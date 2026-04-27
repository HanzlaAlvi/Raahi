'use strict';
const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  title:         { type: String },
  question:      { type: String, default: 'Will you travel tomorrow?' },
  // 'morning' = aane wala poll, 'return' = wapsi ka poll
  pollType:      { type: String, enum: ['morning', 'return'], default: 'morning' },
  timeSlots:     [String],
  closesAt:      String,
  closingDate:   Date,
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // 'active' = open, 'closed' = 10 PM pe band ho gaya
  status:        { type: String, default: 'active' },
  // System ne auto-create kiya ya transporter ne manually
  autoCreated:   { type: Boolean, default: false },
  responses: [{
    passengerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    passengerName:     String,
    passengerEmail:    String,
    response:          String,
    selectedTimeSlot:  String,
    pickupPoint:       String,
    pickupLat:         Number,
    pickupLng:         Number,
    dropLat:           Number,
    dropLng:           Number,
    destination:       String,
    vehiclePreference: { type: String, enum: ['car', 'van', 'bus', null], default: null },
    autoYes:           { type: Boolean, default: false },
    respondedAt:       { type: Date, default: Date.now },
  }],
  // Route departure time set by transporter — driver MUST start route at this exact time
  routeStartTime:    { type: String, default: null },  // e.g. "07:00 AM"
  routeEndTime:      { type: String, default: null },  // e.g. "08:30 AM"
  createdAt:         { type: Date, default: Date.now },
  notificationsSent: { type: Boolean, default: false },
});

module.exports = mongoose.model('Poll', pollSchema);