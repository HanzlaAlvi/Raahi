'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: String, fullName: String, email: String,
  phone: String, password: String, type: String,
  vehicle: String, vehicleNo: String, vehicleType: String,
  capacity: Number, experience: String, license: String,
  preferredTimeSlot:  String,
  vehiclePreference:  { type: String, enum: ['car','van','bus',null], default: null },
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: [Number],
    address:     String,
  },
  address: String, pickupPoint: String, destination: String,
  latitude: Number, longitude: Number,
  destinationLatitude: Number, destinationLongitude: Number,
  transporterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transporterName: String,
  status:    { type: String, default: 'pending' },
  createdAt: { type: Date,   default: Date.now  },
});

module.exports = mongoose.model('JoinRequest', schema);