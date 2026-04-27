'use strict';
/**
 * services/notificationService.js
 *
 * ─── FIX (Transporter-Only Alarms) ─────────────────────────────────────────
 *  Push Notifications (alarm type) SIRF aur SIRF Transporter ko jaayenge.
 *  Driver aur Passenger ko:
 *    - Sirf regular 'notification' type push milega (route confirmation etc.)
 *    - Alarm-style (loud/ring) NAHI milega
 *
 *  sendMidnightSummary:
 *    - Transporter → sendAlarmFCM  ✅  (alarm — loud)
 *    - Driver      → sendFCMPush   ✅  (normal notification — no alarm)
 *    - Passenger   → sendFCMPush   ✅  (normal notification — no alarm)
 * ────────────────────────────────────────────────────────────────────────────
 */

const User             = require('../models/User');
const sendNotification = require('../helpers/notification');
const { sendFCMPush, sendAlarmFCM } = require('../helpers/fcmPush');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getUsersByRole(role) {
  return User.find({
    $or: [{ role }, { type: role }],
    status: 'active',
  }).select('_id name fcmToken expoPushToken transporterId latitude longitude').lean();
}

async function getTokensForUserIds(userIds = []) {
  if (!userIds.length) return [];
  const users = await User.find({ _id: { $in: userIds } })
    .select('fcmToken expoPushToken')
    .lean();
  return users.map(u => u.fcmToken || u.expoPushToken).filter(Boolean);
}

