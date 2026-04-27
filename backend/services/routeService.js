'use strict';
/**
 * services/routeService.js
 *
 * PURPOSE:
 *   This service is the fix for Bug #1 — the original midnightAutoAssign()
 *   only looked for routes that ALREADY existed in the DB with status
 *   'unassigned'/'pending'. If the transporter never manually saved routes
 *   (i.e. never clicked Optimize → Save in the app), there was NOTHING for
 *   the cron to assign, so the entire auto-assignment loop ran on an empty
 *   array and silently did nothing.
 *
 *   This service adds the missing Phase 2 step:
 *     1. Find all transporters whose polls closed but routes were NOT created
 *     2. Run the VRP optimizer on poll responses (same logic as /api/routes/optimize)
 *     3. Save the resulting Route documents to MongoDB with isOptimized: true
 *     4. Return the saved routes so assignmentService can assign drivers to them
 *
 * EXPORTS:
 *   autoOptimizeAndSaveRoutes(transporterId) → { saved: Route[], skipped: number }
 *   hasCompletedPipeline(transporterId)      → boolean
 */

const axios = require('axios');
const Poll  = require('../models/Poll');
const Route = require('../models/Route');
const User  = require('../models/User');

const {
  optimizeRoutes,
  getLivePetrolPrice,
  validGPS,
  safeCoord,
  resolveVehicleType,
  getMostCommonArea,
  calcFuelForRoute,
  DEFAULT_DEST,
  VCAPS,
} = require('../utils/vrpOptimizer');

