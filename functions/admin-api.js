const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ADMIN_KEY = process.env.ADMIN_KEY || 'hellopat2027stats';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function unauthorized() {
  return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
}

function badRequest(msg) {
  return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: msg }) };
}

function ok(data) {
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(data) };
}

function serverError(err) {
  console.error('Admin API error:', err);
  return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Server error' }) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS };
  }

  // Auth check
  const params = event.queryStringParameters || {};
  if (params.key !== ADMIN_KEY) return unauthorized();

  const action = params.action;

  try {
    // ========== GET actions ==========
    if (event.httpMethod === 'GET') {

      // Dashboard stats
      if (action === 'dashboard') {
        const { data: stats } = await supabase.from('crm_dashboard_stats').select('*').single();

        // Recent entries
        const { data: recent } = await supabase
          .from('contest_entries')
          .select('id, full_name, email, pet_name, pet_type, status, payment_confirmed, photo_url, created_at, total_price')
          .order('created_at', { ascending: false })
          .limit(10);

        // Entries needing calls
        const { data: needCalls } = await supabase
          .from('contest_entries')
          .select('id, full_name, phone, email, pet_name, created_at, call_status')
          .eq('payment_confirmed', true)
          .eq('call_status', 'not_called')
          .order('created_at', { ascending: true })
          .limit(20);

        return ok({ stats: stats || {}, recent: recent || [], needCalls: needCalls || [] });
      }

      // List entries with filters
      if (action === 'entries') {
        let query = supabase
          .from('contest_entries')
          .select('*')
          .order('created_at', { ascending: false });

        if (params.status) query = query.eq('status', params.status);
        if (params.payment) query = query.eq('payment_confirmed', params.payment === 'true');
        if (params.has_photo === 'true') query = query.not('photo_url', 'is', null);
        if (params.has_photo === 'false') query = query.is('photo_url', null);
        if (params.winner === 'true') query = query.eq('is_winner', true);
        if (params.call_status) query = query.eq('call_status', params.call_status);
        if (params.entry_status) query = query.eq('entry_status', params.entry_status);
        if (params.search) {
          query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%,pet_name.ilike.%${params.search}%,phone.ilike.%${params.search}%`);
        }

        const limit = parseInt(params.limit) || 50;
        const offset = parseInt(params.offset) || 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) return serverError(error);
        return ok({ entries: data || [], count });
      }

      // Single entry detail with calls and items
      if (action === 'entry') {
        if (!params.id) return badRequest('Missing id');

        const { data: entry } = await supabase
          .from('contest_entries')
          .select('*')
          .eq('id', params.id)
          .single();

        const { data: calls } = await supabase
          .from('upsell_calls')
          .select('*')
          .eq('entry_id', params.id)
          .order('call_datetime', { ascending: false });

        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .eq('entry_id', params.id)
          .order('created_at', { ascending: true });

        const { data: activity } = await supabase
          .from('crm_activity_log')
          .select('*')
          .eq('entry_id', params.id)
          .order('created_at', { ascending: false })
          .limit(50);

        return ok({ entry, calls: calls || [], items: items || [], activity: activity || [] });
      }

      // Winners list
      if (action === 'winners') {
        const { data } = await supabase
          .from('contest_entries')
          .select('id, full_name, email, pet_name, pet_type, photo_url, winner_type, winner_month, is_winner')
          .eq('is_winner', true)
          .order('winner_type', { ascending: true });
        return ok({ winners: data || [] });
      }

      return badRequest('Unknown action');
    }

    // ========== POST/PATCH actions ==========
    if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body || '{}');

      // Update entry fields
      if (action === 'update-entry') {
        if (!body.id) return badRequest('Missing id');
        const allowed = [
          'entry_status', 'is_winner', 'winner_type', 'winner_month',
          'call_status', 'admin_notes', 'total_price', 'pet_name', 'pet_type',
          'full_name', 'email', 'phone', 'address_line1', 'address_line2',
          'city', 'state', 'zip'
        ];
        const updates = {};
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }

        const { data, error } = await supabase
          .from('contest_entries')
          .update(updates)
          .eq('id', body.id)
          .select()
          .single();

        if (error) return serverError(error);

        // Log activity
        await supabase.from('crm_activity_log').insert({
          entry_id: body.id,
          action: 'entry_updated',
          details: { fields: Object.keys(updates), values: updates },
        });

        return ok({ success: true, entry: data });
      }

      // Log a call
      if (action === 'log-call') {
        if (!body.entry_id || !body.outcome) return badRequest('Missing entry_id or outcome');

        const { data: call, error } = await supabase
          .from('upsell_calls')
          .insert({
            entry_id: body.entry_id,
            outcome: body.outcome,
            notes: body.notes || '',
            call_datetime: body.call_datetime || new Date().toISOString(),
          })
          .select()
          .single();

        if (error) return serverError(error);

        // Update call_status on entry
        await supabase
          .from('contest_entries')
          .update({ call_status: 'called' })
          .eq('id', body.entry_id);

        // Log activity
        await supabase.from('crm_activity_log').insert({
          entry_id: body.entry_id,
          action: 'call_logged',
          details: { outcome: body.outcome, notes: body.notes },
        });

        return ok({ success: true, call });
      }

      // Add upsell item
      if (action === 'add-upsell') {
        if (!body.entry_id || !body.item_type) return badRequest('Missing entry_id or item_type');

        const UPSELL_PRICES = {
          featured_month: { price: 127, desc: 'Featured Month Package' },
          special_day: { price: 67, desc: 'Special Day Upgrade' },
          postcard_pack: { price: 29, desc: 'Postcard Pack' },
        };

        const upsell = UPSELL_PRICES[body.item_type];
        if (!upsell) return badRequest('Invalid item_type');

        const unitPrice = body.unit_price || upsell.price;

        const { data: item, error } = await supabase
          .from('order_items')
          .insert({
            entry_id: body.entry_id,
            item_type: body.item_type,
            description: body.description || upsell.desc,
            unit_price: unitPrice,
            total_price: unitPrice,
          })
          .select()
          .single();

        if (error) return serverError(error);

        // Update total_price on entry
        const { data: allItems } = await supabase
          .from('order_items')
          .select('total_price')
          .eq('entry_id', body.entry_id);

        const upsellTotal = (allItems || []).reduce((sum, i) => sum + parseFloat(i.total_price), 0);

        await supabase
          .from('contest_entries')
          .update({ total_price: 36 + upsellTotal })
          .eq('id', body.entry_id);

        // Log activity
        await supabase.from('crm_activity_log').insert({
          entry_id: body.entry_id,
          action: 'upsell_added',
          details: { item_type: body.item_type, price: unitPrice },
        });

        return ok({ success: true, item });
      }

      // Remove upsell item
      if (action === 'remove-upsell') {
        if (!body.item_id || !body.entry_id) return badRequest('Missing item_id or entry_id');

        const { error } = await supabase
          .from('order_items')
          .delete()
          .eq('id', body.item_id);

        if (error) return serverError(error);

        // Recalculate total
        const { data: allItems } = await supabase
          .from('order_items')
          .select('total_price')
          .eq('entry_id', body.entry_id);

        const upsellTotal = (allItems || []).reduce((sum, i) => sum + parseFloat(i.total_price), 0);

        await supabase
          .from('contest_entries')
          .update({ total_price: 36 + upsellTotal })
          .eq('id', body.entry_id);

        return ok({ success: true });
      }

      // Assign winner
      if (action === 'assign-winner') {
        if (!body.id || !body.winner_type) return badRequest('Missing id or winner_type');

        const updates = {
          is_winner: body.winner_type !== 'none',
          winner_type: body.winner_type,
          winner_month: body.winner_month || null,
          entry_status: 'accepted',
        };

        const { data, error } = await supabase
          .from('contest_entries')
          .update(updates)
          .eq('id', body.id)
          .select()
          .single();

        if (error) return serverError(error);

        await supabase.from('crm_activity_log').insert({
          entry_id: body.id,
          action: 'winner_assigned',
          details: { winner_type: body.winner_type, winner_month: body.winner_month },
        });

        return ok({ success: true, entry: data });
      }

      return badRequest('Unknown action');
    }

    return badRequest('Method not supported');
  } catch (err) {
    return serverError(err);
  }
};
