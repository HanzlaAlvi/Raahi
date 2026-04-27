'use strict';
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String },
  senderRole: { type: String }, // 'passenger' | 'driver' | 'transporter'

  receiverId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverName: { type: String },

  conversationId: { type: String, required: true, index: true },

  text: { type: String, required: true, trim: true },

  // ─── NEW FIELDS for Chat Rules ───────────────────────────────
  messageType:  { type: String, enum: ['quick_reply', 'typed'], default: 'typed' },
  isQuickReply: { type: Boolean, default: false },

  // Which ride/trip this chat belongs to (chat closes when trip ends)
  rideId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },

  read:      { type: Boolean, default: false },
  readAt:    { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.statics.buildConversationId = function (id1, id2) {
  return [id1.toString(), id2.toString()].sort().join('_');
};

module.exports = mongoose.model('Message', messageSchema);