function tokenOf(user) {
  return (user && (user.fcmToken || user.expoPushToken)) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — REMINDER  (SIRF TRANSPORTER — 10 PM to 12 AM)
// ─────────────────────────────────────────────────────────────────────────────

async function sendReminderToTransporter(transporter, unassignedCount, reminderNumber) {
  try {
    const title   = '⏰ Route Assignment Reminder';
    const message =
      `You have not assigned the route yet. Please complete before auto assignment. ` +
      `(${unassignedCount} route${unassignedCount > 1 ? 's' : ''} pending — Reminder ${reminderNumber}/7)`;

    // DB save (in-app bell)
    await sendNotification(
      transporter._id, 'transporter',
      title, message,
      'alarm', null, 'alarm', true, 'assign_routes'
    );

    // ✅ ALARM FCM — SIRF TRANSPORTER
    const tok = tokenOf(transporter);
    if (tok) {
      await sendAlarmFCM(
        [tok],
        title,
        message,
        {
          screen:     'Assign',
          unassigned: String(unassignedCount),
          reminder:   String(reminderNumber),
        }
      );
      console.log(
        `[NotifService] ✅ ALARM → Transporter: ${transporter.name} | ` +
        `Reminder #${reminderNumber} | ${unassignedCount} unassigned`
      );
    } else {
      console.warn(`[NotifService] ⚠️ No FCM token — Transporter ${transporter.name}`);
    }
  } catch (err) {
    console.error(`[NotifService] sendReminderToTransporter error:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — AUTO-PROCESS NOTIFICATIONS (12 AM)
// ─────────────────────────────────────────────────────────────────────────────

// ✅ DRIVER — normal notification only (no alarm)
async function notifyDriverAutoAssigned(driver, route) {
  try {
    const routeLabel = route.routeName || route.name || 'Route';
    const pickup     = route.pickupTime || route.timeSlot || 'N/A';

    await sendNotification(
      driver._id, 'driver',
      '🚐 Route Auto-Assigned!',
      `Route "${routeLabel}" has been automatically assigned to you. Pickup: ${pickup}`,
      'auto_assign', route._id, 'route', false
    );

    const tok = tokenOf(driver);
    if (tok) {
      // ✅ Driver ko NORMAL push — alarm nahi
      await sendFCMPush(
        [tok],
        '🚐 Route Assigned!',
        `"${routeLabel}" — Pickup: ${pickup} (Auto-Assigned)`,
        { routeId: String(route._id), screen: 'Routes' },
        'notification'
      );
    }
  } catch (err) {
    console.error('[NotifService] notifyDriverAutoAssigned error:', err.message);
  }
}

// ✅ TRANSPORTER — alarm on successful auto-assign
async function notifyTransporterAutoAssigned(transporterId, route, driverName) {
  try {
    const routeLabel = route.routeName || route.name || 'Route';

    await sendNotification(
      transporterId, 'transporter',
      '✅ Route Auto-Assigned',
      `"${routeLabel}" was automatically assigned to ${driverName}.`,
      'auto_assign', route._id, 'route', false
    );

    const transporter = await User.findById(transporterId)
      .select('fcmToken expoPushToken name').lean();
    const tok = tokenOf(transporter);
    if (tok) {
      await sendAlarmFCM(
        [tok],
        '✅ Route Auto-Assigned',
        `"${routeLabel}" → ${driverName}`,
        { routeId: String(route._id), screen: 'Assign' }
      );
    }
  } catch (err) {
    console.error('[NotifService] notifyTransporterAutoAssigned error:', err.message);
  }
}

// ✅ TRANSPORTER — alarm on assignment failure
async function notifyTransporterAssignFailed(transporterId, route, reason) {
  try {
    const routeLabel = route.routeName || route.name || 'Route';

    await sendNotification(
      transporterId, 'transporter',
      '⚠️ Auto-Assignment Failed',
      `"${routeLabel}" could not be auto-assigned: ${reason}. Please assign manually.`,
      'warning', route._id, 'route', true, 'assign_routes'
    );

    const transporter = await User.findById(transporterId)
      .select('fcmToken expoPushToken').lean();
    const tok = tokenOf(transporter);
    if (tok) {
      await sendAlarmFCM(
        [tok],
        '⚠️ Route Assignment Failed!',
        `"${routeLabel}" — ${reason}. Manual action required.`,
        { routeId: String(route._id), screen: 'Assign' }
      );
    }
  } catch (err) {
    console.error('[NotifService] notifyTransporterAssignFailed error:', err.message);
  }
}

// ✅ PASSENGER — normal notification only (no alarm)
async function notifyPassengersRouteConfirmed(route, driverName) {
  try {
    const routeLabel = route.routeName || route.name || 'Route';
    const pickup     = route.pickupTime || route.timeSlot || 'N/A';
    const paxIds     = (route.passengers || []).map(p => p.passengerId).filter(Boolean);

    const tokens = await getTokensForUserIds(paxIds);
    if (tokens.length) {
      // ✅ Passenger ko NORMAL push — alarm bilkul nahi
      await sendFCMPush(
        tokens,
        '🚐 Your Ride is Confirmed!',
        `Driver: ${driverName} — Pickup: ${pickup} (Auto-Assigned)`,
        { routeId: String(route._id), screen: 'Dashboard' },
        'notification'
      );
    }

    for (const pax of (route.passengers || [])) {
      if (!pax.passengerId) continue;
      await sendNotification(
        pax.passengerId, 'passenger',
        '🚐 Your Ride is Confirmed!',
        `Driver ${driverName} will pick you up. Pickup: ${pickup}`,
        'auto_assign', route._id, 'route', false
      );
    }
  } catch (err) {
    console.error('[NotifService] notifyPassengersRouteConfirmed error:', err.message);
  }
}

/**
 * Midnight summary:
 *   ✅ Transporter → sendAlarmFCM  (alarm — loud ring)
 *   ✅ Driver      → sendFCMPush   (normal — no alarm)
 *   ✅ Passenger   → sendFCMPush   (normal — no alarm)
 */
async function sendMidnightSummary(autoAssignedCount, failedCount) {
  try {
    const transporters = await getUsersByRole('transporter');
    const drivers      = await getUsersByRole('driver');
    const passengers   = await getUsersByRole('passenger');

    const tTokens = transporters.map(tokenOf).filter(Boolean);
    const dTokens = drivers.map(tokenOf).filter(Boolean);
    const pTokens = passengers.map(tokenOf).filter(Boolean);

    // ✅ TRANSPORTER — ALARM
    if (tTokens.length) {
      await sendAlarmFCM(
        tTokens,
        '🌙 Auto-Process Complete',
        `${autoAssignedCount} route(s) auto-assigned.` +
        (failedCount ? ` ${failedCount} could not be assigned — check dashboard.` : ''),
        { screen: 'Assign', autoAssigned: String(autoAssignedCount) }
      );
      console.log(`[NotifService] ✅ ALARM → ${tTokens.length} transporter(s)`);
    }

    // ✅ DRIVER — NORMAL notification
    if (dTokens.length) {
      await sendFCMPush(
        dTokens,
        '🚐 Tomorrow\'s Routes Ready',
        'Your assigned routes for tomorrow are ready. Open the app to view.',
        { screen: 'Routes' },
        'notification'
      );
      console.log(`[NotifService] 🔔 Notification → ${dTokens.length} driver(s)`);
    }

    // ✅ PASSENGER — NORMAL notification
    if (pTokens.length) {
      await sendFCMPush(
        pTokens,
        '✅ Tomorrow\'s Ride Confirmed',
        'Your ride for tomorrow has been confirmed. Driver details in the app.',
        { screen: 'Dashboard' },
        'notification'
      );
      console.log(`[NotifService] 🔔 Notification → ${pTokens.length} passenger(s)`);
    }

    console.log(
      `[NotifService] Midnight summary done — ` +
      `ALARM T:${tTokens.length} | NOTIF D:${dTokens.length} P:${pTokens.length}`
    );
  } catch (err) {
    console.error('[NotifService] sendMidnightSummary error:', err.message);
  }
}

module.exports = {
  getUsersByRole,
  getTokensForUserIds,
  tokenOf,
  sendReminderToTransporter,
  notifyDriverAutoAssigned,
  notifyTransporterAutoAssigned,
  notifyTransporterAssignFailed,
  notifyPassengersRouteConfirmed,
  sendMidnightSummary,
};