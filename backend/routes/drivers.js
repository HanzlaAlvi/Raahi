'use strict';
const express            = require('express');
const router             = express.Router();
const User               = require('../models/User');
const DriverAvailability = require('../models/DriverAvailability');
const auth               = require('../middleware/auth');

// ─── Haversine distance in km ─────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R   = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Vehicle capacity map ─────────────────────────────────────────
const VEHICLE_CAPACITY = {
  car:       4,
  van:       12,
  bus:       30,
  minibus:   20,
  microbus:  14,
};

function getCapacity(vehicleType) {
  return VEHICLE_CAPACITY[(vehicleType || '').toLowerCase()] || 4;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/drivers
// ?availableForTomorrow=true  → only drivers who have marked
//   availability for tomorrow (status: 'available' OR 'confirmed')
// ─────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const filter = {
      $or: [{ role: 'driver' }, { type: 'driver' }],
      transporterId: req.query.transporterId || req.userId,
    };
    let drivers = await User.find(filter).sort({ name: 1 }).lean();

    if (req.query.availableForTomorrow === 'true') {
      const tomorrow    = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Accept both 'available' and 'confirmed' statuses
      const availRecords = await DriverAvailability.find({
        driverId: { $in: drivers.map(d => d._id) },
        status:   { $in: ['available', 'confirmed'] },
        date: {
          $gte: new Date(tomorrowStr + 'T00:00:00.000Z'),
          $lte: new Date(tomorrowStr + 'T23:59:59.999Z'),
        },
      }).lean();

      const availableDriverIds = new Set(availRecords.map(r => r.driverId.toString()));

      drivers = drivers
        .filter(d => availableDriverIds.has(d._id.toString()))
        .map(d => {
          const rec = availRecords.find(r => r.driverId.toString() === d._id.toString());
          return {
            ...d,
            availabilityRecord: rec || null,
            // Expose capacity on driver object for the frontend
            vehicleCapacity: getCapacity(d.vehicleType),
          };
        });
    }

    res.json({ success: true, drivers, data: drivers });
  } catch (err) {
    console.error('[drivers] GET /', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/drivers/:driverId
// ─────────────────────────────────────────────────────────────────
router.get('/:driverId', auth, async (req, res) => {
  try {
    const d = await User.findById(req.params.driverId).lean();
    if (!d) return res.status(404).json({ success: false });

    const tomorrow    = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const avail = await DriverAvailability.findOne({
      driverId: d._id,
      date: {
        $gte: new Date(tomorrowStr + 'T00:00:00.000Z'),
        $lte: new Date(tomorrowStr + 'T23:59:59.999Z'),
      },
    }).lean();

    res.json({
      success: true,
      driver: {
        ...d,
        availability:    avail || null,
        vehicleCapacity: getCapacity(d.vehicleType),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/drivers/:driverId/toggle-status
// ─────────────────────────────────────────────────────────────────
router.put('/:driverId/toggle-status', auth, async (req, res) => {
  try {
    const d = await User.findById(req.params.driverId);
    if (!d) return res.status(404).json({ success: false });
    d.status = d.status === 'active' ? 'inactive' : 'active';
    await d.save();
    res.json({ success: true, driver: d });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/drivers/suggest
//
// AI-style driver suggestion for a given route.
//
// Body: {
//   passengerCount : number,            // total passengers in this route
//   passengerLat   : number,            // centroid / first passenger lat
//   passengerLng   : number,            // centroid / first passenger lng
//   vehiclePreferences: {               // e.g. { car: 3, van: 1, auto: 2 }
//     car?:  number,
//     van?:  number,
//     bus?:  number,
//     auto?: number,
//   },
//   transporterId  : string (optional)
// }
//
// Scoring (0-100):
//   1. Capacity fit          – max 35 pts
//   2. Proximity to passengers – max 30 pts  (uses driver home lat/lng)
//   3. Vehicle preference match – max 25 pts
//   4. Confirmed availability bonus – 10 pts
//
// Returns top 3 suggested drivers, sorted by score desc.
// ─────────────────────────────────────────────────────────────────
router.post('/suggest', auth, async (req, res) => {
  try {
    const {
      passengerCount   = 1,
      passengerLat,
      passengerLng,
      vehiclePreferences = {},
      transporterId,
    } = req.body;

    if (!passengerCount || passengerCount < 1) {
      return res.status(400).json({ success: false, message: 'passengerCount is required' });
    }

    // 1. Fetch all available/confirmed drivers for tomorrow
    const tomorrow    = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const driverFilter = {
      $or: [{ role: 'driver' }, { type: 'driver' }],
      transporterId: transporterId || req.userId,
    };
    const allDrivers = await User.find(driverFilter).lean();

    const availRecords = await DriverAvailability.find({
      driverId: { $in: allDrivers.map(d => d._id) },
      status:   { $in: ['available', 'confirmed'] },
      date: {
        $gte: new Date(tomorrowStr + 'T00:00:00.000Z'),
        $lte: new Date(tomorrowStr + 'T23:59:59.999Z'),
      },
    }).lean();

    if (!availRecords.length) {
      return res.json({
        success:    true,
        suggestions: [],
        message:    'No drivers have marked availability for tomorrow yet.',
      });
    }

    const availableDriverIds = new Set(availRecords.map(r => r.driverId.toString()));
    const availableDrivers   = allDrivers
      .filter(d => availableDriverIds.has(d._id.toString()))
      .map(d => {
        const rec = availRecords.find(r => r.driverId.toString() === d._id.toString());
        return { ...d, availabilityRecord: rec || null };
      });

    // 2. Determine the dominant preference in this route
    // car > van/bus — if ANY passenger requested car, that must be respected
    const carCount  = vehiclePreferences.car  || 0;
    const vanCount  = (vehiclePreferences.van  || 0) + (vehiclePreferences.bus || 0);
    const autoCount = vehiclePreferences.auto || vehiclePreferences.flex || 0;

    // 3. Score each driver
    const scored = availableDrivers.map(driver => {
      const driverType     = (driver.vehicleType || 'car').toLowerCase();
      const driverCapacity = getCapacity(driverType);

      let score  = 0;
      const reasons = [];

      /* ── Score 1: Capacity fit (35 pts) ──────────────────────── */
      if (driverCapacity >= passengerCount) {
        // Perfect fit or slight surplus
        const surplus = driverCapacity - passengerCount;
        if (surplus === 0) {
          score += 35;
          reasons.push(`Exact capacity (${driverCapacity} seats)`);
        } else if (surplus <= 2) {
          score += 30;
          reasons.push(`Near-perfect capacity (${driverCapacity} seats, ${surplus} spare)`);
        } else {
          // Deduct proportionally for large surplus (wasteful)
          const pts = Math.max(10, 30 - Math.floor(surplus * 1.5));
          score += pts;
          reasons.push(`Has capacity (${driverCapacity} seats, ${surplus} spare)`);
        }
      } else {
        // Under-capacity — penalise but don't eliminate entirely
        // (transporter may still want to see them listed at the bottom)
        score += 0;
        reasons.push(`Under capacity (${driverCapacity} seats for ${passengerCount} passengers)`);
      }

      /* ── Score 2: Proximity (30 pts) ─────────────────────────── */
      const driverLat = parseFloat(driver.latitude  || driver.lat  || driver.homeLat  || 0);
      const driverLng = parseFloat(driver.longitude || driver.lng  || driver.homeLng  || 0);
      const pLat      = parseFloat(passengerLat || 0);
      const pLng      = parseFloat(passengerLng || 0);

      if (driverLat && driverLng && pLat && pLng) {
        const distKm = haversineKm(driverLat, driverLng, pLat, pLng);
        let proximityPts = 0;
        if (distKm <= 2)       proximityPts = 30;
        else if (distKm <= 5)  proximityPts = 25;
        else if (distKm <= 10) proximityPts = 18;
        else if (distKm <= 20) proximityPts = 10;
        else                   proximityPts = 3;
        score += proximityPts;
        reasons.push(`${distKm.toFixed(1)} km from passenger area`);
      } else {
        // No GPS data — give neutral mid score
        score += 10;
        reasons.push('Location data unavailable');
      }

      /* ── Score 3: Vehicle preference match (25 pts) ─────────── */
      if (carCount > 0 && driverType === 'car') {
        // Car passengers MUST get a car driver — high reward
        score += 25;
        reasons.push(`Car driver matches ${carCount} car preference(s)`);
      } else if (carCount > 0 && driverType !== 'car') {
        // Car preference not met — heavy penalty
        score -= 20;
        reasons.push(`Car preference unmet (driver has ${driverType})`);
      } else if (vanCount > 0 && (driverType === 'van' || driverType === 'bus' || driverType === 'minibus' || driverType === 'microbus')) {
        score += 25;
        reasons.push(`Van/Bus driver matches ${vanCount} van/bus preference(s)`);
      } else if (autoCount > 0) {
        // No strict preference — any vehicle is fine
        score += 15;
        reasons.push('Flexible preference passengers — any vehicle accepted');
      } else {
        // Mixed or no preferences
        score += 10;
      }

      /* ── Score 4: Confirmed availability bonus (10 pts) ─────── */
      const isConfirmed = driver.availabilityRecord?.status === 'confirmed';
      if (isConfirmed) {
        score += 10;
        reasons.push('Availability confirmed by transporter');
      }

      return {
        driver: {
          _id:                driver._id,
          name:               driver.name,
          phone:              driver.phone,
          vehicleType:        driver.vehicleType,
          vehicleNo:          driver.vehicleNo || driver.vehicleNumber,
          vehicleCapacity:    driverCapacity,
          latitude:           driverLat || undefined,
          longitude:          driverLng || undefined,
          rating:             driver.rating,
          availabilityRecord: driver.availabilityRecord,
        },
        score:        Math.max(0, Math.round(score)),
        reasons,
        isRecommended: false, // set below
      };
    });

    // 4. Sort by score desc, take top 5, mark top 1 as recommended
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);
    if (top.length > 0) top[0].isRecommended = true;

    // 5. Add a human-readable summary to each
    const suggestions = top.map(item => ({
      ...item,
      summary: item.isRecommended
        ? `Best match — ${item.reasons[0] || 'highest overall score'}`
        : item.reasons[0] || 'Available for tomorrow',
    }));

    res.json({
      success:     true,
      suggestions,
      totalScored: scored.length,
      passengerCount,
      vehiclePreferences,
    });

  } catch (err) {
    console.error('[drivers] POST /suggest error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;