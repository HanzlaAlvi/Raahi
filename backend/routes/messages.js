'use strict';
// routes/messages.js
// ─────────────────────────────────────────────────────────────────────────────
// FIX: "Class constructor ObjectId cannot be invoked without 'new'"
//   → Mongoose 6+ mein ObjectId() ko new ke saath call karna padta hai
//   → Aggregate pipeline mein $toObjectId use kiya taake string bhi kaam kare
// ─────────────────────────────────────────────────────────────────────────────
const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const Message  = require('../models/Message');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const sendNotification = require('../helpers/notification');

// Helper: string → ObjectId (Mongoose 6+ safe)
const toObjId = (id) => new mongoose.Types.ObjectId(id.toString());

// ── POST /api/messages ────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, text, messageType = 'typed', rideId, routeId } = req.body;
    if (!receiverId || !text?.trim())
      return res.status(400).json({ success: false, message: 'receiverId and text required' });

    const [sender, receiver] = await Promise.all([
      User.findById(req.userId).select('name role type').lean(),
      User.findById(receiverId).select('name role type').lean(),
    ]);
    if (!receiver)
      return res.status(404).json({ success: false, message: 'Receiver not found' });

    const senderRole = sender?.role || sender?.type || 'passenger';
    const isQuickReply = messageType === 'quick_reply';

    // Rule: Driver -> Passenger: quick replies only. Driver -> Transporter: full typing allowed.
    const receiverRole = receiver?.role || receiver?.type || '';
    if (senderRole === 'driver' && !isQuickReply && receiverRole === 'passenger') {
      return res.status(403).json({
        success: false,
        message: 'Drivers can only send quick replies to passengers',
        code: 'DRIVER_NO_TYPING',
      });
    }

    // ── Rule: Passenger typed-message limit = 3 ────────────────────────────
    if (senderRole === 'passenger' && !isQuickReply) {
      const conversationId = Message.buildConversationId(req.userId, receiverId);
      const typedCount = await Message.countDocuments({
        conversationId,
        senderId: req.userId,
        messageType: 'typed',
      });
      if (typedCount >= 3) {
        return res.status(403).json({
          success: false,
          message: 'You have reached your 3 typed message limit',
          code: 'TYPED_LIMIT_REACHED',
          typedCount,
        });
      }
    }

    const conversationId = Message.buildConversationId(req.userId, receiverId);

    const msg = await Message.create({
      senderId: req.userId,
      senderName: sender?.name || 'User',
      senderRole,
      receiverId,
      receiverName: receiver.name || 'User',
      conversationId,
      text: text.trim(),
      messageType: isQuickReply ? 'quick_reply' : 'typed',
      isQuickReply,
      rideId: rideId || null,
      routeId: routeId || null,
    });

    try {
      await sendNotification(
        receiverId,
        receiver.role || receiver.type || 'passenger',
        `Message from ${sender?.name || 'User'}`,
        text.trim().substring(0, 80),
        'general', msg._id, 'message', false
      );
    } catch {}

    return res.status(201).json({ success: true, message: msg });
  } catch (err) {
    console.error('[POST /messages]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/messages/conversations ──────────────────────────────────────────
// FIX: toObjId() used instead of ObjectId() without new
router.get('/conversations', auth, async (req, res) => {
  try {
    const userId   = req.userId.toString();
    const userObjId = toObjId(userId);   // ← correct way in Mongoose 6+

    const msgs = await Message.aggregate([
      {
        // Match messages where this user is sender OR receiver
        $match: {
          $or: [
            { senderId:   userObjId },
            { receiverId: userObjId },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:         '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$read',       false]     },
                    { $eq: ['$receiverId', userObjId] },
                  ],
                },
                1, 0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    // Hydrate with other-user info
    const conversations = await Promise.all(
      msgs.map(async (conv) => {
        const lm      = conv.lastMessage;
        const otherId = lm.senderId.toString() === userId
          ? lm.receiverId
          : lm.senderId;

        const other = await User.findById(otherId)
          .select('name role type profileImage company phone')
          .lean();

        return {
          conversationId: conv._id,
          otherUser: {
            _id:          otherId,
            name:         other?.name         || 'User',
            role:         other?.role         || other?.type || 'unknown',
            company:      other?.company      || null,
            phone:        other?.phone        || null,
            profileImage: other?.profileImage || null,
          },
          lastMessage: {
            text:      lm.text,
            createdAt: lm.createdAt,
            fromMe:    lm.senderId.toString() === userId,
            read:      lm.read,
          },
          unreadCount: conv.unreadCount,
        };
      })
    );

    return res.json({ success: true, conversations });
  } catch (err) {
    console.error('[GET /messages/conversations]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});



// ── GET /api/messages/:otherUserId ────────────────────────────────────────────
router.get('/:otherUserId', auth, async (req, res) => {
  try {
    const conversationId = Message.buildConversationId(req.userId, req.params.otherUserId);
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).lean();

    const other = await User.findById(req.params.otherUserId)
      .select('name role type phone email profileImage vehicleNo vehicle company')
      .lean();

    return res.json({ success: true, messages, otherUser: other || null });
  } catch (err) {
    console.error('[GET /messages/:otherUserId]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/messages/:otherUserId/read ───────────────────────────────────────
router.put('/:otherUserId/read', auth, async (req, res) => {
  try {
    const conversationId = Message.buildConversationId(req.userId, req.params.otherUserId);
    await Message.updateMany(
      { conversationId, receiverId: req.userId, read: false },
      { read: true, readAt: new Date() }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/messages/:messageId ──────────────────────────────────────────
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg)
      return res.status(404).json({ success: false, message: 'Not found' });
    if (msg.senderId.toString() !== req.userId.toString())
      return res.status(403).json({ success: false, message: 'Not your message' });
    await msg.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;