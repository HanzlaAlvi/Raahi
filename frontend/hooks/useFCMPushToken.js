// frontend/hooks/useFCMPushToken.js
//
// ─── FIX: Firebase v22 modular API ───────────────────────────────────────────
//   OLD (deprecated namespaced API — caused all the WARN logs):
//     import messaging from '@react-native-firebase/messaging';
//     messaging().requestPermission()
//     messaging().getToken()
//     messaging().onTokenRefresh()
//     messaging.AuthorizationStatus.AUTHORIZED
//
//   NEW (modular API — zero deprecation warnings):
//     import { getMessaging, requestPermission, getToken, onTokenRefresh,
//              AuthorizationStatus } from '@react-native-firebase/messaging';
//     requestPermission(getMessaging())
//     getToken(getMessaging())
//     onTokenRefresh(getMessaging(), handler)
//     AuthorizationStatus.AUTHORIZED
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

// ✅ v22 modular imports — no more "This method is deprecated" warnings
import {
  getMessaging,
  getToken,
  requestPermission,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

import {
  setupNotificationChannels,
  registerForegroundHandler,
  registerNotifeeEventHandler,
  requestIOSPermission,
} from '../Transporter/services/AlarmService';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

async function saveTokenToServer(fcmToken) {
  try {
    const authToken = await AsyncStorage.getItem('authToken');
    if (!authToken) return;
    await axios.put(
      `${API_BASE_URL}/push-token`,
      { fcmToken },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('[FCM] Token saved to server ✅');
  } catch (err) {
    console.warn('[FCM] Could not save token:', err.message);
  }
}

async function requestFCMPermission() {
  // ✅ requestPermission(getMessaging()) — modular v22
  const authStatus = await requestPermission(getMessaging());
  const granted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;
  console.log('[FCM] Permission granted:', granted, '| status:', authStatus);
  return granted;
}

export default function useFCMPushToken() {
  useEffect(() => {
    let unsubscribeForeground;
    let unsubscribeNotifeeEvents;
    let unsubscribeTokenRefresh;

    (async () => {
      // Step 1: Create Android notification channels
      await setupNotificationChannels();

      // Step 2: Request permissions
      if (Platform.OS === 'ios') {
        await requestIOSPermission();
      } else {
        await requestFCMPermission();
      }

      // Step 3: Get the FCM token and save to backend
      try {
        // ✅ getToken(getMessaging()) — modular v22
        const fcmToken = await getToken(getMessaging());
        console.log('[FCM] Token:', fcmToken?.slice(0, 30) + '...');
        if (fcmToken) {
          await saveTokenToServer(fcmToken);
        }
      } catch (err) {
        console.warn('[FCM] getToken error:', err.message);
      }

      // Step 4: Listen for token refresh
      // ✅ onTokenRefresh(getMessaging(), handler) — modular v22
      unsubscribeTokenRefresh = onTokenRefresh(getMessaging(), async newToken => {
        console.log('[FCM] Token refreshed');
        await saveTokenToServer(newToken);
      });

      // Step 5: Handle foreground FCM messages via Notifee (plays alarm sound)
      unsubscribeForeground = registerForegroundHandler();

      // Step 6: Handle Notifee button presses / dismiss
      unsubscribeNotifeeEvents = registerNotifeeEventHandler();
    })();

    return () => {
      unsubscribeForeground?.();
      unsubscribeNotifeeEvents?.();
      unsubscribeTokenRefresh?.();
    };
  }, []);
}