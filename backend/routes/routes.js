'use strict';
const express  = require('express');
const axios    = require('axios');
const router   = express.Router();

const Route    = require('../models/Route');
const Trip     = require('../models/Trip');
const Poll     = require('../models/Poll');
const User     = require('../models/User');
const DriverAvailability = require('../models/DriverAvailability');
const auth     = require('../middleware/auth');
const sendNotification   = require('../helpers/notification');
const {
  optimizeRoutes, getLivePetrolPrice, validGPS, safeCoord,
  resolveVehicleType, getMostCommonArea, calcFuelForRoute,
  DEFAULT_DEST, VCAPS,
} = require('../utils/vrpOptimizer');
const { SOLVICE_API_KEY, SOLVICE_BASE } = require('../config/constants');

// ── Solvice helpers ───────────────────────────────────────────────
function buildSolviceVRPPayload(passengers) {
  const carPax  = passengers.filter(p => p.vehiclePreference === 'car');
  const flexPax = passengers.filter(p => p.vehiclePreference !== 'car');
  const vehicles = [];
  if (carPax.length)  for (let i = 0; i < Math.ceil(carPax.length / VCAPS.car);  i++) vehicles.push({ id: `car_${i+1}`,  type_id: 'car_type', start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, end: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, capacity: [VCAPS.car],  tags: ['car'] });
  if (flexPax.length) for (let i = 0; i < Math.ceil(flexPax.length / VCAPS.van); i++) vehicles.push({ id: `van_${i+1}`,  type_id: 'van_type', start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, end: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, capacity: [VCAPS.van],  tags: ['van', 'bus'] });
  if (!vehicles.length) vehicles.push({ id: 'van_1', type_id: 'van_type', start: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, end: { lat: DEFAULT_DEST.lat, lng: DEFAULT_DEST.lng }, capacity: [VCAPS.van], tags: ['van', 'bus'] });
  const jobs = passengers.filter(p => validGPS(p.pickupLat, p.pickupLng)).map(p => ({
    id: p.id,
    location: { lat: safeCoord(p.pickupLat), lng: safeCoord(p.pickupLng) },
    delivery: [1],
    required_tags: p.vehiclePreference === 'car' ? ['car'] : ['van', 'bus', 'car'],
    custom: { name: p.name, pickupAddress: p.pickupAddress || '', dropAddress: p.dropAddress || DEFAULT_DEST.address, dropLat: safeCoord(p.dropLat, DEFAULT_DEST.lat), dropLng: safeCoord(p.dropLng, DEFAULT_DEST.lng), vehiclePreference: p.vehiclePreference || null, timeSlot: p.timeSlot || null },
  }));
  return { vehicles, vehicle_types: [{ id: 'car_type', profile: 'car' }, { id: 'van_type', profile: 'car' }], jobs, options: { g: true, overview: 'full' } };
}

