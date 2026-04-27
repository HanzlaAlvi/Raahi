// ─────────────────────────────────────────────────────────────────────────────
// STORAGE SERVICE
// Wraps AsyncStorage with common app-level operations
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Resolve the auth token by trying multiple known keys
 */
export const resolveAuthToken = async () => {
  const keys = [
    STORAGE_KEYS.AUTH_TOKEN,
    STORAGE_KEYS.USER_TOKEN,
    STORAGE_KEYS.TOKEN,
  ];

  for (const key of keys) {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val) return val;
    } catch {}
  }
  return null;
};

/**
 * Load all session data (token, userId, userData)
 */
export const loadSessionData = async () => {
  try {
    const token  = await resolveAuthToken();
    const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    const raw    = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    const userData = raw ? JSON.parse(raw) : null;
    return { token, userId, userData };
  } catch (e) {
    console.error('loadSessionData error:', e);
    return { token: null, userId: null, userData: null };
  }
};

/**
 * Save session data after login
 */
export const saveSessionData = async ({ token, userId, userData, role }) => {
  try {
    const pairs = [
      [STORAGE_KEYS.AUTH_TOKEN, token],
      [STORAGE_KEYS.USER_TOKEN, token],
      [STORAGE_KEYS.USER_ID, userId],
      [STORAGE_KEYS.USER_DATA, JSON.stringify(userData)],
    ];
    if (role) pairs.push([STORAGE_KEYS.USER_ROLE, role]);
    await AsyncStorage.multiSet(pairs);
  } catch (e) {
    console.error('saveSessionData error:', e);
  }
};

/**
 * Clear all session data on logout
 */
export const clearSessionData = async () => {
  const keys = Object.values(STORAGE_KEYS);
  await AsyncStorage.multiRemove(keys);
};

/**
 * Get a single stored item safely
 */
export const getItem = async (key) => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Set a single item safely
 */
export const setItem = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error(`setItem(${key}) error:`, e);
  }
};
