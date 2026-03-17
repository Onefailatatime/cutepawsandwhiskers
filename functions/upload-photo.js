const { createClient } = require('@supabase/supabase-js');
const { notifyOwner } = require('./telegram-notify');

function escapeHtml(t) { return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_ORIGIN = process.env.URL || 'https://cutepawsandwhiskers.com';
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Rate limiter (per upload token — 3 uploads per 5 min)
const uploadRateMap = new Map();
function isUploadLimited(tkn) {
  const now = Date.now();
  const record = uploadRateMap.get(tkn);
  if (!record || now - record.start > 300000) {
    uploadRateMap.set(tkn, { start: now, count: 1 });
    return false;
  }
  record.count++;
  return record.count > 3;
}

// Allowed image extensions
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];

exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { token, pet_name, pet_type, special_date_label, photo_base64, photo_name, photo_type } = data;

    if (!token || !pet_name || !pet_type || !photo_base64) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Rate limit by token
    if (isUploadLimited(token)) {
      return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Too many uploads. Please try again later.' }) };
    }

    // Server-side file size limit (10MB)
    if (photo_base64.length > 10 * 1024 * 1024 * 1.37) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'File too large (max 10MB)' }) };
    }

    // Look up entry by token
    const { data: entry, error: lookupErr } = await supabase
      .from('contest_entries')
      .select('id, email')
      .eq('upload_token', token)
      .single();

    if (lookupErr || !entry) {
      return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid upload token' }) };
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(photo_base64, 'base64');

    // Validate file extension — only allow safe image types
    const rawExt = photo_name?.split('.').pop()?.toLowerCase() || 'jpg';
    const ext = ALLOWED_EXT.includes(rawExt) ? rawExt : 'jpg';
    const fileName = `${entry.id}_${Date.now()}.${ext}`;
    const filePath = `uploads/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('pet-photos')
      .upload(filePath, buffer, {
        contentType: photo_type || 'image/jpeg',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: 'Failed to upload photo' }),
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('pet-photos')
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Update entry with pet details and photo
    const { error: updateErr } = await supabase
      .from('contest_entries')
      .update({
        pet_name: pet_name.trim(),
        pet_type,
        special_date_label: special_date_label || null,
        photo_url: photoUrl,
        info_confirmed: true,
        info_confirmed_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    if (updateErr) {
      console.error('DB update error:', updateErr);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
        body: JSON.stringify({ error: 'Failed to save entry' }),
      };
    }

    // Telegram notification
    notifyOwner(
      `📸 <b>Photo Uploaded!</b>\n\n` +
      `Pet: <b>${escapeHtml(pet_name)}</b> (${pet_type})\n` +
      `Entry: <code>${entry.id}</code>\n` +
      `Email: ${entry.email}`
    ).catch(err => console.error('Telegram notify error:', err));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ success: true, photo_url: photoUrl }),
    };
  } catch (err) {
    console.error('upload-photo error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
};
