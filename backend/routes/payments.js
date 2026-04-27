'use strict';
const express  = require('express');
const router   = express.Router();
const Payment  = require('../models/Payment');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE ORDER IS CRITICAL:
//   Static named paths must come BEFORE dynamic /:id paths.
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/payments ────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const q = { transporterId: req.query.transporterId || req.userId };
    if (req.query.type   && req.query.type   !== 'all') q.type   = req.query.type;
    if (req.query.status && req.query.status !== 'all') q.status = req.query.status;
    if (req.query.driverId)    q.driverId    = req.query.driverId;
    if (req.query.passengerId) q.passengerId = req.query.passengerId;

    const payments = await Payment.find(q)
      .populate('driverId',    'name email phone vehicleType vehicleNo')
      .populate('passengerId', 'name email phone pickupPoint destination')
      .sort({ date: -1 })
      .lean();

    const allForStats = await Payment.find({
      transporterId: req.query.transporterId || req.userId,
    }).lean();

    const stats = {
      total:         allForStats.length,
      paid:          allForStats.filter(p => ['paid', 'active', 'approved'].includes(p.status)).length,
      pending:       allForStats.filter(p => ['pending', 'unpaid'].includes(p.status)).length,
      totalAmount:   allForStats.reduce((s, p) => s + (p.amount || 0), 0),
      paidAmount:    allForStats.filter(p => ['paid', 'active', 'approved'].includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0),
      pendingAmount: allForStats.filter(p => ['pending', 'unpaid'].includes(p.status)).reduce((s, p) => s + (p.amount || 0), 0),
    };

    res.json({ success: true, payments, data: payments, total: payments.reduce((s, p) => s + (p.amount || 0), 0), stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payments/drivers ────────────────────────────────────────────────
// All drivers linked to this transporter + per-driver payment summaries.
// STATIC — must be before /:id
router.get('/drivers', auth, async (req, res) => {
  try {
    const transporterId = req.query.transporterId || req.userId;

    const drivers = await User.find({
      $or: [{ role: 'driver' }, { type: 'driver' }],
      transporterId,
    }).select('name email phone vehicleType vehicleNo status').sort({ name: 1 }).lean();

    const driverIds   = drivers.map(d => d._id);
    const allPayments = await Payment.find({
      transporterId,
      driverId: { $in: driverIds },
    }).sort({ date: -1 }).lean();

    const driverData = drivers.map(driver => {
      const driverPayments = allPayments.filter(
        p => p.driverId?.toString() === driver._id.toString()
      );
      const totalPaid    = driverPayments
        .filter(p => ['paid', 'completed', 'approved'].includes(p.status))
        .reduce((s, p) => s + (p.paidAmount || p.amount || 0), 0);
      const totalPending = driverPayments
        .filter(p => ['pending', 'unpaid', 'partial'].includes(p.status))
        .reduce((s, p) => {
          const rem = (p.remainingAmount !== null && p.remainingAmount !== undefined)
            ? p.remainingAmount : (p.amount || 0);
          return s + rem;
        }, 0);
      const latestPayment = driverPayments[0] || null;

      return {
        driver: {
          _id:         driver._id,
          name:        driver.name,
          email:       driver.email,
          phone:       driver.phone,
          vehicleType: driver.vehicleType,
          vehicleNo:   driver.vehicleNo,
          status:      driver.status,
        },
        paymentStats: {
          totalRecords:      driverPayments.length,
          totalPaid,
          totalPending,
          lastPaymentDate:   latestPayment?.date   || null,
          lastPaymentStatus: latestPayment?.status || null,
        },
        payments: driverPayments,
      };
    });

    res.json({ success: true, drivers: driverData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payments/passengers ────────────────────────────────────────────
// All passengers linked to this transporter — for the "set amount" list.
// Returns every passenger along with their existing assigned subscription amount.
// STATIC — must be before /:id
router.get('/passengers', auth, async (req, res) => {
  try {
    const transporterId = req.query.transporterId || req.userId;

    const passengers = await User.find({
      $or: [{ role: 'passenger' }, { type: 'passenger' }],
      transporterId,
    }).select('name email phone pickupPoint destination status').sort({ name: 1 }).lean();

    const passengerIds  = passengers.map(p => p._id);

    // Find the latest subscription record that the transporter created for each passenger
    const latestPayments = await Payment.find({
      transporterId,
      passengerId: { $in: passengerIds },
      type:        'subscription',
    }).sort({ createdAt: -1 }).lean();

    // Build a map: passengerId → latest payment
    const paymentMap = {};
    for (const pay of latestPayments) {
      const pid = pay.passengerId?.toString();
      if (pid && !paymentMap[pid]) paymentMap[pid] = pay;
    }

    const result = passengers.map(p => {
      const pay = paymentMap[p._id.toString()] || null;
      return {
        _id:          p._id,
        name:         p.name,
        email:        p.email,
        phone:        p.phone,
        pickupPoint:  p.pickupPoint,
        destination:  p.destination,
        status:       p.status,
        assignedAmount:      pay?.amount       || null,
        assignedAmountLabel: pay?.amountLabel  || null,
        proofImage:          pay?.proofImage   || null,
        lastPaymentStatus:   pay?.status       || null,
        lastPaymentDate:     pay?.createdAt    || null,
        paymentId:           pay?._id?.toString() || null,
      };
    });

    res.json({ success: true, passengers: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payments/driver/my-records ─────────────────────────────────────
// Driver fetches their own payment records (payments sent by transporter).
// STATIC — must be before /:id
router.get('/driver/my-records', auth, async (req, res) => {
  try {
    const payments = await Payment.find({
      driverId: req.userId,
      type:     'driver_payment',
    }).sort({ date: -1 }).lean();

    const totalReceived = payments
      .filter(p => ['paid', 'completed', 'approved'].includes(p.status))
      .reduce((s, p) => s + (p.paidAmount || p.amount || 0), 0);

    const totalPending = payments
      .filter(p => ['pending', 'unpaid', 'partial'].includes(p.status))
      .reduce((s, p) => {
        const rem = (p.remainingAmount !== null && p.remainingAmount !== undefined)
          ? p.remainingAmount : (p.amount || 0);
        return s + rem;
      }, 0);

    res.json({
      success: true,
      payments,
      data: payments,
      stats: {
        total:         payments.length,
        totalReceived,
        totalPending,
        paid:          payments.filter(p => ['paid', 'completed', 'approved'].includes(p.status)).length,
        pending:       payments.filter(p => ['pending', 'unpaid', 'partial'].includes(p.status)).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/payments/passenger/:passengerId ─────────────────────────────────
// Passenger dashboard payment status check.
// STATIC sub-path — must be before /:id
router.get('/passenger/:passengerId', auth, async (req, res) => {
  try {
    const now          = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const payment = await Payment.findOne({
      passengerId:   req.params.passengerId,
      transporterId: req.query.transporterId || req.userId,
      type:  { $in: ['subscription', 'monthly', 'passenger'] },
      date:  { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ date: -1 }).lean();

    const isPaid = payment && ['paid', 'active', 'approved'].includes(payment.status);

    res.json({
      success:  true,
      isPaid,
      payment:  payment || null,
      message:  isPaid ? null : 'Payment required. Please complete your monthly payment to avail services',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payments/set-passenger-amount ──────────────────────────────────
// Transporter sets the monthly subscription amount for a specific passenger.
// Also accepts an optional proofImage (base64 data URI or URL string) as proof.
// After setting, the passenger is notified so they can see the plan and activate it.
// STATIC — must be before /:id
router.post('/set-passenger-amount', auth, async (req, res) => {
  try {
    const {
      passengerId,
      amount,
      amountLabel,
      proofImage,    // optional base64/URL screenshot
      planName,
      description,
    } = req.body;

    if (!passengerId) {
      return res.status(400).json({ success: false, message: 'passengerId is required.' });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'A valid positive amount is required.' });
    }

    const transporterId = req.userId;

    const passenger = await User.findById(passengerId).lean();
    if (!passenger) {
      return res.status(404).json({ success: false, message: 'Passenger not found.' });
    }

    const now         = new Date();
    const end         = new Date(now.getTime() + 30 * 86400000);
    const numAmount   = Number(amount);
    const label       = amountLabel || `Rs. ${numAmount.toLocaleString('en-PK')}`;
    const monthLabel  = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Create a new subscription record representing the assigned amount.
    // This record starts in 'pending' status — the passenger must still
    // send an activation request (POST /api/subscriptions/renew).
    const payment = new Payment({
      type:          'subscription',
      passengerId,
      transporterId,
      amount:        numAmount,
      amountLabel:   label,
      planName:      planName || 'Monthly Subscription',
      planId:        'monthly_basic',
      mode:          'pending',
      status:        'pending',
      month:         monthLabel,
      startDate:     now,
      endDate:       end,
      transactionId: `ASSIGN${Date.now().toString().slice(-8)}`,
      description:   description || '',
      proofImage:    proofImage  || null,
      createdAt:     now,
      date:          now,
    });
    await payment.save();

    // Notify the passenger so they know their plan has been configured
    try {
      await sendNotification(
        passengerId, 'passenger',
        'Your Subscription Amount Has Been Set 💳',
        `Your transporter has set your monthly subscription amount to ${label}. Please go to Payments to activate your plan.`,
        'payment', payment._id, 'payment', true, 'activate_subscription'
      );
    } catch (notifErr) {
      console.warn('[payments/set-passenger-amount] notification error:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Amount set for ${passenger.name || 'passenger'}. They have been notified.`,
      payment,
    });
  } catch (err) {
    console.error('[payments/set-passenger-amount]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/payments ───────────────────────────────────────────────────────
// Transporter creates a driver payment record.
router.post('/', auth, async (req, res) => {
  try {
    const paidAmt   = Number(req.body.paidAmount) || 0;
    const totalAmt  = Number(req.body.amount)      || 0;
    const remaining = req.body.remainingAmount !== undefined
      ? Number(req.body.remainingAmount)
      : Math.max(0, totalAmt - paidAmt);

    const payment = new Payment({
      ...req.body,
      transporterId:   req.body.transporterId || req.userId,
      paidAmount:      paidAmt,
      remainingAmount: remaining,
      paymentMethod:   req.body.paymentMethod || 'Cash',
    });
    await payment.save();

    if (req.body.driverId) {
      try {
        await sendNotification(
          req.body.driverId, 'driver',
          'Payment Received 💰',
          `Your transporter sent Rs. ${paidAmt.toLocaleString()} via ${req.body.paymentMethod || 'Cash'} on ${new Date(req.body.date || Date.now()).toLocaleDateString('en-PK')}.${remaining > 0 ? ` Remaining: Rs. ${remaining.toLocaleString()}.` : ' Fully paid!'}`,
          'general', payment._id, 'payment', false
        );
      } catch {}
    }

    if (req.body.passengerId) {
      try {
        await sendNotification(
          req.body.passengerId, 'passenger',
          'Payment Update',
          `Your payment of Rs. ${totalAmt.toLocaleString()} — status: ${req.body.status || 'pending'}.`,
          'general', payment._id, 'payment', false
        );
      } catch {}
    }

    res.status(201).json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/payments/:id ────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const p = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment: p });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ── PATCH /api/payments/:id/mark-paid ───────────────────────────────────────
router.patch('/:id/mark-paid', auth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    if (payment.transporterId?.toString() !== req.userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const paidAmt = req.body.paidAmount !== undefined
      ? Number(req.body.paidAmount)
      : (payment.amount || 0);

    payment.status          = paidAmt >= (payment.amount || 0) ? 'paid' : 'partial';
    payment.paidAmount      = paidAmt;
    payment.remainingAmount = Math.max(0, (payment.amount || 0) - paidAmt);
    payment.approvedBy      = req.body.approvedBy || 'Transporter';
    payment.approvedDate    = new Date();
    if (req.body.description)   payment.description   = req.body.description;
    if (req.body.paymentMethod) payment.paymentMethod = req.body.paymentMethod;
    await payment.save();

    if (payment.driverId) {
      try {
        await sendNotification(
          payment.driverId, 'driver',
          'Payment Received ✅',
          `Rs. ${paidAmt.toLocaleString()} received from your transporter.${payment.remainingAmount > 0 ? ` Remaining: Rs. ${payment.remainingAmount.toLocaleString()}.` : ' Fully paid!'}`,
          'general', payment._id, 'payment', false
        );
      } catch {}
    }

    if (payment.passengerId) {
      try {
        await sendNotification(
          payment.passengerId, 'passenger',
          'Payment Confirmed ✅',
          `Your payment of Rs. ${paidAmt.toLocaleString()} has been confirmed.`,
          'general', payment._id, 'payment', false
        );
      } catch {}
    }

    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;