const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const SITE_URL = process.env.URL || 'https://cutepawsandwhiskers.com';

// Zoho Mail SMTP transporter
function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.ZOHO_EMAIL,       // orders@cutepawsandwhiskers.com
      pass: process.env.ZOHO_APP_PASSWORD, // App-specific password from Zoho
    },
  });
}

async function sendWelcomeEmail(entry) {
  const uploadLink = `${SITE_URL}/upload.html?token=${entry.upload_token}`;
  const firstName = entry.first_name || entry.full_name.split(' ')[0];

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
      <div style="background: linear-gradient(to right, #f97316, #ec4899); padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
        <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 32px;">🐾</span>
        </div>
        <h1 style="color: white; font-size: 24px; margin: 0;">Welcome to Paws &amp; Whiskers!</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Your entry is confirmed — now let's get your pet in the calendar!</p>
      </div>

      <div style="padding: 32px; border: 1px solid #f3e8ff; border-top: 0; border-radius: 0 0 16px 16px;">
        <p style="font-size: 16px; color: #374151;">Hi ${firstName}! 🎉</p>

        <p style="font-size: 16px; color: #374151; line-height: 1.6;">
          Thank you for entering the <strong>Paws &amp; Whiskers 2027 Calendar Contest</strong>! We're so excited to feature your fur baby.
        </p>

        <div style="background: #fff7ed; border: 2px solid #fed7aa; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="font-size: 18px; color: #9a3412; margin: 0 0 12px;">📸 Next Step: Upload Your Pet's Photo</h2>
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.5;">
            Click the button below to upload your pet's cutest photo and confirm your details. This is how we'll feature your pet in the calendar!
          </p>
          <a href="${uploadLink}" style="display: inline-block; background: linear-gradient(to right, #f97316, #ec4899); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Upload My Pet's Photo →
          </a>
        </div>

        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="font-size: 16px; color: #111827; margin: 0 0 12px;">📋 Please Confirm Your Info</h3>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 4px 0; font-weight: 600;">Name:</td><td>${entry.full_name}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Email:</td><td>${entry.email}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Phone:</td><td>${entry.phone}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: 600;">Address:</td><td>${entry.address_line1}${entry.address_line2 ? ', ' + entry.address_line2 : ''}, ${entry.city}, ${entry.state} ${entry.zip}</td></tr>
          </table>
          <p style="font-size: 13px; color: #6b7280; margin: 12px 0 0;">
            If anything is wrong, just reply to this email and let us know!
          </p>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          <strong>Prefer to reply instead?</strong> You can also just reply to this email and attach your pet's best photo. Include your pet's name and whether they're a cat or dog — we'll take care of the rest!
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="font-size: 13px; color: #9ca3af; text-align: center;">
          Paws &amp; Whiskers 2027 Calendar Contest<br>
          Presented by Hello Pat<br>
          <a href="mailto:orders@cutepawsandwhiskers.com" style="color: #f97316;">orders@cutepawsandwhiskers.com</a>
        </p>
      </div>
    </div>
  `;

  const transporter = getTransporter();

  await transporter.sendMail({
    from: '"Paws & Whiskers" <orders@cutepawsandwhiskers.com>',
    to: entry.email,
    replyTo: 'orders@cutepawsandwhiskers.com',
    subject: `🐾 Welcome ${firstName}! Upload your pet's photo to complete your entry`,
    html,
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const stripeEvent = JSON.parse(event.body);

    // Handle checkout.session.completed
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const entryId = session.client_reference_id;
      const paymentId = session.payment_intent || session.id;

      if (!entryId) {
        console.log('No client_reference_id, skipping');
        return { statusCode: 200, body: 'OK - no entry ID' };
      }

      // Update entry with payment confirmation
      const { data: entry, error: updateErr } = await supabase
        .from('contest_entries')
        .update({
          stripe_payment_id: paymentId,
          payment_confirmed: true,
          payment_confirmed_at: new Date().toISOString(),
          status: 'paid',
        })
        .eq('id', entryId)
        .select()
        .single();

      if (updateErr) {
        console.error('DB update error:', updateErr);
        return { statusCode: 200, body: 'DB error but 200 to prevent retry' };
      }

      // Send welcome email
      try {
        await sendWelcomeEmail(entry);
        await supabase
          .from('contest_entries')
          .update({ welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() })
          .eq('id', entryId);
        console.log(`Welcome email sent to ${entry.email}`);
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        // Don't fail the webhook — we can resend manually
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, body: 'Error but 200 to prevent retry' };
  }
};
