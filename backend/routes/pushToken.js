'use strict';
/**
 * backend/routes/pushToken.js
 *
 * ─── BUG FIX ────────────────────────────────────────────────────────────────
 *  BUG: req.user.id was UNDEFINED
 *
 *  JWT payload is signed as: jwt.sign({ userId: u._id, ... })
 *  So decoded token has:      decoded.userId  (NOT decoded.id)
 *
 *  Old code used:  User.findByIdAndUpdate(req.user.id, ...)
 *                  req.user.id = undefined → NO user was ever updated
 *                  MongoDB silently did nothing, returned success:true anyway
 *
 *  Fixed:          Use req.user.userId (matches JWT payload field name)
 *                  Also fallback to req.userId (set by auth middleware)
 * ────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// PUT /api/push-token
// Body: { fcmToken: "..." }
router.put('/', auth, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ success: false, message: 'fcmToken required' });
    }

    // ✅ FIX: JWT payload has 'userId', not 'id'
    // auth.js sets: req.user = decoded  AND  req.userId = decoded.userId
    const userId = req.user.userId || req.userId || req.user.id;

    if (!userId) {
      console.error('[PushToken] ❌ No userId in token. Payload:', JSON.stringify(req.user));
      return res.status(400).json({ success: false, message: 'userId not found in token' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true }   // returns updated doc
    );

    if (!updatedUser) {
      console.error('[PushToken] ❌ User not found in DB for id:', userId);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`[PushToken] ✅ FCM token saved — user: ${updatedUser.name} (${userId})`);
    res.json({ success: true, message: 'FCM token saved' });

  } catch (err) {
    console.error('[PushToken] Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/push-token  (logout pe token clear karo)
router.delete('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.userId || req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId not found in token' });
    }
    await User.findByIdAndUpdate(userId, { fcmToken: null });
    console.log(`[PushToken] FCM token cleared for user ${userId}`);
    res.json({ success: true, message: 'FCM token cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;