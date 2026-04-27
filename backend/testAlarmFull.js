'use strict';
/**
 * sendTestNotification.js
 * 
 * Seedha transporter ko FCM push notification bhejta hai.
 * Usage: node sendTestNotification.js
 */

require('dotenv').config();

const admin = require('firebase-admin');
const connectDB = require('./config/db');
const User = require('./models/User');

// Firebase init
if (!admin.apps.length) {
  const sa = require('./config/serviceAccountKey.json');
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function main() {
  await connectDB();

  // DB se transporter ka token lo
  const transporter = await User.findOne({
    $or: [{ role: 'transporter' }, { type: 'transporter' }],
    fcmToken: { $ne: null },
  }).lean();

  if (!transporter) {
    console.log('❌ No transporter with FCM token found. Run checkToken.js first.');
    process.exit(1);
  }

  console.log(`\n✅ Sending notification to: ${transporter.name}`);
  console.log(`   Token: ${transporter.fcmToken.substring(0, 40)}...\n`);

  const message = {
    notification: {
      title: '⚠️ Route Siding Test Alert',
      body:  'Yeh test notification hai. Route miss detection kaam kar raha hai!',
    },
    data: {
      type:        'route_missed',
      screen:      'Trips',
      test:        'true',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'default_channel',
        sound:     'default',
        priority:  'high',
      },
    },
    token: transporter.fcmToken,
  };

  try {
    const result = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully!');
    console.log('   Message ID:', result);
    console.log('\n📱 Check your phone — notification aani chahiye!\n');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    if (err.code === 'messaging/registration-token-not-registered') {
      console.log('   Token expired — app mein logout/login karo');
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });