/**
 * One-time setup helper for Telegram bot webhook
 *
 * Visit: /api/telegram-setup?action=set&secret=YOUR_ADMIN_KEY
 * to register the webhook with Telegram.
 *
 * Visit: /api/telegram-setup?action=info&secret=YOUR_ADMIN_KEY
 * to check current webhook status.
 */

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};

  // Simple auth
  if (params.secret !== process.env.ADMIN_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return { statusCode: 400, body: JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not set' }) };
  }

  const SITE_URL = process.env.URL || 'https://cutepawsandwhiskers.netlify.app';
  const WEBHOOK_URL = `${SITE_URL}/api/telegram-webhook`;
  const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

  try {
    if (params.action === 'set') {
      // Register webhook with Telegram
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          secret_token: WEBHOOK_SECRET || undefined,
          allowed_updates: ['message'],
        }),
      });
      const data = await res.json();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_webhook',
          webhook_url: WEBHOOK_URL,
          telegram_response: data,
        }),
      };
    }

    if (params.action === 'info') {
      // Get current webhook info
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const data = await res.json();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'webhook_info',
          data: data.result,
        }),
      };
    }

    if (params.action === 'me') {
      // Get bot info
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const data = await res.json();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot: data.result }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usage: {
          set_webhook: `/api/telegram-setup?action=set&secret=YOUR_KEY`,
          check_info: `/api/telegram-setup?action=info&secret=YOUR_KEY`,
          bot_info: `/api/telegram-setup?action=me&secret=YOUR_KEY`,
        },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
