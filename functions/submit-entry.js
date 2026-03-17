const { createClient } = require('@supabase/supabase-js');
const { sendEvent } = require('./fb-capi');
const { notifyOwner } = require('./telegram-notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);

    // Validate required
    const required = ['full_name', 'email', 'phone', 'address_line1', 'city', 'state', 'zip'];
    for (const field of required) {
      if (!data[field]?.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: `Missing: ${field}` }) };
      }
    }

    // Split name for first/last
    const nameParts = data.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Get client IP and user agent from request headers
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['x-nf-client-connection-ip']
      || event.headers['client-ip']
      || null;
    const clientUserAgent = event.headers['user-agent'] || null;

    const entry = {
      full_name: data.full_name.trim(),
      first_name: firstName,
      last_name: lastName,
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      address_line1: data.address_line1.trim(),
      address_line2: data.address_line2?.trim() || null,
      city: data.city.trim(),
      state: data.state.trim().toUpperCase(),
      zip: data.zip.trim(),
      pet_name: data.pet_name?.trim() || 'Pending',
      pet_type: data.pet_type || 'dog',
      special_date_label: data.special_date_label?.trim() || null,
      birth_month: data.special_date?.split('-')[0] || null,
      birth_day: data.special_date?.split('-')[1] || null,
      photo_url: data.photo_url || null,
      stripe_payment_id: data.stripe_payment_id || null,
      utm_source: data.utm_source || null,
      utm_medium: data.utm_medium || null,
      utm_campaign: data.utm_campaign || null,
      utm_content: data.utm_content || null,
      // Facebook Pixel / CAPI fields
      fb_click_id: data.fbc || null,
      fb_browser_id: data.fbp || null,
      client_ip: clientIp,
      client_user_agent: clientUserAgent,
    };

    const { data: row, error } = await supabase
      .from('contest_entries')
      .insert(entry)
      .select()
      .single();

    if (error) throw error;

    // Fire Facebook Conversions API — Lead event
    const eventId = `Lead_${row.id}`;
    sendEvent({
      event_name: 'Lead',
      event_id: eventId,
      event_source_url: data.event_source_url || 'https://cutepawsandwhiskers.com',
      user_data: {
        email: entry.email,
        phone: entry.phone,
        first_name: firstName,
        last_name: lastName,
        zip: entry.zip,
        fbc: data.fbc || null,
        fbp: data.fbp || null,
        client_ip: clientIp,
        client_user_agent: clientUserAgent,
      },
      custom_data: {
        content_name: 'Paws & Whiskers 2027 Calendar Contest Entry',
        content_category: 'contest_entry',
      },
    }).catch(err => console.error('FB Lead event error:', err));

    // Telegram notification
    notifyOwner(
      `🐾 <b>New Entry Submitted</b>\n\n` +
      `<b>${row.full_name}</b>\n` +
      `${row.email} | ${row.phone}\n` +
      `${row.city}, ${row.state}\n\n` +
      `ID: <code>${row.id}</code>\n` +
      `Status: Awaiting payment`
    ).catch(err => console.error('Telegram notify error:', err));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, entry_id: row.id, fb_event_id: eventId }),
    };
  } catch (err) {
    console.error('submit-entry error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
