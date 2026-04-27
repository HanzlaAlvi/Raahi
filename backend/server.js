'use strict';
require('dotenv').config();

// ── Firebase Admin — MUST be initialized before any route/helper loads ────────
const admin = require('firebase-admin');
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.warn('⚠️  Firebase Admin init failed (FCM will not work):', e.message);
  }
}

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const connectDB          = require('./config/db');
const { uploadsDir }     = require('./helpers/upload');

const authRoutes          = require('./routes/auth');
const userRoutes          = require('./routes/users');
const ProfileRoutes       = require('./routes/profile');
const driverRequestRoutes = require('./routes/driverRequest');
const pollRoutes          = require('./routes/polls');
const routeRoutes         = require('./routes/routes');
const tripRoutes          = require('./routes/trips');
const driverRoutes        = require('./routes/drivers');
const passengerRoutes     = require('./routes/passengers');
const joinRequestRoutes   = require('./routes/joinRequest');
const complaintRoutes     = require('./routes/complaints');
const feedbackRoutes      = require('./routes/feedback');
const notificationRoutes  = require('./routes/notifications');
const paymentRoutes       = require('./routes/payments');
const vanRoutes           = require('./routes/van');
const driverAvailRoutes   = require('./routes/driverAvailability');
const dashboardRoutes     = require('./routes/dashboard');
const subscriptionRoutes  = require('./routes/subscriptions');
const Messages            = require('./routes/messages');
const Message             = require('./models/Message');
const pushTokenRoutes     = require('./routes/pushToken');
const accountRoutes       = require('./routes/account');     // ← account delete / leave-network

const app  = express();
const PORT = process.env.PORT || 3000;

connectDB();
app.use(cors());
app.use(express.json({ limit: '10mb' }));         // increased limit for base64 proof images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' })
);

// ── ROUTES ───────────────────────────────────────────────────────
app.use('/api/auth',              authRoutes);
app.use('/api',                   ProfileRoutes);
app.use('/api',                   userRoutes);
app.use('/api/driver-requests',   driverRequestRoutes);
app.use('/api/dashboard',         dashboardRoutes);
app.use('/api/polls',             pollRoutes);
app.use('/api/routes',            routeRoutes);
app.use('/api/smart-routes',      routeRoutes);
app.use('/api/trips',             tripRoutes);
app.use('/api/passenger',         tripRoutes);
app.use('/api/drivers',           driverRoutes);
app.use('/api/passengers',        passengerRoutes);
app.use('/api/join-requests',     joinRequestRoutes);
app.use('/api/complaints',        complaintRoutes);
app.use('/api/feedback',          feedbackRoutes);
app.use('/api/notifications',     notificationRoutes);
app.use('/api/payments',          paymentRoutes);
app.use('/api/vans',              vanRoutes);
app.use('/api/driver-availability', driverAvailRoutes);
app.use('/api/misc',              dashboardRoutes);
app.use('/api/subscriptions',     subscriptionRoutes);
app.use('/api/messages',          Messages);
app.use('/api/push-token',        pushTokenRoutes);
app.use('/api/account',           accountRoutes);            // ← DELETE /api/account/delete
                                                             //   DELETE /api/account/leave-network

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` })
);

// ── Error handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
});

// ── HTTP + Socket.IO ──────────────────────────────────────────────
const http = require('http');
const server = http.createServer(app);
const { Server: SocketIO } = require('socket.io');
const io = new SocketIO(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.set('io', io);

const attachSocket = require('./socketHandler');
attachSocket(io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);

  setTimeout(() => {
    try {
      require('./corn/Routemisscron');
      console.log('✅ Route miss cron started');
    } catch (e) {
      console.warn('⚠️ Could not start routeMissCron:', e.message);
    }
    try {
      require('./corn/alarmCron');
      console.log('✅ Alarm cron started');
    } catch (e) {
      console.warn('⚠️ Could not start alarmCron:', e.message);
    }
    try {
      require('./corn/feedbackCron');
      console.log('✅ Monthly feedback cron started');
    } catch (e) {
      console.warn('⚠️ Could not start feedbackCron:', e.message);
    }
  }, 10000);
});

module.exports = app;