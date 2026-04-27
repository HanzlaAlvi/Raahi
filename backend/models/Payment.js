'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  type:          String,   // 'subscription' | 'driver_payment' | 'expense' etc.
  driverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName:    String,
  passengerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount:        Number,
  amountLabel:   String,
  paidAmount:    { type: Number, default: 0 },
  remainingAmount: { type: Number, default: null },
  mode:          String,
  paymentMethod: { type: String, default: 'Cash' },
  status:        String,
  month:         String,
  description:   String,
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Subscription-specific
  planName:      String,
  planId:        String,
  transactionId: String,
  startDate:     Date,
  endDate:       Date,
  approvedDate:  Date,
  approvedBy:    String,

  // Proof screenshot — stored as base64 data URI or a URL string
  // Transporter uploads this when setting a passenger's subscription amount
  proofImage:    { type: String, default: null },

  date:      { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Payment', schema);