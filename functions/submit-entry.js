import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);

    // Basic validation
    const required = ['full_name', 'email', 'phone', 'address_line1', 'city', 'state', 'zip', 'pet_name', 'pet_type'];
    for (const field of required) {
      if (!data[field]?.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: `Missing required field: ${field}` }) };
      }
    }

    if (!['cat', 'dog'].includes(data.pet_type)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'pet_type must be cat or dog' }) };
    }

    // Extract UTM params
    const entry = {
      full_name: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      address_line1: data.address_line1.trim(),
      address_line2: data.address_line2?.trim() || null,
      city: data.city.trim(),
      state: data.state.trim(),
      zip: data.zip.trim(),
      pet_name: data.pet_name.trim(),
      pet_type: data.pet_type,
      special_date: data.special_date || null,
      special_date_label: data.special_date_label?.trim() || null,
      photo_url: data.photo_url || null,
      stripe_payment_id: data.stripe_payment_id || null,
      utm_source: data.utm_source || null,
      utm_medium: data.utm_medium || null,
      utm_campaign: data.utm_campaign || null,
      utm_content: data.utm_content || null,
    };

    const { data: row, error } = await supabase
      .from('contest_entries')
      .insert(entry)
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, entry_id: row.id }),
    };
  } catch (err) {
    console.error('submit-entry error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
}
