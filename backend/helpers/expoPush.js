'use strict';
/**
 * expoPush.js
 * Free Expo Push Notification service — no Firebase / no paid plan needed.
 * Uses: https://exp.host/--/api/v2/push/send
 *
 * Usage:
 *   const sendExpoPush = require('./helpers/expoPush');
 *   await sendExpoPush(['ExponentPushToken[xxx]'], 'Title', 'Body', { type:'alarm' });
 */

const https = require('https');

/**
 * @param {string[]} tokens   - Expo push tokens (ExponentPushToken[…])
 * @param {string}   title
 * @param {string}   body
 * @param {object}   data     - extra payload sent to the app
 * @param {object}   opts     - optional overrides (sound, priority, badge)
 */
async function sendExpoPush(tokens, title, body, data = {}, opts = {}) {
  const validTokens = (tokens || []).filter(
    t => typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  if (!validTokens.length) return { sent: 0 };

  // Expo accepts up to 100 messages per request
  const chunks = [];
  for (let i = 0; i < validTokens.length; i += 100) {
    chunks.push(validTokens.slice(i, i + 100));
  }

  let sent = 0;
  for (const chunk of chunks) {
    const messages = chunk.map(to => ({
      to,
      title,
      body,
      data,
      sound: opts.sound !== undefined ? opts.sound : 'default',
      priority: opts.priority || 'high',
      badge: opts.badge,
      channelId: opts.channelId || 'default',
    }));

    const payload = JSON.stringify(messages);

    await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'exp.host',
          path: '/--/api/v2/push/send',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
        },
        res => {
          let raw = '';
          res.on('data', d => (raw += d));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              // Log any per-token errors
              if (parsed.data) {
                parsed.data.forEach((r, i) => {
                  if (r.status === 'error') {
                    console.warn(`[ExpoPush] Token error for ${chunk[i]}: ${r.message}`);
                  }
                });
              }
            } catch (_) {}
            resolve();
          });
        }
      );
      req.on('error', err => {
        console.error('[ExpoPush] Request error:', err.message);
        resolve(); // Don't crash the cron
      });
      req.write(payload);
      req.end();
    });

    sent += chunk.length;
  }

  return { sent };
}

module.exports = sendExpoPush;
