/**
 * frontend/Transporter/services/AlarmService.js
 *
 * ─── FIXES IN THIS VERSION ────────────────────────────────────────────────────
 *
 * FIX 1 — Missing exports crash:
 *   TransporterDashboard imported 6 functions that did not exist in this file:
 *     scheduleNightAlarms, areTodayAlarmsScheduled, setupAlarmNotificationListener,
 *     registerAndSavePushToken, isNightWindow, playAlarmSound
 *   All 6 are now implemented and exported.
 *
 * FIX 2 — Firebase v22 deprecation warnings:
 *   OLD (namespaced API — deprecated in v22):
 *     import messaging from '@react-native-firebase/messaging';
 *     messaging().onMessage(handler)
 *     messaging().requestPermission()
 *     messaging().getToken()
 *     messaging().onTokenRefresh(handler)
 *     messaging.AuthorizationStatus.AUTHORIZED
 *
 *   NEW (modular API — v22 standard):
 *     import { getMessaging, onMessage, getToken, ... } from '@react-native-firebase/messaging';
 *     onMessage(getMessaging(), handler)
 *     requestPermission(getMessaging())
 *     getToken(getMessaging())
 *     onTokenRefresh(getMessaging(), handler)
 *     AuthorizationStatus.AUTHORIZED
 *
 * ─── WHAT EACH EXPORT DOES ───────────────────────────────────────────────────
 *
 *  setupNotificationChannels()       — creates Android alarm + default channels (call once at app start)
 *  triggerAlarm({ title, body, data }) — shows a Notifee heads-up alarm notification
 *  registerForegroundHandler()       — listens for FCM while app is open, shows Notifee alarm
 *  registerNotifeeEventHandler()     — handles tap / dismiss on Notifee notifications
 *  requestIOSPermission()            — asks iOS for critical alert permission
 *
 *  registerAndSavePushToken()        — gets FCM token, saves to backend (call on mount)
 *  isNightWindow()                   — returns true if current time is 10 PM – 12 AM
 *  playAlarmSound()                  — plays the local alarm.mp3 sound file
 *  areTodayAlarmsScheduled()         — checks AsyncStorage if today's setup already done
 *  scheduleNightAlarms()             — marks today as set up; returns count of alarms registered
 *  setupAlarmNotificationListener()  — subscribes to foreground FCM alarm messages,
 *                                      calls your callback(notification, isMidnight)
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  EventType,
} from '@notifee/react-native';

// ✅ FIX 2: modular Firebase v22 API — no more deprecation warnings
import {
  getMessaging,
  onMessage,
  getToken,
  requestPermission,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────
const ALARM_CHANNEL_ID   = 'alarm_channel';
const DEFAULT_CHANNEL_ID = 'default_channel';
const API_BASE           = 'https://raahi-q2ur.onrender.com/api';
const ALARM_STORAGE_KEY  = 'alarmCron_scheduledDate'; // AsyncStorage key

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — NOTIFICATION CHANNELS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Call once at app start (e.g. in useFCMPushToken or App.js).
 * Creates Android channels — safe to call multiple times (idempotent).
 */
