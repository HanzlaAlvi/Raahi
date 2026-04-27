'use strict';
const express   = require('express');
const router    = express.Router();
const Complaint = require('../models/Complaint');
const User      = require('../models/User');
const auth      = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

// POST /api/complaints
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tid  = req.body.transporterId || user?.transporterId || req.userId;
    const c = new Complaint({
      ...req.body,
      byUserId:      req.userId,
      byName:        user?.name,
      byRole:        user?.role || user?.type,
      transporterId: tid,
    });
    await c.save();
    await sendNotification(
      tid, 'transporter',
      '🚨 New Complaint',
      `${user?.name}: ${c.title || c.description?.substring(0, 40)}`,
      'complaint', c._id, 'complaint', true, 'review_complaint'
    );
    res.status(201).json({ success: true, complaint: c });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/complaints
// FIX: Drivers and passengers see their OWN complaints (by byUserId).
//      Transporters see all complaints filed to them (by transporterId).
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    const role = (user?.role || user?.type || '').toLowerCase();

    let query = {};

    if (role === 'transporter') {
      // Transporter sees all complaints sent to them
      query.transporterId = req.query.transporterId || req.userId;
    } else {
      // Driver / Passenger see only their own complaints
      query.byUserId = req.userId;
    }

    if (req.query.status && req.query.status !== 'all') {
      query.status = { $regex: new RegExp(`^${req.query.status}$`, 'i') };
    }

    const c = await Complaint.find(query)
      .populate('byUserId', 'name role type')
      .populate('againstUserId', 'name role type')
      .sort({ createdAt: -1 });

    res.json({ success: true, complaints: c, data: c });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/complaints/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const c = await Complaint.findById(req.params.id)
      .populate('byUserId', 'name role type')
      .populate('againstUserId', 'name role type')
      .populate('tripId');
    if (!c) return res.status(404).json({ success: false });
    res.json({ success: true, complaint: c });
  } catch {
    res.status(500).json({ success: false });
  }
});

// PUT /api/complaints/:id  (general update — kept for backward compatibility)
router.put('/:id', auth, async (req, res) => {
  try {
    const c = await Complaint.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!c) return res.status(404).json({ success: false });
    if (req.body.status === 'Resolved') {
      c.resolvedAt = new Date();
      await c.save();
    }
    res.json({ success: true, complaint: c });
  } catch {
    res.status(500).json({ success: false });
  }
});

// PATCH /api/complaints/:id
// Transporter updates status + adds note → notifies the original complainant (driver or passenger)
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'status is required' });

    const c = await Complaint.findById(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Complaint not found' });

    c.status = status;

    if (note && note.trim()) {
      c.note = note.trim();
      c.replies = c.replies || [];
      c.replies.push({
        by:     'Transporter',
        byRole: 'transporter',
        text:   note.trim(),
        date:   new Date(),
      });
    }

    if (status.toLowerCase() === 'resolved') {
      c.resolvedAt = new Date();
    }

    await c.save();

    // Notify the original complainant (driver or passenger)
    if (c.byUserId) {
      try {
        const role = (c.byRole || 'passenger').toLowerCase();
        let notifTitle = `Complaint ${status.charAt(0).toUpperCase() + status.slice(1)}`;
        let notifBody  = `Your complaint "${c.title || c.subject || 'Complaint'}" status updated to ${status}.`;

        if (note && note.trim()) {
          notifBody += ` Note: ${note.trim()}`;
        }

        if (status.toLowerCase() === 'resolved') {
          notifTitle = 'Complaint Resolved ✅';
          notifBody  = `Your complaint "${c.title || c.subject || 'Complaint'}" has been resolved.`;
          if (note && note.trim()) notifBody += ` Transporter note: ${note.trim()}`;
        }

        await sendNotification(
          c.byUserId, role,
          notifTitle, notifBody,
          'complaint', c._id, 'complaint', false
        );
      } catch (notifErr) {
        console.warn('[complaints PATCH] notification error:', notifErr.message);
      }
    }

    res.json({ success: true, complaint: c });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/complaints/:id/reply
router.post('/:id/reply', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const c = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $push: { replies: { by: user.name, byRole: user.role || user.type, text: req.body.text, date: new Date() } } },
      { new: true }
    );
    if (!c) return res.status(404).json({ success: false });
    if (c.byUserId?.toString() !== req.userId.toString()) {
      await sendNotification(
        c.byUserId, c.byRole || 'passenger',
        'Complaint Reply',
        `${user.name} replied to your complaint.`,
        'complaint', c._id, 'complaint', false
      );
    }
    res.json({ success: true, complaint: c });
  } catch {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
