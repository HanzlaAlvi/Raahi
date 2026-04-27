/**
 * hooks/useExpoPushToken.js
 *
 * Expo Push Token register karo aur backend mein save karo.
 * Expo 55 ke saath free push notifications ke liye.
 *
 * INSTALLATION (ek baar terminal mein run karo):
 *   npx expo install expo-notifications expo-device
 *
 * USE:
 *   import useExpoPushToken from '../hooks/useExpoPushToken';
 *   // Component ke andar:
 *   useExpoPushToken(authToken);
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

// ─── Notification handler: foreground mein bhi show karo ─────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    // Alarm type notifications: sound ON, alert ON
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  data.type === 'alarm' || data.type === 'midnight_summary',
    };
  },
});

// ─── Android notification channels (Expo 55) ─────────────────────
async function setupAndroidChannels() {
  if (Platform.OS !== 'android') return;

  // Alarm channel — loud, vibrate
  await Notifications.setNotificationChannelAsync('alarm', {
    name: 'Alarm Notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lightColor: '#FF0000',
    sound: true,
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // Routes channel
  await Notifications.setNotificationChannelAsync('routes', {
    name: 'Route Updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: true,
  });

  // Availability channel
  await Notifications.setNotificationChannelAsync('availability', {
    name: 'Availability Requests',
    importance: Notifications.AndroidImportance.HIGH,
    sound: true,
  });

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General Notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: true,
  });
}

// ─── Main hook ────────────────────────────────────────────────────
export default function useExpoPushToken(authToken) {
  const registered = useRef(false);

  useEffect(() => {
    if (!authToken || registered.current) return;

    async function register() {
      try {
        // Sirf real device pe kaam karta hai (emulator pe nahi)
        if (!Device.isDevice) {
          console.log('[PushToken] Physical device nahi — push skip');
          return;
        }

        // Android channels setup
        await setupAndroidChannels();

        // Permission maango
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[PushToken] Permission nahi mila — push disabled');
          return;
        }

        // Expo Push Token lo
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'f081ff62-2d72-4d22-9460-f3d9d0bef2dc', // app.json mein projectId ho to yahan daal do, warna Expo auto-detect karega
        });

        const expoPushToken = tokenData.data;
        console.log('[PushToken] Expo Push Token:', expoPushToken);

        // Backend mein save karo
        const res = await fetch(`${API_BASE}/push-token`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ expoPushToken }),
        });

        if (res.ok) {
          registered.current = true;
          console.log('[PushToken] Token backend mein save ho gaya ✅');
        } else {
          const err = await res.text();
          console.warn('[PushToken] Backend save failed:', err);
        }
      } catch (err) {
        console.error('[PushToken] Error:', err.message);
      }
    }

    register();
  }, [authToken]);
}
