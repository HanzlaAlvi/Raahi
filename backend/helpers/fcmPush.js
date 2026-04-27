// backend/helpers/fcmPush.js
//
// FIXES IN THIS VERSION:
//   1. Removed `fullScreenAction` from android.notification — it is NOT a valid
//      field in the FCM HTTP v1 API.
//
//   2. ✅ NEW FIX: Invalid FCM token auto-cleanup
//      Jab koi token 'messaging/invalid-argument' ya
//      'messaging/registration-token-not-registered' error de, usse
//      User collection se automatically null kar do. Isse baar baar
//      wahi error aana band ho jaega.

'use strict';

const admin = require('firebase-admin');
const User  = require('../models/User');

// ─── Invalid token errors jinpar DB clean karna chahiye ──────────────────────
const INVALID_TOKEN_ERRORS = new Set([
  'messaging/invalid-argument',
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/**
 * Invalid FCM tokens ko DB se clean karo.
 * @param {string[]} tokens  - Token list (same order as sendEachForMulticast responses)
 * @param {import('firebase-admin/messaging').SendResponse[]} responses
 */
async function cleanupInvalidTokens(tokens, responses) {
  const badTokens = [];
  responses.forEach((r, i) => {
    if (!r.success && INVALID_TOKEN_ERRORS.has(r.error?.code)) {
      badTokens.push(tokens[i]);
    }
  });

  if (!badTokens.length) return;

  console.log(`[FCM] Cleaning up ${badTokens.length} invalid token(s) from DB...`);
  try {
    // fcmToken aur expoPushToken dono mein se remove karo
    await User.updateMany(
      { $or: [{ fcmToken: { $in: badTokens } }, { expoPushToken: { $in: badTokens } }] },
      { $set: { fcmToken: null, expoPushToken: null } }
    );
    console.log(`[FCM] Cleaned ${badTokens.length} invalid token(s) from User collection.`);
  } catch (err) {
    console.warn('[FCM] Token cleanup error (non-fatal):', err.message);
  }
}

/**
 * Send a FCM notification to one or more device tokens.
 *
 * @param {string|string[]} tokens  - FCM device token(s)
 * @param {string} title            - Notification title
 * @param {string} body             - Notification body
 * @param {object} data             - Extra key-value data (all values must be strings)
 * @param {'alarm'|'notification'} type - Message type — ALWAYS included in data
 */
async function sendFCMPush(tokens, title, body, data = {}, type = 'notification') {
  if (!tokens) return;
  const tokenList = Array.isArray(tokens) ? tokens.filter(Boolean) : [tokens].filter(Boolean);
  if (tokenList.length === 0) return;

  // FCM data values MUST be strings
  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = String(v);
  }

  // IMPORTANT: type is always set so the frontend never sees type: undefined
  stringData.type = type;

  const message = {
    notification: { title, body },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        channelId:             type === 'alarm' ? 'alarm_channel' : 'default_channel',
        sound:                 'default',
        priority:              type === 'alarm' ? 'max' : 'high',
        defaultVibrateTimings: true,
        // ✅ fullScreenAction REMOVED — not a valid FCM v1 field.
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          badge:            1,
          contentAvailable: true,
          ...(type === 'alarm' && {
            sound: { critical: 1, name: 'default', volume: 1.0 },
          }),
          ...(type !== 'alarm' && {
            sound: 'default',
          }),
        },
      },
    },
    tokens: tokenList,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    const failed   = response.responses.filter(r => !r.success);

    console.log(
      `[FCM] type=${type} | sent=${tokenList.length} ok=${response.successCount} fail=${response.failureCount}`
    );

    if (failed.length > 0) {
      failed.forEach((r, i) => {
        const failedToken = tokenList[response.responses.indexOf(r)];
        console.error(`[FCM] Token failed: ${r.error?.code} — ${r.error?.message}`);
      });

      // ✅ Auto-cleanup invalid tokens from DB
      await cleanupInvalidTokens(tokenList, response.responses);
    }

    return response;
  } catch (err) {
    console.error('[FCM] sendEachForMulticast error:', err.message);
    throw err;
  }
}

/**
 * Send a high-priority alarm notification.
 * type is set to 'alarm' — the frontend AlarmService checks this.
 */
async function sendAlarmFCM(tokens, title, body, extraData = {}) {
  return sendFCMPush(tokens, title, body, extraData, 'alarm');
}

module.exports = { sendFCMPush, sendAlarmFCM };