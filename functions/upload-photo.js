const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { token, pet_name, pet_type, special_date_label, photo_base64, photo_name, photo_type } = data;

    if (!token || !pet_name || !pet_type || !photo_base64) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Look up entry by token
    const { data: entry, error: lookupErr } = await supabase
      .from('contest_entries')
      .select('id, email')
      .eq('upload_token', token)
      .single();

    if (lookupErr || !entry) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid upload token' }),
      };
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(photo_base64, 'base64');

    // Determine file extension
    const ext = photo_name?.split('.').pop()?.toLowerCase() || 'jpg';
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Failed to save entry' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, photo_url: photoUrl }),
    };
  } catch (err) {
    console.error('upload-photo error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Server error' }),
    };
  }
};
