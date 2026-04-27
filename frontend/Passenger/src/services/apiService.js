// ─────────────────────────────────────────────────────────────────────────────
// API SERVICE
// Central place for all HTTP calls to the backend
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE_URL, ENDPOINTS } from '../constants/api';

/**
 * Build Authorization headers
 */
export const getHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

/**
 * Generic fetch wrapper
 */
const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();

  if (text.trim().startsWith('<')) {
    throw new Error(`Server error (${response.status})`);
  }

  const data = JSON.parse(text);
  return { ok: response.ok, status: response.status, data };
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginPassenger = (credentials) =>
  request(`${API_BASE_URL}${ENDPOINTS.LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

export const registerPassenger = (token, requestData) =>
  request(`${API_BASE_URL}${ENDPOINTS.REGISTER}`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(requestData),
  });

// ─── Profile ─────────────────────────────────────────────────────────────────

export const fetchProfile = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.PROFILE}`, {
    headers: getHeaders(token),
  });

export const fetchPassengerRideHistory = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.RIDE_HISTORY_PASSENGER}`, {
    headers: getHeaders(token),
  });

// ─── Routes ──────────────────────────────────────────────────────────────────

export const fetchAssignedRoutes = (token, passengerId) =>
  request(`${API_BASE_URL}${ENDPOINTS.ROUTES}?passengerId=${passengerId}`, {
    headers: getHeaders(token),
  });

// ─── Trips ───────────────────────────────────────────────────────────────────

export const fetchTrips = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.TRIPS}`, {
    headers: getHeaders(token),
  });

export const confirmMorningTrip = (token, tripId, traveling) =>
  request(`${API_BASE_URL}${ENDPOINTS.CONFIRM_PASSENGER(tripId)}`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ traveling }),
  });

// ─── Polls ───────────────────────────────────────────────────────────────────

export const fetchActivePolls = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.POLLS_ACTIVE}`, {
    headers: getHeaders(token),
  });

export const fetchPollById = (token, pollId) =>
  request(`${API_BASE_URL}${ENDPOINTS.POLL_BY_ID(pollId)}`, {
    headers: getHeaders(token),
  });

export const submitPollResponse = (token, pollId, responseData) =>
  request(`${API_BASE_URL}${ENDPOINTS.POLL_RESPOND(pollId)}`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify(responseData),
  });

// ─── Notifications ───────────────────────────────────────────────────────────

export const fetchNotifications = (token, category = null) => {
  const url = category && category !== 'all'
    ? `${API_BASE_URL}${ENDPOINTS.NOTIFICATIONS}?type=${category}`
    : `${API_BASE_URL}${ENDPOINTS.NOTIFICATIONS}`;
  return request(url, { headers: getHeaders(token) });
};

export const markNotificationRead = (token, notifId) =>
  request(`${API_BASE_URL}${ENDPOINTS.NOTIFICATION_READ(notifId)}`, {
    method: 'PUT',
    headers: getHeaders(token),
  });

export const markAllNotificationsRead = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.NOTIFICATIONS_READ_ALL}`, {
    method: 'PUT',
    headers: getHeaders(token),
  });

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const fetchCurrentSubscription = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.SUBSCRIPTIONS_CURRENT}`, {
    headers: getHeaders(token),
  });

export const fetchSubscriptionHistory = (token, filter = null) => {
  const url = filter && filter !== 'all'
    ? `${API_BASE_URL}${ENDPOINTS.SUBSCRIPTIONS_HISTORY}?status=${filter}`
    : `${API_BASE_URL}${ENDPOINTS.SUBSCRIPTIONS_HISTORY}`;
  return request(url, { headers: getHeaders(token) });
};

export const fetchSubscriptionPlans = (token) =>
  request(`${API_BASE_URL}${ENDPOINTS.SUBSCRIPTIONS_PLANS}`, {
    headers: getHeaders(token),
  });

export const renewSubscription = (token, planId) =>
  request(`${API_BASE_URL}${ENDPOINTS.SUBSCRIPTIONS_RENEW}`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ planId }),
  });

// ─── Users / Transporters ────────────────────────────────────────────────────

export const fetchAllUsers = () =>
  request(`${API_BASE_URL}${ENDPOINTS.USERS}`);

// ─── Feedback ────────────────────────────────────────────────────────────────

export const fetchFeedback = (token, passengerId) =>
  request(`${API_BASE_URL}${ENDPOINTS.FEEDBACK}?passengerId=${passengerId}`, {
    headers: getHeaders(token),
  });
