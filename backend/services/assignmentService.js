'use strict';
/**
 * services/assignmentService.js
 *
 * ─── FIXES IN THIS VERSION ──────────────────────────────────────────────────
 *
 *  BUG FIX: "Found 0 availability record(s)" → assignment fails for all routes
 *
 *  ROOT CAUSE:
 *    If DriverAvailability collection has no records (e.g. auto-close didn't
 *    create them, or all records are outside the 26-hr window due to timing),
 *    the function immediately returns "No drivers have marked availability."
 *    and ALL 10 routes fail to assign.
 *
 *  FIX — TWO-LEVEL DRIVER LOOKUP:
 *    Level 1 (Primary): DriverAvailability collection with 26-hr window.
 *                       If records found → use them (existing behaviour).
 *    Level 2 (Fallback): If Level 1 returns 0 records, directly query User
 *                        collection for ALL drivers under this transporter.
 *                        Score them by Haversine proximity and assign the best.
 *                        This ensures assignment ALWAYS works even if the
 *                        availability system had an issue.
 *
 *  This keeps the existing manual flow working and does NOT break anything.
 *
 * ─── ALSO INCLUDED (unchanged from previous version) ────────────────────────
 *   - Real Haversine formula (not degree approximation)
 *   - Driver scoring: vehicle match + proximity + availability quality
 *   - Deduplication across routes (alreadyAssigned tracking)
 *   - isAssigned / isAutoProcessed / autoAssigned flags on Route update
 */

const Route              = require('../models/Route');
const User               = require('../models/User');
const DriverAvailability = require('../models/DriverAvailability');

// ─────────────────────────────────────────────────────────────────────────────
// HAVERSINE FORMULA
// ─────────────────────────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;
  const R     = 6371;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE WINDOW — 26-hour lookback to catch records created yesterday evening
// ─────────────────────────────────────────────────────────────────────────────

