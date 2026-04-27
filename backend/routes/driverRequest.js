'use strict';
const express   = require('express');
const mongoose  = require('mongoose');
const router    = express.Router();

const User             = require('../models/User');
const JoinRequest      = require('../models/JoinRequest');
const sendNotification = require('../helpers/notification');

// POST /api/driver-requests  — no auth required (public registration)
router.post('/', async (req, res) => {
  try {
    const {
      fullName, email, phone, password,
      license, vehicleNo, vehicleType, vehicle,
      capacity, address, location,
      latitude, longitude,
      transporterId, transporterName,
    } = req.body;

    // ── Required field check ────────────────────────────────────
    const miss = ['fullName','email','phone','password','license','vehicleNo','transporterId']
      .filter(f => !req.body[f]);
    if (miss.length)
      return res.status(400).json({ success: false, message: `Missing: ${miss.join(', ')}` });

    // ── Duplicate checks ────────────────────────────────────────
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ success: false, message: 'Email already registered.' });

    if (await JoinRequest.findOne({ email: email.toLowerCase(), status: 'pending' }))
      return res.status(400).json({ success: false, message: 'Pending request already exists.' });

    // ── Validate transporter ────────────────────────────────────
    let tid;
    try { tid = new mongoose.Types.ObjectId(transporterId); }
    catch { return res.status(400).json({ success: false, message: 'Invalid transporter ID.' }); }

    const tr = await User.findById(tid);
    if (!tr)
      return res.status(404).json({ success: false, message: 'Transporter not found.' });

    // ── Build record ────────────────────────────────────────────
    const CAPS = { car: 4, van: 12, bus: 30 };
    const rvt  = vehicleType || vehicle || null;
    const rc   = capacity ? +capacity : (rvt ? CAPS[rvt] || 4 : 4);

    let lat = latitude  ? +latitude  : null;
    let lng = longitude ? +longitude : null;
    if (!lat && location?.coordinates?.length === 2) {
      lng = location.coordinates[0];
      lat = location.coordinates[1];
    }

    const jr = new JoinRequest({
      name:            fullName.trim(),
      fullName:        fullName.trim(),
      email:           email.trim().toLowerCase(),
      phone:           phone.trim(),
      password:        password.trim(),
      type:            'driver',
      license:         license.trim().toUpperCase(),
      vehicleNo:       vehicleNo.trim().toUpperCase(),
      vehicle:         vehicleNo.trim().toUpperCase(),
      vehicleType:     rvt,
      capacity:        rc,
      address:         address || location?.address || 'Not provided',
      location:        location || {},
      latitude:        lat,
      longitude:       lng,
      pickupPoint:     address || location?.address || 'Not provided',
      transporterId:   tid,
      transporterName: transporterName || tr.name || 'Transporter',
      vehiclePreference: null,
      status:          'pending',
      createdAt:       new Date(),
    });

    await jr.save();
    console.log(`✅ Driver request saved: ${jr._id}`);

    // ── Notify transporter ──────────────────────────────────────
    try {
      await sendNotification(
        tid, 'transporter',
        'New Driver Request 🚗',
        `${fullName} wants to join. Vehicle: ${rvt || vehicleNo} | Capacity: ${rc}`,
        'request', jr._id, 'driver_request', true, 'review_driver_request'
      );
      console.log(`🔔 Notification sent to transporter ${tid}`);
    } catch (notifErr) {
      console.warn('⚠️ Notification failed (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      success:   true,
      message:   'Driver request submitted successfully!',
      requestId: jr._id,
    });

  } catch (err) {
    console.error('❌ POST /driver-requests error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;