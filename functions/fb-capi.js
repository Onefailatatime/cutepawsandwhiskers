/**
 * Facebook Conversions API helper
 * Sends server-side events matching the Pixel parameters:
 * Event Time, Event Name, Event Source URL, Action Source,
 * Client User Agent, Email, fbc, fbp, First Name, Last Name, Phone, Zip
 */

const crypto = require('crypto');

const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const FB_API_VERSION = 'v21.0';

// SHA-256 hash helper (Facebook requires hashed PII)
function hash(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/**
 * Send event to Facebook Conversions API
 * @param {object} opts
 * @param {string} opts.event_name - e.g. 'Lead', 'Purchase', 'PageView', 'AddPaymentInfo'
 * @param {string} opts.event_source_url - Full URL where event happened
 * @param {string} opts.event_id - Dedup ID (to avoid counting both pixel + CAPI)
 * @param {object} opts.user_data - User info for matching
 * @param {object} [opts.custom_data] - Extra data (value, currency, content_name, etc.)
 */
async function sendEvent(opts) {
  if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) {
    console.log('FB CAPI: Missing pixel ID or access token, skipping');
    return null;
  }

  const event = {
    event_name: opts.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: opts.event_id || `${opts.event_name}_${Date.now()}`,
    event_source_url: opts.event_source_url || 'https://cutepawsandwhiskers.com',
    action_source: 'website',
    user_data: {},
  };

  // Build user_data with hashed PII
  const ud = opts.user_data || {};
  if (ud.email) event.user_data.em = [hash(ud.email)];
  if (ud.phone) event.user_data.ph = [hash(ud.phone.replace(/\D/g, ''))]; // digits only
  if (ud.first_name) event.user_data.fn = [hash(ud.first_name)];
  if (ud.last_name) event.user_data.ln = [hash(ud.last_name)];
  if (ud.zip) event.user_data.zp = [hash(ud.zip)];

  // Non-hashed fields
  if (ud.fbc) event.user_data.fbc = ud.fbc;
  if (ud.fbp) event.user_data.fbp = ud.fbp;
  if (ud.client_ip) event.user_data.client_ip_address = ud.client_ip;
  if (ud.client_user_agent) event.user_data.client_user_agent = ud.client_user_agent;

  // Custom data (for Purchase events, etc.)
  if (opts.custom_data) {
    event.custom_data = opts.custom_data;
  }

  const url = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error('FB CAPI error:', JSON.stringify(body));
    } else {
      console.log(`FB CAPI: ${opts.event_name} sent, events_received: ${body.events_received}`);
    }

    return body;
  } catch (err) {
    console.error('FB CAPI fetch error:', err.message);
    return null;
  }
}

module.exports = { sendEvent, hash };
