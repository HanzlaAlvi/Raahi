'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  tripId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  driverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName:    String,
  passengerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  passengerName: String,
  givenBy:       String,
  rating:        Number,
  comment:       String,
  categories: {
    punctuality: Number,
    cleanliness: Number,
    behavior:    Number,
    driving:     Number,
  },
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Monthly structured feedback fields ────────────────────────────────────
  // These fields are populated only when isMonthly is true (monthly form).
  // General trip feedback documents will have these as null/empty.
  subject:      { type: String, default: null },
  feedbackDate: { type: Date,   default: null },
  questions: [{
    question: { type: String },
    answer:   { type: String },
  }],
  isMonthly: { type: Boolean, default: false },
  month:     { type: String,  default: null },   // e.g. "April 2026"

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Feedback', schema);