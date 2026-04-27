'use strict';
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic info
  name:        { type: String, default: '' },
  fullName:    { type: String, default: '' },
  email:       { type: String, lowercase: true, trim: true },
  password:    { type: String },
  phone:       { type: String, default: '' },

  // Role
  role:        { type: String, default: 'passenger' },
  type:        { type: String, default: 'passenger' },

  // Company / transporter
  company:     { type: String, default: '' },
  companyName: { type: String, default: '' },

  // Location
  address:     { type: String, default: '' },
  country:     { type: String, default: '' },
  city:        { type: String, default: '' },
  zone:        { type: String, default: '' },
  latitude:    { type: Number, default: null },
  longitude:   { type: Number, default: null },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number],
    address:     String,
  },

  // Passenger fields
  pickupPoint:          { type: String, default: '' },
  destination:          { type: String, default: '' },
  destinationLatitude:  { type: Number, default: null },
  destinationLongitude: { type: Number, default: null },
  preferredTimeSlot:    { type: String, default: '' },
  selectedTimeSlot:     { type: String, default: '' },
  vehiclePreference:    { type: String, default: null },

  // Driver fields
  license:           { type: String, default: '' },
  vehicleNo:         { type: String, default: '' },
  vehicleType:       { type: String, default: '' },
  vehicle:           { type: String, default: '' },
  capacity:          { type: Number, default: 4 },
  experience:        { type: String, default: '' },
  availableTimeSlots:{ type: [String], default: [] },

  // Transporter reference (for drivers AND passengers)
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Profile
  profileImage:    { type: String, default: null },
  status:          { type: String, default: 'active' },
  registrationDate:{ type: Date, default: Date.now },

  // ── FCM Push Token (saved via PUT /api/push-token) ──────────────────────
  // IMPORTANT: This field was missing from the schema but used everywhere.
  // Declaring it here ensures proper querying in cron services.
  fcmToken:      { type: String, default: null },
  expoPushToken: { type: String, default: null },

  // OTP for password reset
  resetOTP: {
    code:         { type: String, default: null },
    expiresAt:    { type: Date,   default: null },
    mobileNumber: { type: String, default: null },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);