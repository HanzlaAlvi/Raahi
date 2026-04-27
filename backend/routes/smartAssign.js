'use strict';
/**
 * backend/routes/smartAssign.js
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SMART AUTO ROUTE OPTIMIZATION & DRIVER ASSIGNMENT — API ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ENDPOINTS:
 *
 *  POST /api/smart-assign/optimize
 *    Body: { pollId?, passengers?, transporterId? }
 *    → Runs smart optimization, returns routes + assignment plan (DRY RUN)
 *       Does NOT save to DB yet.
 *
 *  POST /api/smart-assign/save
 *    Body: { pollId?, passengers?, transporterId? }
 *    → Runs optimization + saves Routes to MongoDB + assigns drivers in DB
 *
 *  GET /api/smart-assign/preview/:pollId
 *    → Returns optimization preview for a closed poll
 *
 *  Register in app.js / server.js as:
 *    const smartAssignRouter = require('./routes/smartAssign');
 *    app.use('/api/smart-assign', smartAssignRouter);
 */

const express = require('express');
const router  = express.Router();

const Route  = require('../models/Route');
const User   = require('../models/User');
const Poll   = require('../models/Poll');
const auth   = require('../middleware/auth');

const { smartAutoAssign }   = require('../utils/smartAssigner');
const { getLivePetrolPrice } = require('../utils/vrpOptimizer');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches passengers from a poll's 'yes' responses,
 * hydrated with GPS from the User collection.
 */
async function hydratePassengersFromPoll(poll) {
  const yesRes = (poll.responses || []).filter(r => r.response === 'yes');
  if (!yesRes.length) return [];

  const ids    = yesRes.map(r => r.passengerId).filter(Boolean);
  const dbUsrs = ids.length
    ? await User.find({ _id: { $in: ids } }).lean()
    : [];
  const byId   = {};
  dbUsrs.forEach(u => { byId[u._id.toString()] = u; });

  return yesRes.map((r, i) => {
    const db = byId[r.passengerId?.toString()] || {};
    return {
      id:                r.passengerId?.toString() || `p_${i}`,
      name:              r.passengerName  || db.name        || 'Passenger',
      pickupLat:         parseFloat(r.pickupLat) || parseFloat(db.latitude)             || 0,
      pickupLng:         parseFloat(r.pickupLng) || parseFloat(db.longitude)            || 0,
      pickupAddress:     r.pickupPoint    || db.pickupPoint || db.address               || '',
      dropLat:           parseFloat(r.dropLat)   || parseFloat(db.destinationLatitude)  || 0,
      dropLng:           parseFloat(r.dropLng)   || parseFloat(db.destinationLongitude) || 0,
      dropAddress:       r.destination    || db.destination                             || '',
      vehiclePreference: r.vehiclePreference || db.vehiclePreference                   || null,
      timeSlot:          r.selectedTimeSlot  || null,
      tripType:          r.tripType          || 'onward',
      passengerId:       r.passengerId,
      passengerName:     r.passengerName  || db.name        || 'Passenger',
      passengerEmail:    r.passengerEmail || db.email        || '',
    };
  });
}

/**
 * Fetches all drivers for a given transporterId from the User collection.
 */
