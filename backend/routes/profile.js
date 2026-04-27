'use strict';
// routes/profile.js
// ─────────────────────────────────────────────────────────────────
// Unified profile route — works for passenger, driver, transporter.
// Mount in server.js:
//   app.use('/api', require('./routes/profile'));
//
// Endpoints:
//   GET  /api/profile        → logged-in user's own profile
//   PUT  /api/profile        → update own profile (safe fields only)
//   GET  /api/profile/:id    → any user's profile by _id
//   PUT  /api/profile/:id    → update any user's profile by _id
// ─────────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');   // adjust path if needed
const auth    = require('../middleware/auth'); // adjust path if needed

// ── Fields to never return ─────────────────────────────────────
const OMIT = '-password -fcmToken';

// ── Fields any user may update ─────────────────────────────────
// (role / type / email / transporterId are intentionally excluded)
const ALLOWED = new Set([
  // common
  'name', 'phone', 'address', 'city', 'country', 'zone', 'profileImage',
  // transporter / driver
  'company', 'license',
  // driver vehicle
  'vehicle', 'vehicleNo', 'vehicleType', 'van', 'capacity',
  'experience', 'availableTimeSlots',
  // passenger travel prefs
  'pickupPoint', 'destination',
  'selectedTimeSlot', 'preferredTimeSlot',
  'vehiclePreference',
  'latitude', 'longitude',
  'destinationLatitude', 'destinationLongitude',
]);

/** Keep only fields that are in ALLOWED and are present in body */
function pickAllowed(body) {
  const out = {};
  for (const k of Object.keys(body)) {
    if (ALLOWED.has(k) && body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

/** Serialize a Mongoose doc → plain object safe to send to client */
function fmt(u) {
  return {
    _id:                  u._id,
    id:                   u._id,

    // identity
    name:                 u.name                 || null,
    email:                u.email                || null,
    phone:                u.phone                || null,
    role:                 u.role  || u.type      || null,
    type:                 u.type  || u.role      || null,
    status:               u.status               || 'active',
    profileImage:         u.profileImage         || null,
    registrationDate:     u.registrationDate     || null,

    // location / address
    address:              u.address              || null,
    country:              u.country              || null,
    city:                 u.city                 || null,
    zone:                 u.zone                 || null,

    // transporter
    company:              u.company              || null,
    license:              u.license              || null,
    transporterId:        u.transporterId        || null,

    // passenger travel prefs
    pickupPoint:          u.pickupPoint          || null,
    destination:          u.destination          || null,
    selectedTimeSlot:     u.selectedTimeSlot     || null,
    preferredTimeSlot:    u.preferredTimeSlot    || null,
    vehiclePreference:    u.vehiclePreference    || null,
    latitude:             u.latitude             ?? null,
    longitude:            u.longitude            ?? null,
    destinationLatitude:  u.destinationLatitude  ?? null,
    destinationLongitude: u.destinationLongitude ?? null,

    // driver vehicle
    vehicle:              u.vehicle              || null,
    vehicleNo:            u.vehicleNo            || null,
    vehicleType:          u.vehicleType          || null,
    van:                  u.van                  || null,
    capacity:             u.capacity             ?? null,
    experience:           u.experience           || null,
    availableTimeSlots:   u.availableTimeSlots   || [],
  };
}

// ── GET /api/profile  (own profile) ───────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const u = await User.findById(req.userId).select(OMIT).lean();
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    const data = fmt(u);
    return res.json({ success: true, ...data, user: data, data });
  } catch (err) {
    console.error('[GET /profile]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/profile  (update own profile) ────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const updates = pickAllowed(req.body);

    if (!Object.keys(updates).length)
      return res.status(400).json({ success: false, message: 'No updatable fields provided' });

    // vehiclePreference: allow null explicitly
    if (req.body.vehiclePreference === null) updates.vehiclePreference = null;

    // capacity must be a number
    if (updates.capacity !== undefined)
      updates.capacity = updates.capacity === '' ? null : Number(updates.capacity);

    const u = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: false }
    ).select(OMIT).lean();

    if (!u) return res.status(404).json({ success: false, message: 'User not found' });

    const data = fmt(u);
    return res.json({ success: true, message: 'Profile updated', ...data, user: data, data });
  } catch (err) {
    console.error('[PUT /profile]', err);
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
});

// ── GET /api/profile/:userId  (any user by ID) ────────────────
router.get('/profile/:userId', auth, async (req, res) => {
  try {
    const u = await User.findById(req.params.userId).select(OMIT).lean();
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    const data = fmt(u);
    return res.json({ success: true, ...data, user: data, data });
  } catch (err) {
    console.error('[GET /profile/:userId]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── PUT /api/profile/:userId  (update any user by ID) ─────────
router.put('/profile/:userId', auth, async (req, res) => {
  try {
    const updates = pickAllowed(req.body);

    if (req.body.vehiclePreference === null) updates.vehiclePreference = null;
    if (updates.capacity !== undefined)
      updates.capacity = updates.capacity === '' ? null : Number(updates.capacity);

    const u = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true, runValidators: false }
    ).select(OMIT).lean();

    if (!u) return res.status(404).json({ success: false, message: 'User not found' });

    const data = fmt(u);
    return res.json({ success: true, message: 'Profile updated', ...data, user: data, data });
  } catch (err) {
    console.error('[PUT /profile/:userId]', err);
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
});

module.exports = router;