'use strict';
const express     = require('express');
const router      = express.Router();
const mongoose    = require('mongoose');
const nodemailer  = require('nodemailer');
const JoinRequest = require('../models/JoinRequest');
const User        = require('../models/User');
const auth        = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

// ─────────────────────────────────────────────────────────────────────────────
// Email transporter — uses same env vars as forgot-password
// Set in Render Environment:
//   EMAIL_USER = your Gmail address
//   EMAIL_PASS = your Gmail App Password (16 chars)
// ─────────────────────────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendApprovalEmail = async (toEmail, userName, userType) => {
  const roleLabel = userType === 'driver' ? 'Driver' : 'Passenger';
  await mailer.sendMail({
    from: `"Raahi App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your Raahi ${roleLabel} Request Has Been Approved ✅`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#415844;margin-bottom:8px;">Request Approved!</h2>
        <p style="color:#555;">Hi ${userName || 'there'},</p>
        <p style="color:#555;">
          Great news! Your <strong>${roleLabel}</strong> request on Raahi has been 
          <strong style="color:#415844;">approved</strong> by your transporter.
        </p>
        <div style="background:#EAF4EB;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <span style="font-size:48px;">✅</span>
          <p style="color:#415844;font-weight:900;font-size:18px;margin:8px 0;">You're all set!</p>
          <p style="color:#555;margin:0;">You can now log in to the Raahi app using your registered email and password.</p>
        </div>
        <p style="color:#999;font-size:12px;">If you have any questions, please contact your transporter.</p>
      </div>
    `,
  });
};

const sendRejectionEmail = async (toEmail, userName, userType) => {
  const roleLabel = userType === 'driver' ? 'Driver' : 'Passenger';
  await mailer.sendMail({
    from: `"Raahi App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your Raahi ${roleLabel} Request Status`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f9f9f9;border-radius:12px;">
        <h2 style="color:#415844;margin-bottom:8px;">Request Update</h2>
        <p style="color:#555;">Hi ${userName || 'there'},</p>
        <p style="color:#555;">
          We're sorry to inform you that your <strong>${roleLabel}</strong> request on Raahi has been 
          <strong style="color:#e53935;">rejected</strong> by your transporter.
        </p>
        <div style="background:#fdecea;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
          <span style="font-size:48px;">❌</span>
          <p style="color:#e53935;font-weight:900;font-size:18px;margin:8px 0;">Request Not Approved</p>
          <p style="color:#555;margin:0;">Please contact your transporter for more information or submit a new request.</p>
        </div>
        <p style="color:#999;font-size:12px;">If you believe this is a mistake, please reach out to your transporter directly.</p>
      </div>
    `,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/join-requests  — public, no auth needed
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const jr = new JoinRequest({
      ...req.body,
      transporterId: req.body.transporterId || req.userId,
      status: 'pending',
    });
    await jr.save();
    await sendNotification(
      jr.transporterId, 'transporter',
      `New ${jr.type || 'User'} Request`,
      `${jr.name || jr.fullName} wants to join.`,
      'request', jr._id, 'join_request', true, 'review_request'
    );
    return res.status(201).json({ success: true, request: jr });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/join-requests
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const q = { transporterId: req.query.transporterId || req.userId };
    if (req.query.type)   q.type   = req.query.type;
    if (req.query.status) q.status = req.query.status;
    const r = await JoinRequest.find(q).sort({ createdAt: -1 });
    return res.json({ success: true, requests: r, data: r });
  } catch {
    return res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/join-requests/:id/accept
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/accept', auth, async (req, res) => {
  try {
    const jr = await JoinRequest.findById(req.params.id);
    if (!jr) return res.status(404).json({ success: false, message: 'Request not found' });

    jr.status = 'approved';
    await jr.save();

    const CAPS = { car: 4, van: 12, bus: 30 };
    const newUser = new User({
      name:                 jr.name || jr.fullName,
      email:                jr.email,
      password:             jr.password,
      phone:                jr.phone,
      role:                 jr.type,
      type:                 jr.type,
      address:              jr.address || jr.pickupPoint,
      pickupPoint:          jr.pickupPoint,
      destination:          jr.destination,
      latitude:             jr.latitude,
      longitude:            jr.longitude,
      destinationLatitude:  jr.destinationLatitude,
      destinationLongitude: jr.destinationLongitude,
      vehiclePreference:    jr.vehiclePreference,
      license:              jr.license,
      vehicleNo:            jr.vehicleNo,
      vehicle:              jr.vehicle || jr.vehicleNo,
      vehicleType:          jr.vehicleType,
      capacity:             jr.capacity || (jr.vehicleType ? CAPS[jr.vehicleType] : null),
      preferredTimeSlot:    jr.preferredTimeSlot,
      transporterId:        jr.transporterId,
      status:               'active',
    });
    await newUser.save();

    // In-app notification
    try {
      await sendNotification(
        newUser._id, jr.type,
        'Request Approved ✅',
        'Your join request has been approved! You can now login.',
        'confirmation', newUser._id, 'user', false
      );
    } catch (notifErr) {
      console.warn('Approval in-app notification failed:', notifErr.message);
    }

    // Email notification
    if (jr.email) {
      try {
        await sendApprovalEmail(jr.email, jr.name || jr.fullName, jr.type);
        console.log(`Approval email sent to ${jr.email}`);
      } catch (emailErr) {
        console.warn('Approval email failed (non-fatal):', emailErr.message);
      }
    }

    return res.json({ success: true, message: `${jr.type} approved`, user: newUser });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/join-requests/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const jr = await JoinRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    if (!jr) return res.status(404).json({ success: false, message: 'Request not found' });

    // Email notification
    if (jr.email) {
      try {
        await sendRejectionEmail(jr.email, jr.name || jr.fullName, jr.type);
        console.log(`Rejection email sent to ${jr.email}`);
      } catch (emailErr) {
        console.warn('Rejection email failed (non-fatal):', emailErr.message);
      }
    }

    return res.json({ success: true, message: 'Rejected' });
  } catch {
    return res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/join-requests/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await JoinRequest.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false });
  }
});

module.exports = router;