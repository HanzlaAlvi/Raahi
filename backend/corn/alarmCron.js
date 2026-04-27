'use strict';
/**
 * backend/corn/alarmCron.js
 *
 * ─── FIXES IN THIS VERSION ──────────────────────────────────────────────────
 *
 *  FIX 1: autoCreateDailyPolls → MORNING POLL ONLY
 *    Return poll creation REMOVED.
 *    Reason: Return poll responses are not used for route creation.
 *    Only morning poll passengers need routes assigned.
 *
 *  FIX 2: autoCloseAtTenPM → ALL drivers auto-available (no status filter)
 *    Direct User.find() without status filter.
 *
 *  FIX 3: ✅ TRANSPORTER-ONLY ALARMS
 *    6 PM task mein Passenger aur Driver ko notification NAHI jaati.
 *    Alarm (loud ring) SIRF Transporter ko jaata hai:
 *      - 9:45 PM (polls close) → Transporter alarm
 *      - 10:15–11:45 PM (Phase 1, ×7) → Transporter alarm
 *      - 12:00 AM (Phase 2 auto-assign) → Transporter alarm
 *    Driver → sirf normal notification (route assigned)
 *    Passenger → sirf normal notification (ride confirmed)
 *
 * ─── FULL DAILY SCHEDULE (Pakistan Standard Time = UTC+5) ─────────────────
 *
 *  6:00 PM  → Reset reminder counters + auto-create MORNING POLL ONLY
 *             (koi notification nahi — sirf poll banta hai)
 *  7–9 PM   → Hourly reminders → passengers (poll) + drivers (availability)
 *  9:45 PM  → AUTO-CLOSE all polls + auto-yes + auto-available drivers
 *             + ALARM to transporters only
 *  10:15–11:45 PM → Phase 1: transporter ALARM reminders ×7
 *  12:00 AM → Phase 2: auto-optimize + save routes + assign drivers
 *             + ALARM to transporters | normal push to drivers & passengers
 * ─────────────────────────────────────────────────────────────────────────────
 */

const cron               = require('node-cron');
const User               = require('../models/User');
const Poll               = require('../models/Poll');
const Route              = require('../models/Route');
const DriverAvailability = require('../models/DriverAvailability');
const sendNotification   = require('../helpers/notification');

const { sendFCMPush, sendAlarmFCM } = require('../helpers/fcmPush');

