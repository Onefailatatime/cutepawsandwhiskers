/**
 * Telegram notification helper
 * Shared module — not a Netlify function (no exports.handler)
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Send a message to a specific Telegram chat
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set, skipping notification');
    return null;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const body = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_preview !== false,
  };

  if (options.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    }

    return data;
  } catch (err) {
    console.error('Telegram send error:', err.message);
    return null;
  }
}

/**
 * Send a notification to the owner's chat
 */
async function notifyOwner(text, options = {}) {
  if (!CHAT_ID) {
    console.warn('TELEGRAM_CHAT_ID not set, skipping notification');
    return null;
  }
  return sendTelegramMessage(CHAT_ID, text, options);
}

module.exports = { sendTelegramMessage, notifyOwner };
