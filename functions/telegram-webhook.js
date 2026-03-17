const { createClient } = require('@supabase/supabase-js');
const { sendTelegramMessage } = require('./telegram-notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ========== HELPERS ==========

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text, max = 4000) {
  if (!text || text.length <= max) return text;
  return text.substring(0, max) + '\n... (truncated)';
}

async function reply(chatId, text) {
  return sendTelegramMessage(chatId, truncate(text));
}

// ========== COMMAND HANDLERS ==========

async function handleStats(chatId) {
  const { data: stats } = await supabase.from('crm_dashboard_stats').select('*').single();

  if (!stats) {
    return reply(chatId, 'Could not load stats.');
  }

  const msg = `<b>Dashboard Stats</b>

Total Entries: <b>${stats.total_entries || 0}</b>
Paid: <b>${stats.total_paid || 0}</b>
Unpaid: <b>${stats.total_unpaid || 0}</b>
Photos Uploaded: <b>${stats.total_photos || 0}</b>
Winners: <b>${stats.total_winners || 0}</b>

Revenue: <b>$${parseFloat(stats.total_revenue || 0).toFixed(2)}</b>

Shipping:
  Pending: ${stats.shipping_pending || 0}
  Processing: ${stats.shipping_processing || 0}
  Shipped: ${stats.shipping_shipped || 0}
  Delivered: ${stats.shipping_delivered || 0}

Need Calls: ${stats.needs_call || 0}`;

  return reply(chatId, msg);
}

async function handleRecent(chatId, count = 10) {
  const { data: entries } = await supabase
    .from('contest_entries')
    .select('id, full_name, email, pet_name, status, payment_confirmed, photo_url, shipping_status, created_at, total_price')
    .order('created_at', { ascending: false })
    .limit(count);

  if (!entries || entries.length === 0) {
    return reply(chatId, 'No entries found.');
  }

  let msg = `<b>Recent ${entries.length} Entries</b>\n`;
  for (const e of entries) {
    const paid = e.payment_confirmed ? 'Paid' : 'Unpaid';
    const photo = e.photo_url ? 'Has photo' : 'No photo';
    const ship = e.shipping_status || 'pending';
    const date = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    msg += `\n<code>${e.id.substring(0, 8)}</code> ${escapeHtml(e.full_name)}\n  ${paid} | ${photo} | Ship: ${ship} | ${date}`;
  }

  return reply(chatId, msg);
}

async function handleSearch(chatId, query) {
  if (!query) return reply(chatId, 'Usage: /search <name, email, or phone>');

  // Sanitize search input to prevent filter injection
  const sanitized = query.replace(/[%_\\(),.*]/g, '').trim().substring(0, 100);
  if (!sanitized) return reply(chatId, 'Invalid search query.');

  const { data: entries } = await supabase
    .from('contest_entries')
    .select('id, full_name, email, phone, pet_name, pet_type, status, payment_confirmed, photo_url, shipping_status, total_price, created_at')
    .or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,pet_name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!entries || entries.length === 0) {
    return reply(chatId, `No results for "<b>${escapeHtml(query)}</b>"`);
  }

  let msg = `<b>Search: "${escapeHtml(query)}" (${entries.length} results)</b>\n`;
  for (const e of entries) {
    const paid = e.payment_confirmed ? 'Paid' : 'Unpaid';
    const photo = e.photo_url ? 'Has photo' : 'No photo';
    msg += `\n<b>${escapeHtml(e.full_name)}</b> (${escapeHtml(e.pet_name || 'Pending')})
  ID: <code>${e.id}</code>
  ${escapeHtml(e.email)} | ${escapeHtml(e.phone)}
  ${paid} | ${photo} | Ship: ${e.shipping_status || 'pending'}
  Total: $${parseFloat(e.total_price || 36).toFixed(2)}`;
  }

  return reply(chatId, msg);
}

