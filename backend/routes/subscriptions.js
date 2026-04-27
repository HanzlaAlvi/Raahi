'use strict';
const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/auth');
const Payment  = require('../models/Payment');
const User     = require('../models/User');
const sendNotification = require('../helpers/notification');

// Default plan template — amounts are now set per-passenger by the transporter
const DEFAULT_PLAN_META = {
  id:          'monthly_basic',
  name:        'Monthly Subscription',
  duration:    30,
  description: 'Standard monthly van-pooling service',
  features:    ['Daily pickup & drop', 'Route tracking', 'Notifications'],
};

function toSub(p) {
  const now     = new Date();
  const start   = p.startDate ? new Date(p.startDate) : new Date(p.date);
  const end     = p.endDate   ? new Date(p.endDate)   : new Date(start.getTime() + 30 * 86400000);
  const expired = now > end;
  const active  = !expired && now >= start && ['active', 'approved', 'paid'].includes(p.status);
  return {
    id:              p._id.toString(),
    planName:        p.planName      || 'Monthly Subscription',
    planId:          p.planId        || 'monthly_basic',
    amount:          p.amountLabel   || `Rs. ${(p.amount || 0).toLocaleString()}`,
    amountRaw:       p.amount        || 0,
    startDate:       start.toISOString().split('T')[0],
    endDate:         end.toISOString().split('T')[0],
    status:          expired ? 'completed' : active ? 'active' : (p.status || 'pending'),
    paymentStatus:   ['paid', 'active', 'approved'].includes(p.status) ? 'paid' : 'unpaid',
    paymentMethod:   p.mode          || p.paymentMethod || 'Cash',
    transactionId:   p.transactionId || `SUB${p._id.toString().slice(-6).toUpperCase()}`,
    daysRemaining:   active ? Math.max(0, Math.ceil((end - now) / 86400000)) : 0,
    requestDate:     new Date(p.createdAt || p.date).toISOString().split('T')[0],
    approvedDate:    p.approvedDate  || null,
    approvedBy:      p.approvedBy    || null,
    month:           p.month         || null,
    proofImage:      p.proofImage    || null,
    passengerName:   (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.name  || null) : null,
    passengerEmail:  (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.email || null) : null,
    passengerPhone:  (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.phone || null) : null,
    pickupPoint:     (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.pickupPoint || null) : null,
    destination:     (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.destination || null) : null,
    passengerId:     (p.passengerId && typeof p.passengerId === 'object')
                       ? p.passengerId._id?.toString()
                       : p.passengerId?.toString() || null,
  };
}

