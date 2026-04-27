'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  title: String, message: String, type: String, icon: String, color: String,
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userRole:       String,
  relatedId:      mongoose.Schema.Types.ObjectId,
  relatedType:    String,
  actionRequired: { type: Boolean, default: false },
  actionType:     String,
  read:           { type: Boolean, default: false },
  transporterId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pollId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Poll' },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', schema);