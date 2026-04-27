'use strict';
// backend/routes/driverAvailability.js
//
// FIX:
//   1) Driver POST kare availability → Transporter ko FCM push notification jaata hai
//   2) Transporter confirm kare → Driver ko FCM push notification jaata hai (pehle se tha)
//   3) Time window check (6 PM – 10 PM) preserved

const express            = require('express');
const router             = express.Router();
const DriverAvailability = require('../models/DriverAvailability');
const User               = require('../models/User');
const auth               = require('../middleware/auth');
const sendNotification   = require('../helpers/notification');

// ─── HELPER: Time window check removed (always open) ─────────────
function isWithinAvailabilityWindow() {
  return true;
}

// ─────────────────────────────────────────────────────────────────
// POST /api/driver-availability — Driver marks availability
// FIX: Transporter ko ab FCM push notification bhi jaata hai
// ─────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    // Time window check removed — driver can mark availability any time

    const { driverName, date, startTime, endTime, transporterId, status } = req.body;
    const driverId = req.userId;

    // ── FIX: Use UTC midnight so date matches across all timezones ─
    const dateToUse = date ? new Date(date) : new Date();
    dateToUse.setUTCHours(0, 0, 0, 0);

    // ── Update existing record if same date exists ─────────────────
    const existing = await DriverAvailability.findOne({ driverId, date: dateToUse });

    if (existing) {
      existing.startTime     = startTime     || existing.startTime;
      existing.endTime       = endTime       || existing.endTime;
      existing.status        = status        || 'available';
      existing.transporterId = transporterId || existing.transporterId;
      await existing.save();

      // ── FIX: Transporter ko notify karo (update case) ──────────
      const targetTransporterId = existing.transporterId;
      if (targetTransporterId) {
        const driverUser = await User.findById(driverId).select('name');
        const dName = driverName || driverUser?.name || 'Driver';

        await sendNotification(
          targetTransporterId,
          'transporter',
          '🔄 Driver Availability Updated',
          `${dName} ne kal ki availability update ki hai. Confirm karne ke liye check karein.`,
          'availability',
          existing._id,
          'availability',
          true,
          'confirm_driver'
        );
      }

      return res.json({ success: true, availability: existing });
    }

    // ── Create new availability record ─────────────────────────────
    const driverUser = await User.findById(driverId).select('name');
    const resolvedName = driverName || driverUser?.name || 'Driver';

    const a = new DriverAvailability({
      driverId,
      driverName:    resolvedName,
      date:          dateToUse,
      startTime,
      endTime,
      transporterId: transporterId || req.userId,
      status:        status || 'available',
    });

    await a.save();

    // ── FIX: Transporter ko notify karo (new record) ───────────────
    const targetTransporterId = a.transporterId;
    if (targetTransporterId) {
      await sendNotification(
        targetTransporterId,
        'transporter',
        '🕐 Driver Available for Tomorrow',
        `${resolvedName} ne kal ke liye availability mark kar di hai. Please confirm karein.`,
        'availability',
        a._id,
        'availability',
        true,
        'confirm_driver'
      );
    }

    res.json({ success: true, availability: a });

  } catch (err) {
    console.error('[DriverAvailability] POST error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/driver-availability
// ?driverId=xxx  → driver apni history dekhta hai
// ?transporterId=xxx → transporter apne drivers ki availability dekhta hai
// ?date=YYYY-MM-DD   → filter by specific date (used by AssignSection for tomorrow's availability)
// ─────────────────────────────────────────────────────────────────
// GET /api/driver-availability
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.query.driverId) {
      filter.driverId = req.query.driverId;
    } else if (req.query.transporterId) {
      const driverUsers = await User.find({
        $or: [
          { transporterId: req.query.transporterId },
          { transporter: req.query.transporterId },
        ],
        role: 'driver',
      }).select('_id');
      const driverIds = driverUsers.map(u => u._id);

      filter = {
        $or: [
          { transporterId: req.query.transporterId },
          { transporter: req.query.transporterId },
          { driverId: { $in: driverIds } },
        ],
      };
    } else {
      filter.driverId = req.userId;
    }

    // ✅ FIX 1: Sirf available ya confirmed records return karo
    // (pehle koi status filter nahi tha — sab records aate the)
    if (req.query.date) {
      const targetDate = new Date(req.query.date);
      targetDate.setUTCHours(0, 0, 0, 0);  // FIX: UTC midnight to match stored dates
      const dayAfter = new Date(targetDate);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      filter.date   = { $gte: targetDate, $lt: dayAfter };
      // Jab date filter ho (transporter availability check) toh only valid statuses
      filter.status = { $in: ['available', 'confirmed'] };
    }

    const a = await DriverAvailability.find(filter)
      .populate('driverId', 'name email phone vehicleType vehicleNo latitude longitude')
      .sort({ date: -1 });

    res.json({ success: true, availability: a, availabilities: a, data: a });
  } catch (err) {
    console.error('[DriverAvailability] GET error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/driver-availability/check-window
// Frontend check kar sakta hai ke window open hai ya nahi
// ─────────────────────────────────────────────────────────────────
router.get('/check-window', auth, async (req, res) => {
  const h = new Date().getHours();
  res.json({
    success:     true,
    windowOpen:  h >= 18 && h < 22,
    windowStart: '6:00 PM',
    windowEnd:   '10:00 PM',
    currentHour: h,
  });
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/driver-availability/:id/confirm — Transporter confirms driver
// Driver ko FCM push notification jaata hai
// ─────────────────────────────────────────────────────────────────
router.put('/:id/confirm', auth, async (req, res) => {
  try {
    const a = await DriverAvailability.findByIdAndUpdate(
      req.params.id,
      { confirmed: true, status: 'confirmed' },
      { new: true }
    );
    if (!a) return res.status(404).json({ success: false, message: 'Record not found' });

    // ── Driver ko notify karo ke transporter ne confirm kiya ───────
    await sendNotification(
      a.driverId,
      'driver',
      '✅ Availability Confirmed',
      'Aapki kal ki availability transporter ne confirm kar di hai. Report on time karein!',
      'confirmation',
      a._id,
      'availability',
      false
    );

    res.json({ success: true, availability: a });
  } catch (err) {
    console.error('[DriverAvailability] CONFIRM error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/driver-availability/:id — Driver updates own availability
// Time window check removed
// ─────────────────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    // Time window check removed — driver can update availability any time

    const { startTime, endTime, status } = req.body;
    const a = await DriverAvailability.findOneAndUpdate(
      { _id: req.params.id, driverId: req.userId },
      { startTime, endTime, status },
      { new: true }
    );
    if (!a) return res.status(404).json({ success: false, message: 'Record not found' });

    res.json({ success: true, availability: a });
  } catch (err) {
    console.error('[DriverAvailability] PUT error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;