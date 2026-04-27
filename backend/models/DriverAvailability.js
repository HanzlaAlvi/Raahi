'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  driverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName:    String,
  date:          Date,
  startTime:     String,
  endTime:       String,
  status:        { type: String, default: 'available' },
  confirmed:     { type: Boolean, default: false },
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('DriverAvailability', schema);