const { resetReminderCounters, runPhase1Reminder, runPhase2AutoProcess } = require('../services/schedulerService');
const { getUsersByRole } = require('../services/notificationService');

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function tomorrowMidnight() {
  const d = todayMidnight();
  d.setDate(d.getDate() + 1);
  return d;
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 1 — 6:00 PM: AUTO-CREATE MORNING POLL ONLY
// ✅ FIX: Passenger/Driver ko koi notification NAHI — sirf poll banta hai
// ═════════════════════════════════════════════════════════════════════════════
async function autoCreateDailyPolls() {
  try {
    console.log('[AlarmCron] 6:00 PM — auto-creating daily polls (morning only)...');

    resetReminderCounters();

    const today    = todayMidnight();
    const tomorrow = tomorrowMidnight();

    const transporters = await getUsersByRole('transporter');

    for (const t of transporters) {
      // ── Morning poll ONLY ─────────────────────────────────────────────────
      const existingMorning = await Poll.findOne({
        transporterId: t._id,
        pollType:      'morning',
        createdAt:     { $gte: today, $lt: tomorrow },
      });

      if (existingMorning) {
        console.log(`[AlarmCron] Morning poll already exists — Transporter: ${t.name} — skip`);
        continue;
      }

      await new Poll({
        title:         'Tomorrow Morning Commute — Aane Ka Safar',
        question:      'Kya aap kal subah aao ge? (Will you travel tomorrow morning?)',
        pollType:      'morning',
        timeSlots:     ['7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM'],
        closesAt:      '10:00 PM',
        closingDate:   tomorrow,
        transporterId: t._id,
        status:        'active',
        autoCreated:   true,
      }).save();

      console.log(`[AlarmCron] Morning poll created → Transporter: ${t.name}`);
    }

    // ✅ FIX: Passenger aur Driver ko yahan KUCH NAHI jaata.
    // Poll banta hai — sirf backend par. Passengers/Drivers khud app khol ke dekhte hain.
    // Alarm notifications sirf Transporter ke liye hain (10 PM ke baad).
    console.log('[AlarmCron] 6:00 PM — polls created. No notifications sent (by design).');

  } catch (err) {
    console.error('[AlarmCron] autoCreateDailyPolls error:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 2 — 7 PM / 8 PM / 9 PM: HOURLY REMINDERS
// (Passengers + Drivers ko normal push — transporter ko nahi)
// ═════════════════════════════════════════════════════════════════════════════
async function sendHourlyReminders() {
  try {
    console.log('[AlarmCron] Hourly reminder tick...');

    const today    = todayMidnight();
    const tomorrow = tomorrowMidnight();

    // ── Passengers who haven't responded ─────────────────────────────────────
    const activePolls   = await Poll.find({
      status:    'active',
      pollType:  'morning',
      createdAt: { $gte: today, $lt: tomorrow },
    });
    const allPassengers = await getUsersByRole('passenger');

    const pendingPaxTokens = [];
    for (const p of allPassengers) {
      const myPolls = activePolls.filter(
        poll => poll.transporterId?.toString() === p.transporterId?.toString()
      );
      if (!myPolls.length) continue;

      const hasResponded = myPolls.some(poll =>
        poll.responses?.some(r => r.passengerId?.toString() === p._id.toString())
      );
      if (!hasResponded && (p.fcmToken || p.expoPushToken)) {
        pendingPaxTokens.push(p.fcmToken || p.expoPushToken);
      }
    }

    if (pendingPaxTokens.length) {
      await sendFCMPush(
        pendingPaxTokens,
        '⏰ Poll Reminder — Jawab Do!',
        'Kal ke subah ke safar ka poll abhi bhi open hai. 10 PM se pehle jawab zaroor do!',
        { screen: 'Dashboard' },
        'notification'
      );
    }

    // ── Drivers who haven't set availability ──────────────────────────────────
    const allDrivers = await getUsersByRole('driver');
    const pendingDriverTokens = [];

    for (const d of allDrivers) {
      const avail = await DriverAvailability.findOne({
        driverId: d._id,
        date:     { $gte: today, $lt: tomorrow },
      });
      if (!avail && (d.fcmToken || d.expoPushToken)) {
        pendingDriverTokens.push(d.fcmToken || d.expoPushToken);
      }
    }

    if (pendingDriverTokens.length) {
      await sendFCMPush(
        pendingDriverTokens,
        '⏰ Availability Reminder!',
        'Aapne abhi tak kal ki availability set nahi ki. 10 PM se pehle zaroor set karo!',
        { screen: 'Availability' },
        'notification'
      );
    }

    console.log(
      `[AlarmCron] Hourly reminder → ${pendingPaxTokens.length} passengers, ${pendingDriverTokens.length} drivers`
    );
  } catch (err) {
    console.error('[AlarmCron] sendHourlyReminders error:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 3 — 9:45 PM: AUTO-CLOSE EVERYTHING
// ✅ FIX: ALARM SIRF TRANSPORTER KO — passenger/driver ko sirf normal push
// ═════════════════════════════════════════════════════════════════════════════
async function autoCloseAtTenPM() {
  try {
    console.log('[AlarmCron] 9:45 PM — auto-close all polls + driver availability...');

    const today    = todayMidnight();
    const tomorrow = tomorrowMidnight();

    // ── STEP 1: Close polls + auto-yes non-responders ──────────────────────
    const activePolls = await Poll.find({ status: 'active' });
    let pollsClosed   = 0;
    let autoYesCount  = 0;

    for (const poll of activePolls) {
      poll.status = 'closed';

      const allPax = await User.find({
        $or:           [{ role: 'passenger' }, { type: 'passenger' }],
        transporterId: poll.transporterId,
        status:        'active',
      }).lean();

      for (const pax of allPax) {
        const alreadyResponded = poll.responses?.some(
          r => r.passengerId?.toString() === pax._id.toString()
        );
        if (alreadyResponded) continue;

        poll.responses.push({
          passengerId:       pax._id,
          passengerName:     pax.name,
          passengerEmail:    pax.email || '',
          response:          'yes',
          selectedTimeSlot:  pax.preferredTimeSlot || pax.selectedTimeSlot || null,
          pickupPoint:       pax.pickupPoint || '',
          pickupLat:         pax.latitude,
          pickupLng:         pax.longitude,
          dropLat:           pax.destinationLatitude,
          dropLng:           pax.destinationLongitude,
          destination:       pax.destination || '',
          vehiclePreference: pax.vehiclePreference || null,
          autoYes:           true,
          respondedAt:       new Date(),
        });
        autoYesCount++;

        // DB notification only (no FCM alarm to passenger)
        await sendNotification(
          pax._id, 'passenger',
          '✅ Auto-Confirmed: Kal Ka Safar',
          `Aapka subah ka poll auto-yes ho gaya.`,
          'auto_confirm', poll._id, 'poll', false
        );

        // ✅ Passenger ko NORMAL push (no alarm)
        const tok = pax.fcmToken || pax.expoPushToken;
        if (tok) {
          await sendFCMPush(
            [tok],
            '✅ Auto-Yes Ho Gaya!',
            'Kal ke subah ke safar ke liye aapka jawab auto-yes ho gaya.',
            { pollId: poll._id.toString(), screen: 'Dashboard' },
            'notification'
          );
        }
      }

      await poll.save();
      pollsClosed++;
    }

    console.log(`[AlarmCron] Polls closed: ${pollsClosed} | Auto-yes: ${autoYesCount} passengers`);

    // ── STEP 2: Auto-available for drivers who didn't mark ─────────────────
    const allDrivers = await User.find({
      $or: [{ role: 'driver' }, { type: 'driver' }],
    }).select('_id name fcmToken expoPushToken transporterId latitude longitude').lean();

    let autoAvailCount = 0;

    for (const driver of allDrivers) {
      const existing = await DriverAvailability.findOne({
        driverId: driver._id,
        date:     { $gte: today, $lt: tomorrow },
      });
      if (existing) {
        console.log(`[AlarmCron] ${driver.name} already has availability — skip`);
        continue;
      }

      await DriverAvailability.create({
        driverId:      driver._id,
        driverName:    driver.name,
        date:          new Date(),
        startTime:     '07:00 AM',
        endTime:       '06:00 PM',
        status:        'available',
        confirmed:     false,
        autoFilled:    true,
        transporterId: driver.transporterId,
      });
      autoAvailCount++;

      console.log(`[AlarmCron] Auto-available → ${driver.name}`);

      // DB notification
      await sendNotification(
        driver._id, 'driver',
        '✅ Auto-Available Set Ho Gaya',
        'Aapne 10 PM tak availability set nahi ki — system ne aapko auto-available mark kar diya.',
        'auto_confirm', null, 'availability', false
      );

      // ✅ Driver ko NORMAL push (no alarm)
      const tok = driver.fcmToken || driver.expoPushToken;
      if (tok) {
        await sendFCMPush(
          [tok],
          '✅ Auto-Available!',
          'Aapki availability auto-yes ho gayi. Transporter aapko kal route assign kar sakta hai.',
          { screen: 'Availability' },
          'notification'
        );
      }
    }

    console.log(`[AlarmCron] Auto-available: ${autoAvailCount} drivers`);

    // ── STEP 3: ✅ ALARM SIRF TRANSPORTER KO ────────────────────────────────
    const transporters = await getUsersByRole('transporter');
    const tTokens = transporters.map(t => t.fcmToken || t.expoPushToken).filter(Boolean);

    for (const t of transporters) {
      // DB notification
      await sendNotification(
        t._id, 'transporter',
        '🔔 10 PM — Polls Band Ho Gaye',
        'Sab polls band ho gaye. Ab drivers ko routes assign karo — 12 AM se pehle!',
        'poll_closed', null, 'poll', true, 'assign_routes'
      );
    }

    // ✅ ALARM to transporters only
    if (tTokens.length) {
      await sendAlarmFCM(
        tTokens,
        '⏰ 10 PM — Ab Routes Assign Karo!',
        'Polls band ho gaye. Passenger responses aa gaye. 12 AM se pehle routes assign kar lo!',
        { screen: 'Assign' }
      );
      console.log(`[AlarmCron] ✅ ALARM sent → ${tTokens.length} transporter(s)`);
    }

    console.log('[AlarmCron] 9:45 PM auto-close complete.');
  } catch (err) {
    console.error('[AlarmCron] autoCloseAtTenPM error:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 4 — PHASE 1: 10:15 PM – 11:45 PM (every 15 min) — TRANSPORTER ONLY
// ═════════════════════════════════════════════════════════════════════════════
async function sendTransporterAlarm() {
  await runPhase1Reminder();
}

// ═════════════════════════════════════════════════════════════════════════════
// TASK 5 — PHASE 2: 12:00 AM AUTO-PROCESS
// ═════════════════════════════════════════════════════════════════════════════
async function midnightAutoAssign() {
  await runPhase2AutoProcess();
}

// ═════════════════════════════════════════════════════════════════════════════
// CRON SCHEDULES (UTC — Render runs in UTC; PST = UTC+5)
// ═════════════════════════════════════════════════════════════════════════════

cron.schedule('0 13 * * *', () => {   // 6:00 PM PST
  console.log('[AlarmCron] ⏰ 6:00 PM — auto-create morning poll + reset counters');
  autoCreateDailyPolls();
});

cron.schedule('0 14 * * *', () => {   // 7:00 PM PST
  console.log('[AlarmCron] ⏰ 7:00 PM — hourly reminder');
  sendHourlyReminders();
});

cron.schedule('0 15 * * *', () => {   // 8:00 PM PST
  console.log('[AlarmCron] ⏰ 8:00 PM — hourly reminder');
  sendHourlyReminders();
});

cron.schedule('0 16 * * *', () => {   // 9:00 PM PST
  console.log('[AlarmCron] ⏰ 9:00 PM — FINAL hourly reminder');
  sendHourlyReminders();
});

cron.schedule('45 16 * * *', () => {  // 9:45 PM PST
  console.log('[AlarmCron] ⏰ 9:45 PM — auto-close polls & availability');
  autoCloseAtTenPM();
});

// Phase 1: 10:15 PM → 11:45 PM PST (×7, every 15 min) — TRANSPORTER ALARM
[
  '15 17 * * *',   // 10:15 PM PST
  '30 17 * * *',   // 10:30 PM PST
  '45 17 * * *',   // 10:45 PM PST
  '0 18 * * *',    // 11:00 PM PST
  '15 18 * * *',   // 11:15 PM PST
  '30 18 * * *',   // 11:30 PM PST
  '45 18 * * *',   // 11:45 PM PST
].forEach((cronExpr, i) => {
  cron.schedule(cronExpr, () => {
    console.log(`[AlarmCron] ⏰ Phase 1 Transporter Alarm #${i + 1}`);
    sendTransporterAlarm();
  });
});

// Phase 2: 12:00 AM PST = 7:00 PM UTC
cron.schedule('0 19 * * *', () => {
  console.log('[AlarmCron] ⏰ 12:00 AM PST — Phase 2 Auto-Process START');
  midnightAutoAssign();
});

console.log(
  '✅ AlarmCron registered:\n' +
  '   6:00 PM  — auto-create MORNING POLL ONLY (koi notification nahi)\n' +
  '   7–9 PM   — hourly reminders: passengers (poll) + drivers (availability)\n' +
  '   9:45 PM  — auto-close + auto-yes + auto-available\n' +
  '              ✅ ALARM → SIRF TRANSPORTER | Normal push → drivers & passengers\n' +
  '   10:15–11:45 PM — Phase 1: ×7 ALARM → SIRF TRANSPORTER\n' +
  '   12:00 AM — Phase 2: auto-assign\n' +
  '              ✅ ALARM → SIRF TRANSPORTER | Normal push → drivers & passengers'
);

module.exports = {
  autoCreateDailyPolls,
  sendHourlyReminders,
  autoCloseAtTenPM,
  sendTransporterAlarm,
  midnightAutoAssign,
};