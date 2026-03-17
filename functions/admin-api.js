const { createClient } = require('@supabase/supabase-js');
const { verifyToken } = require('./admin-login');
const nodemailer = require('nodemailer');
const { notifyOwner } = require('./telegram-notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

  // Auth check — verify session token from Authorization header or query param
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '') || (event.queryStringParameters || {}).token;
  if (!token || !verifyToken(token)) return unauthorized();

  const params = event.queryStringParameters || {};
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
          .select('id, full_name, email, pet_name, pet_type, status, payment_confirmed, photo_url, created_at, total_price, shipping_status')
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
        if (params.shipping_status) query = query.eq('shipping_status', params.shipping_status);
        if (params.campaign_id) query = query.eq('campaign_id', params.campaign_id);
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

        // Get campaign name if linked
        let campaign = null;
        if (entry && entry.campaign_id) {
          const { data: c } = await supabase
            .from('ad_campaigns')
            .select('id, name, platform')
            .eq('id', entry.campaign_id)
            .single();
          campaign = c;
        }

        return ok({ entry, calls: calls || [], items: items || [], activity: activity || [], campaign });
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

      // ===== CAMPAIGNS =====
      if (action === 'campaigns') {
        const { data } = await supabase
          .from('campaign_stats')
          .select('*')
          .order('created_at', { ascending: false });
        return ok({ campaigns: data || [] });
      }

      if (action === 'campaign') {
        if (!params.id) return badRequest('Missing id');
        const { data: campaign } = await supabase
          .from('ad_campaigns')
          .select('*')
          .eq('id', params.id)
          .single();

        // Get entries linked to this campaign
        const { data: entries } = await supabase
          .from('contest_entries')
          .select('id, full_name, email, pet_name, payment_confirmed, total_price, shipping_status, created_at')
          .eq('campaign_id', params.id)
          .order('created_at', { ascending: false });

        return ok({ campaign, entries: entries || [] });
      }

      // List all campaigns (for dropdown)
      if (action === 'campaigns-list') {
        const { data } = await supabase
          .from('ad_campaigns')
          .select('id, name, platform, status')
          .order('created_at', { ascending: false });
        return ok({ campaigns: data || [] });
      }

      // Email history for an entry
      if (action === 'email-history') {
        if (!params.id) return badRequest('Missing id');
        const { data } = await supabase
          .from('crm_activity_log')
          .select('*')
          .eq('entry_id', params.id)
          .in('action', ['email_sent', 'email_received'])
          .order('created_at', { ascending: false })
          .limit(50);
        return ok({ emails: data || [] });
      }

      // Upsell products list
      if (action === 'upsell-products') {
        const { data } = await supabase
          .from('upsell_products')
          .select('*')
          .order('sort_order', { ascending: true });
        return ok({ products: data || [] });
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
          'city', 'state', 'zip', 'shipping_status', 'tracking_number',
          'campaign_id', 'refund_reason', 'special_date_label'
        ];
        const updates = {};
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }

        // Auto-set timestamps
        if (updates.shipping_status === 'shipped' && !body.shipped_at) {
          updates.shipped_at = new Date().toISOString();
        }
        if (updates.shipping_status === 'refunded' && !body.refunded_at) {
          updates.refunded_at = new Date().toISOString();
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

      // Add upsell item (now reads from upsell_products table)
      if (action === 'add-upsell') {
        if (!body.entry_id || !body.item_type) return badRequest('Missing entry_id or item_type');

        // Look up the product from the database
        const { data: product } = await supabase
          .from('upsell_products')
          .select('*')
          .eq('slug', body.item_type)
          .single();

        if (!product) return badRequest('Invalid item_type — product not found');

        const unitPrice = body.unit_price || product.price;

        const { data: item, error } = await supabase
          .from('order_items')
          .insert({
            entry_id: body.entry_id,
            item_type: body.item_type,
            description: body.description || product.description || product.name,
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

      // ===== CAMPAIGN CRUD =====
      if (action === 'create-campaign') {
        if (!body.name) return badRequest('Missing campaign name');
        const { data, error } = await supabase
          .from('ad_campaigns')
          .insert({
            name: body.name,
            platform: body.platform || 'facebook',
            status: body.status || 'draft',
            headline: body.headline || '',
            ad_copy: body.ad_copy || '',
            description: body.description || '',
            cta_text: body.cta_text || '',
            image_url: body.image_url || '',
            target_audience: body.target_audience || '',
            daily_budget: body.daily_budget || 0,
            total_spend: body.total_spend || 0,
            utm_campaign: body.utm_campaign || '',
            utm_source: body.utm_source || '',
            utm_medium: body.utm_medium || '',
            utm_content: body.utm_content || '',
            fb_ad_id: body.fb_ad_id || '',
            fb_adset_id: body.fb_adset_id || '',
            fb_campaign_id: body.fb_campaign_id || '',
            notes: body.notes || '',
            start_date: body.start_date || null,
            end_date: body.end_date || null,
          })
          .select()
          .single();

        if (error) return serverError(error);
        return ok({ success: true, campaign: data });
      }

      if (action === 'update-campaign') {
        if (!body.id) return badRequest('Missing id');
        const allowed = [
          'name', 'platform', 'status', 'headline', 'ad_copy', 'description',
          'cta_text', 'image_url', 'target_audience', 'daily_budget', 'total_spend',
          'utm_campaign', 'utm_source', 'utm_medium', 'utm_content',
          'fb_ad_id', 'fb_adset_id', 'fb_campaign_id', 'notes',
          'start_date', 'end_date'
        ];
        const updates = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }

        const { data, error } = await supabase
          .from('ad_campaigns')
          .update(updates)
          .eq('id', body.id)
          .select()
          .single();

        if (error) return serverError(error);
        return ok({ success: true, campaign: data });
      }

      if (action === 'delete-campaign') {
        if (!body.id) return badRequest('Missing id');
        // Unlink entries first
        await supabase
          .from('contest_entries')
          .update({ campaign_id: null })
          .eq('campaign_id', body.id);

        const { error } = await supabase
          .from('ad_campaigns')
          .delete()
          .eq('id', body.id);

        if (error) return serverError(error);
        return ok({ success: true });
      }

      // Link entry to campaign
      if (action === 'link-campaign') {
        if (!body.entry_id || !body.campaign_id) return badRequest('Missing entry_id or campaign_id');
        const { error } = await supabase
          .from('contest_entries')
          .update({ campaign_id: body.campaign_id })
          .eq('id', body.entry_id);

        if (error) return serverError(error);
        return ok({ success: true });
      }

      // Auto-link entries by UTM match
      if (action === 'auto-link-campaign') {
        if (!body.campaign_id || !body.utm_campaign) return badRequest('Missing campaign_id or utm_campaign');
        const { data, error } = await supabase
          .from('contest_entries')
          .update({ campaign_id: body.campaign_id })
          .eq('utm_campaign', body.utm_campaign)
          .is('campaign_id', null)
          .select('id');

        if (error) return serverError(error);
        return ok({ success: true, linked: (data || []).length });
      }

      // ===== UPLOAD CAMPAIGN IMAGE =====
      if (action === 'upload-campaign-image') {
        if (!body.photo_base64) return badRequest('Missing photo_base64');

        const buffer = Buffer.from(body.photo_base64, 'base64');
        const ext = body.file_name?.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `campaign_${Date.now()}.${ext}`;
        const filePath = `campaigns/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('pet-photos')
          .upload(filePath, buffer, {
            contentType: body.file_type || 'image/jpeg',
            upsert: false,
          });

        if (uploadErr) return serverError(uploadErr);

        const { data: urlData } = supabase.storage
          .from('pet-photos')
          .getPublicUrl(filePath);

        return ok({ success: true, image_url: urlData.publicUrl });
      }

      // ===== SEND EMAIL FROM CRM =====
      if (action === 'send-email') {
        if (!body.entry_id || !body.to || !body.subject || !body.html) {
          return badRequest('Missing entry_id, to, subject, or html');
        }

        try {
          const transporter = nodemailer.createTransport({
            host: 'smtp.zoho.com',
            port: 465,
            secure: true,
            auth: {
              user: process.env.ZOHO_EMAIL,
              pass: process.env.ZOHO_APP_PASSWORD,
            },
          });

          await transporter.sendMail({
            from: '"Paws & Whiskers" <' + process.env.ZOHO_EMAIL + '>',
            to: body.to,
            replyTo: process.env.ZOHO_EMAIL,
            subject: body.subject,
            html: body.html,
          });

          // Log email in activity log
          await supabase.from('crm_activity_log').insert({
            entry_id: body.entry_id,
            action: 'email_sent',
            details: {
              type: 'manual_email',
              to: body.to,
              subject: body.subject,
              body_preview: body.html.replace(/<[^>]+>/g, '').substring(0, 200),
            },
          });

          // Notify owner via Telegram
          notifyOwner(
            `📤 <b>EMAIL SENT</b>\n\n` +
            `To: ${body.to}\n` +
            `Subject: ${body.subject}\n` +
            `Entry: <code>${body.entry_id}</code>`
          ).catch(() => {});

          return ok({ success: true });
        } catch (emailErr) {
          console.error('Send email error:', emailErr);
          return serverError({ message: 'Failed to send email: ' + emailErr.message });
        }
      }

      // ===== DELETE ENTRY =====
      if (action === 'delete-entry') {
        if (!body.id) return badRequest('Missing id');

        // Delete related records first
        await supabase.from('order_items').delete().eq('entry_id', body.id);
        await supabase.from('upsell_calls').delete().eq('entry_id', body.id);
        await supabase.from('crm_activity_log').delete().eq('entry_id', body.id);

        // Delete the entry itself
        const { error } = await supabase
          .from('contest_entries')
          .delete()
          .eq('id', body.id);

        if (error) return serverError(error);
        return ok({ success: true });
      }

      // ===== UPLOAD PHOTO (admin manual upload) =====
      if (action === 'upload-photo') {
        if (!body.entry_id || !body.photo_base64) return badRequest('Missing entry_id or photo_base64');

        const buffer = Buffer.from(body.photo_base64, 'base64');
        const ext = body.file_name?.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${body.entry_id}_admin_${Date.now()}.${ext}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadErr } = await supabase.storage
          .from('pet-photos')
          .upload(filePath, buffer, {
            contentType: body.file_type || 'image/jpeg',
            upsert: false,
          });

        if (uploadErr) return serverError(uploadErr);

        const { data: urlData } = supabase.storage
          .from('pet-photos')
          .getPublicUrl(filePath);

        const photoUrl = urlData.publicUrl;

        // Update entry with photo URL
        const { data: entry, error: updateErr } = await supabase
          .from('contest_entries')
          .update({ photo_url: photoUrl })
          .eq('id', body.entry_id)
          .select()
          .single();

        if (updateErr) return serverError(updateErr);

        await supabase.from('crm_activity_log').insert({
          entry_id: body.entry_id,
          action: 'photo_uploaded',
          details: { source: 'admin_manual', photo_url: photoUrl },
        });

        return ok({ success: true, photo_url: photoUrl, entry });
      }

      // ===== UPSELL PRODUCT CRUD =====
      if (action === 'create-upsell-product') {
        if (!body.name || !body.slug || !body.price) return badRequest('Missing name, slug, or price');
        const { data, error } = await supabase
          .from('upsell_products')
          .insert({
            name: body.name,
            slug: body.slug,
            description: body.description || '',
            price: parseFloat(body.price),
            is_active: body.is_active !== false,
            sort_order: body.sort_order || 0,
          })
          .select()
          .single();

        if (error) return serverError(error);
        return ok({ success: true, product: data });
      }

      if (action === 'update-upsell-product') {
        if (!body.id) return badRequest('Missing id');
        const allowed = ['name', 'slug', 'description', 'price', 'is_active', 'sort_order'];
        const updates = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
          if (body[key] !== undefined) updates[key] = body[key];
        }
        if (updates.price) updates.price = parseFloat(updates.price);

        const { data, error } = await supabase
          .from('upsell_products')
          .update(updates)
          .eq('id', body.id)
          .select()
          .single();

        if (error) return serverError(error);
        return ok({ success: true, product: data });
      }

      if (action === 'delete-upsell-product') {
        if (!body.id) return badRequest('Missing id');
        const { error } = await supabase
          .from('upsell_products')
          .delete()
          .eq('id', body.id);

        if (error) return serverError(error);
        return ok({ success: true });
      }

      return badRequest('Unknown action');
    }

    return badRequest('Method not supported');
  } catch (err) {
    return serverError(err);
  }
};