async function parseSolviceVRPSolution(solution, passengers, petrolPrice) {
  if (!solution?.routes?.length) return [];
  const pMap = {}; passengers.forEach(p => { pMap[p.id] = p; });
  const routes = [];
  for (let ri = 0; ri < solution.routes.length; ri++) {
    const sr = solution.routes[ri], routePax = [], stops = [];
    for (const step of (sr.steps || [])) { if (step.type === 'job' || step.type === 'pickup') { const p = pMap[step.id || step.job_id]; if (p) { routePax.push(p); stops.push({ name: p.name, address: p.pickupAddress || `${safeCoord(p.pickupLat).toFixed(4)}, ${safeCoord(p.pickupLng).toFixed(4)}`, lat: safeCoord(p.pickupLat), lng: safeCoord(p.pickupLng), type: 'pickup' }); } } }
    if (!routePax.length) continue;
    const destLat = safeCoord(routePax[0]?.dropLat, DEFAULT_DEST.lat), destLng = safeCoord(routePax[0]?.dropLng, DEFAULT_DEST.lng), destAddr = routePax[0]?.dropAddress || DEFAULT_DEST.address;
    stops.push({ name: 'Destination', address: destAddr, lat: destLat, lng: destLng, type: 'dropoff' });
    const distanceKm = Math.max(safeCoord(sr.summary?.distance ?? sr.distance, 0) / 1000, 5);
    const durationMins = Math.max(Math.round(safeCoord(sr.summary?.duration ?? sr.duration, 0) / 60), 10);
    const vType = resolveVehicleType(routePax), { litres: fuelLitres, consumption } = calcFuelForRoute(distanceKm, vType), fuelCostPKR = Math.round(fuelLitres * petrolPrice);
    routes.push({ id: `route_${ri+1}`, vehicleType: vType, passengerCount: routePax.length, capacity: VCAPS[vType] || 12, passengers: routePax, stops, destination: destAddr, destinationLat: destLat, destinationLng: destLng, areaLabel: getMostCommonArea(routePax.map(p => p.pickupAddress)), estimatedKm: `${distanceKm.toFixed(1)} km`, estimatedTime: durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins/60)}h ${durationMins%60}m`, estimatedFuel: `${fuelLitres.toFixed(1)} L`, fuelCostPKR: `Rs. ${fuelCostPKR.toLocaleString()}`, fuelType: 'petrol', consumption: `${consumption} L/100km`, pricePerLitre: petrolPrice, fuelRatePerKm: +(fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3), rawDistanceKm: +distanceKm.toFixed(2), rawDurationMins: durationMins, rawFuelLitres: fuelLitres, rawFuelCostPKR: fuelCostPKR, matrixSource: 'solvice', optimizationScore: 0, preferenceGroup: routePax.some(p => p.vehiclePreference === 'car') || routePax.some(p => p.vehiclePreference === 'van' || p.vehiclePreference === 'bus'), warnings: [] });
  }
  routes.sort((a, b) => { if (a.preferenceGroup && !b.preferenceGroup) return -1; if (!a.preferenceGroup && b.preferenceGroup) return 1; return b.passengerCount - a.passengerCount; });
  return routes;
}

async function callSolviceVRP(passengers, petrolPrice) {
  try {
    const validPax = passengers.filter(p => validGPS(p.pickupLat, p.pickupLng));
    if (!validPax.length) return null;
    const submitRes = await axios.post(`${SOLVICE_BASE}/v2/vrp/solve`, buildSolviceVRPPayload(validPax), { headers: { Authorization: SOLVICE_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 });
    if (submitRes.data?.routes?.length) return await parseSolviceVRPSolution(submitRes.data, passengers, petrolPrice);
    const jobToken = submitRes.data?.token || submitRes.data?.id || submitRes.data?.jobId;
    if (!jobToken) return null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try { const d = (await axios.get(`${SOLVICE_BASE}/v2/vrp/${jobToken}/result`, { headers: { Authorization: SOLVICE_API_KEY }, timeout: 10000 })).data; if (d?.status === 'error' || d?.status === 'failed') return null; if (d?.routes?.length || d?.status === 'finished') return await parseSolviceVRPSolution(d, passengers, petrolPrice); } catch {}
    }
    return null;
  } catch (e) { console.warn('[Solvice] callSolviceVRP:', e.message); return null; }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

// Parse "07:00 AM" / "07:00" into today's Date object
function parseTimeToday(timeStr) {
  if (!timeStr) return null;
  try {
    const now   = new Date();
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let hours       = parseInt(match[1], 10);
    const mins      = parseInt(match[2], 10);
    const ampm      = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
  } catch { return null; }
}

// ═════════════════════════════════════════════════════════════════
// POST /api/routes/optimize  ← MUST be before /:routeId
// ═════════════════════════════════════════════════════════════════
router.post('/optimize', auth, async (req, res) => {
  try {
    const { pollId, passengers: rawPassengers } = req.body;
    let passengers = rawPassengers || [];
    if (pollId && !passengers.length) {
      const poll = await Poll.findById(pollId);
      if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
      const yesRes = poll.responses.filter(r => r.response === 'yes');
      if (!yesRes.length) return res.json({ success: true, routes: [], count: 0, message: 'No passengers confirmed travel' });

      // Hydrate GPS coordinates from User collection for passengers missing them
      const passengerIds = yesRes.map(r => r.passengerId).filter(Boolean);
      const dbUsers = {};
      if (passengerIds.length) {
        const users = await User.find({ _id: { $in: passengerIds } }).lean();
        users.forEach(u => { dbUsers[u._id.toString()] = u; });
      }

      passengers = yesRes.map((r, i) => {
        const db = dbUsers[r.passengerId?.toString()] || {};
        // Prefer poll response coords, fall back to user profile coords
        const pickupLat = parseFloat(r.pickupLat) || parseFloat(db.latitude)  || parseFloat(db.pickupLat)  || 0;
        const pickupLng = parseFloat(r.pickupLng) || parseFloat(db.longitude) || parseFloat(db.pickupLng)  || 0;
        const dropLat   = parseFloat(r.dropLat)   || parseFloat(db.destinationLatitude)  || parseFloat(db.dropLat)  || 0;
        const dropLng   = parseFloat(r.dropLng)   || parseFloat(db.destinationLongitude) || parseFloat(db.dropLng)  || 0;
        return {
          id:                r.passengerId?.toString() || `p_${i}`,
          name:              r.passengerName || db.name || 'Passenger',
          pickupLat,
          pickupLng,
          pickupAddress:     r.pickupPoint || db.pickupPoint || db.address || '',
          dropLat,
          dropLng,
          dropAddress:       r.destination || db.destination || '',
          vehiclePreference: r.vehiclePreference || db.vehiclePreference || null,
          timeSlot:          r.selectedTimeSlot || null,
        };
      });
    }
    if (!passengers.length) return res.status(400).json({ success: false, message: 'No passengers found' });
    const petrolPrice = await getLivePetrolPrice();
    let routes = await callSolviceVRP(passengers, petrolPrice), optimizerUsed = 'solvice';
    if (!routes?.length) { optimizerUsed = 'internal'; routes = await optimizeRoutes(passengers); }
    if (!routes?.length) return res.json({ success: true, routes: [], count: 0, message: 'Could not generate routes' });
    res.json({ success: true, routes, count: routes.length, optimizerUsed, totalPassengers: routes.reduce((s, r) => s + r.passengerCount, 0), petrolPricePerL: petrolPrice });
  } catch (err) { console.error('[VRP] optimize error:', err); res.status(500).json({ success: false, message: err.message }); }
});

// ═════════════════════════════════════════════════════════════════
// POST /api/routes  — create route
// ═════════════════════════════════════════════════════════════════
router.post('/', auth, async (req, res) => {
  try {
    const body = { ...req.body, transporterId: req.body.transporterId || req.userId };

    // ── DESTINATION NAME GUARD ────────────────────────────────────────────────
    // Ensure each passenger's `destination` field is a PLACE NAME, not a person name.
    // If destination matches passengerName, replace it with route-level destination
    // or an empty string so the frontend resolveDestinationName() can handle it.
    if (Array.isArray(body.passengers)) {
      body.passengers = body.passengers.map(p => {
        const dest = p.destination || '';
        const isSameasName = dest && (dest === p.passengerName || dest === p.name);
        return {
          ...p,
          destination: isSameasName ? (body.destination || '') : dest,
        };
      });
    }

    const r = new Route(body);
    await r.save();
    res.status(201).json({ success: true, route: r });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═════════════════════════════════════════════════════════════════
// GET /api/routes
// Supports: ?transporterId=  ?assignedDriver=  ?passengerId=  ?status=
// ═══════════════════════════════════════════════════════════════
router.get('/', auth, async (req, res) => {
  try {
    const filter = {};

    if (req.query.assignedDriver) {
      // Driver fetching their own assigned routes
      filter.assignedDriver = req.query.assignedDriver;
      filter.status = { $nin: ['completed', 'missed', 'cancelled'] };

    } else if (req.query.passengerId) {
      // Passenger fetching routes they are part of
      const pid = req.query.passengerId;
      filter.$or = [
        { 'passengers.passengerId': pid },
        { 'passengers._id': pid },
      ];
      filter.status = { $nin: ['completed', 'missed', 'cancelled'] };

    } else {
      // Transporter fetching all their routes
      filter.transporterId = req.query.transporterId || req.userId;
    }

    if (req.query.status) filter.status = req.query.status;

    const routes = await Route.find(filter)
      .populate('assignedDriver', 'name email phone vehicleNo vehicleType vehicleNumber rating')
      .sort({ createdAt: -1 });

    res.json({ success: true, routes, data: routes });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═════════════════════════════════════════════════════════════════
// GET /api/routes/:routeId
// ═════════════════════════════════════════════════════════════════
router.get('/:routeId', auth, async (req, res) => {
  try {
    const r = await Route.findById(req.params.routeId)
      .populate('assignedDriver', 'name email phone vehicleNo vehicleType');
    if (!r) return res.status(404).json({ success: false });
    res.json({ success: true, route: r });
  } catch { res.status(500).json({ success: false }); }
});

// ═════════════════════════════════════════════════════════════════
// PUT /api/routes/:routeId
// ═════════════════════════════════════════════════════════════════
router.put('/:routeId', auth, async (req, res) => {
  try {
    const r = await Route.findByIdAndUpdate(req.params.routeId, req.body, { new: true });
    if (!r) return res.status(404).json({ success: false });
    res.json({ success: true, route: r });
  } catch { res.status(500).json({ success: false }); }
});

// ═════════════════════════════════════════════════════════════════
// PUT /api/routes/:routeId/assign-driver
// ENHANCED: checks driver availability before assigning
// ═════════════════════════════════════════════════════════════════
router.put('/:routeId/assign-driver', auth, async (req, res) => {
  try {
    const dr = await User.findById(req.body.driverId);
    if (!dr) return res.status(404).json({ success: false, message: 'Driver not found' });

    // ── Availability check ───────────────────────────────────────
    // FIX: Use UTC midnight dates to match how driver availability is stored
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setUTCHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setUTCHours(23, 59, 59, 999);

    // ✅ FIX 2: 'confirmed' status bhi allow karo, pehle sirf 'available' tha
    const availRecord = await DriverAvailability.findOne({
      driverId: req.body.driverId,
      status:   { $in: ['available', 'confirmed'] },   // <-- yahan FIX hai
      date: {
        $gte: tomorrowStart,
        $lte: tomorrowEnd,
      },
    });

    if (!availRecord) {
      return res.status(400).json({
        success: false,
        message: `Driver "${dr.name}" has not marked availability for tomorrow. Please select an available driver.`,
        notAvailable: true,
      });
    }

    // FIX: Fetch route FIRST so we have its existing pickupTime before update
    const existingRoute = await Route.findById(req.params.routeId);
    if (!existingRoute) return res.status(404).json({ success: false, message: 'Route not found' });

    const r = await Route.findByIdAndUpdate(
      req.params.routeId,
      {
        assignedDriver: req.body.driverId,
        driverName:     dr.name,
        status:         'assigned',
        pickupTime:     availRecord.startTime || req.body.pickupTime || existingRoute.pickupTime || existingRoute.timeSlot,
      },
      { new: true }
    );
    if (!r) return res.status(404).json({ success: false, message: 'Route not found' });

    // Notify driver
    await sendNotification(
      req.body.driverId,
      'driver',
      'Route Assigned 🗺️',
      `You have been assigned route: "${r.routeName || r.name}". Pickup time: ${r.pickupTime || r.timeSlot}`,
      'route_assigned',
      r._id,
      'route',
      true,
      'view_route'
    );

    res.json({ success: true, route: r, message: 'Driver assigned successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═════════════════════════════════════════════════════════════════
// POST /api/routes/:routeId/start
// Time check: cannot start more than 30 mins before scheduled time
// ═════════════════════════════════════════════════════════════════
router.post('/:routeId/start', auth, async (req, res) => {
  try {
    const r = await Route.findById(req.params.routeId)
      .populate('assignedDriver', 'name');

    if (!r) return res.status(404).json({ success: false, message: 'Route not found' });

    // ── 🚫 TEMPORARILY DISABLED: Time check commented out for testing ──
    /*
    const routeTime = parseTimeToday(r.pickupTime || r.timeSlot);
    if (routeTime) {
      const now      = new Date();
      const diffMs   = routeTime - now;
      const diffMins = Math.round(diffMs / 60000);

      if (diffMins > 30) {
        return res.status(400).json({
          success:       false,
          message:       `Route cannot be started yet. Scheduled time: ${r.pickupTime || r.timeSlot}. You are ${diffMins} minutes early. You can only start at the scheduled time (up to 30 minutes before).`,
          scheduledTime: r.pickupTime || r.timeSlot,
          minutesEarly:  diffMins,
        });
      }
    }
    */
    // ✅ Routes can now be started ANYTIME

    await Route.findByIdAndUpdate(r._id, { status: 'in_progress', startedAt: new Date() });

    // Create Trip record
    const trip = new Trip({
      routeId:       r._id,
      routeName:     r.routeName || r.name,
      driverId:      req.userId,
      driverName:    r.driverName,
      transporterId: r.transporterId,
      passengers:    (r.passengers || []).map(p => ({ ...( p._doc || p), status: 'pending' })),
      timeSlot:      r.pickupTime || r.timeSlot,
      status:        'En Route',
      startedAt:     new Date(),
    });
    await trip.save();

    // Notify first passenger to be ready
    const firstPending = (r.passengers || [])[0];
    if (firstPending?.passengerId) {
      await sendNotification(
        firstPending.passengerId, 'passenger',
        'Van is on the way! 🚐',
        `${r.driverName || 'Driver'} has started the route. You are the first pickup — get ready!`,
        'next_pickup', trip._id, 'trip', true, 'track_van'
      );
    }

    // Notify all other passengers
    for (let i = 1; i < (r.passengers || []).length; i++) {
      const p = r.passengers[i];
      if (p.passengerId) {
        await sendNotification(
          p.passengerId, 'passenger',
          'Van Departed! 🚐',
          `${r.driverName || 'Driver'} has started the route. Van is on its way!`,
          'trip_started', trip._id, 'trip', true, 'track_van'
        );
      }
    }

    // Notify transporter
    await sendNotification(
      r.transporterId, 'transporter',
      'Route Started 🚐',
      `Driver ${r.driverName} has started route "${r.routeName || r.name}".`,
      'route_started', r._id, 'route', false
    );

    // ── EMIT routeStarted to all passengers + transporter via Socket.io ──────
    try {
      const io = req.app.get('io');
      if (io) {
        // Build complete passenger list with pickup coords and drop-off location
        const passengersPayload = (trip.passengers || []).map(p => ({
          passengerId:   p.passengerId?.toString() || p._id?.toString(),
          passengerName: p.passengerName || p.name || '',
          status:        p.status,
          pickupPoint:   p.pickupPoint || '',
          pickupLat:     p.pickupLat   || p.latitude  || null,
          pickupLng:     p.pickupLng   || p.longitude || null,
          // Drop-off: prefer dropOffLocation, then destinationLat/Lng, then route-level
          dropOffLocation: {
            latitude:  p.destinationLat || r.destinationLat || null,
            longitude: p.destinationLng || r.destinationLng || null,
            name:      p.destination    || r.destination    || 'Destination',
            address:   p.destination    || r.destination    || '',
          },
          destination:    p.destination    || r.destination    || null,
          destinationLat: p.destinationLat || r.destinationLat || null,
          destinationLng: p.destinationLng || r.destinationLng || null,
        }));

        // Primary drop-off location (route-level fallback)
        const primaryDropOff = {
          latitude:  r.destinationLat || null,
          longitude: r.destinationLng || null,
          name:      r.destination    || 'Destination',
          address:   r.destination    || '',
        };

        const routePayload = {
          rideId:          trip._id.toString(),
          tripId:          trip._id.toString(),
          routeId:         r._id.toString(),
          driverId:        trip.driverId?.toString(),
          driverName:      trip.driverName || r.driverName || 'Driver',
          vehicleType:     r.vehicleType || 'Van',
          passengers:      passengersPayload,
          encodedPolyline: r.encodedPolyline || null,
          destination:     r.destination    || null,
          destinationLat:  r.destinationLat || null,
          destinationLng:  r.destinationLng || null,
          // dropOffLocation is the canonical final drop-off field
          dropOffLocation: primaryDropOff,
          timestamp:       Date.now(),
        };

        // Notify ALL sockets in the ride room (driver already joined, passengers join on receipt)
        io.to(`ride_${trip._id}`).emit('routeStarted', routePayload);

        // Notify each passenger in their personal room (in case they haven't joined ride room yet)
        for (const p of (r.passengers || [])) {
          if (p.passengerId) {
            io.to(`user_${p.passengerId}`).emit('routeStarted', routePayload);
          }
        }
        // Notify transporter overview room and personal room
        if (r.transporterId) {
          io.to(`route_${r._id}`).emit('routeStarted', routePayload);
          io.to(`user_${r.transporterId}`).emit('routeStarted', routePayload);
        }

        // Also emit rideUpdated for any generic listeners
        io.to(`ride_${trip._id}`).emit('rideUpdated', { ...routePayload, event: 'routeStarted' });

        console.log('[Socket] routeStarted emitted for trip:', trip._id.toString());
      }
    } catch (socketErr) {
      console.warn('[routes/start] socket emit failed:', socketErr.message);
    }

    res.json({ success: true, trip, route: r, message: 'Route started!' });
  } catch (err) {
    console.error('start route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════
// PUT /api/routes/:routeId/stops/:stopId/status
// Driver marks a passenger as picked up
// Notifies the NEXT pending passenger to be ready
// ═════════════════════════════════════════════════════════════════
// Enhanced passenger confirm endpoint
router.put('/:routeId/stops/:stopId/passenger-confirm', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) return res.status(404).json({ success: false, message: 'Route not found' });

    const stopIndex = route.passengers.findIndex(p => p._id?.toString() === req.params.stopId || p.passengerId?.toString() === req.params.stopId);
    if (stopIndex === -1 || stopIndex !== route.currentStopIndex) {
      return res.status(400).json({ success: false, message: 'Not current stop or invalid stop' });
    }

    let status = route.stopStatuses?.find(s => s.stopIndex === stopIndex);
    if (!status) {
      status = { stopIndex, passengerConfirmed: true, driverConfirmed: false };
      if (!route.stopStatuses) route.stopStatuses = [];
      route.stopStatuses.push(status);
    } else {
      status.passengerConfirmed = true;
    }
    route.markModified('stopStatuses');
    await route.save();

    const io = req.app.get('io');
    const trip = await Trip.findOne({ routeId: route._id });
    if (trip) io.to(trip._id.toString()).emit('passengerReady', { stopIndex });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:routeId/stops/:stopId/status', auth, async (req, res) => {
  try {
    const r = await Route.findById(req.params.routeId);
    if (!r) return res.status(404).json({ success: false, message: 'Route not found' });

    const passengerIdx = r.passengers.findIndex(
      p => p._id?.toString() === req.params.stopId || p.passengerId?.toString() === req.params.stopId
    );
    if (passengerIdx === -1) return res.status(404).json({ success: false, message: 'Passenger not found' });

    r.passengers[passengerIdx].status   = 'picked';
    r.passengers[passengerIdx].pickedAt = new Date();
    r.markModified('passengers');
    await r.save();

    // Update Trip record
    await Trip.findOneAndUpdate(
      { routeId: r._id, status: 'En Route' },
      { $set: { [`passengers.${passengerIdx}.status`]: 'picked', [`passengers.${passengerIdx}.pickedAt`]: new Date() } }
    );

    const passenger = r.passengers[passengerIdx];

    // Notify this passenger that they are picked up
    if (passenger.passengerId) {
      await sendNotification(
        passenger.passengerId, 'passenger',
        'You have been picked up ✅',
        'Driver has picked you up. En route to destination!',
        'passenger_picked', r._id, 'route', true
      );
    }

    // Find NEXT pending passenger and notify them they're next
    const nextPending = r.passengers.find(
      (p, idx) => idx > passengerIdx && p.status !== 'picked'
    );
    if (nextPending?.passengerId) {
      const remainingBefore = r.passengers.slice(passengerIdx + 1, r.passengers.indexOf(nextPending));
      await sendNotification(
        nextPending.passengerId, 'passenger',
        'Van is coming for you! 🚐',
        `You are the next pickup. Get ready — ${r.driverName || 'Driver'} is on the way!`,
        'next_pickup', r._id, 'route', true
      );
    }

    res.json({
      success:   true,
      passenger: r.passengers[passengerIdx],
      nextStop:  nextPending || null,
      message:   'Passenger marked as picked',
    });
  } catch (err) {
    console.error('pickup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════
// POST /api/routes/:routeId/end  — Driver ends route
// ═════════════════════════════════════════════════════════════════
router.post('/:routeId/end', auth, async (req, res) => {
  try {
    const r = await Route.findById(req.params.routeId);
    if (!r) return res.status(404).json({ success: false, message: 'Route not found' });

    const endedAt = new Date();
    await Route.findByIdAndUpdate(r._id, { status: 'completed', endedAt });

    const trip = await Trip.findOneAndUpdate(
      { routeId: r._id, status: { $in: ['En Route', 'ongoing', 'active'] } },
      { status: 'completed', endTime: endedAt, endedAt },
      { new: true }
    );

    // Notify transporter
    await sendNotification(
      r.transporterId, 'transporter',
      'Route Completed ✅',
      `Driver ${r.driverName} has completed route "${r.routeName || r.name}". All passengers delivered.`,
      'route_completed', r._id, 'route', true
    );

    // Notify all passengers
    for (const p of (r.passengers || [])) {
      if (p.passengerId) {
        await sendNotification(
          p.passengerId, 'passenger',
          'Trip Complete ✅',
          "Today's trip is complete. Thank you for riding with us!",
          'trip_completed', trip?._id, 'trip', false
        );
      }
    }

    // Broadcast statsRefresh so all dashboards (driver, passenger, transporter)
    // immediately update their stats without waiting for next polling cycle.
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('statsRefresh', {
          transporterId: r.transporterId?.toString(),
          routeId:       r._id?.toString(),
          driverId:      r.assignedDriver?.toString(),
        });
      }
    } catch (e) { console.warn('[routes/end] statsRefresh emit failed:', e.message); }

    res.json({ success: true, trip, message: 'Route completed!' });
  } catch (err) {
    console.error('end route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════
// POST /api/routes/:routeId/miss
// Called by cron/scheduler when route time has passed without start
// ═════════════════════════════════════════════════════════════════
router.post('/:routeId/miss', auth, async (req, res) => {
  try {
    const r = await Route.findByIdAndUpdate(
      req.params.routeId,
      { status: 'missed' },
      { new: true }
    );
    if (!r) return res.status(404).json({ success: false });

    const trip = new Trip({
      routeId:       r._id,
      routeName:     r.routeName || r.name,
      driverId:      r.assignedDriver,
      driverName:    r.driverName,
      transporterId: r.transporterId,
      passengers:    r.passengers || [],
      timeSlot:      r.pickupTime || r.timeSlot,
      status:        'Missed',
    });
    await trip.save();

    // Notify transporter
    await sendNotification(
      r.transporterId, 'transporter',
      'Route Missed ⚠️',
      `Driver ${r.driverName} did not start route "${r.routeName || r.name}" on time.`,
      'route_missed', r._id, 'route', true
    );

    // Notify driver
    if (r.assignedDriver) {
      await sendNotification(
        r.assignedDriver, 'driver',
        'Route Marked as Missed ⚠️',
        `Route "${r.routeName || r.name}" was not started on time and has been marked as missed.`,
        'route_missed', r._id, 'route', false
      );
    }

    res.json({ success: true, trip, message: 'Route marked as missed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ═════════════════════════════════════════════════════════════════
// DELETE /api/routes/:routeId
// ═════════════════════════════════════════════════════════════════
router.delete('/:routeId', auth, async (req, res) => {
  try {
    await Route.findByIdAndDelete(req.params.routeId);
    res.json({ success: true });
  } catch { res.status(500).json({ success: false }); }
});

module.exports = router;