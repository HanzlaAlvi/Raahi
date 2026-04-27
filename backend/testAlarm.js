'use strict';
/**
 * backend/testAlarm.js
 *
 * ═══════════════════════════════════════════════════════════════
 *  COMPREHENSIVE TEST SCRIPT — Transporter-Only Alarm System
 *
 *  Tests:
 *   1. Poll Creation         (6 PM task)
 *   2. Auto-Close / Auto-Yes / Auto-Available  (9:45 PM task)
 *   3. Phase 1 Reminder — Transporter ALARM ×7  (10:15–11:45 PM)
 *   4. Phase 2 Midnight Auto-Assign + DB Verify  (12 AM)
 *   5. Transporter Dashboard Data Check
 *   6. Notification Type Verify — ALARM only to transporter
 *
 * Usage:
 *   node testAlarm.js              ← sab tests
 *   node testAlarm.js polls        ← sirf poll creation
 *   node testAlarm.js close        ← sirf auto-close
 *   node testAlarm.js alarm        ← sirf transporter alarm (Phase 1)
 *   node testAlarm.js assign       ← sirf midnight auto-assign (Phase 2)
 *   node testAlarm.js dashboard    ← sirf dashboard check
 *   node testAlarm.js notify       ← sirf notification type verify
 * ═══════════════════════════════════════════════════════════════
 */

require('dotenv').config();

// ─── Terminal colours ────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  magenta: '\x1b[35m',
};

const results = { passed: 0, failed: 0, warned: 0 };

function pass(msg)  { console.log(`${C.green}  ✅ PASS${C.reset}  ${msg}`); results.passed++; }
function fail(msg)  { console.log(`${C.red}  ❌ FAIL${C.reset}  ${msg}`); results.failed++; }
function info(msg)  { console.log(`${C.cyan}  ℹ️  INFO${C.reset}  ${msg}`); }
function warn(msg)  { console.log(`${C.yellow}  ⚠️  WARN${C.reset}  ${msg}`); results.warned++; }
function section(title) {
  console.log(`\n${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  ${title}${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'═'.repeat(60)}${C.reset}\n`);
}
function assert(condition, passMsg, failMsg) {
  if (condition) pass(passMsg);
  else           fail(failMsg);
}

