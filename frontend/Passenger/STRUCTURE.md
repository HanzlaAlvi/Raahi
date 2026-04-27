# 📁 Passenger App — Folder Structure

```
passenger/
└── src/
    │
    ├── 📂 constants/               ← Sab static values yahan hain
    │   ├── api.js                  ← API_BASE_URL, ENDPOINTS object
    │   ├── theme.js                ← COLORS, GRADIENTS, SPACING, RADIUS
    │   └── index.js                ← STORAGE_KEYS, SCREENS, VEHICLE_OPTIONS, etc.
    │
    ├── 📂 services/                ← Reusable logic / utility functions
    │   ├── apiService.js           ← Sab HTTP calls (fetchProfile, submitPollResponse, etc.)
    │   ├── storageService.js       ← AsyncStorage wrapper (loadSessionData, clearSessionData)
    │   ├── locationService.js      ← Google Maps / Expo Location helpers
    │   └── helpers.js              ← Pure utility fns (getInitials, formatDate, formatTime, etc.)
    │
    ├── 📂 components/              ← Reusable UI pieces (no screen-level navigation logic)
    │   ├── common/
    │   │   ├── AppHeader.js        ← Gradient header (title + back + right icon)
    │   │   └── EmptyState.js       ← Empty list illustration + optional action button
    │   ├── dashboard/
    │   │   └── PollAlertBanner.js  ← Poll alert banner shown on Dashboard
    │   └── modals/
    │       ├── ChatModal.js        ← Reusable chat UI (used in Dashboard + ContactSupport)
    │       └── CallModal.js        ← Reusable call UI (used in Dashboard + ContactSupport)
    │
    ├── 📂 screens/                 ← One folder per feature area
    │   ├── dashboard/
    │   │   └── PassengerDashboard.js
    │   ├── notifications/
    │   │   ├── AlertScreen.js      ← Notification list with poll response modal
    │   │   └── NotificationsScreen.js
    │   ├── rides/
    │   │   └── RideHistoryScreen.js
    │   ├── payments/
    │   │   └── PassengerPaymentScreen.js
    │   ├── profile/
    │   │   └── ProfileScreen.js
    │   ├── settings/
    │   │   └── SettingScreen.js
    │   ├── support/
    │   │   ├── HelpSupportScreen.js
    │   │   ├── ContactSupportScreen.js
    │   │   └── TermsConditionsScreen.js
    │   └── auth/
    │       ├── PassengerRequestScreen.js   ← New passenger registration form
    │       └── LogoutScreen.js
    │
    ├── 📂 navigation/
    │   └── PassengerAppNavigation.js       ← Drawer + Stack navigator (clean imports)
    │
    ├── 📂 context/                 ← (reserved for AuthContext, ThemeContext, etc.)
    │
    └── index.js                    ← Barrel export for all services & constants
```

---

## 🔁 Import Guide

### API calls
```js
import { fetchProfile, fetchActivePolls, markNotificationRead } from '../services/apiService';
```

### Storage
```js
import { loadSessionData, clearSessionData } from '../services/storageService';
```

### Helpers
```js
import { getInitials, formatDate, formatRelativeTime } from '../services/helpers';
```

### Constants
```js
import { API_BASE_URL }  from '../constants/api';
import { COLORS }        from '../constants/theme';
import { SCREENS, STORAGE_KEYS } from '../constants';
```

### Reusable components
```js
import AppHeader   from '../components/common/AppHeader';
import EmptyState  from '../components/common/EmptyState';
import ChatModal   from '../components/modals/ChatModal';
import CallModal   from '../components/modals/CallModal';
```

---

## ✅ What was refactored

| Before | After |
|--------|-------|
| `API_BASE_URL` repeated in every file | Single source: `constants/api.js` |
| `AsyncStorage` calls scattered everywhere | Wrapped in `storageService.js` |
| Google Maps logic mixed in screens | Extracted to `locationService.js` |
| `getInitials`, `formatDate` duplicated | Centralized in `helpers.js` |
| `PassengerAppNavigation` had hardcoded screen names | Uses `SCREENS` constants |
| Logout logic duplicated in 3 files | Single `clearSessionData()` in storageService |
| Chat & Call UI duplicated in 2 screens | Shared `ChatModal` & `CallModal` components |
| All screens in one flat folder | Organized by feature (dashboard, rides, support, etc.) |


frontend/Passenger/src/
├── styles/                          ← YEH FOLDER BANAO
│   ├── NotificationScreenStyle.js   ← AlertScreen use karta hai
│   ├── RideHistoryStyle.js          ← RideHistoryScreen use karta hai
│   ├── HelpSupportStyle.js          ← HelpSupportScreen use karta hai
│   ├── ContactSupportStyle.js       ← ContactSupportScreen use karta hai
│   ├── SettingScreenStyle.js        ← SettingScreen use karta hai
│   ├── TermsConditionsStyle.js      ← TermsConditionsScreen use karta hai
│   ├── PassengerPaymentStyle.js     ← PassengerPaymentScreen use karta hai
│   ├── PassengerDashboardStyle.js   ← (extra, reference ke liye)
│   ├── AlertStyle.js                ← (extra)
│   └── ProfileStyle.js              ← (extra)
├── screens/
│   ├── notifications/AlertScreen.js → import '../../styles/NotificationScreenStyle' ✅
│   ├── rides/RideHistoryScreen.js   → import '../../styles/RideHistoryStyle' ✅
│   ├── support/HelpSupportScreen.js → import '../../styles/HelpSupportStyle' ✅
│   └── ... baaki screens