import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Simple auth check — pass ?key=YOUR_ADMIN_KEY
  const key = event.queryStringParameters?.key;
  if (key !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // Total entries
    const { count: totalEntries } = await supabase
      .from('contest_entries')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'refunded');

    // Front-end revenue
    const { data: feRev } = await supabase
      .rpc('', {}).catch(() => null) || { data: null };

    // Use the view for full stats
    const { data: entries, error } = await supabase
      .from('entry_revenue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const totalFrontEnd = entries.reduce((s, e) => s + Number(e.front_end_revenue), 0);
    const totalUpsell = entries.reduce((s, e) => s + Number(e.upsell_revenue), 0);
    const totalRevenue = totalFrontEnd + totalUpsell;
    const reached = entries.filter(e => e.reached).length;
    const withUpsells = entries.filter(e => e.upsell_count > 0).length;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_entries: entries.length,
        total_front_end: totalFrontEnd,
        total_upsell: totalUpsell,
        total_revenue: totalRevenue,
        avg_revenue_per_entry: entries.length ? (totalRevenue / entries.length).toFixed(2) : 0,
        reached_count: reached,
        reach_rate: entries.length ? ((reached / entries.length) * 100).toFixed(1) + '%' : '0%',
        upsell_count: withUpsells,
        upsell_take_rate: reached ? ((withUpsells / reached) * 100).toFixed(1) + '%' : '0%',
        entries,
      }),
    };
  } catch (err) {
    console.error('get-stats error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}
