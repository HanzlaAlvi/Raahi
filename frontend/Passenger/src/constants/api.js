// ─────────────────────────────────────────────────────────────────────────────
// API CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

export const GOOGLE_MAPS_API_KEY = 'AIzaSyAURA_WOTStUtf3-nnDUR88jeBr6qSejFs';

export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/passenger/request',
  REQUEST_STATUS: (id) => `/passenger/request-status/${id}`,

  // Profile
  PROFILE: '/profile',
  RIDE_HISTORY_PASSENGER: '/passenger/ride-history',

  // Routes
  ROUTES: '/routes',

  // Trips
  TRIPS: '/trips',
  CONFIRM_PASSENGER: (tripId) => `/trips/${tripId}/confirm-passenger`,

  // Polls
  POLLS_ACTIVE: '/polls/active',
  POLL_BY_ID: (id) => `/polls/${id}`,
  POLL_RESPOND: (id) => `/polls/${id}/respond`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATION_READ: (id) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL: '/notifications/read-all',

  // Subscriptions
  SUBSCRIPTIONS_CURRENT: '/subscriptions/current',
  SUBSCRIPTIONS_HISTORY: '/subscriptions/history',
  SUBSCRIPTIONS_PLANS: '/subscriptions/plans',
  SUBSCRIPTIONS_RENEW: '/subscriptions/renew',

  // Users
  USERS: '/users',

  // Feedback
  FEEDBACK: '/feedback',

  // Support
  TRIPS_FEEDBACK: '/trips/feedback',
};
