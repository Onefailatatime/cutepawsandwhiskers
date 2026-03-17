const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const { sendEvent } = require('./fb-capi');
const { notifyOwner } = require('./telegram-notify');

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

async function sendReceiptEmail(entry, amountPaid) {
  const firstName = entry.first_name || entry.full_name.split(' ')[0];
  const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const orderId = entry.id.substring(0, 8).toUpperCase();

  const html = `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
      <div style="background: #111827; padding: 32px; text-align: center; border-radius: 16px 16px 0 0;">
        <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.1); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span style="font-size: 32px;">🧾</span>
        </div>
        <h1 style="color: white; font-size: 24px; margin: 0;">Payment Confirmed!</h1>
        <p style="color: rgba(255,255,255,0.7); margin: 8px 0 0; font-size: 14px;">Your receipt for the Paws &amp; Whiskers Calendar Contest</p>
      </div>

      <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 16px 16px;">
        <p style="font-size: 16px; color: #374151;">Hi ${firstName},</p>
        <p style="font-size: 15px; color: #374151; line-height: 1.6;">
          Your payment has been received. Here's your receipt for your records.
        </p>

        <!-- Order Details -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin: 24px 0;">
          <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Order #</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; font-family: monospace;">${orderId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Date</td>
              <td style="padding: 8px 0; text-align: right;">${orderDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Payment Method</td>
              <td style="padding: 8px 0; text-align: right;">Credit Card (via Stripe)</td>
            </tr>
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; color: #6b7280;">Email</td>
              <td style="padding: 8px 0; text-align: right;">${entry.email}</td>
            </tr>
          </table>
        </div>

        <!-- Line Items -->
        <div style="border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin: 24px 0;">
          <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Item</th>
                <th style="padding: 12px 16px; text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 14px 16px;">
                  <div style="font-weight: 600;">Paws &amp; Whiskers 2027 Calendar Contest</div>
                  <div style="font-size: 13px; color: #6b7280;">Contest entry + calendar inclusion</div>
                </td>
                <td style="padding: 14px 16px; text-align: right; font-weight: 600;">$${amountPaid.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #e5e7eb; background: #f0fdf4;">
                <td style="padding: 14px 16px; font-weight: 700; font-size: 16px;">Total Paid</td>
                <td style="padding: 14px 16px; text-align: right; font-weight: 700; font-size: 16px; color: #16a34a;">$${amountPaid.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Shipping Info -->
        <div style="background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="font-size: 15px; color: #1e40af; margin: 0 0 10px;">📦 Shipping To</h3>
          <p style="font-size: 14px; color: #374151; margin: 0; line-height: 1.6;">
            ${entry.full_name}<br>
            ${entry.address_line1}${entry.address_line2 ? '<br>' + entry.address_line2 : ''}<br>
            ${entry.city}, ${entry.state} ${entry.zip}
          </p>
          <p style="font-size: 12px; color: #6b7280; margin: 10px 0 0;">
            We'll ship your calendar once all winners are selected and the calendar is printed. You'll receive a shipping notification with tracking info!
          </p>
        </div>

        <!-- What's Next -->
        <div style="background: #fff7ed; border: 2px solid #fed7aa; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="font-size: 15px; color: #9a3412; margin: 0 0 10px;">📋 What Happens Next?</h3>
          <ol style="font-size: 14px; color: #374151; line-height: 1.8; padding-left: 20px; margin: 0;">
            <li><strong>Upload your pet's photo</strong> — check your other email from us!</li>
            <li><strong>Winners announced</strong> — we'll notify all 13 winners by email</li>
            <li><strong>Calendar printed &amp; shipped</strong> — straight to your door</li>
          </ol>
        </div>

        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          <strong>Need help?</strong> Reply to this email or contact us at <a href="mailto:orders@cutepawsandwhiskers.com" style="color: #f97316; text-decoration: underline;">orders@cutepawsandwhiskers.com</a>
        </p>

        <p style="font-size: 14px; color: #374151; line-height: 1.6;">
          Thank you for your purchase! 🐾
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p style="font-size: 13px; color: #9ca3af; text-align: center; line-height: 1.6;">
          Paws &amp; Whiskers 2027 Calendar Contest<br>
          Presented by Hello Pat<br>
          <a href="mailto:orders@cutepawsandwhiskers.com" style="color: #f97316;">orders@cutepawsandwhiskers.com</a><br>
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
    subject: `🧾 Receipt — Order #${orderId} ($${amountPaid.toFixed(2)})`,
    html,
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
          <div style="background: #fffbeb; border: 1px dashed #f59e0b; border-radius: 8px; padding: 14px; margin-top: 14px;">
            <p style="font-size: 14px; color: #92400e; margin: 0; line-height: 1.5;">
              <strong>🐾 What's your pet's name?</strong> When you upload your photo (or reply to this email), please tell us your pet's name and whether they're a 🐶 dog or 🐱 cat — we want to make sure we spell it right on the calendar!
            </p>
          </div>
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

      // Extract real amount from Stripe (amount_total is in cents)
      const amountPaidCents = session.amount_total || 3600;
      const amountPaid = amountPaidCents / 100;
      const currency = (session.currency || 'usd').toUpperCase();
      const stripeEmail = session.customer_details?.email || session.customer_email || null;

      // Update entry with payment confirmation + real Stripe data
      const updateFields = {
        stripe_payment_id: paymentId,
        payment_confirmed: true,
        payment_confirmed_at: new Date().toISOString(),
        status: 'paid',
        total_price: amountPaid,
      };
      // If Stripe has customer email and entry doesn't, backfill it
      if (stripeEmail) updateFields.stripe_customer_email = stripeEmail;

      const { data: entry, error: updateErr } = await supabase
        .from('contest_entries')
        .update(updateFields)
        .eq('id', entryId)
        .select()
        .single();

      if (updateErr) {
        console.error('DB update error:', updateErr);
        return { statusCode: 200, body: 'DB error but 200 to prevent retry' };
      }

      // Fire Facebook Conversions API — Purchase event with real amount
      sendEvent({
        event_name: 'Purchase',
        event_id: `Purchase_${entryId}`,
        event_source_url: 'https://cutepawsandwhiskers.com',
        user_data: {
          email: entry.email,
          phone: entry.phone,
          first_name: entry.first_name,
          last_name: entry.last_name,
          zip: entry.zip,
          fbc: entry.fb_click_id,
          fbp: entry.fb_browser_id,
          client_ip: entry.client_ip,
          client_user_agent: entry.client_user_agent,
        },
        custom_data: {
          currency: currency,
          value: amountPaid,
          content_name: 'Paws & Whiskers 2027 Calendar Contest Entry',
          content_type: 'product',
          content_ids: [entryId],
        },
      }).catch(err => console.error('FB Purchase event error:', err));

      // Telegram notification — sale with real amount!
      notifyOwner(
        `💰 <b>NEW SALE!</b>\n\n` +
        `<b>${entry.full_name}</b>\n` +
        `${entry.email} | ${entry.phone}\n` +
        `${entry.city}, ${entry.state} ${entry.zip}\n\n` +
        `Amount: <b>$${amountPaid.toFixed(2)}</b>\n` +
        `Pet: ${entry.pet_name || 'Pending'}\n` +
        `ID: <code>${entryId}</code>\n` +
        (entry.utm_source ? `UTM: ${entry.utm_source} / ${entry.utm_campaign || '-'}` : '')
      ).catch(err => console.error('Telegram notify error:', err));

      // Send welcome email
      try {
        await sendWelcomeEmail(entry);
        await supabase
          .from('contest_entries')
          .update({ welcome_email_sent: true, welcome_email_sent_at: new Date().toISOString() })
          .eq('id', entryId);

        // Log email in activity log
        await supabase.from('crm_activity_log').insert({
          entry_id: entryId,
          action: 'email_sent',
          details: {
            type: 'welcome_email',
            to: entry.email,
            subject: `Welcome ${entry.first_name || entry.full_name.split(' ')[0]}! Upload your pet's photo`,
            template: 'welcome',
          },
        });

        console.log(`Welcome email sent to ${entry.email}`);
      } catch (emailErr) {
        console.error('Welcome email error:', emailErr);
      }

      // Send purchase receipt email
      try {
        await sendReceiptEmail(entry, amountPaid);

        await supabase.from('crm_activity_log').insert({
          entry_id: entryId,
          action: 'email_sent',
          details: {
            type: 'receipt_email',
            to: entry.email,
            subject: `Receipt — Order #${entryId.substring(0, 8).toUpperCase()} ($${amountPaid.toFixed(2)})`,
            template: 'receipt',
            amount: amountPaid,
          },
        });

        console.log(`Receipt email sent to ${entry.email}`);
      } catch (emailErr) {
        console.error('Receipt email error:', emailErr);
      }

      // Auto-add to email groups by utm_campaign
      if (entry.utm_campaign) {
        try {
          const { data: groups } = await supabase
            .from('email_groups')
            .select('id')
            .eq('auto_utm_campaign', entry.utm_campaign);
          for (const g of (groups || [])) {
            await supabase.from('email_group_members')
              .upsert({ group_id: g.id, entry_id: entryId }, { onConflict: 'group_id,entry_id', ignoreDuplicates: true });
          }
        } catch (e) { console.error('Auto-group error:', e); }
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('Webhook error:', err);
    return { statusCode: 200, body: 'Error but 200 to prevent retry' };
  }
};
