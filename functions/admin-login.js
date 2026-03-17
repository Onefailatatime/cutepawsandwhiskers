const crypto = require('crypto');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET = process.env.ADMIN_KEY;
if (!ADMIN_SECRET) {
  console.error('CRITICAL: ADMIN_KEY env var is not set! Auth will fail.');
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Generate a signed session token (valid for 24 hours)
function generateToken(email) {
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const payload = `${email}|${expires}`;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
  // Base64 encode the whole thing
  return Buffer.from(`${payload}|${sig}`).toString('base64');
}

// Verify a session token
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;
    const [email, expires, sig] = parts;
    // Check expiry
    if (Date.now() > parseInt(expires)) return null;
    // Check signature
    const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(`${email}|${expires}`).digest('hex');
    if (sig !== expectedSig) return null;
    return { email, expires: parseInt(expires) };
  } catch {
    return null;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { action, email, password, token } = JSON.parse(event.body || '{}');

    // LOGIN
    if (action === 'login') {
      if (!email || !password) {
        return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Email and password required' }) };
      }

      // Constant-time comparison to prevent timing attacks
      const emailInput = email.trim().toLowerCase();
      const emailExpected = (ADMIN_EMAIL || '').trim().toLowerCase();
      const emailMatch = emailInput.length === emailExpected.length &&
        crypto.timingSafeEqual(Buffer.from(emailInput), Buffer.from(emailExpected || ' '));

      const passInput = password || '';
      const passExpected = ADMIN_PASSWORD || '';
      const passMatch = passInput.length === passExpected.length &&
        crypto.timingSafeEqual(Buffer.from(passInput), Buffer.from(passExpected || ' '));

      if (!emailMatch || !passMatch) {
        // Small delay to prevent brute force
        await new Promise(r => setTimeout(r, 1000));
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }

      const sessionToken = generateToken(email.trim().toLowerCase());
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ success: true, token: sessionToken, email: email.trim().toLowerCase() }),
      };
    }

    // VERIFY (check if token is still valid)
    if (action === 'verify') {
      const result = verifyToken(token);
      if (!result) {
        return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Invalid or expired session' }) };
      }
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ success: true, email: result.email }) };
    }

    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Server error' }) };
  }
};

// Export verifyToken for use by admin-api
exports.verifyToken = verifyToken;