async function handleEntry(chatId, entryId) {
  if (!entryId) return reply(chatId, 'Usage: /entry <id>');

  // Try partial ID match
  let entry;
  if (entryId.length < 36) {
    const { data: entries } = await supabase
      .from('contest_entries')
      .select('*')
      .ilike('id', `${entryId}%`)
      .limit(1);
    entry = entries?.[0];
  } else {
    const { data } = await supabase
      .from('contest_entries')
      .select('*')
      .eq('id', entryId)
      .single();
    entry = data;
  }

  if (!entry) return reply(chatId, 'Entry not found.');

  const { data: items } = await supabase
    .from('order_items')
    .select('item_type, description, total_price')
    .eq('entry_id', entry.id);

  const upsells = (items || []).map(i => `  - ${i.description}: $${i.total_price}`).join('\n') || '  None';

  const msg = `<b>Entry Detail</b>

<b>${escapeHtml(entry.full_name)}</b>
ID: <code>${entry.id}</code>

Contact:
  Email: ${escapeHtml(entry.email)}
  Phone: ${escapeHtml(entry.phone)}
  Address: ${escapeHtml(entry.address_line1)}${entry.address_line2 ? ', ' + escapeHtml(entry.address_line2) : ''}, ${escapeHtml(entry.city)}, ${entry.state} ${entry.zip}

Pet: ${escapeHtml(entry.pet_name || 'Pending')} (${entry.pet_type || 'unknown'})
Photo: ${entry.photo_url ? 'Uploaded' : 'Not uploaded'}

Status: ${entry.status || 'new'} | Payment: ${entry.payment_confirmed ? 'Confirmed' : 'Pending'}
Entry Status: ${entry.entry_status || 'new'}
Shipping: ${entry.shipping_status || 'pending'}${entry.tracking_number ? '\nTracking: ' + entry.tracking_number : ''}

Total: $${parseFloat(entry.total_price || 36).toFixed(2)}
Upsells:
${upsells}

Call Status: ${entry.call_status || 'not_called'}
Winner: ${entry.is_winner ? entry.winner_type + (entry.winner_month ? ' (' + entry.winner_month + ')' : '') : 'No'}
${entry.admin_notes ? '\nNotes: ' + escapeHtml(entry.admin_notes) : ''}
UTM: ${entry.utm_source || '-'} / ${entry.utm_campaign || '-'}`;

  return reply(chatId, msg);
}

async function handleStatus(chatId, args) {
  const parts = args.split(/\s+/);
  const entryId = parts[0];
  const newStatus = parts[1];

  if (!entryId || !newStatus) {
    return reply(chatId, 'Usage: /status <entry_id> <new_status>\n\nStatuses: new, contacted, qualified, won, lost');
  }

  const { data, error } = await supabase
    .from('contest_entries')
    .update({ entry_status: newStatus })
    .ilike('id', `${entryId}%`)
    .select('id, full_name, entry_status')
    .single();

  if (error || !data) return reply(chatId, 'Failed to update. Check the entry ID.');

  await supabase.from('crm_activity_log').insert({
    entry_id: data.id,
    action: 'entry_updated',
    details: { fields: ['entry_status'], values: { entry_status: newStatus }, source: 'telegram' },
  });

  return reply(chatId, `Updated <b>${escapeHtml(data.full_name)}</b> status to: <b>${newStatus}</b>`);
}

async function handleShip(chatId, args) {
  const parts = args.split(/\s+/);
  const entryId = parts[0];
  const tracking = parts.slice(1).join(' ');

  if (!entryId) {
    return reply(chatId, 'Usage: /ship <entry_id> [tracking_number]');
  }

  const updates = {
    shipping_status: 'shipped',
    shipped_at: new Date().toISOString(),
  };
  if (tracking) updates.tracking_number = tracking;

  const { data, error } = await supabase
    .from('contest_entries')
    .update(updates)
    .ilike('id', `${entryId}%`)
    .select('id, full_name')
    .single();

  if (error || !data) return reply(chatId, 'Failed to update. Check the entry ID.');

  await supabase.from('crm_activity_log').insert({
    entry_id: data.id,
    action: 'entry_updated',
    details: { fields: Object.keys(updates), values: updates, source: 'telegram' },
  });

  return reply(chatId, `Marked <b>${escapeHtml(data.full_name)}</b> as shipped${tracking ? '\nTracking: <code>' + escapeHtml(tracking) + '</code>' : ''}`);
}

async function handleNote(chatId, args) {
  const spaceIdx = args.indexOf(' ');
  if (spaceIdx === -1) {
    return reply(chatId, 'Usage: /note <entry_id> <your note text>');
  }

  const entryId = args.substring(0, spaceIdx);
  const noteText = args.substring(spaceIdx + 1).trim();

  // Get current notes
  const { data: existing } = await supabase
    .from('contest_entries')
    .select('id, full_name, admin_notes')
    .ilike('id', `${entryId}%`)
    .single();

  if (!existing) return reply(chatId, 'Entry not found.');

  const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const newNotes = existing.admin_notes
    ? `${existing.admin_notes}\n[${timestamp} via TG] ${noteText}`
    : `[${timestamp} via TG] ${noteText}`;

  const { error } = await supabase
    .from('contest_entries')
    .update({ admin_notes: newNotes })
    .eq('id', existing.id);

  if (error) return reply(chatId, 'Failed to save note.');

  await supabase.from('crm_activity_log').insert({
    entry_id: existing.id,
    action: 'entry_updated',
    details: { fields: ['admin_notes'], note: noteText, source: 'telegram' },
  });

  return reply(chatId, `Note added to <b>${escapeHtml(existing.full_name)}</b>:\n<i>${escapeHtml(noteText)}</i>`);
}

async function handleHelp(chatId) {
  return reply(chatId, `<b>Paws & Whiskers Bot Commands</b>

/stats — Dashboard overview
/recent — Last 10 entries
/search <query> — Search by name, email, phone
/entry <id> — Full entry detail
/status <id> <status> — Update entry status
/ship <id> [tracking] — Mark as shipped
/note <id> <text> — Add a note to entry
/help — Show this message

<i>Or just type a question and I'll answer using AI!</i>`);
}

