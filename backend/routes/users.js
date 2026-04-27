'use strict';
// routes/users.js
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users            → list users (filter by role/type)
// GET /api/users/:id        → get single user by ID  ← YE NAYA HAI
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const auth    = require('../middleware/auth');   // optional — remove if not needed

// ── GET /api/users?role=transporter ──────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { role } = req.query;
    console.log(`📋 GET /api/users  role="${role}"`);

    const filter = role
      ? { $or: [{ role: role.trim().toLowerCase() }, { type: role.trim().toLowerCase() }] }
      : {};

    const users = await User.find(filter).select('-password').lean();
    console.log(`✅ Found ${users.length} user(s)`);
    return res.json({ success: true, users });
  } catch (err) {
    console.error('❌ GET /api/users error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
// Returns a single user by MongoDB _id.
// Used by ContactSupportScreen to:
//   1. Get passenger's own doc → find transporterId field
//   2. Get transporter doc → get name, company, phone
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 GET /api/users/${id}`);

    // Validate id format to avoid CastError
    if (!id || id.length !== 24) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await User.findById(id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`✅ Found user: ${user.name} (${user.role || user.type})`);
    return res.json({ success: true, user });
  } catch (err) {
    console.error(`❌ GET /api/users/${req.params.id} error:`, err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;