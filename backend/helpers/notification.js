'use strict';
// backend/helpers/notification.js
//
// FIX: Ab sirf DB mein save nahi hota — FCM push notification bhi jata hai
// agar user ka fcmToken saved hai.

const Notification          = require('../models/Notification');
const User                  = require('../models/User');
const { ICON_MAP, COLOR_MAP } = require('../config/constants');
const { sendFCMPush }       = require('./fcmPush'); // ← FCM helper

/**
 * sendNotification
 *
 * 1) Notification DB mein save karta hai (in-app bell icon ke liye)
 * 2) FCM push bhi bhejta hai agar user ka fcmToken available hai
 *
 * @param {string}  userId         - Target user ka MongoDB _id
 * @param {string}  userRole       - 'driver' | 'passenger' | 'transporter'
 * @param {string}  title          - Notification title
 * @param {string}  message        - Notification body/message
 * @param {string}  type           - e.g. 'availability', 'confirmation', 'route', 'poll', etc.
 * @param {*}       relatedId      - Related document _id (optional)
 * @param {string}  relatedType    - e.g. 'availability', 'poll', 'route' (optional)
 * @param {boolean} actionRequired - Kya user ko kuch action lena hai?
 * @param {string}  actionType     - e.g. 'confirm_driver' (optional)
 */
async function sendNotification(
  userId, userRole, title, message, type,
  relatedId      = null,
  relatedType    = null,
  actionRequired = false,
  actionType     = null
) {
  try {
    // ── Step 1: User fetch karo ──────────────────────────────────────
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[Notify] User not found: ${userId}`);
      return;
    }

    // ── Step 2: DB mein notification save karo ───────────────────────
    await new Notification({
      title,
      message,
      type,
      icon:          ICON_MAP[type]  || 'notifications',
      color:         COLOR_MAP[type] || '#9E9E9E',
      userId,
      userRole,
      relatedId,
      relatedType,
      actionRequired,
      actionType,
      transporterId: user.transporterId || userId,
      pollId:        relatedType === 'poll' ? relatedId : null,
    }).save();

    // ── Step 3: FCM push bhejo agar token hai ────────────────────────
    if (user.fcmToken) {
      const data = {
        type:        type           || '',
        relatedId:   relatedId      ? String(relatedId) : '',
        relatedType: relatedType    || '',
        actionRequired: actionRequired ? 'true' : 'false',
        actionType:  actionType     || '',
      };

      await sendFCMPush(
        user.fcmToken,
        title,
        message,
        data,
        'notification'   // type = 'notification' (alarm nahi)
      ).catch(err =>
        console.warn('[Notify] FCM push failed (non-fatal):', err.message)
      );
    } else {
      console.log(`[Notify] No fcmToken for user ${userId} — skipping push`);
    }

  } catch (e) {
    console.error('[Notify] sendNotification error:', e.message);
  }
}

module.exports = sendNotification;