// ========== CLAUDE AI HANDLER ==========

async function handleAI(chatId, userMessage) {
  if (!ANTHROPIC_API_KEY) {
    return reply(chatId, "AI assistant not configured. Set ANTHROPIC_API_KEY to enable.");
  }

  // Grab quick stats for context
  const { data: stats } = await supabase.from('crm_dashboard_stats').select('*').single();

  const systemPrompt = `You are the AI assistant for "Paws & Whiskers 2027 Calendar Contest" by Hello Pat. You're chatting with the business owner on Telegram.

Current business stats:
- Total entries: ${stats?.total_entries || 0}
- Paid: ${stats?.total_paid || 0}
- Revenue: $${parseFloat(stats?.total_revenue || 0).toFixed(2)}
- Photos uploaded: ${stats?.total_photos || 0}
- Shipped: ${stats?.shipping_shipped || 0}
- Needs calls: ${stats?.needs_call || 0}

The business:
- Pet calendar contest where owners pay $30 + $6 shipping to enter their pet
- Phone upsells: Featured Month ($127), Special Day ($67), Postcard Pack ($29)
- Grand Prize: front cover, custom watercolor framed portrait, free gift box ($200+ value)
- 13 winners total (1 cover + 12 monthly stars)
- Website: cutepawsandwhiskers.com (hosted on Netlify)
- CRM: cutepawsandwhiskers.netlify.app/admin.html
- Database: Supabase
- Payments: Stripe
- Email: Zoho Mail
- Facebook ads with Pixel + Conversions API

Be helpful, concise, and business-focused. If they ask you to do something to the CRM or website, let them know you can help through the CRM commands (/search, /status, /ship, /note, /entry) or explain what changes would be needed. Keep responses brief for Telegram.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await res.json();

    if (data.content && data.content[0]) {
      return reply(chatId, data.content[0].text);
    } else {
      console.error('Claude API unexpected response:', JSON.stringify(data));
      return reply(chatId, 'Sorry, I had trouble processing that. Try again or use a /command.');
    }
  } catch (err) {
    console.error('Claude API error:', err);
    return reply(chatId, 'AI assistant error. Try a /command instead.');
  }
}

// ========== MAIN HANDLER ==========

exports.handler = async function (event) {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: 'OK' };
  }

  // Verify webhook secret (REQUIRED — reject if not set or mismatch)
  const headerSecret = event.headers['x-telegram-bot-api-secret-token'];
  if (!WEBHOOK_SECRET || headerSecret !== WEBHOOK_SECRET) {
    console.warn('Telegram webhook: invalid or missing secret');
    return { statusCode: 200, body: 'OK' };
  }

  try {
    const update = JSON.parse(event.body);
    const message = update.message;

    if (!message || !message.text) {
      return { statusCode: 200, body: 'OK' };
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // Only respond to the owner's chat
    if (CHAT_ID && chatId !== CHAT_ID) {
      console.warn(`Ignoring message from unauthorized chat: ${chatId}`);
      await sendTelegramMessage(chatId, "Sorry, I only respond to authorized users. Contact the admin if you think this is an error.");
      return { statusCode: 200, body: 'OK' };
    }

    // If CHAT_ID not set, report the chat ID so the owner can configure it
    if (!CHAT_ID) {
      await sendTelegramMessage(chatId, `Your Chat ID is: <code>${chatId}</code>\n\nSet this as TELEGRAM_CHAT_ID in your Netlify env vars to authorize this chat.`);
      return { statusCode: 200, body: 'OK' };
    }

    // Route commands
    if (text.startsWith('/')) {
      const spaceIdx = text.indexOf(' ');
      const command = (spaceIdx > 0 ? text.substring(0, spaceIdx) : text).toLowerCase().replace(/@\w+$/, '');
      const args = spaceIdx > 0 ? text.substring(spaceIdx + 1).trim() : '';

      switch (command) {
        case '/start':
        case '/help':
          await handleHelp(chatId);
          break;
        case '/stats':
          await handleStats(chatId);
          break;
        case '/recent':
          await handleRecent(chatId, parseInt(args) || 10);
          break;
        case '/search':
          await handleSearch(chatId, args);
          break;
        case '/entry':
          await handleEntry(chatId, args);
          break;
        case '/status':
          await handleStatus(chatId, args);
          break;
        case '/ship':
          await handleShip(chatId, args);
          break;
        case '/note':
          await handleNote(chatId, args);
          break;
        default:
          await reply(chatId, `Unknown command: ${command}\nType /help to see available commands.`);
      }
    } else {
      // Free-form message → send to Claude AI
      await handleAI(chatId, text);
    }

  } catch (err) {
    console.error('Telegram webhook error:', err);
  }

  // Always return 200 to Telegram
  return { statusCode: 200, body: 'OK' };
};
