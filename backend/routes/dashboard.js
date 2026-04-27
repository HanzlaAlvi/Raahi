'use strict';
const express   = require('express');
const router    = express.Router();
const mongoose  = require('mongoose');
const axios     = require('axios');
const User      = require('../models/User');
const Trip      = require('../models/Trip');
const Complaint = require('../models/Complaint');
const Payment   = require('../models/Payment');
const auth      = require('../middleware/auth');
const { getLivePetrolPrice } = require('../utils/vrpOptimizer');

// GET /api/dashboard/stats
// FIX: Validate ObjectId before using in Payment.aggregate() — invalid/null tid caused
//      the entire Promise.all to throw, returning 500 and showing all zeros in frontend.
router.get('/stats', auth, async (req, res) => {
  try {
    const tid = req.query.transporterId || req.userId;

    // Validate that tid is a proper ObjectId before passing to aggregate
    const isValidId = mongoose.isValidObjectId(tid);
    const tidObj    = isValidId ? new mongoose.Types.ObjectId(tid) : null;

    const [ad, tp, ct, ot, cp, dp, pp] = await Promise.all([
      User.countDocuments({ $or: [{ role: 'driver' }, { type: 'driver' }], status: 'active', transporterId: tid }),
      User.countDocuments({ $or: [{ role: 'passenger' }, { type: 'passenger' }], transporterId: tid }),
      Trip.countDocuments({ status: { $in: ['Completed', 'completed'] }, transporterId: tid }),
      Trip.countDocuments({ status: { $in: ['En Route', 'ongoing', 'active'] }, transporterId: tid }),
      Complaint.countDocuments({ transporterId: tid }),
      tidObj
        ? Payment.aggregate([{ $match: { type: 'driver', status: 'Sent',    transporterId: tidObj } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
        : Promise.resolve([]),
      tidObj
        ? Payment.aggregate([{ $match: { type: 'driver', status: 'Pending', transporterId: tidObj } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
        : Promise.resolve([]),
    ]);

    res.json({
      stats: {
        activeDrivers:    ad,
        totalPassengers:  tp,
        completedTrips:   ct,
        ongoingTrips:     ot,
        complaints:       cp,
        paymentsReceived: dp[0]?.total || 0,
        paymentsPending:  pp[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error('[dashboard/stats] error:', err.message);
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// GET /api/dashboard/drivers  — all drivers associated with this transporter
router.get('/drivers', auth, async (req, res) => {
  try {
    const tid = req.query.transporterId || req.userId;
    const drivers = await User.find({
      $or: [{ role: 'driver' }, { type: 'driver' }],
      transporterId: tid,
    }).select('-password').sort({ name: 1 }).lean();
    res.json({ success: true, drivers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/passengers  — all passengers associated with this transporter
router.get('/passengers', auth, async (req, res) => {
  try {
    const tid = req.query.transporterId || req.userId;
    const passengers = await User.find({
      $or: [{ role: 'passenger' }, { type: 'passenger' }],
      transporterId: tid,
    }).select('-password').sort({ name: 1 }).lean();
    res.json({ success: true, passengers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dashboard/completed-trips  — all completed trips for this transporter
router.get('/completed-trips', auth, async (req, res) => {
  try {
    const tid = req.query.transporterId || req.userId;
    const trips = await Trip.find({
      transporterId: tid,
      status: { $in: ['Completed', 'completed'] },
    })
      .populate('driverId', 'name phone vehicleNo')
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();

    const formatted = trips.map(t => ({
      _id:            t._id,
      routeName:      t.routeName || t.name || 'Trip',
      driverName:     t.driverId?.name || t.driverName || null,
      passengerCount: t.passengers?.length || t.passengerCount || 0,
      startTime:      t.startTime || t.createdAt,
      completedAt:    t.completedAt || null,
      status:         t.status,
    }));

    res.json({ success: true, trips: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fuel-price
router.get('/fuel-price', auth, async (req, res) => {
  try {
    const { getLivePetrolPrice: getPrice } = require('../utils/vrpOptimizer');
    const price = await getLivePetrolPrice();
    res.json({ success: true, pricePerLitre: price, fuelType: 'petrol', currency: 'PKR' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/directions  (Google proxy)
router.get('/directions', async (req, res) => {
  try {
    const { origin, destination, waypoints, mode = 'driving' } = req.query;
    if (!origin || !destination) return res.status(400).json({ success: false, message: 'origin and destination required' });
    const GOOGLE_KEY = 'AIzaSyBrYAA7OEcYgtRqH8HXAS5OMi30IMZF-60';
    const params = new URLSearchParams({ origin, destination, key: GOOGLE_KEY, mode, language: 'en', units: 'metric' });
    if (waypoints) params.append('waypoints', `optimize:true|${waypoints}`);
    const response = await axios.get(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { timeout: 10000 });
    if (response.data.status !== 'OK') return res.json({ success: false, status: response.data.status, message: response.data.error_message || response.data.status });
    return res.json({ success: true, routes: response.data.routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/health
router.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0-multi-destination' })
);

module.exports = router;
