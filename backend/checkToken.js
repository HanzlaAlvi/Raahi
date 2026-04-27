'use strict';
require('dotenv').config();
const connectDB = require('./config/db');
const User      = require('./models/User');

async function main() {
  await connectDB();

  const transporters = await User.find({
    $or: [{ role: 'transporter' }, { type: 'transporter' }],
  }).select('name email role fcmToken expoPushToken updatedAt').lean();

  console.log('\n══════════════════════════════════════');
  console.log('  CURRENT TRANSPORTER FCM TOKENS IN DB');
  console.log('══════════════════════════════════════\n');

  for (const t of transporters) {
    console.log(`Name:     ${t.name}`);
    console.log(`Email:    ${t.email}`);
    console.log(`Role:     ${t.role}`);
    console.log(`FCM:      ${t.fcmToken || '❌ NULL'}`);
    console.log(`Expo:     ${t.expoPushToken || '❌ NULL'}`);
    console.log(`Updated:  ${t.updatedAt}`);
    console.log('──────────────────────────────────────');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });