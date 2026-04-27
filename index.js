// index.js
import { registerRootComponent, AppRegistry } from 'expo';
import notifee, { EventType } from '@notifee/react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

import {
  triggerAlarm,
  setupNotificationChannels,
} from './frontend/Transporter/services/AlarmService';

import App from './App';

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND / QUIT STATE — FCM Handler
// Yeh tab chalta hai jab app BAND ho ya BACKGROUND mein ho
// ─────────────────────────────────────────────────────────────────────────────
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('[BGHandler] FCM message received in background/quit');

  try {
    // Channel banao (agar pehle se nahi bana)
    await setupNotificationChannels();

    const title = remoteMessage.notification?.title || 'Raahi Alarm';
    const body  = remoteMessage.notification?.body  || 'Routes assign karo!';
    const data  = remoteMessage.data || {};

    // Notification dikhao
    await triggerAlarm({ title, body, data });

    console.log('[BGHandler] Alarm triggered successfully');
  } catch (error) {
    console.error('[BGHandler] Error:', error.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFEE BACKGROUND EVENT HANDLER
// Jab user background mein notification tap kare
// ─────────────────────────────────────────────────────────────────────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    console.log('[Notifee BG] Notification pressed:', detail.notification?.id);
  }
  if (type === EventType.DISMISSED) {
    console.log('[Notifee BG] Notification dismissed');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT REGISTER
// ─────────────────────────────────────────────────────────────────────────────
registerRootComponent(App);