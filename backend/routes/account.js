'use strict';
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// Gracefully load optional models so the route does not crash if a
// model file is missing in certain deployment configurations.
const load = (name) => { try { return require(`../models/${name}`); } catch { return null; } };
const Payment      = load('Payment');
const Complaint    = load('Complaint');
const Notification = load('Notification');
const Trip         = load('Trip');
const Route        = load('Route');
const JoinRequest  = load('JoinRequest');
const Message      = load('Message');
const Feedback     = load('Feedback');
const PushToken    = load('PushToken');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: validate that the supplied email matches the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
async function resolveUser(userId, email) {
  const user = await User.findById(userId).lean();
  if (!user) {
    return { error: 'User not found.', status: 404 };
  }
  const stored   = (user.email || '').toLowerCase().trim();
  const supplied = (email || '').toLowerCase().trim();
  if (!supplied) {
    return { error: 'Please provide your email address to confirm.', status: 400 };
  }
  if (stored !== supplied) {
    return { error: 'The email you entered does not match your account email.', status: 403 };
  }
  return { user };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: delete all data associated with a user ID
// ─────────────────────────────────────────────────────────────────────────────
async function purgeUserData(userId) {
  const id = userId;
  await Promise.allSettled([
    Payment      && Payment.deleteMany({
      $or: [{ passengerId: id }, { driverId: id }, { transporterId: id }],
    }),
    Complaint    && Complaint.deleteMany({
      $or: [{ byUserId: id }, { againstUserId: id }, { transporterId: id }],
    }),
    Notification && Notification.deleteMany({ userId: id }),
    Trip         && Trip.deleteMany({
      $or: [{ driverId: id }, { transporterId: id }, { passengerId: id }],
    }),
    Route        && Route.deleteMany({
      $or: [{ driverId: id }, { transporterId: id }],
    }),
    JoinRequest  && JoinRequest.deleteMany({
      $or: [{ userId: id }, { passengerId: id }, { driverId: id }, { transporterId: id }],
    }),
    Message      && Message.deleteMany({
      $or: [{ senderId: id }, { receiverId: id }],
    }),
    Feedback     && Feedback.deleteMany({
      $or: [{ passengerId: id }, { driverId: id }, { transporterId: id }],
    }),
    PushToken    && PushToken.deleteMany({ userId: id }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/account/delete
// Any authenticated user permanently deletes their own account.
// Body: { email: string }
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/delete', auth, async (req, res) => {
  try {
    const { email } = req.body;
    const { user, error, status } = await resolveUser(req.userId, email);
    if (error) return res.status(status).json({ success: false, message: error });

    await purgeUserData(user._id);
    await User.findByIdAndDelete(user._id);

    res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (err) {
    console.error('[account/delete]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/account/leave-network
// Driver or passenger leaves the transporter network — deletes their account
// and all their data, but does NOT touch the transporter's or other users' data.
// Body: { email: string }
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/leave-network', auth, async (req, res) => {
  try {
    const { email } = req.body;
    const { user, error, status } = await resolveUser(req.userId, email);
    if (error) return res.status(status).json({ success: false, message: error });

    // Only wipe data that belongs to this specific user
    const id = user._id;
    await Promise.allSettled([
      Payment      && Payment.deleteMany({
        $or: [{ passengerId: id }, { driverId: id }],
      }),
      Complaint    && Complaint.deleteMany({ byUserId: id }),
      Notification && Notification.deleteMany({ userId: id }),
      Trip         && Trip.deleteMany({ driverId: id }),
      JoinRequest  && JoinRequest.deleteMany({
        $or: [{ userId: id }, { passengerId: id }, { driverId: id }],
      }),
      Message      && Message.deleteMany({
        $or: [{ senderId: id }, { receiverId: id }],
      }),
      Feedback     && Feedback.deleteMany({ passengerId: id }),
      PushToken    && PushToken.deleteMany({ userId: id }),
    ]);

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'You have left the network. All your data has been permanently deleted. You must re-register to join again.',
    });
  } catch (err) {
    console.error('[account/leave-network]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;