async function fetchDrivers(transporterId) {
  return User.find({
    $or: [{ role: 'driver' }, { type: 'driver' }],
    transporterId,
    status: { $ne: 'inactive' },
  })
    .select('_id name latitude longitude vehicleType vehicle capacity fcmToken expoPushToken')
    .lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/smart-assign/optimize  (DRY RUN — no DB writes)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/optimize', auth, async (req, res) => {
  try {
    const { pollId, passengers: rawPassengers, transporterId } = req.body;
    const tId = transporterId || req.userId;

    // 1. Resolve passengers
    let passengers = rawPassengers || [];
    if (pollId && !passengers.length) {
      const poll = await Poll.findById(pollId).lean();
      if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
      passengers = await hydratePassengersFromPoll(poll);
    }
    if (!passengers.length) {
      return res.json({ success: true, message: 'No passengers to optimize', onward: { routes: [], unassigned: [] }, return: { routes: [], unassigned: [] } });
    }

    // 2. Fetch drivers
    const drivers = await fetchDrivers(tId);
    if (!drivers.length) {
      return res.json({
        success: false,
        message: 'No drivers found for this transporter. Cannot assign routes.',
        driverCount: 0,
      });
    }

    // 3. Get live petrol price
    let petrolPrice = 280;
    try { petrolPrice = await getLivePetrolPrice(); } catch (_) {}

    // 4. Run smart optimizer
    const result = await smartAutoAssign(passengers, drivers, { petrolPricePKR: petrolPrice });

    res.json({
      ...result,
      driverCount:    drivers.length,
      passengerCount: passengers.length,
      dryRun:         true,
      message:        `Optimization complete. ${result.summary.assignedRoutes} routes ready for ${result.summary.driversUsed.length} driver(s).`,
    });

  } catch (err) {
    console.error('[SmartAssign] /optimize error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/smart-assign/save  (SAVES to MongoDB)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/save', auth, async (req, res) => {
  try {
    const { pollId, passengers: rawPassengers, transporterId } = req.body;
    const tId = transporterId || req.userId;

    // 1. Resolve passengers
    let passengers = rawPassengers || [];
    let poll = null;
    if (pollId) {
      poll = await Poll.findById(pollId).lean();
      if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
      if (!passengers.length) {
        passengers = await hydratePassengersFromPoll(poll);
      }
    }
    if (!passengers.length) {
      return res.status(400).json({ success: false, message: 'No passengers to process' });
    }

    // 2. Check for existing routes (avoid duplicates)
    if (pollId) {
      const existing = await Route.find({ pollId, transporterId: tId }).select('_id status').lean();
      const unassigned = existing.filter(r => r.status === 'unassigned' || r.status === 'pending');
      if (existing.length && unassigned.length === 0) {
        return res.json({
          success: true,
          message: 'Routes already fully assigned for this poll.',
          alreadyProcessed: true,
        });
      }
    }

    // 3. Fetch drivers
    const drivers = await fetchDrivers(tId);

    // 4. Live petrol price
    let petrolPrice = 280;
    try { petrolPrice = await getLivePetrolPrice(); } catch (_) {}

    // 5. Run smart optimizer
    const result = await smartAutoAssign(passengers, drivers, { petrolPricePKR: petrolPrice });

    // ── 6. Save Both Pools to MongoDB ─────────────────────────────────────
    const savedRoutes     = [];
    const unassignedSaved = [];

    const savePool = async (pool) => {
      const allPoolRoutes = [...pool.routes, ...pool.unassigned];
      for (const r of allPoolRoutes) {
        const routeDoc = new Route({
          routeName:       r.routeName,
          pollId:          pollId || null,
          transporterId:   tId,
          vehicleType:     r.vehicleType,
          destination:     r.destination,
          destinationLat:  r.destinationLat,
          destinationLng:  r.destinationLng,
          passengers:      r.passengers,
          stops:           r.stops.map(s => s.address || s.name || ''),
          estimatedKm:     r.estimatedKm,
          estimatedTime:   r.estimatedTime,
          estimatedFuel:   r.estimatedFuel,
          fuelCostPKR:     r.fuelCostPKR,
          fuelType:        'petrol',
          pricePerLitre:   r.pricePerLitre,
          fuelRatePerKm:   r.fuelRatePerKm,

          // Driver assignment
          assignedDriver:  r.assignedDriver  || null,
          driverName:      r.driverName      || null,
          status:          r.status          || 'unassigned',
          pickupTime:      r.passengers?.[0]?.timeSlot || '',
          date:            new Date(),

          // Flags
          isOptimized:     true,
          isAssigned:      r.isAssigned || false,
          isAutoProcessed: true,
          autoProcessedAt: new Date(),
          autoAssigned:    r.autoAssigned || false,
        });

        const saved = await routeDoc.save();

        if (r.status === 'assigned') {
          savedRoutes.push({
            routeId:     saved._id,
            routeName:   saved.routeName,
            vehicleType: saved.vehicleType,
            passengers:  r.passengerCount,
            driver:      r.driverName,
            driverScore: r._driverScore,
          });
        } else {
          unassignedSaved.push({
            routeId:     saved._id,
            routeName:   saved.routeName,
            vehicleType: saved.vehicleType,
            passengers:  r.passengerCount,
            reason:      r._unassignReason || 'No suitable driver available',
          });
        }
      }
    };

    await savePool(result.onward);
    await savePool(result.return);

    res.json({
      success:          true,
      message:          `${savedRoutes.length} route(s) assigned, ${unassignedSaved.length} unassigned (saved for manual assignment).`,
      assignedRoutes:   savedRoutes,
      unassignedRoutes: unassignedSaved,
      summary:          result.summary,
      onwardPool: {
        label:      result.onward.label,
        passengers: result.onward.totalPassengers,
        routes:     result.onward.totalRoutes,
      },
      returnPool: {
        label:      result.return.label,
        passengers: result.return.totalPassengers,
        routes:     result.return.totalRoutes,
      },
    });

  } catch (err) {
    console.error('[SmartAssign] /save error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/smart-assign/preview/:pollId  (quick preview)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/preview/:pollId', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.pollId).lean();
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    const tId      = poll.transporterId?.toString() || req.userId;
    const passengers = await hydratePassengersFromPoll(poll);
    const drivers    = await fetchDrivers(tId);

    let petrolPrice = 280;
    try { petrolPrice = await getLivePetrolPrice(); } catch (_) {}

    const result = await smartAutoAssign(passengers, drivers, { petrolPricePKR: petrolPrice });

    res.json({
      success:        true,
      pollId:         req.params.pollId,
      passengerCount: passengers.length,
      driverCount:    drivers.length,
      preview:        result,
    });
  } catch (err) {
    console.error('[SmartAssign] /preview error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;