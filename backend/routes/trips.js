'use strict';
const express = require('express');
const router  = express.Router();
const Trip    = require('../models/Trip');
const Feedback = require('../models/Feedback');
const mongoose = require('mongoose');
const auth    = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

router.post('/', auth, async (req, res) => {
  try {
    const trip = new Trip({ ...req.body, transporterId: req.body.transporterId||req.userId, status: 'ongoing', startTime: new Date() });
    await trip.save();
    for (const p of (trip.passengers||[])) if (p._id) await sendNotification(p._id, 'passenger', 'Trip Started 🚐', `Your vehicle has started. Driver: ${trip.driverName}`, 'confirmation', trip._id, 'trip', false);
    res.status(201).json({ success: true, trip });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/', auth, async (req, res) => {
  try { const t=await Trip.find({transporterId:req.query.transporterId||req.userId}).populate('driverId').populate('routeId').sort({createdAt:-1}); res.json({success:true,trips:t,data:t}); }
  catch { res.status(500).json({success:false}); }
});

router.get('/active', auth, async (req, res) => {
  try { const t=await Trip.find({transporterId:req.query.transporterId||req.userId,status:{$in:['ongoing','active','En Route']}}).populate('driverId'); res.json({success:true,trips:t,data:t}); }
  catch { res.status(500).json({success:false}); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRITICAL: These two named routes MUST be declared BEFORE /:tripId
// Otherwise Express matches "driver" and "passenger" as a tripId param,
// Mongoose throws an ObjectId cast error, and history returns empty / 500.
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/trips/driver/ride-history
router.get('/driver/ride-history', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const trips = await Trip.find({ driverId: userId })
      .populate('routeId', 'routeName name passengers')
      .populate('driverId', 'name vehicleNo vehicleType')
      .sort({ createdAt: -1 })
      .lean();
    const formatted = trips.map(trip => ({
      _id: trip._id,
      routeName: trip.routeId?.routeName || trip.routeId?.name || trip.routeName || 'Route',
      timeSlot: trip.timeSlot || trip.routeId?.timeSlot || 'N/A',
      // Normalize status to title-case so HistoryScreen filter ("Completed") matches
      status: normalizeStatus(trip.status),
      passengers: trip.routeId?.passengers?.length || trip.passengers?.length || 0,
      createdAt: trip.createdAt,
      endTime: trip.endTime,
      startTime: trip.startTime,
    }));
    res.json({ success: true, rides: formatted, data: formatted, count: formatted.length });
  } catch (err) {
    console.error('[driver-history] error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/trips/passenger/ride-history  (also mounted under /api/passenger)
router.get('/passenger/ride-history', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const trips    = await Trip.find({'passengers._id': new mongoose.Types.ObjectId(userId)}).populate('driverId','name vehicleNo vehicleType vehicle').sort({createdAt:-1}).lean();
    const tripsStr = await Trip.find({passengers:{$elemMatch:{_id:userId.toString()}}}).populate('driverId','name vehicleNo vehicleType vehicle').sort({createdAt:-1}).lean();
    const allTrips = [...trips];
    tripsStr.forEach(t=>{ if(!allTrips.find(x=>x._id.toString()===t._id.toString())) allTrips.push(t); });
    const feedbacks = await Feedback.find({passengerId:userId,tripId:{$in:allTrips.map(t=>t._id)}}).lean();
    const ratingMap = {}; feedbacks.forEach(f=>{ if(f.tripId) ratingMap[f.tripId.toString()]=f.rating; });
    const rides = allTrips.map(trip=>{
      const pEntry=(trip.passengers||[]).find(p=>p._id?.toString()===userId.toString()||p._id===userId.toString());
      const pickupAddr=pEntry?.pickupPoint||trip.stops?.[0]||'Pickup', dropAddr=pEntry?.destination||trip.stops?.[trip.stops?.length-1]||'Destination';
      const statusLower = (trip.status||'').toLowerCase();
      const isMissed=['missed','cancelled'].includes(statusLower);
      const isCompleted=['completed'].includes(statusLower);
      let delayStr='On time';
      if(trip.startTime&&trip.endTime){ const diffMins=Math.round((new Date(trip.endTime)-new Date(trip.startTime))/60000); if(diffMins>2) delayStr=`${diffMins} min late`; else if(diffMins<-2) delayStr=`${Math.abs(diffMins)} min early`; }
      return { _id:trip._id, id:trip._id, route:`${pickupAddr} → ${dropAddr}`, pickupLocation:pickupAddr, dropoffLocation:dropAddr, driverName:trip.driverName||trip.driverId?.name||'N/A', driver:{name:trip.driverName||trip.driverId?.name||'N/A',vehicle:trip.vehicleType?`${trip.vehicleType} ${trip.vehicleNumber||trip.driverId?.vehicleNo||''}`.trim():trip.driverId?.vehicle||'N/A'}, vehicleType:trip.vehicleType||'N/A', vehicleNumber:trip.vehicleNumber||trip.driverId?.vehicleNo||'', timeSlot:trip.timeSlot||'', status:isMissed?'missed':isCompleted?'completed':statusLower||'pending', scheduledTime:trip.startTime, actualPickupTime:pEntry?.pickupTime||trip.startTime, bookingDate:trip.createdAt, startTime:trip.startTime, endTime:trip.endTime, delay:delayStr, stops:trip.stops||[], confirmedMorning:pEntry?.confirmedMorning||false, rating:ratingMap[trip._id.toString()]||null, createdAt:trip.createdAt };
    });
    res.json({success:true,rides,data:rides,count:rides.length});
  } catch (err) { console.error('[ride-history] error:', err); res.status(500).json({success:false,message:err.message}); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Dynamic :tripId routes — declared AFTER all named routes above
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:tripId', auth, async (req, res) => {
  try { const t=await Trip.findById(req.params.tripId).populate('driverId').populate('routeId'); if(!t) return res.status(404).json({success:false}); res.json({success:true,trip:t}); }
  catch { res.status(500).json({success:false}); }
});

router.put('/:tripId', auth, async (req, res) => {
  try { const t=await Trip.findByIdAndUpdate(req.params.tripId,{...req.body,updatedAt:new Date()},{new:true}); if(!t) return res.status(404).json({success:false}); res.json({success:true,trip:t}); }
  catch { res.status(500).json({success:false}); }
});

router.put('/:tripId/complete', auth, async (req, res) => {
  try {
    const t=await Trip.findByIdAndUpdate(req.params.tripId,{status:'completed',endTime:new Date(),updatedAt:new Date()},{new:true});
    if(!t) return res.status(404).json({success:false});
    for (const p of (t.passengers||[])) if(p._id) await sendNotification(p._id,'passenger','Trip Completed ✅','You arrived safely. Please rate your experience.','feedback',t._id,'trip',true,'submit_feedback');
    res.json({success:true,trip:t});
  } catch { res.status(500).json({success:false}); }
});

// PUT /api/trips/:id/location  — Driver live location update
router.put('/:id/location', auth, async (req, res) => {
  try {
    const { latitude, longitude, speed } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'latitude aur longitude required hain' });
    }
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      {
        currentLocation: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        speed:           speed != null ? parseFloat(speed) : undefined,
        updatedAt:       new Date(),
      },
      { new: true }
    );
    if (!trip) return res.status(404).json({ success: false, message: 'Trip nahi mili' });
    res.json({ success: true, trip });
  } catch (err) {
    console.error('[Trip] location update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:tripId/location', auth, async (req, res) => {
  try {
    const { latitude, longitude, speed, eta, currentStop } = req.body;
    const t=await Trip.findByIdAndUpdate(req.params.tripId,{currentLocation:{latitude,longitude},speed,eta,currentStop,updatedAt:new Date()},{new:true});
    if(!t) return res.status(404).json({success:false});
    res.json({success:true,trip:t});
  } catch { res.status(500).json({success:false}); }
});

// STRICT SEQUENCE APIs
router.post('/:tripId/advance-stop', auth, async (req, res) => {
  try {
    const { routeId } = req.body;
    const trip = await Trip.findById(req.params.tripId).populate('routeId');
    if (!trip || !trip.routeId) return res.status(404).json({ success: false, message: 'Trip/Route not found' });

    const route = trip.routeId;
    const currentIdx = route.currentStopIndex || 0;
    const status = route.stopStatuses?.find(s => s.stopIndex === currentIdx);
    
    if (!status || !status.passengerConfirmed) {
      return res.status(400).json({ success: false, message: 'Passenger confirmation required first' });
    }
    
    if (status.driverConfirmed) {
      return res.status(400).json({ success: false, message: 'Already confirmed' });
    }

    status.driverConfirmed = true;
    route.simulationPaused = false;
    route.currentStopIndex = Math.min(currentIdx + 1, route.passengers.length);
    route.markModified('stopStatuses');
    await route.save();

    trip.currentStopIndex = route.currentStopIndex;
    trip.simulationPaused = false;
    await trip.save();

    const io = req.app.get('io');
    io.to(trip._id.toString()).emit('stopAdvanced', { 
      currentStopIndex: route.currentStopIndex, 
      simulationPaused: false 
    });

    res.json({ success: true, newIndex: route.currentStopIndex });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:tripId/set-pause', auth, async (req, res) => {
  try {
    const { paused } = req.body;
    const trip = await Trip.findById(req.params.tripId).populate('routeId');
    if (!trip) return res.status(404).json({ success: false });

    const route = trip.routeId;
    route.simulationPaused = paused !== false;
    trip.simulationPaused = paused !== false;
    await route.save();
    await trip.save();

    const io = req.app.get('io');
    io.to(trip._id.toString()).emit('simulationPaused', { paused: route.simulationPaused });

    res.json({ success: true, paused: route.simulationPaused });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:tripId/passenger-confirm', auth, async (req, res) => {
  try {
    const { stopIndex } = req.body;
    const trip = await Trip.findById(req.params.tripId).populate('routeId');
    if (!trip) return res.status(404).json({ success: false });

    const route = trip.routeId;
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
    io.to(trip._id.toString()).emit('passengerReady', { stopIndex });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STRICT SEQUENCE APIs - END
module.exports = router;

// ── Helper ────────────────────────────────────────────────────────────────────
// Normalize trip status to Title-Case for consistent frontend filtering.
// DB may store 'completed', 'Completed', 'En Route', 'ongoing', etc.
function normalizeStatus(s) {
  if (!s) return 'Pending';
  const l = s.toLowerCase();
  if (l === 'completed') return 'Completed';
  if (l === 'missed')    return 'Missed';
  if (l === 'cancelled') return 'Cancelled';
  if (l === 'ongoing' || l === 'en route' || l === 'active') return 'Active';
  return s.charAt(0).toUpperCase() + s.slice(1);
}