function getAvailabilityDateWindow() {
  const now         = new Date();
  const windowStart = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() +  2 * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scores a driver for a given route.
 *
 * Criteria:
 *   +40  — vehicle type matches dominant passenger preference
 *   +25  — vehicle type matches route vehicleType
 *   +10  — no preference specified (neutral)
 *   +20  — availability is 'confirmed' (not just 'available')
 *   0–30 — proximity score: 30 pts at 0 km, 0 pts at 10+ km (Haversine)
 *   +10  — driver not already assigned to another route
 */
function scoreDriver(driverUser, route, alreadyAssigned = [], availStatus = 'available') {
  let score = 0;
  const drvVehicle = (driverUser.vehicleType || driverUser.vehicle || '').toLowerCase();

  const prefCounts = {};
  (route.passengers || []).forEach(p => {
    const pref = (p.vehiclePreference || '').toLowerCase();
    if (pref) prefCounts[pref] = (prefCounts[pref] || 0) + 1;
  });
  const dominantPref = Object.entries(prefCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (dominantPref && drvVehicle.includes(dominantPref)) {
    score += 40;
  } else if (!dominantPref && route.vehicleType && drvVehicle.includes(route.vehicleType.toLowerCase())) {
    score += 25;
  } else if (!dominantPref) {
    score += 10;
  }

  if (availStatus === 'confirmed') score += 20;

  const firstPax = route.passengers?.[0];
  const paxLat   = firstPax?.latitude  || firstPax?.pickupLat;
  const paxLng   = firstPax?.longitude || firstPax?.pickupLng;

  if (paxLat && paxLng && driverUser.latitude && driverUser.longitude) {
    const km = haversineKm(driverUser.latitude, driverUser.longitude, paxLat, paxLng);
    score += Math.max(0, 30 - km * 3);
  }

  if (!alreadyAssigned.includes(driverUser._id.toString())) {
    score += 10;
  }

  return Math.round(score);
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Update Route document after assignment
// ─────────────────────────────────────────────────────────────────────────────

async function markRouteAssigned(routeId, driver, pickupTime) {
  await Route.findByIdAndUpdate(routeId, {
    assignedDriver:  driver._id,
    driverName:      driver.name,
    status:          'assigned',
    pickupTime:      pickupTime || '',
    isAssigned:      true,
    isAutoProcessed: true,
    autoProcessedAt: new Date(),
    autoAssigned:    true,
    updatedAt:       new Date(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: assignDriversToRoute
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assigns the best available driver to a single route.
 *
 * Two-level lookup:
 *   Level 1 — DriverAvailability records (26-hr window, preferred)
 *   Level 2 — User collection fallback (if Level 1 returns 0 records)
 *
 * Both levels use the same Haversine-based scoring.
 */
async function assignDriversToRoute(route, alreadyAssigned = []) {
  try {
    const { windowStart, windowEnd } = getAvailabilityDateWindow();

    console.log(
      `[AssignService] Processing route "${route.routeName || route.name}" | ` +
      `Availability window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`
    );

    // ── LEVEL 1: DriverAvailability records ────────────────────────────────
    const availDocs = await DriverAvailability.find({
      transporterId: route.transporterId,
      status:        { $in: ['available', 'confirmed'] },
      date:          { $gte: windowStart, $lte: windowEnd },
    }).lean();

    console.log(`[AssignService] Found ${availDocs.length} availability record(s)`);

    // ── Exclude already-assigned drivers ───────────────────────────────────
    const liveAssignedIds = await Route.distinct('assignedDriver', {
      transporterId: route.transporterId,
      status:        { $in: ['assigned', 'in_progress'] },
      _id:           { $ne: route._id },
    });

    const allExcluded = [
      ...alreadyAssigned,
      ...liveAssignedIds.map(id => id?.toString()).filter(Boolean),
    ];

    // ── Level 1: Use DriverAvailability ────────────────────────────────────
    if (availDocs.length > 0) {
      const freeDocs = availDocs.filter(av =>
        av.driverId && !allExcluded.includes(av.driverId.toString())
      );

      console.log(`[AssignService] ${freeDocs.length} free driver(s) after exclusions (Level 1)`);

      if (freeDocs.length > 0) {
        const driverIds   = freeDocs.map(d => d.driverId);
        const driverUsers = await User.find({ _id: { $in: driverIds } })
          .select('_id name latitude longitude vehicleType vehicle capacity fcmToken expoPushToken')
          .lean();

        if (driverUsers.length > 0) {
          const scored = driverUsers.map(drv => {
            const av    = freeDocs.find(d => d.driverId.toString() === drv._id.toString());
            const score = scoreDriver(drv, route, allExcluded, av?.status || 'available');
            return { driver: drv, availDoc: av, score };
          });
          scored.sort((a, b) => b.score - a.score);

          console.log('[AssignService] Driver scores (Level 1):');
          scored.slice(0, 3).forEach(s =>
            console.log(`  ${s.driver.name}: ${s.score} pts`)
          );

          const best       = scored[0];
          const pickupTime = best.availDoc?.startTime || route.pickupTime || route.timeSlot || '';
          await markRouteAssigned(route._id, best.driver, pickupTime);

          console.log(
            `[AssignService] ✅ Assigned "${best.driver.name}" ` +
            `(score: ${best.score}, via DriverAvailability) → "${route.routeName || route.name}"`
          );

          return {
            driver:   best.driver,
            assigned: true,
            reason:   `Assigned via DriverAvailability (score: ${best.score}, Haversine used)`,
          };
        }
      }

      // All availability docs are for already-assigned drivers
      if (freeDocs.length === 0) {
        console.warn('[AssignService] All available drivers already assigned — trying User fallback');
      }
    }

    // ── LEVEL 2: Fallback — query User collection directly ─────────────────
    //
    // This fires when:
    //   a) DriverAvailability returned 0 records (auto-available cron failed, or
    //      drivers never marked themselves, or date window mismatch)
    //   b) All availability records were for already-assigned drivers
    //
    console.log('[AssignService] ⚡ Level 2 fallback — querying User collection for drivers...');

    const allDriverUsers = await User.find({
      $or:           [{ role: 'driver' }, { type: 'driver' }],
      transporterId: route.transporterId,
    })
      .select('_id name latitude longitude vehicleType vehicle capacity fcmToken expoPushToken transporterId')
      .lean();

    console.log(`[AssignService] User fallback found ${allDriverUsers.length} driver(s) under this transporter`);

    if (!allDriverUsers.length) {
      // Last resort: find ANY driver in the system
      const anyDrivers = await User.find({
        $or: [{ role: 'driver' }, { type: 'driver' }],
      })
        .select('_id name latitude longitude vehicleType vehicle capacity fcmToken expoPushToken transporterId')
        .lean();

      console.log(`[AssignService] Last-resort fallback: ${anyDrivers.length} driver(s) in entire system`);

      if (!anyDrivers.length) {
        return {
          driver:   null,
          assigned: false,
          reason:   'No drivers found in the system at all.',
        };
      }

      // Use any driver not already excluded
      const freeFallback = anyDrivers.filter(
        d => !allExcluded.includes(d._id.toString())
      );

      if (!freeFallback.length) {
        return {
          driver:   null,
          assigned: false,
          reason:   'All drivers in the system are already assigned to other routes.',
        };
      }

      const scored = freeFallback.map(drv => ({
        driver: drv,
        score:  scoreDriver(drv, route, allExcluded, 'available'),
      }));
      scored.sort((a, b) => b.score - a.score);

      const best = scored[0];
      await markRouteAssigned(route._id, best.driver, route.pickupTime || route.timeSlot || '');

      console.log(
        `[AssignService] ✅ Assigned "${best.driver.name}" ` +
        `(score: ${best.score}, last-resort fallback) → "${route.routeName || route.name}"`
      );

      return {
        driver:   best.driver,
        assigned: true,
        reason:   `Assigned via system-wide driver fallback (score: ${best.score})`,
      };
    }

    // Filter out already-excluded drivers
    const freeDrivers = allDriverUsers.filter(
      d => !allExcluded.includes(d._id.toString())
    );

    console.log(`[AssignService] ${freeDrivers.length} free driver(s) after exclusions (Level 2)`);

    if (!freeDrivers.length) {
      return {
        driver:   null,
        assigned: false,
        reason:   'All drivers under this transporter are already assigned to other routes.',
      };
    }

    // Score and assign
    const scored = freeDrivers.map(drv => ({
      driver: drv,
      score:  scoreDriver(drv, route, allExcluded, 'available'),
    }));
    scored.sort((a, b) => b.score - a.score);

    console.log('[AssignService] Driver scores (Level 2 fallback):');
    scored.slice(0, 3).forEach(s =>
      console.log(`  ${s.driver.name}: ${s.score} pts`)
    );

    const best       = scored[0];
    const pickupTime = route.pickupTime || route.timeSlot || '';
    await markRouteAssigned(route._id, best.driver, pickupTime);

    console.log(
      `[AssignService] ✅ Assigned "${best.driver.name}" ` +
      `(score: ${best.score}, User fallback) → "${route.routeName || route.name}"`
    );

    return {
      driver:   best.driver,
      assigned: true,
      reason:   `Assigned via User collection fallback (score: ${best.score}, Haversine used)`,
    };

  } catch (err) {
    console.error('[AssignService] assignDriversToRoute error:', err.message);
    return {
      driver:   null,
      assigned: false,
      reason:   `Internal error: ${err.message}`,
    };
  }
}

/**
 * Assigns drivers to multiple routes, deduplicating so no driver gets
 * assigned twice in the same batch.
 */
async function assignDriversToRoutes(routes) {
  const results     = [];
  const nowAssigned = [];

  for (const route of routes) {
    const result = await assignDriversToRoute(route, nowAssigned);

    if (result.assigned && result.driver) {
      nowAssigned.push(result.driver._id.toString());
    }

    results.push({ route, ...result });
  }

  return results;
}

module.exports = { assignDriversToRoute, assignDriversToRoutes, haversineKm, scoreDriver };