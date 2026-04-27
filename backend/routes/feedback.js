'use strict';
const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: get the current date components in Pakistan Standard Time (UTC+5)
// The server may run in UTC — using PKT ensures the window opens on the
// correct calendar day for Pakistani users (26th–30th of the month).
// ─────────────────────────────────────────────────────────────────────────────
function getPKTDate() {
  const now    = new Date();
  const pktMs  = now.getTime() + 5 * 60 * 60 * 1000; // UTC + 5 hours
  return new Date(pktMs);
}

function isLastWeekOfMonth() {
  const pkt     = getPKTDate();
  const year    = pkt.getUTCFullYear();
  const month   = pkt.getUTCMonth();
  const day     = pkt.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Last 7 days of the month (days 24–30 for a 30-day month)
  return day >= lastDay - 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback  — passenger or driver submits general feedback (existing)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const tid  = req.body.transporterId || user?.transporterId || req.userId;
    const fb   = new Feedback({
      ...req.body,
      passengerId:   req.userId,
      passengerName: user?.name,
      givenBy:       user?.role || user?.type,
      transporterId: tid,
    });
    await fb.save();
    if (req.body.driverId) {
      await sendNotification(
        req.body.driverId, 'driver',
        '⭐ New Rating',
        `${user?.name} gave you ${req.body.rating}/5 stars.`,
        'feedback', fb._id, 'feedback', false
      );
    }
    res.status(201).json({ success: true, feedback: fb });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback  — transporter fetches all feedback (existing)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const q = { transporterId: req.query.transporterId || req.userId };
    if (req.query.driverId) q.driverId = req.query.driverId;
    const feedbacks = await Feedback.find(q)
      .populate('passengerId')
      .populate('driverId')
      .sort({ createdAt: -1 });
    const avg = feedbacks.length
      ? feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length
      : 0;
    res.json({ success: true, feedbacks, data: feedbacks, averageRating: parseFloat(avg.toFixed(2)) });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/driver/:driverId  — driver's own feedback (existing)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/driver/:driverId', auth, async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ driverId: req.params.driverId }).sort({ createdAt: -1 });
    const avg = feedbacks.length
      ? feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length
      : 0;
    res.json({ success: true, feedbacks, averageRating: parseFloat(avg.toFixed(2)) });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback/monthly-window
// FIX: alreadySubmitted now correctly uses isMonthly:true instead of
//      subject:{$exists:true}.  The Feedback schema stores subject:'  ' as
//      default on EVERY document, so the old check always returned true for
//      users who had submitted any feedback — blocking the monthly form.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monthly-window', auth, async (req, res) => {
  try {
    const pkt      = getPKTDate();
    const year     = pkt.getUTCFullYear();
    const month    = pkt.getUTCMonth();
    const isOpen   = isLastWeekOfMonth();
    const lastDay  = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const windowStart = new Date(Date.UTC(year, month, lastDay - 6));
    const windowEnd   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
    const monthLabel  = new Date(Date.UTC(year, month, 1))
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    // Check if this user already submitted the MONTHLY structured form this month.
    // Use isMonthly:true — do NOT use subject:{$exists:true} because the Feedback
    // schema defaults subject to '' so every document matches that filter.
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    const endOfMonth   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    const existing = await Feedback.findOne({
      passengerId: req.userId,
      isMonthly:   true,             // ← only count actual monthly submissions
      createdAt:   { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    res.json({
      success:          true,
      isOpen,
      month:            monthLabel,
      windowStart:      windowStart.toISOString(),
      windowEnd:        windowEnd.toISOString(),
      alreadySubmitted: !!existing,
    });
  } catch (err) {
    console.error('[feedback/monthly-window]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback/monthly
// ─────────────────────────────────────────────────────────────────────────────
router.post('/monthly', auth, async (req, res) => {
  try {
    if (!isLastWeekOfMonth()) {
      return res.status(403).json({
        success: false,
        message: 'Monthly feedback can only be submitted during the last week of the month (26th–30th).',
      });
    }

    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const tid = req.body.transporterId || user.transporterId;

    const pkt          = getPKTDate();
    const year         = pkt.getUTCFullYear();
    const month        = pkt.getUTCMonth();
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    const endOfMonth   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    // Prevent duplicate monthly submission — use isMonthly:true (not subject filter)
    const existing = await Feedback.findOne({
      passengerId: req.userId,
      isMonthly:   true,
      createdAt:   { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted monthly feedback for this month.',
      });
    }

    const { subject, date, questions } = req.body;
    if (!subject || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'subject and questions are required.',
      });
    }

    const monthLabel = new Date(Date.UTC(year, month, 1))
      .toLocaleString('default', { month: 'long', year: 'numeric' });

    const fb = new Feedback({
      passengerId:   req.userId,
      passengerName: user.name,
      givenBy:       user.role || user.type,
      transporterId: tid || null,
      subject,
      feedbackDate:  date ? new Date(date) : new Date(),
      questions,
      comment:       questions.map(q => `${q.question}: ${q.answer}`).join(' | '),
      isMonthly:     true,
      month:         monthLabel,
    });
    await fb.save();

    if (tid) {
      try {
        await sendNotification(
          tid, 'transporter',
          '📝 Monthly Feedback Received',
          `${user.name} submitted monthly feedback for ${monthLabel}.`,
          'feedback', fb._id, 'feedback', false
        );
      } catch {}
    }

    res.status(201).json({ success: true, feedback: fb });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback/send-monthly-reminder — called by cron job
// FIX: uses isMonthly:true to detect who already submitted this month
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send-monthly-reminder', async (req, res) => {
  if (req.headers['x-cron-secret'] !== (process.env.CRON_SECRET || 'raahi_cron_2024')) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    if (!isLastWeekOfMonth()) {
      return res.json({ success: false, message: 'Not in last week of month. No reminders sent.' });
    }

    const pkt          = getPKTDate();
    const year         = pkt.getUTCFullYear();
    const month        = pkt.getUTCMonth();
    const monthLabel   = new Date(Date.UTC(year, month, 1))
      .toLocaleString('default', { month: 'long', year: 'numeric' });
    const startOfMonth = new Date(Date.UTC(year, month, 1));
    const endOfMonth   = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

    const allUsers = await User.find({
      $or: [
        { role: { $in: ['passenger', 'driver'] } },
        { type: { $in: ['passenger', 'driver'] } },
      ],
      status: { $ne: 'inactive' },
    }).select('_id name role type').lean();

    // Only check isMonthly:true submissions — not general feedback
    const submittedIds = await Feedback.find({
      passengerId: { $in: allUsers.map(u => u._id) },
      isMonthly:   true,
      createdAt:   { $gte: startOfMonth, $lte: endOfMonth },
    }).distinct('passengerId');

    const submittedSet = new Set(submittedIds.map(id => id.toString()));
    const pending      = allUsers.filter(u => !submittedSet.has(u._id.toString()));

    let sent = 0;
    for (const user of pending) {
      const role = user.role || user.type;
      try {
        await sendNotification(
          user._id, role,
          `📝 Share Your Monthly Feedback — ${monthLabel}`,
          'Your monthly feedback window is now open! Please share your experience to help us improve the service.',
          'general', null, 'feedback', true, 'open_feedback'
        );
        sent++;
      } catch {}
    }

    res.json({ success: true, sent, total: pending.length, month: monthLabel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;