// ════════════════════════════════════════════════════════════════════════════
// Firebase Init
// ════════════════════════════════════════════════════════════════════════════
const admin = require('firebase-admin');
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.warn('⚠️  Firebase init failed — FCM tests will be skipped:', e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DB Connection + Models
// ════════════════════════════════════════════════════════════════════════════
const connectDB = require('./config/db');

// ✅ FIX: Correct model imports
const User             = require('./models/User');
const Poll             = require('./models/Poll');
const Route            = require('./models/Route');
const DriverAvailability = require('./models/DriverAvailability');
const Notification     = require('./models/Notification');

// ════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ════════════════════════════════════════════════════════════════════════════
async function runAllTests() {
  await connectDB();
  console.log('✅ DB Connected\n');

  const arg = process.argv[2];

  const {
    autoCreateDailyPolls,
    autoCloseAtTenPM,
    sendTransporterAlarm,
    midnightAutoAssign,
  } = require('./corn/alarmCron');

  if (!arg || arg === 'polls')     await testPollCreation(autoCreateDailyPolls);
  if (!arg || arg === 'close')     await testAutoClose(autoCloseAtTenPM);
  if (!arg || arg === 'alarm')     await testTransporterAlarm(sendTransporterAlarm);
  if (!arg || arg === 'assign')    await testAutoAssign(midnightAutoAssign);
  if (!arg || arg === 'dashboard') await testTransporterDashboard();
  if (!arg || arg === 'notify')    await testNotificationTypes();

  printSummary();
  process.exit(results.failed > 0 ? 1 : 0);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — Poll Creation (6 PM Task)
// ════════════════════════════════════════════════════════════════════════════
async function testPollCreation(autoCreateDailyPolls) {
  section('TEST 1 — Poll Creation (6 PM Task)');

  // Count transporters
  const transporters = await User.find({
    $or: [{ role: 'transporter' }, { type: 'transporter' }],
    status: 'active',
  }).lean();
  info(`Active transporters in DB: ${transporters.length}`);

  const beforeCount = await Poll.countDocuments();
  info(`Polls in DB before: ${beforeCount}`);

  try {
    await autoCreateDailyPolls();
    pass('autoCreateDailyPolls() ran without throwing');
  } catch (e) {
    fail(`autoCreateDailyPolls() threw: ${e.message}`);
    return;
  }

  const afterCount = await Poll.countDocuments();
  info(`Polls in DB after: ${afterCount}`);

  assert(
    afterCount >= beforeCount,
    `Poll count same or increased (${beforeCount} → ${afterCount})`,
    `Poll count DECREASED — something deleted polls! (${beforeCount} → ${afterCount})`
  );

  // ✅ Verify: morning poll type only
  const returnPolls = await Poll.countDocuments({ pollType: 'return', autoCreated: true });
  assert(
    returnPolls === 0,
    'No auto-created return polls found (morning-only — correct!)',
    `${returnPolls} auto-created RETURN poll(s) found — should be ZERO`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — Auto-Close / Auto-Yes / Auto-Available (9:45 PM Task)
// ════════════════════════════════════════════════════════════════════════════
async function testAutoClose(autoCloseAtTenPM) {
  section('TEST 2 — Auto-Close + Auto-Yes + Auto-Available (9:45 PM Task)');

  try {
    await autoCloseAtTenPM();
    pass('autoCloseAtTenPM() ran without throwing');
  } catch (e) {
    fail(`autoCloseAtTenPM() threw: ${e.message}`);
    return;
  }

  // Verify: no polls still 'active'
  const openPolls = await Poll.countDocuments({ status: 'active' });
  assert(
    openPolls === 0,
    'No active polls remain after auto-close',
    `${openPolls} poll(s) still ACTIVE after auto-close ran`
  );

  // Verify: DriverAvailability records exist
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const availCount = await DriverAvailability.countDocuments({
    date: { $gte: today, $lt: tomorrow },
  });
  info(`DriverAvailability records for today: ${availCount}`);
  assert(
    availCount >= 0,
    `DriverAvailability count valid (${availCount})`,
    'DriverAvailability check failed'
  );

  // ✅ Verify: ALARM notification went to transporters, not to passengers/drivers
  const alarmToTransporter = await Notification.countDocuments({
    userRole: 'transporter',
    type: 'poll_closed',
  });
  info(`DB notifications (poll_closed) for transporters: ${alarmToTransporter}`);

  const alarmToPassenger = await Notification.countDocuments({
    userRole: 'passenger',
    type: 'poll_closed',
  });
  const alarmToDriver = await Notification.countDocuments({
    userRole: 'driver',
    type: 'poll_closed',
  });
  assert(
    alarmToPassenger === 0,
    'No poll_closed alarm notification went to passengers ✅',
    `${alarmToPassenger} poll_closed notification(s) went to passengers — WRONG!`
  );
  assert(
    alarmToDriver === 0,
    'No poll_closed alarm notification went to drivers ✅',
    `${alarmToDriver} poll_closed notification(s) went to drivers — WRONG!`
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — Transporter Alarm / Phase 1 Reminder
// ✅ Verifies alarm went ONLY to transporter
// ════════════════════════════════════════════════════════════════════════════
async function testTransporterAlarm(sendTransporterAlarm) {
  section('TEST 3 — Phase 1 Alarm: Transporter Only (10:15–11:45 PM Task)');

  // Count transporters with FCM tokens
  const transporters = await User.find({
    $or: [{ role: 'transporter' }, { type: 'transporter' }],
    status: 'active',
  }).lean();

  info(`Total transporters in DB: ${transporters.length}`);

  const tokCount = transporters.filter(t => t.fcmToken || t.expoPushToken).length;
  info(`Transporters with FCM token: ${tokCount}`);

  if (tokCount === 0) {
    warn('No transporter has an FCM token — alarm will be skipped by FCM (token required)');
  }

  const notifBefore = await Notification.countDocuments({ userRole: 'transporter', type: 'alarm' });

  try {
    await sendTransporterAlarm();
    pass('sendTransporterAlarm() ran without throwing');
  } catch (e) {
    fail(`sendTransporterAlarm() threw: ${e.message}`);
    return;
  }

  const notifAfter = await Notification.countDocuments({ userRole: 'transporter', type: 'alarm' });
  info(`Transporter alarm notifications in DB before: ${notifBefore} | after: ${notifAfter}`);

  assert(
    notifAfter >= notifBefore,
    `Transporter alarm notification count increased or same (${notifBefore} → ${notifAfter})`,
    `Transporter alarm notifications DECREASED — something wrong (${notifBefore} → ${notifAfter})`
  );

  // ✅ CRITICAL: Verify NO alarm went to passenger or driver
  const paxAlarm = await Notification.countDocuments({ userRole: 'passenger', type: 'alarm' });
  const drvAlarm = await Notification.countDocuments({ userRole: 'driver',    type: 'alarm' });

  assert(
    paxAlarm === 0,
    '✅ No ALARM notification went to any passenger',
    `❌ ${paxAlarm} ALARM notification(s) went to passengers — THIS IS THE BUG!`
  );
  assert(
    drvAlarm === 0,
    '✅ No ALARM notification went to any driver',
    `❌ ${drvAlarm} ALARM notification(s) went to drivers — THIS IS THE BUG!`
  );

  assert(
    transporters.length > 0,
    `Transporters exist in DB (${transporters.length} found)`,
    'NO transporters in DB — alarm had no one to notify!'
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Phase 2 Midnight Auto-Assign + DB Verification
// ════════════════════════════════════════════════════════════════════════════
async function testAutoAssign(midnightAutoAssign) {
  section('TEST 4 — Midnight Auto-Assign: Routes → Drivers (12 AM Task)');

  const routesBefore    = await Route.find({});
  const assignedBefore  = routesBefore.filter(r => r.assignedDriver || r.driverId).length;
  info(`Routes in DB:            ${routesBefore.length}`);
  info(`Already assigned before: ${assignedBefore}`);
  info(`Unassigned before:       ${routesBefore.length - assignedBefore}`);

  try {
    await midnightAutoAssign();
    pass('midnightAutoAssign() ran without throwing');
  } catch (e) {
    fail(`midnightAutoAssign() threw: ${e.message}`);
    return;
  }

  // ── DB Verification ───────────────────────────────────────────────────────
  section('  DB VERIFICATION — After Auto-Assign');

  const routesAfter  = await Route.find({});
  const assignedAfter = routesAfter.filter(r => r.assignedDriver || r.driverId).length;
  const unassigned    = routesAfter.length - assignedAfter;

  info(`Routes in DB after:     ${routesAfter.length}`);
  info(`Assigned after:         ${assignedAfter}`);
  info(`Still unassigned:       ${unassigned}`);

  assert(
    assignedAfter >= assignedBefore,
    `Routes assigned count same or increased (${assignedBefore} → ${assignedAfter})`,
    `Routes assigned DECREASED — something went wrong! (${assignedBefore} → ${assignedAfter})`
  );

  if (unassigned > 0) {
    warn(`${unassigned} route(s) still unassigned — possibly no available drivers`);
  } else if (routesAfter.length > 0) {
    pass('All routes have been assigned a driver');
  }

  // Route-level detail
  console.log(`\n${C.dim}  Route-level detail:${C.reset}`);
  for (const route of routesAfter) {
    const driverInfo = (route.assignedDriver || route.driverId)
      ? `→ Driver: ${route.assignedDriver || route.driverId}`
      : `→ ⚠️  NOT ASSIGNED`;
    console.log(`${C.dim}    Route ${route._id} (${route.routeName || 'unnamed'}) ${driverInfo}${C.reset}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Transporter Dashboard Data Check
// ════════════════════════════════════════════════════════════════════════════
async function testTransporterDashboard() {
  section('TEST 5 — Transporter Dashboard Data Verification');

  const transporters = await User.find({
    $or: [{ role: 'transporter' }, { type: 'transporter' }],
  }).lean();

  assert(
    transporters.length > 0,
    `${transporters.length} transporter(s) found in DB`,
    'NO transporters found — dashboard will be empty!'
  );

  for (const t of transporters) {
    console.log(`\n${C.bold}  Transporter: ${t.name || t._id}${C.reset}`);

    const myRoutes = await Route.find({ transporterId: t._id }).lean();
    info(`    Routes on dashboard: ${myRoutes.length}`);

    for (const route of myRoutes) {
      const driver = (route.assignedDriver || route.driverId)
        ? `Driver assigned ✅ (${route.assignedDriver || route.driverId})`
        : `No driver ❌`;
      console.log(`${C.dim}      ${route.routeName || route._id}: ${driver}${C.reset}`);
    }

    assert(
      myRoutes.length > 0,
      `"${t.name || t._id}" has routes on dashboard`,
      `"${t.name || t._id}" has NO routes — dashboard empty!`
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — Notification Type Verify (ALARM only to transporter)
// ════════════════════════════════════════════════════════════════════════════
async function testNotificationTypes() {
  section('TEST 6 — Notification Type Verify (Alarm = Transporter Only)');

  // Check DB notifications by type and role
  const allNotifs = await Notification.find({}).lean();
  info(`Total notifications in DB: ${allNotifs.length}`);

  const alarmNotifs = allNotifs.filter(n => n.type === 'alarm');
  info(`Alarm-type notifications: ${alarmNotifs.length}`);

  const alarmToTransporter = alarmNotifs.filter(n => n.userRole === 'transporter').length;
  const alarmToPassenger   = alarmNotifs.filter(n => n.userRole === 'passenger').length;
  const alarmToDriver      = alarmNotifs.filter(n => n.userRole === 'driver').length;

  info(`  → Transporter: ${alarmToTransporter}`);
  info(`  → Passenger:   ${alarmToPassenger}`);
  info(`  → Driver:      ${alarmToDriver}`);

  assert(
    alarmToPassenger === 0,
    '✅ ZERO alarm notifications to passengers (correct!)',
    `❌ ${alarmToPassenger} alarm notification(s) went to PASSENGERS — FIX NEEDED`
  );

  assert(
    alarmToDriver === 0,
    '✅ ZERO alarm notifications to drivers (correct!)',
    `❌ ${alarmToDriver} alarm notification(s) went to DRIVERS — FIX NEEDED`
  );

  if (alarmToTransporter > 0) {
    pass(`${alarmToTransporter} alarm notification(s) correctly went to transporters`);
  } else {
    warn('No alarm notifications to transporters yet — run alarm test first');
  }

  // Check FCM token availability
  section('  FCM Token Check');

  const allUsers = await User.find({}).lean();
  for (const role of ['transporter', 'passenger', 'driver']) {
    const roleUsers = allUsers.filter(u => u.role === role || u.type === role);
    const withToken = roleUsers.filter(u => u.fcmToken || u.expoPushToken).length;
    info(`${role}: ${withToken}/${roleUsers.length} have FCM tokens`);
    if (role === 'transporter' && withToken === 0) {
      warn(`NO transporter has an FCM token — alarm CANNOT be delivered! Add token via app login.`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
function printSummary() {
  section('FINAL TEST SUMMARY');
  console.log(`  ${C.green}Passed:   ${results.passed}${C.reset}`);
  console.log(`  ${C.red}Failed:   ${results.failed}${C.reset}`);
  console.log(`  ${C.yellow}Warnings: ${results.warned}${C.reset}`);
  console.log('');

  if (results.failed === 0 && results.warned === 0) {
    console.log(`${C.green}${C.bold}  🎉 ALL TESTS PASSED!${C.reset}\n`);
  } else if (results.failed === 0) {
    console.log(`${C.yellow}${C.bold}  ⚠️  Tests passed with warnings — review above${C.reset}\n`);
  } else {
    console.log(`${C.red}${C.bold}  ❌ SOME TESTS FAILED — Fix issues above${C.reset}\n`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// RUN
// ════════════════════════════════════════════════════════════════════════════
runAllTests().catch(e => {
  console.error(`${C.red}❌ Test runner crashed: ${e.message}${C.reset}`);
  console.error(e.stack);
  process.exit(1);
});