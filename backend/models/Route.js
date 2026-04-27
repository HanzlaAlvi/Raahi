'use strict';
/**
 * models/Route.js  — Updated with polyline + ride-state fields
 */
const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  name: String, routeName: String,
  pollId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Poll' },
  assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  driverName:     { type: String, default: null },
  stops:          [String],
  startPoint:     String,

  destination:    String,
  destinationLat: Number,
  destinationLng: Number,

  timeSlot:   String,
  pickupTime: String,
  date:       Date,

  passengers: [{
    passengerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    passengerName: String,
    pickupPoint:   String,
    // ─── destination fields ──────────────────────────────────────────────────
    // IMPORTANT: store the place NAME here, not the passenger name
    destination:   String,
    destinationLat:Number,
    destinationLng:Number,
    // ────────────────────────────────────────────────────────────────────────
    status:    { type: String, default: 'pending' },
    latitude:  Number,
    longitude: Number,
  }],

  estimatedTime:  String,
  estimatedFuel:  String,
  estimatedKm:    String,
  fuelType:       { type: String, default: 'petrol' },
  fuelCostPKR:    String,
  fuelRatePerKm:  Number,
  pricePerLitre:  Number,
  vehicleType:    { type: String, default: 'van' },
  distance:       String,
  totalDistance:  String,
  duration:       String,

  status:         { type: String, default: 'unassigned' },
  transporterId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Google Directions polyline — generated once by driver ─────────────────
  // Passengers and transporter decode + reuse this. No re-fetching.
  encodedPolyline: { type: String, default: null },

  // ── Ride state ────────────────────────────────────────────────────────────
  rideState: {
    type:    String,
    enum:    ['PICKING_UP', 'GOING_TO_DESTINATION', 'COMPLETED', null],
    default: null,
  },

  // ── Strict sequence sync ──────────────────────────────────────────────────
  currentStopIndex:  { type: Number, default: 0, min: 0, max: 4 },
  stopStatuses: [{
    stopIndex:          Number,
    passengerId:        String,
    passengerConfirmed: { type: Boolean, default: false },
    driverConfirmed:    { type: Boolean, default: false },
  }],
  simulationPaused:  { type: Boolean, default: false },

  // ── EXISTING flag ──────────────────────────────────────────────
  autoAssigned:      { type: Boolean, default: false },

  // ── NEW FLAGS: Automated Route Assignment System ───────────────
  // isOptimized    — VRP optimizer ran + route saved to DB
  isOptimized:       { type: Boolean, default: false },
  // isAssigned     — driver assigned (manual OR automatic)
  isAssigned:        { type: Boolean, default: false },
  // isAutoProcessed — 12 AM pipeline ran: auto-optimized + auto-assigned
  isAutoProcessed:   { type: Boolean, default: false },
  // autoProcessedAt — timestamp of when auto-processing happened
  autoProcessedAt:   { type: Date, default: null },

  currentLocation: {
    latitude:  Number,
    longitude: Number,
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Route', routeSchema);