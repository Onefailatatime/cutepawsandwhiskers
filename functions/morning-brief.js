const { createClient } = require('@supabase/supabase-js');
const { notifyOwner } = require('./telegram-notify');
const { schedule } = require('@netlify/functions');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function handler() {
  try {
    // Get dashboard stats
    const { data: stats } = await supabase.from('crm_dashboard_stats').select('*').single();

    // Get entries from last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: newEntries } = await supabase
      .from('contest_entries')
      .select('id, full_name, payment_confirmed, total_price')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    // Get payments in last 24h
    const { data: recentPaid } = await supabase
      .from('contest_entries')
      .select('id, full_name, total_price')
      .eq('payment_confirmed', true)
      .gte('payment_confirmed_at', since);

    // Get photos uploaded in last 24h
    const { data: recentPhotos } = await supabase
      .from('contest_entries')
      .select('id')
      .not('photo_url', 'is', null)
      .gte('info_confirmed_at', since);

    // Count entries needing calls
    const { count: needCallsCount } = await supabase
      .from('contest_entries')
      .select('id', { count: 'exact', head: true })
      .eq('payment_confirmed', true)
      .eq('call_status', 'not_called');

    // Count entries missing photos
    const { count: missingPhotos } = await supabase
      .from('contest_entries')
      .select('id', { count: 'exact', head: true })
      .eq('payment_confirmed', true)
      .is('photo_url', null);

    // Count entries pending shipping
    const { count: pendingShipping } = await supabase
      .from('contest_entries')
      .select('id', { count: 'exact', head: true })
      .eq('payment_confirmed', true)
      .eq('shipping_status', 'pending');

    const s = stats || {};
    const newCount = (newEntries || []).length;
    const paidCount = (recentPaid || []).length;
    const paidRevenue = (recentPaid || []).reduce((sum, e) => sum + (parseFloat(e.total_price) || 0), 0);
    const photoCount = (recentPhotos || []).length;

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const message =
      `☀️ <b>MORNING BRIEF — ${today}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 <b>Last 24 Hours</b>\n` +
      `• New entries: <b>${newCount}</b>\n` +
      `• Payments: <b>${paidCount}</b> ($${paidRevenue.toFixed(2)})\n` +
      `• Photos uploaded: <b>${photoCount}</b>\n\n` +
      `💰 <b>All-Time Totals</b>\n` +
      `• Total entries: <b>${s.total_entries || 0}</b>\n` +
      `• Paid entries: <b>${s.paid_entries || 0}</b>\n` +
      `• Total revenue: <b>$${parseFloat(s.total_revenue || 0).toFixed(2)}</b>\n` +
      `• Upsell revenue: <b>$${parseFloat(s.upsell_revenue || 0).toFixed(2)}</b>\n` +
      `• Photos: <b>${s.photos_uploaded || 0}</b>\n` +
      `• Winners: <b>${s.total_winners || 0}</b>/13\n\n` +
      `🔔 <b>Action Items</b>\n` +
      `• Needs upsell call: <b>${needCallsCount || 0}</b>\n` +
      `• Missing photos: <b>${missingPhotos || 0}</b>\n` +
      `• Pending shipping: <b>${pendingShipping || 0}</b>\n\n` +
      `Have a great day! 🐾`;

    await notifyOwner(message);
    console.log('Morning brief sent successfully');

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Morning brief error:', err);
    return { statusCode: 500, body: 'Error' };
  }
}

// Run every day at 8:00 AM EST (13:00 UTC)
exports.handler = schedule('0 13 * * *', handler);
