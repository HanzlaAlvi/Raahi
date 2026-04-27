'use strict';
const express = require('express');
const router  = express.Router();
const Poll    = require('../models/Poll');
const User    = require('../models/User');
const auth    = require('../middleware/auth');
const sendNotification = require('../helpers/notification');
const sendFCMPush      = require('../helpers/fcmPush');

// ─── HELPER: Is the current time within the 6 PM – 10 PM window? ─
function isWithinPollWindow() {
  const h = new Date().getHours();
  return h >= 18 && h < 22; // 18:00 to 21:59 = 6 PM to 9:59 PM
}

// ─────────────────────────────────────────────────────────────────
// POST /api/polls — Transporter manually creates a poll
// (Transporter can create anytime — no time restriction for creation)
// ─────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { title, timeSlots, closesAt, closingDate, transporterId, pollType, routeStartTime, routeEndTime } = req.body;
    const tid = transporterId || req.userId;

    const poll = new Poll({
      title:          title || 'Tomorrow Travel',
      question:       pollType === 'return'
        ? 'Will you return tomorrow?'
        : 'Will you travel tomorrow?',
      pollType:       pollType || 'morning',
      timeSlots,
      closesAt,
      closingDate:    closingDate || new Date(Date.now() + 86400000),
      transporterId:  tid,
      routeStartTime: routeStartTime || null,
      routeEndTime:   routeEndTime   || null,
      status:         'active',
      autoCreated:    false,
      responses:      [],
    });

    await poll.save();

    // Notify all passengers under this transporter
    const pax  = await User.find({
      $or: [{ role: 'passenger' }, { type: 'passenger' }],
      transporterId: tid,
      status: 'active',
    });

    let sent = 0;
    const tokens = [];

    for (const p of pax) {
      try {
        await sendNotification(
          p._id, 'passenger',
          '📋 Travel Confirmation Poll',
          `${title || 'Will you travel tomorrow?'} Respond by ${closesAt || '10:00 PM'}.`,
          'poll', poll._id, 'poll', true, 'respond_poll'
        );
        const tok = p.fcmToken || p.expoPushToken;
        if (tok) tokens.push(tok);
        sent++;
      } catch {}
    }

    if (tokens.length) {
      await sendFCMPush(
        tokens,
        '📋 New Poll — Jawab Do!',
        `${title || 'Will you travel tomorrow?'} 6 PM se 10 PM ke beech jawab do.`,
        { type: 'poll_open', pollId: poll._id.toString(), screen: 'Dashboard' },
        'default'
      );
    }

    poll.notificationsSent = true;
    await poll.save();

    res.json({ success: true, poll, notificationsSent: sent, totalPassengers: pax.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/polls — Transporter gets all their polls
// ─────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const tid   = req.query.transporterId || req.userId;
    const polls = await Poll.find({ transporterId: tid })
      .populate('responses.passengerId')
      .sort({ createdAt: -1 });
    res.json({ success: true, polls, data: polls });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/polls/active — Passenger gets active polls for their transporter
// ─────────────────────────────────────────────────────────────────
router.get('/active', auth, async (req, res) => {
  try {
    const u = await User.findById(req.userId);
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });

    const q = { status: 'active' };
    if (u.transporterId) q.transporterId = u.transporterId;

    const polls  = await Poll.find(q).sort({ pollType: 1, createdAt: -1 });
    const result = polls.map(p => {
      const ur = p.responses.find(
        r => r.passengerId && r.passengerId.toString() === req.userId.toString()
      );
      return { ...p.toObject(), hasResponded: !!ur, userResponse: ur || null };
    });

    res.json({ success: true, polls: result, count: result.length });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/polls/:pollId — Get single poll
// ─────────────────────────────────────────────────────────────────
router.get('/:pollId', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, poll });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/polls/:pollId/respond — Passenger responds to poll
// TIME WINDOW ENFORCED: Only allowed 6 PM – 10 PM
// ─────────────────────────────────────────────────────────────────
router.post('/:pollId/respond', auth, async (req, res) => {
  try {
    const {
      response, selectedTimeSlot, pickupPoint,
      pickupLat, pickupLng, destination, dropLat, dropLng, vehiclePreference,
    } = req.body;

    const poll = await Poll.findById(req.params.pollId);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });
    if (poll.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'This poll is closed. Responses are no longer accepted.',
        code:    'POLL_CLOSED',
      });
    }

    const u = await User.findById(req.userId);
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });

    const obj = {
      passengerId:      req.userId,
      passengerName:    u.name,
      passengerEmail:   u.email || '',
      response,
      selectedTimeSlot: response === 'yes' ? selectedTimeSlot : null,
      pickupPoint:      response === 'yes' ? (pickupPoint || u.pickupPoint) : null,
      pickupLat:        pickupLat  || u.latitude,
      pickupLng:        pickupLng  || u.longitude,
      destination:      destination || u.destination || '',
      dropLat:          dropLat    || u.destinationLatitude,
      dropLng:          dropLng    || u.destinationLongitude,
      vehiclePreference:vehiclePreference || u.vehiclePreference || null,
      autoYes:          false,
      respondedAt:      new Date(),
    };

    const idx = poll.responses.findIndex(
      r => r.passengerId && r.passengerId.toString() === req.userId.toString()
    );
    if (idx !== -1) poll.responses[idx] = obj;
    else poll.responses.push(obj);

    await poll.save();

    // Notify transporter
    if (poll.transporterId) {
      // Send Android-style alarm notification to transporter
      const transporter = await User.findById(poll.transporterId);
      if (transporter && transporter.fcmToken) {
        const sendFCMPush = require('../helpers/fcmPush');
        await sendFCMPush(
          transporter.fcmToken,
          '⏰ Poll Response Aaya',
          `${u.name}: ${response === 'yes' ? 'Will travel' : 'Will NOT travel'} → ${destination || u.destination || 'Unknown'}`,
          {
            type: 'alarm',
            relatedId: poll._id.toString(),
            relatedType: 'poll',
            actionRequired: 'true',
            actionType: 'view_poll',
            screen: 'Polls',
          },
          'alarm'
        );
      } else {
        // fallback: normal notification if no fcmToken
        await sendNotification(
          poll.transporterId, 'transporter',
          'Poll Response Aaya',
          `${u.name}: ${response === 'yes' ? 'Will travel' : 'Will NOT travel'} → ${destination || u.destination || 'Unknown'}`,
          'poll', poll._id, 'poll', false
        );
      }
    }

    res.json({ success: true, message: 'Response recorded successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/polls/:pollId/close — Transporter manually closes poll
// ─────────────────────────────────────────────────────────────────
router.put('/:pollId/close', auth, async (req, res) => {
  try {
    const p = await Poll.findByIdAndUpdate(req.params.pollId, { status: 'closed' }, { new: true });
    res.json({ success: true, poll: p });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/polls/:pollId
// ─────────────────────────────────────────────────────────────────
router.delete('/:pollId', auth, async (req, res) => {
  try {
    await Poll.findByIdAndDelete(req.params.pollId);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/polls/:pollId/responses — Summary of poll responses
// ─────────────────────────────────────────────────────────────────
router.get('/:pollId/responses', auth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.pollId).populate('responses.passengerId');
    if (!poll) return res.status(404).json({ success: false });

    const yes = poll.responses.filter(r => r.response === 'yes');
    const no  = poll.responses.filter(r => r.response === 'no');
    const dm  = {};
    yes.forEach(r => { const d = r.destination || 'Unknown'; dm[d] = (dm[d] || 0) + 1; });

    res.json({
      success: true,
      summary: {
        total:               poll.responses.length,
        yes:                 yes.length,
        no:                  no.length,
        autoYesCount:        yes.filter(r => r.autoYes).length,
        yesResponses:        yes,
        noResponses:         no,
        destinationBreakdown:dm,
      },
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

module.exports = router;