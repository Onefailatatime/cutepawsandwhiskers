const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth via Authorization header (preferred) or query param key (legacy)
  const authHeader = event.headers['authorization'] || '';
  const headerKey = authHeader.replace('Bearer ', '');
  const queryKey = event.queryStringParameters?.key;
  const providedKey = headerKey || queryKey || '';
  const expectedKey = process.env.ADMIN_KEY || '';

  // Constant-time comparison
  if (!providedKey || !expectedKey ||
      providedKey.length !== expectedKey.length ||
      !crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
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

    // Return ONLY aggregated stats — never raw entry data with PII
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
      }),
    };
  } catch (err) {
    console.error('get-stats error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
