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
          Thank you for entering the <strong>Paws &amp; Whiskers 2027 Calendar Contest</strong>! We're so excited to feature your fur baby. There's just one more step — we need your pet's best photo!
        </p>

        <!-- UPLOAD CTA -->
        <div style="background: #fff7ed; border: 2px solid #fed7aa; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="font-size: 18px; color: #9a3412; margin: 0 0 12px;">📸 Upload Your Pet's Photo</h2>
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.5;">
            Click the button below to upload your pet's cutest photo. This is the photo we'll use in the calendar — so make it a good one!
          </p>
          <a href="${uploadLink}" style="display: inline-block; background: linear-gradient(to right, #f97316, #ec4899); color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Upload My Pet's Photo →
          </a>
          <p style="font-size: 12px; color: #9a3412; margin: 16px 0 0; font-style: italic;">
            Or reply to this email with your photo attached — include your pet's name and if they're a dog or cat.
          </p>
        </div>

        <!-- IMPORTANT RULES -->
        <div style="background: #fef2f2; border: 2px solid #fecaca; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="font-size: 18px; color: #991b1b; margin: 0 0 12px;">⚠️ Important — Please Read</h2>
          <ul style="font-size: 14px; color: #374151; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li><strong>Pets only — no people.</strong> Your photo must only contain your pet. Photos with people in them will not be accepted.</li>
            <li><strong>Your photo is final.</strong> Once you submit your photo, it cannot be changed, swapped, or replaced. Please make sure you love it before uploading!</li>
            <li><strong>Image rights.</strong> By submitting your photo, you grant Hello Pat permission to use this image in the Paws &amp; Whiskers calendar, promotional materials, social media, and other related publications.</li>
            <li><strong>No refunds.</strong> All entries are final and non-refundable after submission.</li>
            <li><strong>Must be 18+.</strong> This contest is open to participants 18 years of age or older.</li>
          </ul>
        </div>

        <!-- PRIZES -->
        <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h2 style="font-size: 18px; color: #166534; margin: 0 0 12px;">🏆 13 Winners Will Be Selected!</h2>
          <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0 0 12px;">
            <strong>Grand Prize (1 Winner):</strong> Front cover of the calendar + a professionally framed picture of your pet + a Gift Bundle worth up to <strong>$200+</strong> packed with pet food, toys, and other goodies!
          </p>
          <p style="font-size: 14px; color: #374151; line-height: 1.6; margin: 0;">
            <strong>Monthly Stars (12 Winners):</strong> Your pet featured as the star of their very own month in the 2027 calendar.
          </p>
        </div>

        <!-- VERIFY INFO -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="font-size: 16px; color: #111827; margin: 0 0 12px;">📋 Please Verify Your Information</h3>
          <p style="font-size: 13px; color: #6b7280; margin: 0 0 12px;">This is the info we have on file. Please review and reply to this email if anything needs to be corrected.</p>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 6px 0; font-weight: 600; width: 90px;">Name:</td><td>${entry.full_name}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td>${entry.email}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Phone:</td><td>${entry.phone}</td></tr>
            <tr><td style="padding: 6px 0; font-weight: 600;">Address:</td><td>${entry.address_line1}${entry.address_line2 ? ', ' + entry.address_line2 : ''}, ${entry.city}, ${entry.state} ${entry.zip}</td></tr>
          </table>
          <p style="font-size: 13px; color: #dc2626; margin: 12px 0 0; font-weight: 600;">
            ⚠️ If anything above is incorrect, reply to this email right away so we can fix it before your calendar ships!
          </p>
        </div>

        <!-- HELP -->
        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          <strong>Questions?</strong> Just reply to this email or reach us anytime at <a href="mailto:hello@cutepawsandwhiskers.com" style="color: #f97316; text-decoration: underline;">hello@cutepawsandwhiskers.com</a>. We're here to help!
        </p>

        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-top: 8px;">
          Can't wait to see your fur baby! 🐶🐱
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="font-size: 13px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Paws &amp; Whiskers 2027 Calendar Contest<br>
          Presented by Hello Pat<br>
          <a href="mailto:hello@cutepawsandwhiskers.com" style="color: #f97316;">hello@cutepawsandwhiskers.com</a><br>
          <a href="${SITE_URL}/terms.html" style="color: #9ca3af; font-size: 12px;">Terms of Service</a> &bull; <a href="${SITE_URL}/privacy.html" style="color: #9ca3af; font-size: 12px;">Privacy Policy</a>
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