const { SOLVICE_API_KEY, SOLVICE_BASE } = require('../config/constants');

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Solvice VRP (mirrors routes.js — kept here so this service is
// self-contained and does not need to import from a route file)
// ─────────────────────────────────────────────────────────────────────────────

function buildSolvicePayload(passengers) {
  const carPax  = passengers.filter(p => p.vehiclePreference === 'car');
  const flexPax = passengers.filter(p => p.vehiclePreference !== 'car');
  const vehicles = [];

  if (carPax.length) {
    for (let i = 0; i < Math.ceil(carPax.length / VCAPS.car); i++) {
      vehicles.push({
        id: `car_${i + 1}`, type_id: 'car_type',
        start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
        end:   { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
        capacity: [VCAPS.car], tags: ['car'],
      });
    }
  }
  if (flexPax.length) {
    for (let i = 0; i < Math.ceil(flexPax.length / VCAPS.van); i++) {
      vehicles.push({
        id: `van_${i + 1}`, type_id: 'van_type',
        start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
        end:   { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
        capacity: [VCAPS.van], tags: ['van', 'bus'],
      });
    }
  }
  if (!vehicles.length) {
    vehicles.push({
      id: 'van_1', type_id: 'van_type',
      start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
      end:   { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng },
      capacity: [VCAPS.van], tags: ['van', 'bus'],
    });
  }

  const jobs = passengers
    .filter(p => validGPS(p.pickupLat, p.pickupLng))
    .map(p => ({
      id:       p.id,
      location: { lat: safeCoord(p.pickupLat), lng: safeCoord(p.pickupLng) },
      delivery: [1],
      required_tags: p.vehiclePreference === 'car' ? ['car'] : ['van', 'bus', 'car'],
      custom: {
        name:              p.name,
        pickupAddress:     p.pickupAddress || '',
        dropAddress:       p.dropAddress   || DEFAULT_DEST.address,
        dropLat:           safeCoord(p.dropLat,  DEFAULT_DEST.lat),
        dropLng:           safeCoord(p.dropLng,  DEFAULT_DEST.lng),
        vehiclePreference: p.vehiclePreference || null,
        timeSlot:          p.timeSlot          || null,
      },
    }));

  return {
    vehicles,
    vehicle_types: [
      { id: 'car_type', profile: 'car' },
      { id: 'van_type', profile: 'car' },
    ],
    jobs,
    options: { g: true, overview: 'full' },
  };
}

async function parseSolviceSolution(solution, passengers, petrolPrice) {
  if (!solution?.routes?.length) return [];
  const pMap = {};
  passengers.forEach(p => { pMap[p.id] = p; });
  const routes = [];

  for (let ri = 0; ri < solution.routes.length; ri++) {
    const sr = solution.routes[ri];
    const routePax = [];
    const stops    = [];

    for (const step of (sr.steps || [])) {
      if (step.type === 'job' || step.type === 'pickup') {
        const p = pMap[step.id || step.job_id];
        if (p) {
          routePax.push(p);
          stops.push({
            name:    p.name,
            address: p.pickupAddress || `${safeCoord(p.pickupLat).toFixed(4)}, ${safeCoord(p.pickupLng).toFixed(4)}`,
            lat:     safeCoord(p.pickupLat),
            lng:     safeCoord(p.pickupLng),
            type:    'pickup',
          });
        }
      }
    }
    if (!routePax.length) continue;

    const destLat  = safeCoord(routePax[0]?.dropLat,  DEFAULT_DEST.lat);
    const destLng  = safeCoord(routePax[0]?.dropLng,  DEFAULT_DEST.lng);
    const destAddr = routePax[0]?.dropAddress || DEFAULT_DEST.address;
    stops.push({ name: 'Destination', address: destAddr, lat: destLat, lng: destLng, type: 'dropoff' });

    const distanceKm   = Math.max(safeCoord(sr.summary?.distance ?? sr.distance, 0) / 1000, 5);
    const durationMins = Math.max(Math.round(safeCoord(sr.summary?.duration ?? sr.duration, 0) / 60), 10);
    const vType = resolveVehicleType(routePax);
    const { litres: fuelLitres, consumption } = calcFuelForRoute(distanceKm, vType);
    const fuelCostPKR = Math.round(fuelLitres * petrolPrice);

    routes.push({
      vehicleType:      vType,
      passengerCount:   routePax.length,
      passengers:       routePax,
      stops,
      destination:      destAddr,
      destinationLat:   destLat,
      destinationLng:   destLng,
      areaLabel:        getMostCommonArea(routePax.map(p => p.pickupAddress)),
      estimatedKm:      `${distanceKm.toFixed(1)} km`,
      estimatedTime:    durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`,
      estimatedFuel:    `${fuelLitres.toFixed(1)} L`,
      fuelCostPKR:      `Rs. ${fuelCostPKR.toLocaleString()}`,
      fuelType:         'petrol',
      pricePerLitre:    petrolPrice,
      fuelRatePerKm:    +(fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3),
      rawDistanceKm:    +distanceKm.toFixed(2),
      rawDurationMins:  durationMins,
    });
  }
  return routes;
}

async function callSolviceVRP(passengers, petrolPrice) {
  try {
    const validPax = passengers.filter(p => validGPS(p.pickupLat, p.pickupLng));
    if (!validPax.length) return null;

    const res = await axios.post(
      `${SOLVICE_BASE}/v2/vrp/solve`,
      buildSolvicePayload(validPax),
      { headers: { Authorization: SOLVICE_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    if (res.data?.routes?.length) {
      return await parseSolviceSolution(res.data, passengers, petrolPrice);
    }

    // Async job — poll for result
    const jobToken = res.data?.token || res.data?.id || res.data?.jobId;
    if (!jobToken) return null;

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const poll = await axios.get(
          `${SOLVICE_BASE}/v2/vrp/${jobToken}/result`,
          { headers: { Authorization: SOLVICE_API_KEY }, timeout: 10000 }
        );
        const d = poll.data;
        if (d?.status === 'error' || d?.status === 'failed') return null;
        if (d?.routes?.length || d?.status === 'finished') {
          return await parseSolviceSolution(d, passengers, petrolPrice);
        }
      } catch (_) { /* retry */ }
    }
    return null;
  } catch (e) {
    console.warn('[RouteService] Solvice VRP error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: Hydrate poll responses into the passenger shape expected by the VRP
// This is the same transformation as POST /api/routes/optimize in routes.js
// ─────────────────────────────────────────────────────────────────────────────

async function hydratePassengers(poll) {
  const yesResponses = (poll.responses || []).filter(r => r.response === 'yes');
  if (!yesResponses.length) return [];

  // Bulk-fetch user profiles for GPS fallback
  const passengerIds = yesResponses.map(r => r.passengerId).filter(Boolean);
  const dbUsersArr   = passengerIds.length
    ? await User.find({ _id: { $in: passengerIds } }).lean()
    : [];
  const dbUsers = {};
  dbUsersArr.forEach(u => { dbUsers[u._id.toString()] = u; });

  return yesResponses.map((r, i) => {
    const db = dbUsers[r.passengerId?.toString()] || {};

    // Prefer poll-response coordinates, fall back to user profile coords
    const pickupLat = parseFloat(r.pickupLat)  || parseFloat(db.latitude)              || parseFloat(db.pickupLat)  || 0;
    const pickupLng = parseFloat(r.pickupLng)  || parseFloat(db.longitude)             || parseFloat(db.pickupLng)  || 0;
    const dropLat   = parseFloat(r.dropLat)    || parseFloat(db.destinationLatitude)   || parseFloat(db.dropLat)    || 0;
    const dropLng   = parseFloat(r.dropLng)    || parseFloat(db.destinationLongitude)  || parseFloat(db.dropLng)    || 0;

    return {
      id:                r.passengerId?.toString() || `p_${i}`,
      name:              r.passengerName  || db.name        || 'Passenger',
      pickupLat,
      pickupLng,
      pickupAddress:     r.pickupPoint    || db.pickupPoint || db.address || '',
      dropLat,
      dropLng,
      dropAddress:       r.destination    || db.destination  || '',
      vehiclePreference: r.vehiclePreference || db.vehiclePreference || null,
      timeSlot:          r.selectedTimeSlot  || null,
      // Keep original IDs for saving to Route.passengers
      passengerId:       r.passengerId,
      passengerName:     r.passengerName  || db.name || 'Passenger',
      passengerEmail:    r.passengerEmail || db.email || '',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether a transporter has already completed the full manual pipeline:
 *   - Has at least one Route in the DB with isOptimized AND isAssigned both true
 *   - OR all routes are already status:'assigned'
 *
 * Used by schedulerService to decide whether to skip a transporter at 12 AM.
 *
 * @param   {ObjectId|string} transporterId
 * @returns {Promise<boolean>}
 */
async function hasCompletedPipeline(transporterId) {
  const routes = await Route.find({ transporterId }).select('status isOptimized isAssigned isAutoProcessed').lean();
  if (!routes.length) return false;

  // If every route is assigned (manually or auto), pipeline is done
  const allAssigned = routes.every(r => r.status === 'assigned' || r.status === 'in_progress' || r.status === 'completed');
  if (allAssigned) return true;

  // If any route is still unassigned/pending, pipeline is NOT complete
  return false;
}

/**
 * MAIN FUNCTION — called by schedulerService at 12 AM for each transporter.
 *
 * Step 1: Find today's closed polls for this transporter with 'yes' responses
 * Step 2: If routes already exist for this poll → skip (don't duplicate)
 * Step 3: Run VRP optimizer on poll responses (Solvice first, internal fallback)
 * Step 4: Save each optimized route as a Route document with isOptimized: true
 * Step 5: Return saved Route objects for assignmentService to assign drivers
 *
 * @param   {ObjectId|string} transporterId
 * @returns {Promise<{ saved: Route[], skipped: number, error: string|null }>}
 */
async function autoOptimizeAndSaveRoutes(transporterId) {
  const result = { saved: [], skipped: 0, error: null };

  try {
    console.log(`[RouteService] Auto-optimize starting for transporter: ${transporterId}`);

    // ── STEP 1: Find today's closed polls ──────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // ✅ FIX: Only process MORNING polls for route creation.
    //    Return polls are information-only and must NOT generate routes.
    const polls = await Poll.find({
      transporterId,
      pollType:  'morning',
      status:    'closed',
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }).lean();

    if (!polls.length) {
      console.log(`[RouteService] No closed morning polls found for transporter ${transporterId} today`);
      result.error = 'No closed morning polls found for today';
      return result;
    }

    for (const poll of polls) {
      // ── STEP 2: Check for duplicate routes ──────────────────────────────
      const existingRoutes = await Route.find({
        pollId:        poll._id,
        transporterId,
        isAutoProcessed: false,  // Don't skip if we already auto-processed
      }).select('_id status isOptimized isAssigned').lean();

      // If manually-created routes exist and some are unassigned — let assignmentService handle them
      if (existingRoutes.length) {
        const unassigned = existingRoutes.filter(r =>
          r.status === 'unassigned' || r.status === 'pending'
        );
        if (unassigned.length === 0) {
          console.log(`[RouteService] All routes for poll ${poll._id} already assigned — skipping`);
          result.skipped += existingRoutes.length;
          continue;
        }
        // Return existing unassigned routes so assignmentService can assign drivers
        const unassignedDocs = await Route.find({ _id: { $in: unassigned.map(r => r._id) } });
        result.saved.push(...unassignedDocs);
        result.skipped += (existingRoutes.length - unassigned.length);
        console.log(`[RouteService] Found ${unassigned.length} existing unassigned routes for poll ${poll._id}`);
        continue;
      }

      // ── STEP 3: Hydrate passengers from poll responses ──────────────────
      const passengers = await hydratePassengers(poll);
      if (!passengers.length) {
        console.log(`[RouteService] Poll ${poll._id} has no 'yes' responses — skipping`);
        result.skipped++;
        continue;
      }

      console.log(`[RouteService] Optimizing ${passengers.length} passengers for poll ${poll._id}...`);

      // ── STEP 4: Run VRP optimizer ────────────────────────────────────────
      let petrolPrice = 280; // fallback price PKR
      try { petrolPrice = await getLivePetrolPrice(); } catch (_) {}

      let optimizedRoutes = null;
      try {
        optimizedRoutes = await callSolviceVRP(passengers, petrolPrice);
        if (optimizedRoutes?.length) {
          console.log(`[RouteService] Solvice returned ${optimizedRoutes.length} routes`);
        }
      } catch (solviceErr) {
        console.warn('[RouteService] Solvice failed, using internal optimizer:', solviceErr.message);
      }

      if (!optimizedRoutes?.length) {
        try {
          optimizedRoutes = await optimizeRoutes(passengers);
          console.log(`[RouteService] Internal optimizer returned ${optimizedRoutes?.length || 0} routes`);
        } catch (internalErr) {
          console.error('[RouteService] Internal optimizer also failed:', internalErr.message);
          result.error = `Optimizer failed: ${internalErr.message}`;
          continue;
        }
      }

      if (!optimizedRoutes?.length) {
        console.warn(`[RouteService] No routes generated for poll ${poll._id}`);
        result.skipped++;
        continue;
      }

      // ── STEP 5: Save routes to DB ────────────────────────────────────────
      for (let i = 0; i < optimizedRoutes.length; i++) {
        const opt = optimizedRoutes[i];

        // Map optimized passengers back to the Route.passengers schema
        const routePassengers = (opt.passengers || []).map(p => ({
          passengerId:    p.passengerId   || p.id,
          passengerName:  p.passengerName || p.name || 'Passenger',
          pickupPoint:    p.pickupAddress || '',
          destination:    p.dropAddress   || '',
          destinationLat: safeCoord(p.dropLat,  DEFAULT_DEST.lat),
          destinationLng: safeCoord(p.dropLng,  DEFAULT_DEST.lng),
          latitude:       safeCoord(p.pickupLat),
          longitude:      safeCoord(p.pickupLng),
          status:         'pending',
        }));

        const newRoute = new Route({
          routeName:      `Auto Route ${i + 1} — ${new Date().toLocaleDateString('en-PK')}`,
          pollId:         poll._id,
          transporterId,
          vehicleType:    opt.vehicleType   || 'van',
          destination:    opt.destination   || DEFAULT_DEST.address,
          destinationLat: opt.destinationLat || DEFAULT_DEST.lat,
          destinationLng: opt.destinationLng || DEFAULT_DEST.lng,
          passengers:     routePassengers,
          stops:          (opt.stops || []).map(s => s.address || s.name || ''),
          estimatedKm:    opt.estimatedKm   || '',
          estimatedTime:  opt.estimatedTime || '',
          estimatedFuel:  opt.estimatedFuel || '',
          fuelCostPKR:    opt.fuelCostPKR   || '',
          fuelType:       'petrol',
          pricePerLitre:  opt.pricePerLitre || petrolPrice,
          fuelRatePerKm:  opt.fuelRatePerKm || 0,
          status:         'unassigned',
          timeSlot:       poll.routeStartTime || '',
          pickupTime:     poll.routeStartTime || '',
          date:           new Date(),

          // ── NEW FLAGS ───────────────────────────────────────────────────
          isOptimized:     true,   // VRP ran successfully
          isAssigned:      false,  // driver not yet assigned
          isAutoProcessed: true,   // created by the auto-pipeline
          autoProcessedAt: new Date(),
          autoAssigned:    false,
        });

        const saved = await newRoute.save();
        result.saved.push(saved);
        console.log(`[RouteService] Saved auto route: "${saved.routeName}" (${routePassengers.length} pax)`);
      }
    }

    console.log(
      `[RouteService] Done for transporter ${transporterId}: ` +
      `${result.saved.length} saved, ${result.skipped} skipped`
    );
  } catch (err) {
    console.error('[RouteService] autoOptimizeAndSaveRoutes error:', err.message);
    result.error = err.message;
  }

  return result;
}

module.exports = { autoOptimizeAndSaveRoutes, hasCompletedPipeline };