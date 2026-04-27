// ─────────────────────────────────────────────────────────────────────────────
// ASYNC STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_TOKEN: 'userToken',
  TOKEN:      'token',
  USER_ID:    'userId',
  USER_DATA:  'userData',
  USER_ROLE:  'userRole',
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION SCREEN NAMES
// Must exactly match the names registered in App.js Stack.Navigator
// ─────────────────────────────────────────────────────────────────────────────
export const SCREENS = {
  // ── App.js root stack ─────────────────────────────────────────────────────
  WELCOME:          'Welcome',
  ONBOARDING:       'Onboarding',
  HELLO:            'HelloScreen',
  DASHBOARD_REGISTER:'DashboardRegister',
  LOGIN:            'Login',               // shared login (passenger / driver / transporter)
  TRANSPORTER_LOGIN:  'TransporterLogin',
  TRANSPORTER_REGISTER:'TransporterRegister',
  DRIVER_LOGIN:     'DriverLogin',
  DRIVER_REGISTER:  'DriverRegister',
  PASSENGER_REQUEST:'PassengerRequestScreen',
  PASSENGER_NAV:    'PassengerAppNavigation',

  // ── Passenger drawer (inside PassengerAppNavigation) ──────────────────────
  DASHBOARD:         'Dashboard',
  NOTIFICATIONS:     'Notifications',
  RIDE_HISTORY:      'RideHistory',
  PAYMENTS:          'Payments',
  PROFILE:           'Profile',
  SETTINGS:          'Settings',
  HELP_SUPPORT:      'HelpSupport',
  CONTACT_SUPPORT:   'ContactSupport',
  TERMS_CONDITIONS:  'TermsConditions',

  // ── Internal stack inside Drawer ──────────────────────────────────────────
  DASHBOARD_MAIN:    'DashboardMain',
  ALERT_SCREEN:      'AlertScreen',
};

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE OPTIONS
// ─────────────────────────────────────────────────────────────────────────────
export const VEHICLE_OPTIONS = [
  { id: 'car', label: 'Car', icon: 'car',        description: 'Comfortable sedan / hatchback' },
  { id: 'van', label: 'Van', icon: 'bus',        description: 'Spacious van / minibus'        },
  { id: 'bus', label: 'Bus', icon: 'trail-sign', description: 'Large bus / coach'             },
];

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export const NOTIFICATION_CATEGORIES = [
  { id: 'all',          label: 'All',           icon: 'apps'             },
  { id: 'poll',         label: 'Polls',          icon: 'bar-chart'        },
  { id: 'route',        label: 'Routes',         icon: 'map'              },
  { id: 'confirmation', label: 'Confirmations',  icon: 'checkmark-circle' },
  { id: 'alert',        label: 'Alerts',         icon: 'warning'          },
];

// ─────────────────────────────────────────────────────────────────────────────
// RIDE / ROUTE STATUS
// ─────────────────────────────────────────────────────────────────────────────
export const RIDE_STATUS = {
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  MISSED:    'missed',
  ACTIVE:    'active',
  PENDING:   'pending',
  EN_ROUTE:  'en route',
  ONGOING:   'ongoing',
};

export const ROUTE_STATUS = {
  ASSIGNED:    'assigned',
  IN_PROGRESS: 'in_progress',
  ACTIVE:      'active',
  COMPLETED:   'completed',
};