export async function setupNotificationChannels() {
  await notifee.createChannel({
    id:               ALARM_CHANNEL_ID,
    name:             'Alarms',
    importance:       AndroidImportance.HIGH,
    visibility:       AndroidVisibility.PUBLIC,
    vibration:        true,
    vibrationPattern: [300, 500, 300, 500],
    sound:            'default',
  });

  await notifee.createChannel({
    id:         DEFAULT_CHANNEL_ID,
    name:       'Notifications',
    importance: AndroidImportance.DEFAULT,
    sound:      'default',
  });

  console.log('[AlarmService] Notification channels created');
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — TRIGGER ALARM NOTIFICATION (foreground + background safe)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Shows a heads-up Notifee notification with alarm priority.
 * Works when app is in foreground, background, or killed (via index.js background handler).
 */
export async function triggerAlarm({ title = 'Alarm', body = '', data = {} }) {
  try {
    await notifee.displayNotification({
      title: `<b>${title}</b>`,
      body,
      data,
      android: {
        channelId:        ALARM_CHANNEL_ID,
        importance:       AndroidImportance.HIGH,
        visibility:       AndroidVisibility.PUBLIC,
        category:         AndroidCategory.ALARM,
        sound:            'default',
        vibrationPattern: [300, 500, 300, 500],
        pressAction:      { id: 'default' },
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        asForegroundService: false,
      },
      ios: {
        sound:          'default',
        critical:       true,
        criticalVolume: 1.0,
        badge:          1,
      },
    });
    console.log('[AlarmService] Alarm displayed:', title);
  } catch (err) {
    console.error('[AlarmService] Failed to display alarm:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — FOREGROUND FCM HANDLER
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Register a listener for FCM messages when the app is in foreground.
 * FCM does NOT show notifications automatically while app is open — Notifee does it.
 * Returns unsubscribe function.
 */
export function registerForegroundHandler() {
  // ✅ FIX 2: onMessage(getMessaging(), handler) — not messaging().onMessage(handler)
  return onMessage(getMessaging(), async remoteMessage => {
    const title = remoteMessage.notification?.title || 'Notification';
    const body  = remoteMessage.notification?.body  || '';
    const data  = remoteMessage.data || {};
    const type  = data.type;

    console.log(`[AlarmService] Foreground FCM: ${title} | type: ${type ?? 'none'}`);
    await triggerAlarm({ title, body, data });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — NOTIFEE EVENT HANDLER (tap / dismiss)
// ═════════════════════════════════════════════════════════════════════════════

/** Listens for user tapping or dismissing a Notifee notification. Returns unsubscribe. */
export function registerNotifeeEventHandler() {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      console.log('[AlarmService] Notification pressed:', detail.notification?.id);
    }
    if (type === EventType.DISMISSED) {
      console.log('[AlarmService] Notification dismissed');
    }
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — iOS PERMISSION
// ═════════════════════════════════════════════════════════════════════════════

/** Request iOS critical alert permission. Call once at startup on iOS. */
export async function requestIOSPermission() {
  await notifee.requestPermission({
    alert:         true,
    sound:         true,
    badge:         true,
    criticalAlert: true,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — REGISTER & SAVE FCM PUSH TOKEN
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 1) Requests FCM permission
 * 2) Gets device FCM token
 * 3) Saves it to backend via PUT /api/push-token
 * Call this once on TransporterDashboard mount.
 */
export async function registerAndSavePushToken() {
  try {
    // ✅ FIX 2: requestPermission(getMessaging()) — not messaging().requestPermission()
    const authStatus = await requestPermission(getMessaging());
    const granted =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!granted) {
      console.warn('[AlarmService] FCM permission not granted');
      return null;
    }

    // ✅ FIX 2: getToken(getMessaging()) — not messaging().getToken()
    const fcmToken = await getToken(getMessaging());
    if (!fcmToken) {
      console.warn('[AlarmService] FCM token is null');
      return null;
    }

    console.log('[AlarmService] FCM token obtained:', fcmToken);

    // Save token to backend
    const authToken = await AsyncStorage.getItem('authToken');
    if (authToken) {
      const res = await fetch(`${API_BASE}/push-token`, {
        method:  'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${authToken}`,
        },
        body: JSON.stringify({ fcmToken }),
      });
      if (res.ok) {
        console.log('[AlarmService] FCM token saved to backend ✅');
      } else {
        console.warn('[AlarmService] Backend token save failed:', res.status);
      }
    }

    return fcmToken;
  } catch (err) {
    console.error('[AlarmService] registerAndSavePushToken error:', err.message);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 — isNightWindow
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Returns true if the current hour is between 10 PM (22) and 12 AM (0).
 * TransporterDashboard uses this to decide if it should show the alarm banner on mount.
 */
export function isNightWindow() {
  const h = new Date().getHours();
  return h === 22 || h === 23;
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8 — playAlarmSound
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

let _soundObject = null;

/**
 * Plays assets/sounds/alarm.mp3 once.
 * Safe to call multiple times — stops previous sound before playing.
 */
export async function playAlarmSound() {
  try {
    // Unload previous if playing
    if (_soundObject) {
      await _soundObject.unloadAsync();
      _soundObject = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      require('../../../assets/sounds/alarm.mp3'),
      { shouldPlay: true, volume: 1.0 }
    );
    _soundObject = sound;

    sound.setOnPlaybackStatusUpdate(status => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        _soundObject = null;
      }
    });

    console.log('[AlarmService] Alarm sound playing');
  } catch (err) {
    console.warn('[AlarmService] playAlarmSound error:', err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9 — areTodayAlarmsScheduled
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Returns true if today's alarm setup has already been done.
 * Checked in AsyncStorage so we don't double-setup on every re-render.
 */
export async function areTodayAlarmsScheduled() {
  try {
    const stored = await AsyncStorage.getItem(ALARM_STORAGE_KEY);
    if (!stored) return false;
    const storedDate = new Date(stored).toDateString();
    const today      = new Date().toDateString();
    return storedDate === today;
  } catch {
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 10 — scheduleNightAlarms
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Marks today as "alarms scheduled" in AsyncStorage.
 * Since push alarms come from the backend via FCM (not local scheduling),
 * this just records that this device is ready to receive them.
 * Returns the number of alarm slots registered (7 = 10:15 PM to 11:45 PM).
 */
export async function scheduleNightAlarms() {
  try {
    await AsyncStorage.setItem(ALARM_STORAGE_KEY, new Date().toISOString());
    console.log('[AlarmService] Night alarm slots registered (FCM-based, 7 pushes expected)');
    return 7; // 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 11:45 PM
  } catch (err) {
    console.warn('[AlarmService] scheduleNightAlarms error:', err.message);
    return 0;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 11 — setupAlarmNotificationListener
// ─── FIX 1: This function was imported by TransporterDashboard but never existed
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Sets up a foreground FCM listener specifically for alarm-type messages.
 * When an alarm arrives, calls callback(notification, isMidnight).
 * Also plays the local alarm sound.
 * Returns an unsubscribe function — call it on component unmount.
 *
 * @param {(notification: object, isMidnight: boolean) => void} onAlarmReceived
 * @returns {() => void} cleanup function
 */
export function setupAlarmNotificationListener(onAlarmReceived) {
  // ✅ FIX 2: onMessage(getMessaging(), handler) — modular API
  const unsubscribe = onMessage(getMessaging(), async remoteMessage => {
    const data  = remoteMessage.data || {};
    const type  = data.type;
    const title = remoteMessage.notification?.title || '';
    const body  = remoteMessage.notification?.body  || '';

    // Only handle alarm-type messages here
    if (type !== 'alarm') return;

    console.log('[AlarmService] Alarm FCM received:', title);

    // Play local sound
    await playAlarmSound();

    // Show Notifee heads-up notification
    await triggerAlarm({ title, body, data });

    // Determine if this is the midnight auto-assign notification
    const isMidnight =
      data.screen === 'Routes' ||
      title.toLowerCase().includes('12 am') ||
      title.toLowerCase().includes('auto-assign') ||
      data.type === 'midnight_summary' ||
      data.autoAssigned === 'true';

    // Call the dashboard callback
    if (typeof onAlarmReceived === 'function') {
      onAlarmReceived(remoteMessage, isMidnight);
    }
  });

  return unsubscribe;
}