// GET /api/subscriptions/current
router.get('/current', auth, async (req, res) => {
  try {
    let p = await Payment.findOne({ passengerId: req.userId, type: 'subscription', status: 'active' }).sort({ date: -1 }).lean();
    if (!p) p = await Payment.findOne({ passengerId: req.userId, type: 'subscription' }).sort({ date: -1 }).lean();
    return res.json({ success: true, subscription: p ? toSub(p) : null });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/subscriptions/history
router.get('/history', auth, async (req, res) => {
  try {
    const q = { passengerId: req.userId, type: 'subscription' };
    if (req.query.status && req.query.status !== 'all') q.status = req.query.status;
    const payments = await Payment.find(q).sort({ date: -1 }).lean();
    const subs  = payments.map(toSub);
    const stats = {
      total:     subs.length,
      active:    subs.filter(s => s.status === 'active').length,
      completed: subs.filter(s => s.status === 'completed').length,
      rejected:  subs.filter(s => s.status === 'rejected').length,
      pending:   subs.filter(s => s.status === 'pending').length,
    };
    return res.json({ success: true, subscriptions: subs, data: subs, stats });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/subscriptions/plans
// Returns the plan that the transporter has assigned for this specific passenger.
// If no custom amount has been set, returns an empty array so the passenger
// sees "No plan assigned yet" instead of a generic fixed-price plan.
router.get('/plans', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();

    if (!user?.transporterId) {
      // Passenger has no transporter — cannot have a plan assigned yet
      return res.json({ success: true, plans: [], message: 'No transporter assigned.' });
    }

    // Look for the latest subscription payment record created by the transporter
    // for this specific passenger. This is the "assigned plan".
    const existing = await Payment.findOne({
      passengerId:   req.userId,
      transporterId: user.transporterId,
      type:          'subscription',
    }).sort({ createdAt: -1 }).lean();

    if (!existing || !existing.amount) {
      // Transporter hasn't set an amount for this passenger yet
      return res.json({ success: true, plans: [], message: 'No plan assigned by your transporter yet.' });
    }

    // Return the transporter-set amount as the passenger's plan
    const plan = {
      ...DEFAULT_PLAN_META,
      amount:      existing.amountLabel || `Rs. ${existing.amount.toLocaleString()}`,
      amountLabel: existing.amountLabel || `Rs. ${existing.amount.toLocaleString()}`,
      amountRaw:   existing.amount,
      // Include proof image if transporter uploaded one
      proofImage:  existing.proofImage || null,
      paymentId:   existing._id.toString(),
    };

    return res.json({ success: true, plans: [plan] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subscriptions/pending — transporter sees all pending subscription requests
router.get('/pending', auth, async (req, res) => {
  try {
    const transporterId = req.query.transporterId || req.userId;
    const payments = await Payment.find({
      transporterId,
      type:   'subscription',
      status: 'pending',
    })
      .populate('passengerId', 'name email phone pickupPoint destination')
      .sort({ date: -1 })
      .lean();

    const requests = payments.map(p => ({
      ...toSub(p),
      passengerName:  (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.name  || '—') : '—',
      passengerEmail: (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.email || '')  : '',
      passengerPhone: (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.phone || '')  : '',
      pickupPoint:    (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.pickupPoint || '') : '',
      destination:    (p.passengerId && typeof p.passengerId === 'object') ? (p.passengerId.destination || '') : '',
    }));

    return res.json({ success: true, requests });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/subscriptions/renew — passenger sends subscription/renewal request
// Uses the transporter-set amount (not a fixed plan) if one exists.
router.post('/renew', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let amount      = 0;
    let amountLabel = 'Amount set by transporter';
    let planId      = 'monthly_basic';
    let planName    = 'Monthly Subscription';

    // Try to use the transporter-set amount for this passenger
    if (user.transporterId) {
      const assigned = await Payment.findOne({
        passengerId:   req.userId,
        transporterId: user.transporterId,
        type:          'subscription',
      }).sort({ createdAt: -1 }).lean();

      if (assigned && assigned.amount) {
        amount      = assigned.amount;
        amountLabel = assigned.amountLabel || `Rs. ${assigned.amount.toLocaleString()}`;
      }
    }

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Your transporter has not set a subscription amount for you yet. Please contact your transporter.',
      });
    }

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 86400000);

    const payment = new Payment({
      type:          'subscription',
      passengerId:   req.userId,
      transporterId: user.transporterId || null,
      amount,
      amountLabel,
      planName,
      planId,
      mode:          'pending',
      status:        'pending',
      month:         `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
      startDate:     now,
      endDate:       end,
      transactionId: `SUB${Date.now().toString().slice(-8)}`,
      createdAt:     now,
      date:          now,
    });
    await payment.save();

    if (user.transporterId) {
      try {
        await sendNotification(
          user.transporterId, 'transporter',
          'New Subscription Request 📋',
          `${user.name || 'Passenger'} has requested ${planName} (${amountLabel}). Please review and approve in Payments.`,
          'payment', payment._id, 'payment', true, 'review_subscription'
        );
      } catch {}
    }

    return res.json({
      success: true,
      message: 'Subscription request sent. Your transporter will approve within 24 hours.',
      payment: toSub(payment.toObject()),
    });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/subscriptions/:id/approve
router.patch('/:id/approve', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Subscription not found' });

    payment.status       = 'active';
    payment.approvedBy   = req.body.approvedBy || 'Transporter';
    payment.approvedDate = new Date();
    await payment.save();

    if (payment.passengerId) {
      try {
        await sendNotification(
          payment.passengerId, 'passenger',
          'Subscription Approved ✅',
          `Your ${payment.planName || 'monthly subscription'} request has been approved! Amount: ${payment.amountLabel || `Rs. ${payment.amount}`}. Service access granted.`,
          'payment', payment._id, 'payment', false, 'subscription_approved'
        );
      } catch {}
    }

    return res.json({ success: true, message: 'Subscription approved. Passenger notified.', payment: toSub(payment.toObject()) });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/subscriptions/:id/reject
router.patch('/:id/reject', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Subscription not found' });

    payment.status       = 'rejected';
    payment.approvedBy   = req.body.approvedBy || 'Transporter';
    payment.approvedDate = new Date();
    await payment.save();

    if (payment.passengerId) {
      try {
        await sendNotification(
          payment.passengerId, 'passenger',
          'Subscription Request Rejected ❌',
          `Your ${payment.planName || 'subscription'} request has been rejected. Please contact your transporter for details.`,
          'payment', payment._id, 'payment', false, 'subscription_rejected'
        );
      } catch {}
    }

    return res.json({ success: true, message: 'Subscription rejected. Passenger notified.', payment: toSub(payment.toObject()) });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/subscriptions/:id/mark-paid
router.patch('/:id/mark-paid', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Subscription not found' });

    payment.status       = 'active';
    payment.approvedBy   = req.body.approvedBy || 'Transporter';
    payment.approvedDate = new Date();
    await payment.save();

    if (payment.passengerId) {
      try {
        await sendNotification(
          payment.passengerId, 'passenger',
          'Payment Confirmed ✅',
          `Your ${payment.planName || 'monthly subscription'} payment of ${payment.amountLabel || `Rs. ${payment.amount}`} has been confirmed. Van service access granted!`,
          'payment', payment._id, 'payment', false, 'subscription_paid'
        );
      } catch {}
    }

    return res.json({ success: true, message: 'Payment marked as paid. Passenger notified.', payment: toSub(payment.toObject()) });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;