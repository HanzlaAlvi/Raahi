'use strict';
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  // Subject / title — both kept for backward compatibility
  title:         { type: String, default: '' },
  subject:       { type: String, default: '' },
  description:   { type: String, default: '' },
  message:       { type: String, default: '' },
  category:      { type: String, default: '' },

  byUserId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  byName:        String,
  byRole:        String,

  againstUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  againstName:   String,

  tripId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  transporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  status:   { type: String, default: 'Open' },
  priority: { type: String, default: 'medium' },

  // Latest transporter note — also mirrored inside replies[] for full history
  note: { type: String, default: '' },

  replies: [{
    by:     String,
    byRole: String,
    text:   String,
    date:   { type: Date, default: Date.now },
  }],

  resolvedAt: Date,
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Complaint', schema);