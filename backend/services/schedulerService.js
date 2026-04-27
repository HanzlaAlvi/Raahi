'use strict';
/**
 * services/schedulerService.js
 *
 * PURPOSE:
 *   Manages stateful reminder tracking so the alarm cron can accurately
 *   report "Reminder 3/7" instead of always saying "Reminder 1/7".
 *
 *   Also provides the central `runPhase1Reminder` and `runPhase2AutoProcess`
 *   entry points that alarmCron.js calls — keeping the cron file thin and
 *   all logic modular.
 *
 * DESIGN:
 *   State is kept in-memory (Map keyed by transporterId string).
 *   State resets at 6 PM each day when autoCreateDailyPolls runs.
 *   This is intentional — process restarts also clear state, which is fine
 *   because the cron is re-registered fresh on every server start.
 *
 * EXPORTS:
 *   resetReminderCounters()            — call at 6 PM / server start
 *   getReminderCount(transporterId)    → number (1-7)
 *   incrementReminderCount(id)
 *   runPhase1Reminder()               — called every 15 min, 10 PM–12 AM
 *   runPhase2AutoProcess()            — called at 12 AM
 */

const Route              = require('../models/Route');
const { getUsersByRole, sendReminderToTransporter, sendMidnightSummary } = require('./notificationService');
const { autoOptimizeAndSaveRoutes, hasCompletedPipeline }                = require('./routeService');
const { assignDriversToRoutes }                                           = require('./assignmentService');
const {
  notifyDriverAutoAssigned,
  notifyTransporterAutoAssigned,
  notifyTransporterAssignFailed,
  notifyPassengersRouteConfirmed,
} = require('./notificationService');

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY REMINDER STATE
// ─────────────────────────────────────────────────────────────────────────────

// Map<transporterIdString, reminderCount>
const _reminderCounts = new Map();

function resetReminderCounters() {
  _reminderCounts.clear();
  console.log('[SchedulerService] Reminder counters reset for new day');
}

function getReminderCount(transporterId) {
  return _reminderCounts.get(transporterId.toString()) || 0;
}

