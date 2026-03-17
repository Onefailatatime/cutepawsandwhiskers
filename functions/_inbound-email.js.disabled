const { createClient } = require('@supabase/supabase-js');
const { notifyOwner } = require('./telegram-notify');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * Inbound email webhook handler
 * Receives forwarded email replies from Resend (or any inbound email provider)
 * Parses photo attachments and associates them with the sender's entry
 */
exports.handler = async function (event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);

    // Resend inbound email webhook format
    // data.from, data.to, data.subject, data.text, data.html, data.attachments[]
    const senderEmail = extractEmail(data.from);
    const bodyText = data.text || data.html || '';
    const attachments = data.attachments || [];

    if (!senderEmail) {
      console.log('No sender email found');
      return { statusCode: 200, body: 'OK - no sender' };
    }

    console.log(`Inbound email from: ${senderEmail}, attachments: ${attachments.length}`);

    // Find the entry by email
    const { data: entry, error: lookupErr } = await supabase
      .from('contest_entries')
      .select('id, email, pet_name, photo_url')
      .eq('email', senderEmail.toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lookupErr || !entry) {
      console.log(`No entry found for email: ${senderEmail}`);
      return { statusCode: 200, body: 'OK - no entry found' };
    }

    // Process image attachments
    const imageAttachment = attachments.find(att =>
      att.content_type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|heic|heif)$/i.test(att.filename || '')
    );

    if (!imageAttachment) {
      console.log('No image attachment found in email');
      return { statusCode: 200, body: 'OK - no image attachment' };
    }

    // Decode attachment (base64 encoded)
    const buffer = Buffer.from(imageAttachment.content, 'base64');
    const ext = (imageAttachment.filename || 'photo.jpg').split('.').pop().toLowerCase();
    const fileName = `${entry.id}_email_${Date.now()}.${ext}`;
    const filePath = `uploads/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('pet-photos')
      .upload(filePath, buffer, {
        contentType: imageAttachment.content_type || 'image/jpeg',
        upsert: false,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return { statusCode: 200, body: 'OK - upload failed' };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('pet-photos')
      .getPublicUrl(filePath);

    const photoUrl = urlData.publicUrl;

    // Try to parse pet name and type from email body
    let petName = entry.pet_name;
    let petType = null;

    if (bodyText) {
      // Simple parsing: look for pet name mentions
      const nameMatch = bodyText.match(/(?:pet'?s?\s*name|name\s*(?:is|:))\s*[:\-]?\s*([A-Za-z]+)/i);
      if (nameMatch) petName = nameMatch[1];

      // Check for cat/dog mentions
      if (/\bcat\b/i.test(bodyText)) petType = 'cat';
      else if (/\bdog\b/i.test(bodyText)) petType = 'dog';
    }

    // Update entry
    const updateData = {
      photo_url: photoUrl,
      info_confirmed: true,
      info_confirmed_at: new Date().toISOString(),
    };
    if (petName && petName !== 'Pending') updateData.pet_name = petName;
    if (petType) updateData.pet_type = petType;

    const { error: updateErr } = await supabase
      .from('contest_entries')
      .update(updateData)
      .eq('id', entry.id);

    if (updateErr) {
      console.error('DB update error:', updateErr);
    } else {
      console.log(`Photo uploaded via email reply for entry ${entry.id}`);

      // Log in activity log
      await supabase.from('crm_activity_log').insert({
        entry_id: entry.id,
        action: 'email_received',
        details: {
          from: senderEmail,
          subject: data.subject || '(no subject)',
          has_photo: true,
          pet_name: petName,
          pet_type: petType,
        },
      });

      // Notify owner via Telegram
      notifyOwner(
        `📧 <b>INBOUND EMAIL</b>\n\n` +
        `From: <b>${senderEmail}</b>\n` +
        `Subject: ${data.subject || '(no subject)'}\n` +
        `📸 Photo attached & uploaded!\n` +
        (petName ? `Pet: ${petName}\n` : '') +
        `Entry: <code>${entry.id}</code>`
      ).catch(err => console.error('Telegram notify error:', err));
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('inbound-email error:', err);
    return { statusCode: 200, body: 'OK - error handled' };
  }
};

/**
 * Extract email address from a "Name <email>" format string
 */
function extractEmail(fromStr) {
  if (!fromStr) return null;
  const match = fromStr.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  if (fromStr.includes('@')) return fromStr.trim().toLowerCase();
  return null;
}
