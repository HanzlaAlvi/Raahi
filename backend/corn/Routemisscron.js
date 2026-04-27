'use strict';
/**
 * Routemisscron.js
 *
 * ─── FIXES IN THIS VERSION ──────────────────────────────────────────────────
 *  FIX 1: Miss logic UNCOMMENTED & ENABLED
 *    Pehle yeh sara logic comment mein tha isliye koi notification nahi jaati thi.
 *    Ab yeh properly kaam karega.
 *
 *  FIX 2: Token Error Handling
 *    Jab FCM token invalid hota tha to error silently fail hota tha.
 *    Ab invalid tokens automatically DB se clean ho jaate hain (fcmPush.js handles this).
 *
 *  FIX 3: Transporter-only notifications
 *    Route miss cron SIRF transporter ko notify karta hai.
 *    Passenger aur driver ke liye koi notification NAHI.
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────────────
 *  Runs every 15 minutes.
 *  If transporter has a route with status 'assigned' and scheduled time
 *  has passed by more than 30 minutes without being started:
 *    1. Route status → 'missed'
 *    2. Trip record created
 *    3. Transporter ko notification jaati hai
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Usage in your server.js / app.js:
 *   require('./cron/Routemisscron');
 */

const cron  = require('node-cron');
const Route = require('../models/Route');
const Trip  = require('../models/Trip');
const sendNotification = require('../helpers/notification');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: "10:30 AM" string → today ki Date object
// ─────────────────────────────────────────────────────────────────────────────
function parseTimeToday(timeStr) {
  if (!timeStr) return null;
  try {
    const now   = new Date();
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let hours  = parseInt(match[1], 10);
    const mins = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
async function checkMissedRoutes() {
  try {
    const now = new Date();
    console.log('[MissCron] Checking for missed routes...');

    // Find all routes with 'assigned' status (driver assigned but not started)
    const assignedRoutes = await Route.find({ status: 'assigned' });
    console.log('[MissCron] Assigned routes to check:', assignedRoutes.length);

    for (const r of assignedRoutes) {
      const scheduledTime = parseTimeToday(r.pickupTime || r.timeSlot);
      if (!scheduledTime) continue;

      const minsLate = Math.round((now - scheduledTime) / 60000);

      // If more than 30 minutes past scheduled time and still not started → missed
      if (minsLate <= 30) continue;

      // ── SAFETY: Re-fetch to check live status before marking missed ──────
      const freshRoute = await Route.findById(r._id).select('status');
      if (!freshRoute || freshRoute.status !== 'assigned') {
        console.log('[MissCron] Route status changed to', freshRoute?.status, '— skip');
        continue;
      }

      const routeLabel = r.routeName || r.name || 'Route';
      const timeLabel  = r.pickupTime || r.timeSlot || 'N/A';

      console.log('[MissCron] Route "' + routeLabel + '" is ' + minsLate + ' mins late → marking missed');

      // Mark route as missed
      await Route.findByIdAndUpdate(r._id, { status: 'missed' });

      // Create missed trip record (only if does not already exist)
      const existingTrip = await Trip.findOne({ routeId: r._id });
      if (!existingTrip) {
        await Trip.create({
          routeId:       r._id,
          routeName:     routeLabel,
          driverId:      r.assignedDriver,
          driverName:    r.driverName,
          transporterId: r.transporterId,
          passengers:    r.passengers || [],
          timeSlot:      timeLabel,
          status:        'Missed',
        });
      }

      // ── NOTIFY TRANSPORTER ONLY ──────────────────────────────────────────
      // Sirf transporter ko notification jaayegi.
      // Passenger aur Driver ko is cron se koi notification NAHI.
      if (r.transporterId) {
        await sendNotification(
          r.transporterId,
          'transporter',
          '⚠️ Route Siding Alert',
          `Driver ${r.driverName || 'Unknown'} ne route "${routeLabel}" (${timeLabel}) time par start nahi kiya. Route missed ho gaya hai.`,
          'route_missed',
          r._id,
          'route',
          true  // actionRequired = true (transporter ko dekhna hai)
        );
        console.log('[MissCron] ✅ Transporter notified — route missed: ' + routeLabel);
      }
    }
  } catch (err) {
    console.error('[MissCron] Error:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE — Every 15 minutes
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('*/15 * * * *', () => {
  console.log('[MissCron] ⏰ Running missed route check...');
  checkMissedRoutes();
});

console.log('✅ RouteMissCron registered — runs every 15 minutes');
console.log('   If route is 30+ mins past scheduled time and not started → mark missed + notify transporter only');

module.exports = { checkMissedRoutes };
