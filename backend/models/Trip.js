'use strict';
/**
 * models/Trip.js  — Updated with ride tracking fields
 * Changes:
 *  + encodedPolyline  — stored once by driver, reused by all clients (no recalc)
 *  + rideState        — PICKING_UP | GOING_TO_DESTINATION | COMPLETED
 *  + finalDestination — name/lat/lng for the actual end point
 *  + onboardingStatus — per-stop dual-confirm tracking
 */
const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  driverId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName:      String,
  routeId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Route' },
  routeName:       String,

  // ── Ride lifecycle ─────────────────────────────────────────────────────────
  // PICKING_UP          : driver is collecting passengers stop by stop
  // GOING_TO_DESTINATION: all passengers picked, heading to final destination
  // COMPLETED           : driver reached final destination
  rideState: {
    type:    String,
    enum:    ['PICKING_UP', 'GOING_TO_DESTINATION', 'COMPLETED'],
    default: 'PICKING_UP',
  },
  status: { type: String, default: 'ongoing' },

  // ── Location ───────────────────────────────────────────────────────────────
  currentLocation: { latitude: Number, longitude: Number },
  speed:           Number,
  eta:             String,
  currentStop:     String,

  // ── Route polyline — generated ONCE by driver, reused by all ──────────────
  encodedPolyline: { type: String, default: null },  // Google encoded polyline

  // ── Final destination ──────────────────────────────────────────────────────
  finalDestination: {
    name:      { type: String, default: null },
    latitude:  { type: Number, default: null },
    longitude: { type: Number, default: null },
    address:   { type: String, default: null },
  },

  // ── Passengers ────────────────────────────────────────────────────────────
  passengers: [{
    _id:              { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:             String,
    pickupPoint:      String,
    pickupLat:        Number,
    pickupLng:        Number,
    destination:      String,     // ← destination NAME (not passenger name)
    destinationLat:   Number,
    destinationLng:   Number,
    status:           { type: String, default: 'pending' },  // pending|picked|missed
    pickupTime:       String,
    confirmedMorning: { type: Boolean, default: false },
  }],

  // ── Dual-confirm onboarding per stop ──────────────────────────────────────
  // Keyed by passengerId string for quick lookup
  onboardingStatus: [{
    passengerId:       { type: String },
    stopId:            { type: String },
    passengerConfirmed:{ type: Boolean, default: false },
    driverConfirmed:   { type: Boolean, default: false },
    confirmedAt:       { type: Date,    default: null },
  }],

  stops:          [String],
  completedStops: [String],

  currentStopIndex:  { type: Number, default: 0, min: 0 },
  simulationPaused:  { type: Boolean, default: false },

  timeSlot:      String,
  capacity:      Number,
  vehicleType:   String,
  vehicleNumber: String,
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  startTime:  Date,
  endTime:    Date,
  createdAt:  { type: Date, default: Date.now },
  updatedAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Trip', tripSchema);