function incrementReminderCount(transporterId) {
  const id  = transporterId.toString();
  const cur = _reminderCounts.get(id) || 0;
  _reminderCounts.set(id, cur + 1);
  return cur + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the transporter still has at least one route that is
 * NOT assigned (status is 'unassigned' or 'pending') AND was not
 * auto-processed yet.
 *
 * Used to decide whether to send an alarm to this transporter.
 */
async function transporterHasPendingWork(transporterId) {
  const count = await Route.countDocuments({
    transporterId,
    status:          { $in: ['unassigned', 'pending'] },
    isAutoProcessed: { $ne: true },
  });
  return count > 0;
}

/**
 * Returns true ONLY if the transporter has routes in DB AND all of them
 * are assigned/in-progress/completed (manually or auto).
 *
 * Returns FALSE in these cases (Phase 2 should run):
 *   - No routes exist at all (transporter never optimized → routeService will create them)
 *   - Some routes are still unassigned/pending
 */
async function transporterIsComplete(transporterId) {
  const totalRoutes = await Route.countDocuments({ transporterId });

  // No routes at all → NOT complete, Phase 2 needs to create + assign them
  if (totalRoutes === 0) return false;

  // Check if any route is still pending/unassigned and not yet auto-processed
  const pendingCount = await Route.countDocuments({
    transporterId,
    status:          { $in: ['unassigned', 'pending'] },
    isAutoProcessed: { $ne: true },
  });

  // If pendingCount > 0 → still work to do → not complete
  return pendingCount === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — REMINDER (called every 15 min, 10 PM – 11:45 PM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends the required reminder notification to every transporter who has NOT
 * yet completed route optimization + driver assignment.
 *
 * Message (as per spec):
 *   "You have not assigned the route yet. Please complete before auto assignment."
 *
 * Max 7 reminders per transporter per day (10:15 PM → 11:45 PM, every 15 min).
 * Counter is tracked in _reminderCounts.
 */
async function runPhase1Reminder() {
  try {
    console.log('[SchedulerService] Phase 1 reminder tick...');
    const transporters = await getUsersByRole('transporter');
    let notified = 0;

    for (const t of transporters) {
      // Skip if transporter already finished
      const isComplete = await transporterIsComplete(t._id);
      if (isComplete) {
        console.log(`[SchedulerService] ${t.name} already complete — skip reminder`);
        continue;
      }

      // Cap at 7 reminders (10:15 PM to 11:45 PM inclusive)
      const currentCount = getReminderCount(t._id);
      if (currentCount >= 7) {
        console.log(`[SchedulerService] ${t.name} already received 7 reminders — no more`);
        continue;
      }

      const unassignedCount = await Route.countDocuments({
        transporterId:   t._id,
        status:          { $in: ['unassigned', 'pending'] },
        isAutoProcessed: { $ne: true },
      });

      // If transporter has no routes yet — they haven't even optimized
      // Still remind them because they need to act before midnight
      const reminderNum = incrementReminderCount(t._id);
      await sendReminderToTransporter(t, unassignedCount || 1, reminderNum);
      notified++;
    }

    console.log(`[SchedulerService] Phase 1 done — ${notified} transporter(s) reminded`);
  } catch (err) {
    console.error('[SchedulerService] runPhase1Reminder error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — AUTO PROCESS (called at 12 AM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The main 12 AM auto-process function.
 *
 * For each transporter who has NOT completed the pipeline:
 *   Step 1: autoOptimizeAndSaveRoutes — run VRP on poll responses, save routes
 *   Step 2: assignDriversToRoutes     — assign best drivers using Haversine
 *   Step 3: Send notifications to driver, transporter, and passengers
 *
 * For transporters who have already manually assigned all routes → skip.
 * For transporters who already have routes but they're unassigned → only assign.
 */
async function runPhase2AutoProcess() {
  try {
    console.log('[SchedulerService] ⏰ 12:00 AM — Phase 2 Auto-Process starting...');

    const transporters      = await getUsersByRole('transporter');
    let totalAutoAssigned   = 0;
    let totalFailed         = 0;

    for (const t of transporters) {
      console.log(`\n[SchedulerService] Processing transporter: ${t.name} (${t._id})`);

      // Check if already done manually
      const alreadyDone = await hasCompletedPipeline(t._id);
      if (alreadyDone) {
        console.log(`[SchedulerService] ${t.name} already completed pipeline — skipping`);
        continue;
      }

      // ── STEP 1: Auto-optimize poll responses → save routes ──────────────
      let routesToAssign = [];
      const optimizeResult = await autoOptimizeAndSaveRoutes(t._id);

      if (optimizeResult.error && !optimizeResult.saved.length) {
        console.warn(
          `[SchedulerService] Optimization failed for ${t.name}: ${optimizeResult.error}`
        );
        // Try to pick up any pre-existing unassigned routes
        const existingUnassigned = await Route.find({
          transporterId:   t._id,
          status:          { $in: ['unassigned', 'pending'] },
          isAutoProcessed: { $ne: true },
        });
        routesToAssign = existingUnassigned;
        console.log(
          `[SchedulerService] Found ${routesToAssign.length} pre-existing unassigned route(s) to assign`
        );
      } else {
        routesToAssign = optimizeResult.saved;
        console.log(
          `[SchedulerService] ${optimizeResult.saved.length} route(s) ready for assignment ` +
          `(${optimizeResult.skipped} skipped)`
        );
      }

      if (!routesToAssign.length) {
        console.log(`[SchedulerService] No routes to assign for ${t.name}`);
        continue;
      }

      // ── STEP 2: Assign drivers to routes ────────────────────────────────
      const assignResults = await assignDriversToRoutes(routesToAssign);

      // ── STEP 3: Notifications ────────────────────────────────────────────
      for (const ar of assignResults) {
        if (ar.assigned && ar.driver) {
          totalAutoAssigned++;

          // Notify driver
          await notifyDriverAutoAssigned(ar.driver, ar.route);

          // Notify transporter
          await notifyTransporterAutoAssigned(t._id, ar.route, ar.driver.name);

          // Notify passengers
          await notifyPassengersRouteConfirmed(ar.route, ar.driver.name);

          console.log(
            `[SchedulerService] ✅ "${ar.route.routeName || ar.route.name}" ` +
            `→ ${ar.driver.name}`
          );
        } else {
          totalFailed++;
          await notifyTransporterAssignFailed(t._id, ar.route, ar.reason);

          // Mark as auto-processed even if assignment failed — prevents retry loop
          await Route.findByIdAndUpdate(ar.route._id, {
            isAutoProcessed: true,
            autoProcessedAt: new Date(),
          });

          console.warn(
            `[SchedulerService] ⚠️ Could not assign "${ar.route.routeName || ar.route.name}": ${ar.reason}`
          );
        }
      }
    }

    // ── Global midnight summary ────────────────────────────────────────────
    await sendMidnightSummary(totalAutoAssigned, totalFailed);

    console.log(
      `\n[SchedulerService] Phase 2 complete — ` +
      `${totalAutoAssigned} auto-assigned, ${totalFailed} failed`
    );
  } catch (err) {
    console.error('[SchedulerService] runPhase2AutoProcess error:', err.message);
  }
}

module.exports = {
  resetReminderCounters,
  getReminderCount,
  incrementReminderCount,
  runPhase1Reminder,
  runPhase2AutoProcess,
};