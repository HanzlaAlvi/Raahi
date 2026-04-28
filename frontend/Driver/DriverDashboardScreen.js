// frontend/Driver/DriverDashboardScreen.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, StatusBar,
  StyleSheet, Platform, Animated,
} from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage       from "@react-native-async-storage/async-storage";
import { stopCoordinates } from "../constants/coordinates"; // named pickup point → lat/lng lookup
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  setBackgroundMessageHandler,
  requestPermission,
  getToken,
  AuthorizationStatus,
} from "@react-native-firebase/messaging";
import * as Location from 'expo-location';

import DashboardScreen     from "./screens/DashboardScreen";
import AvailabilityScreen  from "./screens/Availabilityscreen";
import RoutesScreen        from "./screens/RoutesScreen";
import HistoryScreen       from "./screens/HistoryScreen";
import PaymentsScreen      from "./screens/PaymentsScreen";
import SupportScreen       from "./screens/SupportScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import DriverProfileScreen   from "./screens/DriverProfileScreen";
import DriverChatModal       from "./components/DriverChatModal";
import MonthlyFeedbackScreen from "./screens/MonthlyFeedbackScreen";
import LeaveNetworkScreen    from "./screens/LeaveNetworkScreen";
import DeleteAccountScreen   from "./screens/DeleteAccountScreen";

// ── Persistence keys for pickup confirmation state ─────────────────────────
const PERSIST_WAITING_STOP    = "driver_waitingAtStop";
const PERSIST_WAITING_ROUTE   = "driver_waitingRouteId";
const PERSIST_PASSENGER_CONF  = "driver_passengerConfirmed";
const PERSIST_ROUTE_STARTED   = "driver_routeStarted";
const PERSIST_ACTIVE_TRIP     = "driver_activeTripId";
// Simulation position keys — survive logout/login on same device
const PERSIST_SIM_SEGMENT  = "driver_simSegment";
const PERSIST_SIM_PROGRESS = "driver_simProgress";
const PERSIST_SIM_LAT      = "driver_simLat";
const PERSIST_SIM_LNG      = "driver_simLng";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE_URL      = "https://raahi-q2ur.onrender.com/api";
const SOCKET_URL        = "https://raahi-q2ur.onrender.com";
const STATUS_BAR_H      = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;
const SIM_INTERVAL_MS   = 1500;
const ASSUMED_SPEED_KMH = 35;
const TEN_MIN_KM        = (ASSUMED_SPEED_KMH * 10) / 60; // ~5.83 km
const FIVE_MIN_KM       = (ASSUMED_SPEED_KMH *  5) / 60; // ~2.92 km
const THREE_MIN_KM      = (ASSUMED_SPEED_KMH *  3) / 60; // ~1.75 km
const ONE_MIN_KM        = (ASSUMED_SPEED_KMH *  1) / 60; // ~0.58 km
const SOCKET_EMIT_MS    = 3000;

// ─── Utilities ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos((lat1 * Math.PI) / 180) *
             Math.cos((lat2 * Math.PI) / 180) *
             Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolate(from, to, t) {
  return {
    latitude:  from.latitude  + (to.latitude  - from.latitude)  * t,
    longitude: from.longitude + (to.longitude - from.longitude) * t,
  };
}

// ── resolveCoord ────────────────────────────────────────────────────────────
// Returns {latitude, longitude} for a passenger stop using:
//   1. Explicit lat/lng from DB (most accurate)
//   2. Named pickup point lookup from stopCoordinates map
//   3. DEMO fallback (so map always shows something)
function resolveCoord(p, fallbackIndex = 0) {
  const DEMO_COORDS = [
    { latitude: 33.6884, longitude: 73.0512 },
    { latitude: 33.6941, longitude: 73.0389 },
    { latitude: 33.7014, longitude: 73.0287 },
    { latitude: 33.7104, longitude: 73.0192 },
    { latitude: 33.7214, longitude: 73.0072 },
  ];
  const lat = p.pickupLat || p.latitude  || p.location?.coordinates?.[1] || null;
  const lng = p.pickupLng || p.longitude || p.location?.coordinates?.[0] || null;
  // Valid non-default coordinate
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001)) {
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  // Named stop lookup from constants/coordinates.js
  const key = p.pickupPoint || p.pickupAddress || p.address || p.name || '';
  if (key && stopCoordinates[key]) return stopCoordinates[key];
  // DEMO spread-out fallback so stops are visually distinct on map
  return DEMO_COORDS[fallbackIndex % DEMO_COORDS.length];
}

function parseTimeToday(timeStr) {
  if (!timeStr) return null;
  try {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let h    = parseInt(match[1], 10);
    const m  = parseInt(match[2], 10);
    const ap = (match[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  } catch { return null; }
}

function formatCountdown(ms) {
  if (ms <= 0) return "now";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function sortByProximity(passengers, fromLat, fromLng) {
  if (!passengers || passengers.length === 0) return passengers;
  const remaining = [...passengers];
  const sorted = [];
  let curLat = fromLat;
  let curLng = fromLng;
  while (remaining.length > 0) {
    let nearestIdx  = 0;
    let nearestDist = Infinity;
    remaining.forEach((p, idx) => {
      const d = haversineKm(curLat, curLng, p.coordinate.latitude, p.coordinate.longitude);
      if (d < nearestDist) { nearestDist = d; nearestIdx = idx; }
    });
    const nearest = remaining.splice(nearestIdx, 1)[0];
    sorted.push(nearest);
    curLat = nearest.coordinate.latitude;
    curLng = nearest.coordinate.longitude;
  }
  return sorted;
}

// ─── Theme ────────────────────────────────────────────────────────────────────
const P = {
  main:      "#415844",
  dark:      "#2D3E2F",
  white:     "#FFFFFF",
  bg:        "#F5F7F5",
  light:     "#EDF1ED",
  border:    "#C5D0C5",
  textDark:  "#1A2218",
  textMid:   "#374151",
  textLight: "#6B7280",
  error:     "#C62828",
};

const MENU = [
  { view: "Dashboard",    label: "Dashboard",    icon: "grid-outline",        activeIcon: "grid"          },
  { view: "Availability", label: "Availability", icon: "calendar-outline",    activeIcon: "calendar"      },
  { view: "Routes",       label: "Routes",       icon: "map-outline",         activeIcon: "map"           },
  { view: "History",      label: "Trip History", icon: "time-outline",        activeIcon: "time"          },
  { view: "Payments",     label: "Payments",     icon: "card-outline",        activeIcon: "card"          },
  { view: "Support",      label: "Complaints",   icon: "warning-outline",     activeIcon: "warning"       },
  { view: "Messages",     label: "Messages",     icon: "chatbubbles-outline", activeIcon: "chatbubbles"   },
  { view: "MonthlyFeedback", label: "Monthly Feedback", icon: "star-outline", activeIcon: "star"       },
];

const SECTION_TITLES = {
  Dashboard:            "Dashboard",
  Availability:         "Availability",
  Routes:               "Routes",
  History:              "Trip History",
  Payments:             "Payments",
  Support:              "Complaints",
  Notifications:        "Notifications",
  Profile:              "My Profile",
  Messages:             "Messages",
  LeaveNetwork:         "Leave Transporter Network",
  DeleteAccount:        "Delete Account Permanently",
};

const initials = (name = "D") =>
  (name || "D").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

async function registerFCMToken(authToken) {
  try {
    const authStatus = await requestPermission(getMessaging());
    const granted =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;
    if (!granted) return;
    const fcmToken = await getToken(getMessaging());
    if (!fcmToken) return;
    await fetch(`${API_BASE_URL}/push-token`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ fcmToken }),
    });
  } catch (err) {
    console.warn("[Driver] registerFCMToken:", err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function UnifiedDriverDashboard({ navigation }) {

  // ── Core refs ──────────────────────────────────────────────────────────────
  const driverIdRef = useRef(null);
  const authTokenRef = useRef(null);

  // Socket refs
  const socketRef = useRef(null);
  const lastSocketEmit = useRef(0);
  const activeTripIdRef = useRef(null);

  // Simulation refs
  const simSegmentRef   = useRef(0);
  const simProgressRef  = useRef(0);
  // isRestoringRef: true when sim is resuming from AsyncStorage (login after logout)
  // prevents startSimulation from resetting segment/progress to 0
  const isRestoringRef    = useRef(false);
  const simTickRef        = useRef(0);   // tick counter for throttled AsyncStorage saves
  // completeRouteRef: always points to the LATEST completeRoute function.
  // The setInterval callback captures a stale closure — this ref is the fix.
  const completeRouteRef  = useRef(null);
  // routeEndingRef: prevents calling completeRoute multiple times before user confirms
  const routeEndingRef    = useRef(false);
  const simIntervalRef = useRef(null);
  const alertedStopsRef = useRef(new Set());
  const simPausedRef = useRef(false);
  const lastLocationSyncRef = useRef(0);

  // ── routeStopsRef ─────────────────────────────────────────────────────────
  // The setInterval callback closes over the initial routeStops value (stale
  // closure). This ref is kept in sync via useEffect so every interval tick
  // reads the LIVE stop array — including status changes (picked / missed) —
  // without restarting the interval and resetting simSegmentRef to 0.
  const routeStopsRef = useRef([]);

  // Passenger / driver confirmation refs (used only for socket bookkeeping)
  const passengerConfirmedRef = useRef(null);
  const driverConfirmedRef = useRef(null);

  // Chat
  const chatPollRef = useRef(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;

  // ── Monthly Feedback ────────────────────────────────────────────────────────
  const [feedbackWindow,    setFeedbackWindow]     = useState({ isOpen: false, month: '', alreadySubmitted: false });
  const [feedbackAnswers,   setFeedbackAnswers]    = useState({});
  const [feedbackSubject,   setFeedbackSubject]    = useState('');
  const [feedbackSaving,    setFeedbackSaving]     = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted]  = useState(false);

  // ── Auth / profile ─────────────────────────────────────────────────────────
  const [authToken, setAuthToken] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [available, setAvailable] = useState(false);
  const [networkTransporter, setNetworkTransporter] = useState(null);

  // ── Availability ───────────────────────────────────────────────────────────
  const [dashboardStats, setDashboardStats] = useState({ completedTrips: 0, activeTrips: 0, pendingTrips: 0, monthlyEarnings: 0 });
  const [startTime, setStartTime] = useState("07:00 AM");
  const [endTime, setEndTime] = useState("06:00 PM");
  const [availabilityHistory, setAvailabilityHistory] = useState([]);
  const [activeAvailabilityRecord, setActiveAvailabilityRecord] = useState(null);

  // ── Route / stops ──────────────────────────────────────────────────────────
  const [assignedRoutes, setAssignedRoutes] = useState([]);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [routeStarted, setRouteStarted] = useState(false);
  const [routeStops, setRouteStops] = useState([]);
  const [completedStops, setCompletedStops] = useState([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [waitingAtStop, setWaitingAtStop] = useState(null);
  const [stopDistances, setStopDistances] = useState([]);
  const [currentLocation, setCurrentLocation] = useState({ latitude: 33.6844, longitude: 73.0479 });

  // passengerConfirmedForStop — drives "✅ Passenger confirmed!" hint in driver UI
  const [passengerConfirmedForStop, setPassengerConfirmedForStop] = useState(null);

  // ── Other screens ──────────────────────────────────────────────────────────
  const [trips, setTrips] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [paymentData, setPaymentData] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [chatOtherUser, setChatOtherUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSending, setChatSending] = useState(false);

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: sidebarOpen ? 0 : -300,
      useNativeDriver: true, tension: 80, friction: 12,
    }).start();
  }, [sidebarOpen]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.timing(blinkAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAuthData();
    initSocket();
    return () => {
      // ── CRITICAL FIX: On unmount, only clear interval — do NOT call
      // stopSimulation(). stopSimulation removes persisted state (waiting stop,
      // route started flag) which breaks resume after navigation/logout.
      // The simulation interval itself will be garbage collected when the
      // component unmounts — React's GC handles this automatically.
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      socketRef.current?.disconnect();
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    };
  }, []);

  // ── Keep routeStopsRef in sync ─────────────────────────────────────────────
  // Written here, read inside setInterval (which would otherwise see stale data).
  useEffect(() => {
    routeStopsRef.current = routeStops;
  }, [routeStops]);

  // ── Simulation lifecycle ───────────────────────────────────────────────────
  // Depends ONLY on routeStarted — NOT on routeStops.
  // If routeStops were in deps, every stop status change (picked/missed) would
  // restart the interval and reset simSegmentRef to 0, causing the van to jump
  // back to the first passenger every time someone boards.
  useEffect(() => {
    if (routeStarted) {
      startSimulation();
    } else {
      // Only call full stopSimulation (which clears persisted state) when
      // routeStarted explicitly becomes false (user ended route). Do NOT
      // call it in the cleanup return — that fires before every re-render
      // and would wipe state when screen refreshes.
      stopSimulation();
    }
    return () => {
      // Cleanup: only clear the interval, preserve persisted state.
      // Full stopSimulation(true) is called explicitly in completeRoute.
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [routeStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Recalculate stop distances ─────────────────────────────────────────────
  useEffect(() => {
    if (routeStops.length < 2) { setStopDistances([]); return; }
    const dists = [];
    for (let i = 0; i < routeStops.length - 1; i++) {
      const a = routeStops[i].coordinate;
      const b = routeStops[i + 1].coordinate;
      dists.push(haversineKm(a.latitude, a.longitude, b.latitude, b.longitude));
    }
    setStopDistances(dists);
  }, [routeStops]);

  // ── Sync location ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!routeStarted || !currentRoute?._id || !currentLocation) return;
    syncRouteLocation({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      speed: ASSUMED_SPEED_KMH,
      eta: "", currentStop: "",
    });
  }, [routeStarted, currentRoute?._id, currentLocation?.latitude, currentLocation?.longitude]);

  // ── Socket ────────────────────────────────────────────────────────────────
  const initSocket = useCallback(() => {
    try {
      const { io } = require("socket.io-client"); // eslint-disable-line global-require
      if (socketRef.current?.connected) return;

      const socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      socket.on("connect", () => {
        console.log("[Socket] Driver connected:", socket.id);
        if (activeTripIdRef.current) socket.emit("joinTrip", { tripId: activeTripIdRef.current, userId: driverIdRef.current });
      });

      // ── passengerStatusUpdate ──────────────────────────────────────────────
      // Fires when backend records a stop status change (e.g. passenger tapped
      // "I'm On Board" and the API returned success).
      // FIX: We ONLY update the UI stop list here. We do NOT resume the
      // simulation — that is the exclusive job of pickupPassenger() so the
      // driver must always press "Confirm Pickup" before the van moves on.
      socket.on("passengerStatusUpdate", (data) => {
        const { passengerId, status } = data || {};
        if (!passengerId || !status) return;

        setRouteStops(prev => prev.map(s => {
          const sid = s.passengerId?.toString() || s._id?.toString();
          return sid === passengerId?.toString() ? { ...s, status } : s;
        }));

        console.log(`[Socket] passengerStatusUpdate: ${passengerId} → ${status}  (UI only — sim stays paused)`);
        // ↑ NO simPausedRef = false  |  NO setWaitingAtStop(null)
      });

      // ── passengerBoarded ───────────────────────────────────────────────────
      // Passenger pressed "I'm On Board".  We record it and show a hint on the
      // driver UI ("✅ Passenger confirmed — tap Confirm Pickup").
      // Simulation stays paused until the driver presses the button.
      socket.on("passengerBoarded", (data) => {
        const { passengerId } = data || {};
        if (!passengerId) return;
        const idStr = passengerId?.toString();
        console.log(`[Socket] passengerBoarded: ${idStr} — driver confirmation still needed`);

        passengerConfirmedRef.current = idStr;
        setPassengerConfirmedForStop(idStr);
        // ✅ PERSIST passenger confirmation — survives app minimize/restart
        AsyncStorage.setItem(PERSIST_PASSENGER_CONF, idStr).catch(() => { });
        // Simulation stays paused — pickupPassenger() is the single resume gate.
      });

      // ── passengerNotGoing — passenger said NO at boarding ──────────────────
      // Auto-resume simulation: mark stop as missed and move to next stop.
      // The passenger said they are not going today (penalty already applied).
      socket.on("passengerNotGoing", (data) => {
        const { passengerId, passengerName, penaltyAmount } = data || {};
        if (!passengerId) return;
        const idStr = passengerId?.toString();
        console.log(`[Socket] passengerNotGoing: ${passengerName} (${idStr}) — auto-resuming simulation`);

        // Mark this stop as missed in local route state
        setRouteStops(prev => prev.map(s => {
          const sid = s.passengerId?.toString() || s._id?.toString();
          return sid === idStr ? { ...s, status: 'missed' } : s;
        }));

        // Auto-resume simulation — passenger is not boarding, van moves to next stop
        if (simPausedRef.current) {
          simPausedRef.current = false;
          setWaitingAtStop(null);
          setPassengerConfirmedForStop(null);
          passengerConfirmedRef.current = null;
          AsyncStorage.multiRemove([
            PERSIST_WAITING_STOP, PERSIST_WAITING_ROUTE, PERSIST_PASSENGER_CONF,
          ]).catch(() => {});
          console.log('[Driver] Simulation resumed — passenger not going');
        }
      });

      socket.on("disconnect", reason => console.log("[Socket] Driver disconnected:", reason));
      socketRef.current = socket;
    } catch (e) {
      console.log("[Socket] not available:", e.message);
    }
  }, []);

  // ── FCM ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubFg = onMessage(getMessaging(), async (remoteMessage) => {
      const title = remoteMessage.notification?.title;
      const body = remoteMessage.notification?.body;
      const data = remoteMessage.data || {};

      if (data.type === "auto_assign") {
        fetchAssignedRoutes(driverIdRef.current, authTokenRef.current);
        Alert.alert(title || "Route Assigned", body || "A new route has been assigned to you.");
      } else if (data.type === "midnight_summary") {
        fetchAssignedRoutes(driverIdRef.current, authTokenRef.current);
        if (title) Alert.alert(title, body || "");
      } else if (data.type === "alarm" || data.type === "availability_reminder") {
        if (title) Alert.alert(title, body || "");
      } else if (data.type === "message") {
        if (currentView === "Messages" && chatOtherUser?._id) {
          fetchChatMessages(chatOtherUser._id);
        } else {
          setUnreadMsgCount(prev => prev + 1);
        }
        if (title) Alert.alert(title, body || "");
      } else if (title) {
        Alert.alert(title, body || "");
      }
      fetchNotifications(driverIdRef.current, authTokenRef.current);
    });

    const unsubOpened = onNotificationOpenedApp(getMessaging(), (remoteMessage) => {
      const data = remoteMessage?.data || {};
      if (data.screen === "Routes") {
        setCurrentView("Routes");
        fetchAssignedRoutes(driverIdRef.current, authTokenRef.current);
      } else if (data.screen === "Availability") {
        setCurrentView("Availability");
      } else if (data.screen === "Messages") {
        openChatWithTransporter();
      }
    });

    getInitialNotification(getMessaging()).then((remoteMessage) => {
      if (!remoteMessage) return;
      const data = remoteMessage?.data || {};
      if (data.screen === "Routes") setCurrentView("Routes");
      else if (data.screen === "Messages") openChatWithTransporter();
    });

    setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
      console.log("[Driver] FCM background:", remoteMessage.notification?.title);
    });

    return () => { unsubFg(); unsubOpened(); };
  }, [currentView, chatOtherUser]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getHeaders = useCallback((tok = null) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tok || authTokenRef.current || authToken}`,
  }), [authToken]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const loadAuthData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const userId = await AsyncStorage.getItem("userId") || await AsyncStorage.getItem("driverId");
      const uStr = await AsyncStorage.getItem("userData");
      if (!token || !userId) {
        navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }
      driverIdRef.current = userId;
      authTokenRef.current = token;
      setAuthToken(token);
      if (uStr) try { setDriverProfile(JSON.parse(uStr)); } catch { }
      await registerFCMToken(token);
      await loadAllData(userId, token);

      // ✅ RESTORE persistent pickup confirmation state
      // This keeps the "Confirm Passenger Onboarded" button visible even after
      // app minimize, logout/login, or screen refresh.
      try {
        const [
          [, savedWaitingStop],
          [, savedRouteId],
          [, savedPassengerConf],
          [, savedRouteStarted],
          [, savedTripId],
        ] = await AsyncStorage.multiGet([
          PERSIST_WAITING_STOP,
          PERSIST_WAITING_ROUTE,
          PERSIST_PASSENGER_CONF,
          PERSIST_ROUTE_STARTED,
          PERSIST_ACTIVE_TRIP,
        ]);

        // Only restore if the saved routeId matches the currently assigned route
        // (prevents stale state from a previous route showing up)
        if (savedWaitingStop && savedRouteId) {
          // We'll match after fetchAssignedRoutes has run — use a short delay
          // so setCurrentRoute() has settled in React state
          setTimeout(async () => {
            const currentRouteId = (await AsyncStorage.getItem(PERSIST_WAITING_ROUTE)) || "";
            if (currentRouteId) {
              console.log("[Driver] 🔄 Restoring pickup pause from storage:", savedWaitingStop);
              setWaitingAtStop(savedWaitingStop);
              simPausedRef.current = true;
              if (savedPassengerConf) {
                setPassengerConfirmedForStop(savedPassengerConf);
                passengerConfirmedRef.current = savedPassengerConf;
              }
            }
          }, 1500);
        }

        if (savedRouteStarted === "true" && savedTripId) {
          activeTripIdRef.current = savedTripId;
          if (socketRef.current?.connected) {
            socketRef.current.emit("joinTrip", { tripId: savedTripId, userId: driverIdRef.current });
          }
        }
      } catch (e) { console.warn("[Driver] restore state error:", e); }

      try {
        const hdrs = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
        const pr = await fetch(`${API_BASE_URL}/profile`, { headers: hdrs });
        const pd = await pr.json();

        // ── Extract driver home lat/lng from fresh profile ────────────────
        // This ensures the simulation origin uses the driver's REAL saved
        // location from the database, not just whatever is in AsyncStorage.
        // User model stores latitude/longitude fields directly on the user doc.
        const freshLat = pd.latitude  ?? pd.location?.coordinates?.[1] ?? null;
        const freshLng = pd.longitude ?? pd.location?.coordinates?.[0] ?? null;
        if (freshLat != null && freshLng != null) {
          setDriverProfile(prev => ({
            ...(prev || {}),
            ...(pd.name     ? { name:     pd.name     } : {}),
            ...(pd.phone    ? { phone:    pd.phone    } : {}),
            ...(pd.vehicle  ? { vehicle:  pd.vehicle  } : {}),
            ...(pd.vehicleNo? { vehicleNo:pd.vehicleNo} : {}),
            latitude:  freshLat,
            longitude: freshLng,
          }));
          console.log(`[Driver] 📍 Home coords loaded: ${freshLat.toFixed(5)}, ${freshLng.toFixed(5)}`);
        }

        const tid = pd.transporterId || pd.transporter?._id || pd.transporter;
        if (tid) {
          const tr = await fetch(`${API_BASE_URL}/profile/${tid}`, { headers: hdrs });
          const td = await tr.json();
          if (td._id || td.id) {
            setNetworkTransporter({ _id: td._id || td.id, name: td.name || "Transporter" });
          }
        }
      } catch (e) { console.warn("fetchTransporter:", e); }

      const poll = setInterval(() => {
        fetchAssignedRoutes(driverIdRef.current, authTokenRef.current);
        fetchNotifications(driverIdRef.current, authTokenRef.current);
      }, 30000);
      return () => clearInterval(poll);
    } catch (e) { console.error("loadAuthData:", e); }
  };

  const loadAllData = async (uid, tok) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDashboardStats(uid, tok),
        fetchAssignedRoutes(uid, tok),
        fetchAvailabilityHistory(uid, tok),
        fetchPayments(uid, tok),
        fetchTrips(uid, tok),
        fetchSupportTickets(uid, tok),
        fetchNotifications(uid, tok),
        fetchFeedbackWindow(tok),
      ]);
    } finally { setLoading(false); }
  };

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchDashboardStats = async (uid, tok) => {
    try {
      // Use driver ride-history endpoint (filters by driverId, not transporterId).
      // The generic /dashboard/stats uses transporterId which equals the company ID,
      // NOT the driver's ID — so it always returns 0 for drivers.
      const r = await fetch(`${API_BASE_URL}/trips/driver/ride-history`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) {
        const rides = d.rides || d.data || [];
        setDashboardStats({
          completedTrips: rides.filter(t =>
            ['Completed', 'completed'].includes(t.status)
          ).length,
          activeTrips: rides.filter(t =>
            ['Active', 'En Route', 'ongoing', 'active'].includes(t.status)
          ).length,
          pendingTrips: rides.filter(t =>
            ['Missed', 'missed', 'Cancelled', 'cancelled'].includes(t.status)
          ).length,
          monthlyEarnings: 0,
        });
      }
    } catch { }
  };

  const fetchAssignedRoutes = useCallback(async (uid, tok) => {
    try {
      const id = uid || driverIdRef.current;
      const tkn = tok || authTokenRef.current;
      const r = await fetch(`${API_BASE_URL}/routes?assignedDriver=${id}`, { headers: getHeaders(tkn) });
      const d = await r.json();
      const arr = d.routes || d.data || [];
      setAssignedRoutes(arr);

      if (arr.length > 0) {
        // ── CRITICAL FIX: Pick the in_progress route first ──────────────────
        // Routes are sorted newest-first. If driver has an in_progress route
        // plus tomorrow's assigned route, arr[0] would be the WRONG one.
        // Always prefer in_progress, then fallback to first in list.
        const first = arr.find(r => r.status === 'in_progress') || arr[0];
        setCurrentRoute(first);

        const rawStops = (first.passengers || []).map((p, i) => {
          // resolveCoord: tries DB lat/lng → named stop lookup → DEMO fallback
          const coord = resolveCoord(p, i);
          return {
            _id: p._id?.toString() || `stop-${i}`,
            passengerId: p.passengerId?.toString() || p._id?.toString(),
            name: p.pickupPoint || p.pickupAddress || p.address || `Stop ${i + 1}`,
            passengerName: p.passengerName || p.name || "Passenger",
            phone: p.phone || "",
            status: p.status || "pending",
            coordinate: coord,
          };
        });

        // Driver's confirmed home/starting location (fallback to Islamabad center)
        const dLat = driverProfile?.homeLatitude || driverProfile?.latitude || currentLocation?.latitude || 33.6844;
        const dLng = driverProfile?.homeLongitude || driverProfile?.longitude || currentLocation?.longitude || 73.0479;

        // Sort passengers by proximity from driver home — nearest first
        const sortedStops = sortByProximity(rawStops, dLat, dLng);

        // ── Driver origin stop ────────────────────────────────────────────────
        const driverOriginStop = {
          _id: 'driver-origin',
          _isDriverOrigin: true,
          passengerId: null,
          name: 'Driver Start Location',
          passengerName: 'Driver',
          phone: '',
          status: 'picked',
          coordinate: { latitude: dLat, longitude: dLng },
        };
        const stopsWithOrigin = [driverOriginStop, ...sortedStops];
        setRouteStops(stopsWithOrigin);

        // ── CRITICAL FIX: Only reset van to driver home on FRESH start ───────
        // If route is already in_progress and simulation is running, do NOT
        // override currentLocation — it would jump the van back to driver home
        // on every 30s poll. Only set it when route hasn't started yet.
        if (first.status !== 'in_progress') {
          setCurrentLocation({ latitude: dLat, longitude: dLng });
        }

        if (first.status === "in_progress") {
          setRouteStarted(true);
          const picked = (first.passengers || [])
            .filter(p => p.status === "picked")
            .map(p => p._id?.toString());
          setCompletedStops(picked);
          setCurrentStopIndex(picked.length);

          const tripId = first.tripId || first._id?.toString();
          if (tripId) {
            activeTripIdRef.current = tripId;
            if (socketRef.current?.connected) socketRef.current.emit("joinTrip", { tripId, userId: driverIdRef.current });
          }

          // ✅ RESTORE simulation position (seg + lat/lng) so van doesn't jump
          // back to driver home after logout/login on the same device.
          try {
            const [[, rSeg], [, rProg], [, rLat], [, rLng]] = await AsyncStorage.multiGet([
              PERSIST_SIM_SEGMENT, PERSIST_SIM_PROGRESS, PERSIST_SIM_LAT, PERSIST_SIM_LNG,
            ]);
            const restoredSeg = parseInt(rSeg, 10);
            if (!isNaN(restoredSeg) && restoredSeg > 0) {
              isRestoringRef.current  = true;
              simSegmentRef.current   = restoredSeg;
              simProgressRef.current  = parseFloat(rProg) || 0;
              const rLatN = parseFloat(rLat);
              const rLngN = parseFloat(rLng);
              if (!isNaN(rLatN) && !isNaN(rLngN)) {
                setCurrentLocation({ latitude: rLatN, longitude: rLngN });
              }
              console.log(`[Driver] 🔄 Sim position restored: seg=${restoredSeg}`);
            }
          } catch (e) { console.warn('[Driver] sim position restore error:', e); }

          // ✅ RESTORE: If there's a persisted waitingAtStop for this route,
          // keep simulation paused. This covers app restart mid-pickup.
          try {
            const [[, sw], [, sr]] = await AsyncStorage.multiGet([
              PERSIST_WAITING_STOP, PERSIST_WAITING_ROUTE,
            ]);
            if (sw && sr === first._id?.toString()) {
              // Verify this stop is still pending in fresh data
              const stillPending = (first.passengers || []).find(
                p => p._id?.toString() === sw && p.status !== "picked" && p.status !== "missed"
              );
              if (stillPending) {
                simPausedRef.current = true;
                setWaitingAtStop(sw);
                const [[, spc]] = await AsyncStorage.multiGet([PERSIST_PASSENGER_CONF]);
                if (spc) {
                  setPassengerConfirmedForStop(spc);
                  passengerConfirmedRef.current = spc;
                }
                console.log("[Driver] 🔄 Route in_progress — restored waitingAtStop:", sw);
              } else {
                // Stop was picked/missed externally — clear stale persisted state
                AsyncStorage.multiRemove([PERSIST_WAITING_STOP, PERSIST_WAITING_ROUTE, PERSIST_PASSENGER_CONF]).catch(() => { });
              }
            }
          } catch { }
        }
      } else {
        // ── CRITICAL FIX: Never kill an active route on empty API response ──
        // If routeStarted is true (simulation running) but API returns empty,
        // this is likely a momentary network error or auth flicker.
        // Resetting state here would stop the running simulation.
        // Only reset if we are NOT currently running a route.
        if (!routeStarted) {
          setCurrentRoute(null);
          setRouteStops([]);
          setCompletedStops([]);
          setCurrentStopIndex(0);
        }
        // routeStarted is intentionally NOT set to false here — the route is
        // still active on the backend (in_progress). It will show up again on
        // the next poll when network is restored.
      }
    } catch (e) { console.error("fetchAssignedRoutes:", e); }
  }, [getHeaders]);

  const fetchAvailabilityHistory = useCallback(async (uid, tok) => {
    try {
      const id = uid || driverIdRef.current;
      const tkn = tok || authTokenRef.current;
      if (!id) return;
      const r = await fetch(`${API_BASE_URL}/driver-availability?driverId=${id}`, { headers: getHeaders(tkn) });
      const d = await r.json();
      if (d.success) {
        const all = d.availability || d.availabilities || [];
        setAvailabilityHistory(all);
        const today = new Date().toISOString().split("T")[0];
        const active = all.filter(a => new Date(a.date).toISOString().split("T")[0] >= today && a.status === "available");
        if (active.length > 0) { setAvailable(true); setActiveAvailabilityRecord(active[0]); }
        else setAvailable(false);
      }
    } catch { }
  }, [getHeaders]);

  const fetchPayments = async (uid, tok) => {
    try {
      const r = await fetch(`${API_BASE_URL}/payments`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) setPaymentData(d.payments || d.data || []);
    } catch { }
  };

  const fetchTrips = async (uid, tok) => {
    try {
      // Use driver ride-history which correctly filters by driverId
      const r = await fetch(`${API_BASE_URL}/trips/driver/ride-history`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) setTrips(d.rides || d.data || []);
    } catch { }
  };

  const fetchSupportTickets = async (uid, tok) => {
    try {
      const r = await fetch(`${API_BASE_URL}/complaints`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) setSupportTickets(d.complaints || d.data || []);
    } catch { }
  };

  // ── Fetch monthly feedback window status ─────────────────────────────────
  const fetchFeedbackWindow = async (tok) => {
    try {
      const r = await fetch(`${API_BASE_URL}/feedback/monthly-window`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) setFeedbackWindow(d);
    } catch { }
  };

  // ── Submit monthly feedback ───────────────────────────────────────────────
  const FEEDBACK_QUESTIONS = [
    'How would you rate your overall driving experience this month?',
    'How satisfied are you with the route assigned to you?',
    'How would you rate communication with your transporter?',
    'How satisfied are you with your payment timelines?',
    'Would you recommend this service to other drivers?',
  ];
  const RATING_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'];

  const handleFeedbackSubmit = async () => {
    if (!feedbackSubject.trim()) {
      Alert.alert('Subject Required', 'Please enter a subject for your feedback.');
      return;
    }
    const allAnswered = FEEDBACK_QUESTIONS.every((_, i) => feedbackAnswers[i]);
    if (!allAnswered) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }
    setFeedbackSaving(true);
    try {
      const tok = authTokenRef.current;
      const questions = FEEDBACK_QUESTIONS.map((q, i) => ({ question: q, answer: feedbackAnswers[i] }));
      const res = await fetch(`${API_BASE_URL}/feedback/monthly`, {
        method: 'POST',
        headers: { ...getHeaders(tok), 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: feedbackSubject.trim(), date: new Date().toISOString(), questions }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbackSubmitted(true);
      } else {
        Alert.alert('Error', data.message || 'Could not submit feedback.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const fetchNotifications = async (uid, tok) => {
    try {
      const r = await fetch(`${API_BASE_URL}/notifications`, { headers: getHeaders(tok) });
      const d = await r.json();
      if (d.success) {
        const n = d.notifications || d.data || [];
        setNotifications(n);
        setUnreadCount(n.filter(x => !x.read).length);
      }
    } catch { }
  };

  // ── Simulation engine ─────────────────────────────────────────────────────
  //
  // KEY DESIGN DECISIONS (fixes the passenger-skip + button-missing bugs):
  //
  // 1. Read from routeStopsRef.current (not routeStops) — avoids stale closure.
  //    Status changes applied via setRouteStops() are immediately visible here.
  //
  // 2. while-loop skips already-picked/missed stops sequentially on every tick.
  //    Because the ref is live, newly-picked stops are skipped correctly.
  //
  // 3. Simulation PAUSES (simPausedRef = true) when the van arrives at a stop.
  //    It will NOT unpause itself — only pickupPassenger() can unpause it.
  //
  // 4. Multi-level alerts: 10 → 5 → 3 → 1 min before each stop.
  //    Each level fires exactly once per stop (keyed in alertedStopsRef).
  //
  const startSimulation = () => {
    const restoring = isRestoringRef.current;
    isRestoringRef.current = false;
    simTickRef.current     = 0;
    routeEndingRef.current = false;  // reset so next route can auto-complete

    if (!restoring) {
      // Fresh start — clear interval and reset to beginning
      stopSimulation();
      simSegmentRef.current  = 0;
      simProgressRef.current = 0;
    } else {
      // Resuming after logout/login — keep saved segment & progress,
      // just clear the interval so we create a fresh one below
      if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
      console.log(`[Sim] ▶ Resuming from seg=${simSegmentRef.current} progress=${simProgressRef.current.toFixed(3)}`);
    }
    simPausedRef.current = false;
    alertedStopsRef.current = new Set();



      // LAST STOP AUTO-COMPLETE
      const passengerStops = routeStopsRef.current.filter(s => s._isDriverOrigin !== true);
      const passengerCount = passengerStops.length;
    
      simIntervalRef.current = setInterval(() => {
        if (simPausedRef.current) return;

        const currentStops = routeStopsRef.current;
        if (!currentStops || currentStops.length < 2) { stopSimulation(); return; }

        const totalSegments = currentStops.length - 1;
        let seg = simSegmentRef.current;

        // Sequential skip + progress
        while (seg < totalSegments) {
          const dest = currentStops[seg + 1];
          if (dest?.status === "picked" || dest?.status === "missed") {
            console.log(`[Sim] Skipping ${seg + 1}: ${dest?.passengerName}`);
            seg += 1;
            simSegmentRef.current = seg;
            simProgressRef.current = 0;
          } else break;
        }

        const passengerStops = currentStops.filter(s => !s._isDriverOrigin);
        const passengerCount = passengerStops.length;
        if (seg >= passengerCount) {
          if (!routeEndingRef.current) {
            routeEndingRef.current = true;
            simPausedRef.current   = true; // stop repeating before alert shows
            console.log('[Sim] 🎉 ALL COMPLETE → END ROUTE');
            completeRouteRef.current?.();  // always latest version, never stale
          }
          return;
        }

        // Check arrival at stop — skip driver origin (status already 'picked')
        const arrivedStop = currentStops[seg];
        if (
          arrivedStop &&
          !arrivedStop._isDriverOrigin &&
          arrivedStop.status !== 'picked' &&
          arrivedStop.status !== 'missed'
        ) {
          simPausedRef.current = true;
          setCurrentLocation(arrivedStop.coordinate);
          setWaitingAtStop(arrivedStop._id);
          setPassengerConfirmedForStop(null);
          AsyncStorage.multiSet([
            [PERSIST_WAITING_STOP, arrivedStop._id?.toString()],
            [PERSIST_WAITING_ROUTE, currentRoute?._id?.toString() || ''],
            [PERSIST_PASSENGER_CONF, ''],
          ]).catch(() => { });
          console.log(`[Sim] ⏸ Paused at ${arrivedStop.passengerName}`);
          return;
        }

        // Sequential skip: advance past already-completed stops
        while (seg < totalSegments) {
          const dest = currentStops[seg + 1];
          if (dest.status === "picked" || dest.status === "missed") {
            console.log(`[Sim] Skipping ${seg + 1}: ${dest.passengerName}`);
            seg += 1;
            simSegmentRef.current = seg;
            simProgressRef.current = 0;
          } else break;
        }

        if (seg >= totalSegments) { stopSimulation(); return; }

        const segDistKm = haversineKm(
          currentStops[seg].coordinate.latitude, currentStops[seg].coordinate.longitude,
          currentStops[seg + 1].coordinate.latitude, currentStops[seg + 1].coordinate.longitude
        );
        const kmPerTick = (ASSUMED_SPEED_KMH * SIM_INTERVAL_MS) / 3600000;
        const stepFraction = segDistKm > 0 ? kmPerTick / segDistKm : 0.08;

        simProgressRef.current += stepFraction;

        if (simProgressRef.current >= 1) {
          simProgressRef.current = 0;
          simSegmentRef.current = seg + 1;
          seg = simSegmentRef.current;

          if (seg >= totalSegments) {
            // ── Arrived at the very last stop ──────────────────────────────
            // With driver-origin prepended: totalSegments === passengerCount.
            // When seg === totalSegments we've just arrived at the last passenger.
            // We must PAUSE here exactly like any other stop (not auto-complete).
            // Only after the driver presses "Confirm Pickup" does pickupPassenger()
            // resume the sim, and the top-of-loop passengerCount check fires to
            // call completeRoute() on the very next tick.
            const lastStop = currentStops[seg];
            if (
              lastStop &&
              !lastStop._isDriverOrigin &&
              lastStop.status !== 'picked' &&
              lastStop.status !== 'missed'
            ) {
              // Pause at last stop — same flow as every other stop
              simPausedRef.current = true;
              setCurrentLocation(lastStop.coordinate);
              setWaitingAtStop(lastStop._id);
              setPassengerConfirmedForStop(null);
              AsyncStorage.multiSet([
                [PERSIST_WAITING_STOP, lastStop._id?.toString()],
                [PERSIST_WAITING_ROUTE, currentRoute?._id?.toString() || ''],
                [PERSIST_PASSENGER_CONF, ''],
              ]).catch(() => {});
              console.log(`[Sim] ⏸ Pause at LAST STOP: ${lastStop.passengerName}`);
              if (socketRef.current?.connected && activeTripIdRef.current) {
                socketRef.current.emit('boardingRequest', {
                  tripId: activeTripIdRef.current,
                  routeId: currentRoute?._id,
                  passengerId: lastStop.passengerId,
                  passengerName: lastStop.passengerName,
                  stopName: lastStop.name,
                  stopId: lastStop._id,
                });
              }
            } else {
              // Last stop already picked/missed — finish the route
              setCurrentLocation(currentStops[currentStops.length - 1].coordinate);
              if (!routeEndingRef.current) {
                routeEndingRef.current = true;
                simPausedRef.current   = true;
                completeRouteRef.current?.();
              }
            }
            return;
          }

          // ── Arrived at an intermediate passenger stop ───────────────────
          const arrivedStop = currentStops[seg];
          if (
            arrivedStop &&
            !arrivedStop._isDriverOrigin &&
            arrivedStop.status !== 'picked' &&
            arrivedStop.status !== 'missed'
          ) {
            simPausedRef.current = true;
            setCurrentLocation(arrivedStop.coordinate);
            setWaitingAtStop(arrivedStop._id);
            setPassengerConfirmedForStop(null);
            AsyncStorage.multiSet([
              [PERSIST_WAITING_STOP, arrivedStop._id?.toString()],
              [PERSIST_WAITING_ROUTE, currentRoute?._id?.toString() || ''],
              [PERSIST_PASSENGER_CONF, ''],
            ]).catch(() => {});
            console.log(`[Sim] ⏸ Pause ${arrivedStop.passengerName}`);
            if (socketRef.current?.connected && activeTripIdRef.current) {
              socketRef.current.emit('boardingRequest', {
                tripId: activeTripIdRef.current,
                routeId: currentRoute?._id,
                passengerId: arrivedStop.passengerId,
                passengerName: arrivedStop.passengerName,
                stopName: arrivedStop.name,
                stopId: arrivedStop._id,
              });
            }
            return;
          }
        }

        const pos = interpolate(
          currentStops[seg].coordinate,
          currentStops[seg + 1].coordinate,
          simProgressRef.current
        );
        setCurrentLocation(pos);

        // ── Persist sim position every 3 ticks so login/logout doesn't reset van ──
        simTickRef.current += 1;
        if (simTickRef.current % 3 === 0) {
          AsyncStorage.multiSet([
            [PERSIST_SIM_SEGMENT,  simSegmentRef.current.toString()],
            [PERSIST_SIM_PROGRESS, simProgressRef.current.toFixed(6)],
            [PERSIST_SIM_LAT,      pos.latitude.toFixed(7)],
            [PERSIST_SIM_LNG,      pos.longitude.toFixed(7)],
          ]).catch(() => {});
        }

        // Broadcast van location
        const tripId = activeTripIdRef.current;
        if (socketRef.current?.connected && tripId) {
          socketRef.current.emit("tripLocationUpdate", {
            tripId,
            routeId: currentRoute?._id,
            latitude: pos.latitude,
            longitude: pos.longitude,
            speed: ASSUMED_SPEED_KMH,
          });
        }

        // Multi-level proximity alerts: 10 → 5 → 3 → 1 min
        const nextStopIdx = seg + 1;
        const nextStop = currentStops[nextStopIdx];
        if (nextStop && nextStop.status !== "picked" && nextStop.status !== "missed") {
          const distToNext = haversineKm(
            pos.latitude, pos.longitude,
            nextStop.coordinate.latitude, nextStop.coordinate.longitude
          );

          const thresholds = [
            { km: TEN_MIN_KM, alertLevel: 10 },
            { km: FIVE_MIN_KM, alertLevel: 5 },
            { km: THREE_MIN_KM, alertLevel: 3 },
            { km: ONE_MIN_KM, alertLevel: 1 },
          ];

          for (const { km, alertLevel } of thresholds) {
            const key = `${nextStopIdx}_${alertLevel}`;
            if (distToNext <= km && !alertedStopsRef.current.has(key)) {
              alertedStopsRef.current.add(key);
              const etaMin = Math.max(1, Math.round((distToNext / ASSUMED_SPEED_KMH) * 60));
              console.log(`[Sim] ${alertLevel}-min alert → stop ${nextStopIdx} (${nextStop.passengerName})`);

              if (socketRef.current?.connected && tripId) {
                socketRef.current.emit("tenMinAlert", {
                  tripId,
                  routeId: currentRoute?._id,
                  passengerId: nextStop.passengerId,
                  passengerName: nextStop.passengerName,
                  stopName: nextStop.name,
                  stopId: nextStop._id,
                  etaMin,
                  alertLevel,  // 10 | 5 | 3 | 1
                });
              }
            }
          }
        }
      }, SIM_INTERVAL_MS);
    };

    // clearAll=true only when route actually COMPLETES — preserves sim position
    // across logout/login (clearAll=false, default) so van resumes correctly.
    const stopSimulation = (clearAll = false) => {
      if (simIntervalRef.current) { clearInterval(simIntervalRef.current); simIntervalRef.current = null; }
      simPausedRef.current = false;
      setWaitingAtStop(null);
      setPassengerConfirmedForStop(null);
      if (clearAll) {
        // Route truly finished — wipe all persisted state including position
        AsyncStorage.multiRemove([
          PERSIST_WAITING_STOP, PERSIST_WAITING_ROUTE, PERSIST_PASSENGER_CONF,
          PERSIST_ROUTE_STARTED, PERSIST_ACTIVE_TRIP,
          PERSIST_SIM_SEGMENT, PERSIST_SIM_PROGRESS, PERSIST_SIM_LAT, PERSIST_SIM_LNG,
        ]).catch(() => {});
      } else {
        // Logout/unmount — only clear pickup state, keep sim position for resume
        AsyncStorage.multiRemove([
          PERSIST_WAITING_STOP, PERSIST_WAITING_ROUTE, PERSIST_PASSENGER_CONF,
          PERSIST_ROUTE_STARTED, PERSIST_ACTIVE_TRIP,
        ]).catch(() => {});
      }
    };

    // ── syncRouteLocation ─────────────────────────────────────────────────────
    const syncRouteLocation = useCallback(async (payload) => {
      if (!currentRoute?._id) return;
      const now = Date.now();
      if (now - lastLocationSyncRef.current >= 5000) {
        lastLocationSyncRef.current = now;
        try {
          await fetch(`${API_BASE_URL}/trips/${activeTripIdRef.current}/location`, {
            method: "PUT", headers: getHeaders(),
            body: JSON.stringify(payload),
          });
        } catch { }
      }
      if (now - lastSocketEmit.current >= SOCKET_EMIT_MS) {
        lastSocketEmit.current = now;
        if (socketRef.current?.connected) {
          socketRef.current.emit("tripLocationUpdate", {
            tripId: activeTripIdRef.current,
            routeId: currentRoute._id,
            ...payload,
          });
        }
      }
    }, [currentRoute?._id, getHeaders]);

    // ── Route actions ─────────────────────────────────────────────────────────
    const confirmAvailability = async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      try {
        setLoading(true);
        const r = await fetch(`${API_BASE_URL}/driver-availability`, {
          method: "POST", headers: getHeaders(),
          body: JSON.stringify({
            date: tomorrow.toISOString().split("T")[0],
            startTime, endTime, status: "available",
          }),
        });
        const d = await r.json();
        if (d.success) {
          setAvailable(true);
          await fetchAvailabilityHistory(driverIdRef.current, authTokenRef.current);
          Alert.alert("Done ✅", "Availability confirmed for tomorrow!");
        }
      } catch { Alert.alert("Error", "Could not connect to server"); }
      finally { setLoading(false); }
    };

    const startRoute = useCallback(async () => {
      if (!currentRoute) { Alert.alert("No Route", "No route assigned to start."); return; }

      // ✅ TIME RESTRICTION DISABLED — Driver can start route anytime.
      // To re-enable scheduling in future, uncomment the block below.
      /*
      const scheduledTime = currentRoute.routeStartTime || currentRoute.pickupTime || currentRoute.timeSlot;
      if (scheduledTime) {
        const routeTime = parseTimeToday(scheduledTime);
        if (routeTime) {
          const diffMs = routeTime - new Date();
          const diffMins = Math.round(diffMs / 60000);
          if (diffMins > 2) {
            Alert.alert(
              "⏰ Too Early to Start",
              `This route is scheduled for ${scheduledTime}.\n\nYou can start in ${formatCountdown(diffMs)}.`,
              [{ text: "OK, Got It" }]
            );
            return;
          }
        }
      }
      */

      Alert.alert("Start Route", `Start "${currentRoute.routeName || currentRoute.name}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start", onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_BASE_URL}/routes/${currentRoute._id}/start`, { method: "POST", headers: getHeaders() });
              const data = await res.json();
              if (data.success) {
                const tripId = data.trip?._id?.toString();
                activeTripIdRef.current = tripId;
                if (socketRef.current?.connected && tripId) socketRef.current.emit("joinTrip", { tripId, userId: driverIdRef.current });
                setRouteStarted(true);
                setCurrentRoute(prev => ({ ...prev, status: "in_progress", tripId }));
                setCurrentStopIndex(0);
                setCompletedStops([]);
                // ✅ PERSIST route started state
                // Clear old sim position — fresh start begins from driver home
              AsyncStorage.multiRemove([
                PERSIST_SIM_SEGMENT, PERSIST_SIM_PROGRESS, PERSIST_SIM_LAT, PERSIST_SIM_LNG,
              ]).catch(() => {});
              AsyncStorage.multiSet([
                  [PERSIST_ROUTE_STARTED, "true"],
                  [PERSIST_ACTIVE_TRIP, tripId || ""],
                ]).catch(() => { });
              } else {
                Alert.alert("Cannot Start", data.message || "Could not start route.");
              }
            } catch (e) { Alert.alert("Error", "Could not connect to server."); }
            finally { setLoading(false); }
          }
        },
      ]);
    }, [currentRoute, getHeaders]);

    const completeRoute = useCallback(async () => {
      if (!currentRoute) return;
      const allHandled = routeStops.filter(s => s._isDriverOrigin !== true).every(
        s => s.status === "picked" || s.status === "missed" || completedStops.includes(s._id)
      );
      Alert.alert(
        "Complete Route",
        allHandled
          ? `Complete route "${currentRoute.routeName || currentRoute.name}"?`
          : "Some passengers are pending. End route anyway?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: allHandled ? "Complete ✅" : "End Anyway",
            style: allHandled ? "default" : "destructive",
            onPress: async () => {
              setLoading(true);
              try {
                const res = await fetch(`${API_BASE_URL}/routes/${currentRoute._id}/end`, { method: "POST", headers: getHeaders() });
                const data = await res.json();
                if (data.success) {
                  routeEndingRef.current = false; // allow future routes to auto-complete
                  stopSimulation(true); // true = clear ALL persisted state incl. sim position
                  setRouteStarted(false);
                  setCurrentRoute(prev => ({ ...prev, status: "completed" }));
                  setCompletedStops([]); setCurrentStopIndex(0);
                  if (socketRef.current?.connected && activeTripIdRef.current) {
                    socketRef.current.emit("routeCompleted", {
                      tripId: activeTripIdRef.current,
                      routeId: currentRoute._id,
                    });
                  }
                  activeTripIdRef.current = null;
                  Alert.alert("Route Completed ✅", "Trip finished! Stats are being updated.");
                  await Promise.all([
                    fetchAssignedRoutes(driverIdRef.current, authTokenRef.current),
                    fetchDashboardStats(driverIdRef.current, authTokenRef.current),
                    fetchTrips(driverIdRef.current, authTokenRef.current),
                  ]);
                } else { Alert.alert("Error", data.message || "Could not complete route."); }
              } catch { Alert.alert("Error", "Could not connect to server."); }
              finally { setLoading(false); }
            }
          },
        ]
      );
    }, [currentRoute, routeStops, completedStops, getHeaders, fetchAssignedRoutes]);

    // Keep completeRouteRef pointing to the latest completeRoute.
    // The setInterval in startSimulation closes over a stale version —
    // this ref ensures it always calls the current one with fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => { completeRouteRef.current = completeRoute; }, [completeRoute]);

    const markNotificationRead = async (id) => {
      try {
        await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PUT", headers: getHeaders() });
        setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { }
    };

    const submitSupportTicket = async () => {
      if (!ticketSubject.trim() || !ticketDescription.trim()) {
        Alert.alert("Error", "Please fill in all fields."); return;
      }
      try {
        setLoading(true);
        const r = await fetch(`${API_BASE_URL}/complaints`, {
          method: "POST", headers: getHeaders(),
          body: JSON.stringify({ subject: ticketSubject, description: ticketDescription }),
        });
        const d = await r.json();
        if (d.success) {
          Alert.alert("Ticket Submitted ✅", "We'll get back to you soon.");
          setNewTicketVisible(false); setTicketSubject(""); setTicketDescription("");
          fetchSupportTickets(driverIdRef.current, authTokenRef.current);
        } else Alert.alert("Error", d.message || "Could not submit.");
      } catch { Alert.alert("Error", "Network error."); }
      finally { setLoading(false); }
    };

    // ── Chat ──────────────────────────────────────────────────────────────────
    const fetchChatMessages = useCallback(async (otherId) => {
      if (!otherId) return;
      try {
        const myId = driverIdRef.current;
        const r = await fetch(`${API_BASE_URL}/messages/${otherId}`, { headers: getHeaders() });
        const d = await r.json();
        if (d.success) {
          setChatMessages((d.messages || []).map(m => ({
            _id: m._id,
            text: m.text,
            fromMe: m.senderId?.toString() === myId,
            isQuickReply: m.isQuickReply || false,
            time: new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          })));
          fetch(`${API_BASE_URL}/messages/${otherId}/read`, { method: "PUT", headers: getHeaders() }).catch(() => { });
        }
      } catch (e) { console.warn("fetchChatMessages:", e); }
    }, [getHeaders]);

    const openDriverChat = useCallback(async (otherUser) => {
      if (!otherUser?._id) return;
      setChatOtherUser(otherUser);
      setChatMessages([]);
      setUnreadMsgCount(0);
      await fetchChatMessages(otherUser._id);
      setCurrentView("Messages");
      if (chatPollRef.current) clearInterval(chatPollRef.current);
      chatPollRef.current = setInterval(() => fetchChatMessages(otherUser._id), 4000);
    }, [fetchChatMessages]);

    const openChatWithTransporter = useCallback(() => {
      if (networkTransporter?._id) {
        openDriverChat({ _id: networkTransporter._id, name: networkTransporter.name, role: "transporter" });
      } else {
        Alert.alert("No Transporter", "You are not assigned to a transporter yet.");
      }
    }, [networkTransporter, openDriverChat]);

    const closeDriverChat = () => {
      if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
      setChatOtherUser(null);
      setChatMessages([]);
      setCurrentView("Dashboard");
    };

    const handleDriverChatSend = useCallback(async (text, messageType = "quick_reply") => {
      if (!text?.trim() || !chatOtherUser?._id || chatSending) return;

      const tempMsg = {
        _id: `tmp_${Date.now()}`, text: text.trim(), fromMe: true,
        isQuickReply: messageType === "quick_reply",
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages(prev => [...prev, tempMsg]);
      setChatSending(true);

      try {
        const r = await fetch(`${API_BASE_URL}/messages`, {
          method: "POST", headers: getHeaders(),
          body: JSON.stringify({
            receiverId: chatOtherUser._id,
            text: text.trim(),
            messageType,
            routeId: currentRoute?._id || null,
          }),
        });
        const d = await r.json();
        if (d.success && d.message) {
          const real = d.message;
          setChatMessages(prev => prev.map(m => m._id === tempMsg._id ? {
            _id: real._id, text: real.text, fromMe: true,
            isQuickReply: real.isQuickReply || false,
            time: new Date(real.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          } : m));
        } else {
          setChatMessages(prev => prev.filter(m => m._id !== tempMsg._id));
          if (d.code === "DRIVER_NO_TYPING") Alert.alert("Not Allowed", "Quick replies only for passengers.");
          else Alert.alert("Error", d.message || "Could not send.");
        }
      } catch {
        setChatMessages(prev => prev.filter(m => m._id !== tempMsg._id));
        Alert.alert("Error", "Network error.");
      } finally { setChatSending(false); }
    }, [chatOtherUser, chatSending, getHeaders, currentRoute]);

    // ── pickupPassenger — THE SINGLE GATE to resume simulation ────────────────
    //
    // This is the ONLY function that unpauses the simulation.
    // It does NOT wait for the passenger to tap "I'm On Board" first.
    // The passenger hint (passengerConfirmedForStop) is informational only.
    //
    // Flow:
    //   van arrives → pause → passenger may tap "I'm On Board" (shows ✅ hint)
    //                       → driver MUST press "Confirm Pickup"
    //                       → simulation resumes to next stop
    //
    const pickupPassenger = useCallback(async () => {
      // Read from ref so we always get the latest stops, not stale closure data
      const stops = routeStopsRef.current;
      const stop = stops.find(s => s._id === waitingAtStop);
      if (!stop || !currentRoute?._id) {
        console.warn("[Driver] pickupPassenger: no matching stop or no route");
        return;
      }

      const passengerId = stop.passengerId?.toString() || stop._id?.toString();
      console.log(`[Driver] ✅ Confirming pickup: ${stop.passengerName} (${passengerId})`);

      // 1. Persist to backend
      try {
        await fetch(
          `${API_BASE_URL}/routes/${currentRoute._id}/stops/${stop._id}/status`,
          { method: "PUT", headers: getHeaders(), body: JSON.stringify({ status: "picked" }) }
        );
      } catch (e) { console.warn("[Driver] pickupPassenger backend error:", e.message); }

      // 2. Notify passenger's screen that driver confirmed
      if (socketRef.current?.connected && activeTripIdRef.current) {
        socketRef.current.emit("driverConfirmedPickup", {
          tripId: activeTripIdRef.current,
          routeId: currentRoute._id,
          passengerId,
          stopId: stop._id,
          stopName: stop.name,
        });
      }

      // 3. Update local state
      setRouteStops(prev => prev.map(s => {
        const sid = s.passengerId?.toString() || s._id?.toString();
        return sid === passengerId ? { ...s, status: "picked" } : s;
      }));
      setCompletedStops(prev => prev.includes(passengerId) ? prev : [...prev, passengerId]);
      setCurrentStopIndex(prev => prev + 1);

      // 4. Clear waiting state
      setWaitingAtStop(null);
      setPassengerConfirmedForStop(null);
      passengerConfirmedRef.current = null;
      driverConfirmedRef.current = null;

      // ✅ CLEAR persisted pickup state — pickup is done
      AsyncStorage.multiRemove([
        PERSIST_WAITING_STOP,
        PERSIST_WAITING_ROUTE,
        PERSIST_PASSENGER_CONF,
      ]).catch(() => { });

      // 5. Resume simulation — this is the ONLY place simPausedRef is set false
      simPausedRef.current = false;
      console.log(`[Driver] ▶ Simulation resuming → next stop`);
    }, [waitingAtStop, currentRoute, getHeaders]);
    // Note: routeStops intentionally NOT in deps — we read routeStopsRef.current instead

    // ── isRideActive ───────────────────────────────────────────────────────────
    const isRideActive = currentRoute
      ? ["assigned", "in_progress", "active"].includes(currentRoute.status)
      : false;

    // ── Navigation ────────────────────────────────────────────────────────────
    const handleLogout = () => {
      setSidebarOpen(false);
      setTimeout(() => {
        Alert.alert("Logout", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout", style: "destructive", onPress: async () => {
              socketRef.current?.disconnect();
              await AsyncStorage.multiRemove(["authToken", "userId", "driverId", "userData"]);
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            }
          },
        ]);
      }, 300);
    };

    const navigateTo = (view) => {
      setSidebarOpen(false);
      if (view === "Messages") {
        setTimeout(() => openChatWithTransporter(), 200);
        return;
      }
      setTimeout(() => setCurrentView(view), 150);
    };

    const toggleSidebar = () => setSidebarOpen(prev => !prev);

    // ── screenProps ───────────────────────────────────────────────────────────
    const screenProps = {
      loading, navigateTo, driverIdRef, authTokenRef, getHeaders,
      dashboardStats, currentRoute, routeStarted, routeStops,
      unreadNotifications: unreadCount, loadAllData,
      available, activeAvailabilityRecord, startTime, setStartTime,
      endTime, setEndTime, availabilityHistory, confirmAvailability,
      markUnavailable: () => { },
      completedStops, currentStopIndex, currentLocation,
      stopDistances, waitingAtStop, onLocationTick: syncRouteLocation,
      progress: routeStops.filter(s => s._isDriverOrigin !== true).length > 0 ? (completedStops.length / routeStops.filter(s => s._isDriverOrigin !== true).length) * 100 : 0,
      completedCount: completedStops.length,
      totalStops: routeStops.filter(s => s._isDriverOrigin !== true).length,
      startRoute, completeRoute,
      pickupPassenger,
      passengerConfirmedForStop,
      fetchAssignedRoutes,
      filteredTrips: trips, search, setSearch, filter, setFilter,
      paymentData, trips,
      supportTickets, newTicketVisible, setNewTicketVisible,
      ticketSubject, setTicketSubject, ticketDescription, setTicketDescription,
      submitSupportTicket,
      notifications, markNotificationRead,
      openDriverChat,
      isRideActive,
      networkTransporter,
      hideTransporterChat: true,
    };

    const isChatOpen = currentView === "Messages";

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={P.dark} />

        {!isChatOpen && (
          <LinearGradient colors={[P.main, P.dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.appBar}>
            <TouchableOpacity style={s.appBarBtn} onPress={toggleSidebar} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.75}>
              <Ionicons name={sidebarOpen ? "close" : "menu"} size={24} color={P.white} />
            </TouchableOpacity>

            <View style={s.appBarCenter}>
              <Text style={s.appBarTitle}>{SECTION_TITLES[currentView] || currentView}</Text>
              <Text style={s.appBarSub} numberOfLines={1}>{driverProfile?.name || "Driver"}</Text>
            </View>

            <TouchableOpacity style={s.appBarBtn} onPress={() => navigateTo("Notifications")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="notifications-outline" size={22} color={P.white} />
              {unreadCount > 0 && (
                <Animated.View style={[s.badge, { opacity: blinkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
                  <Text style={s.badgeTxt}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          </LinearGradient>
        )}

        <View style={{ flex: 1 }}>
          {currentView === "Dashboard" && <DashboardScreen     {...screenProps} />}
          {currentView === "Availability" && <AvailabilityScreen  {...screenProps} />}
          {currentView === "Routes" && <RoutesScreen        {...screenProps} />}
          {currentView === "History" && <HistoryScreen       {...screenProps} />}
          {currentView === "Payments" && <PaymentsScreen      {...screenProps} />}
          {currentView === "Support" && <SupportScreen       {...screenProps} />}
          {currentView === "Notifications" && <NotificationsScreen {...screenProps} />}
          {currentView === "Profile" && <DriverProfileScreen {...screenProps} />}
          {currentView === "MonthlyFeedback" && (
            <MonthlyFeedbackScreen
              authTokenRef={authTokenRef}
              getHeaders={getHeaders}
              navigateTo={navigateTo}
            />
          )}
          {currentView === "LeaveNetwork" && (
            <LeaveNetworkScreen
              driverProfile={driverProfile}
              authTokenRef={authTokenRef}
              getHeaders={getHeaders}
              navigateTo={navigateTo}
              navigation={navigation}
            />
          )}
          {currentView === "DeleteAccount" && (
            <DeleteAccountScreen
              driverProfile={driverProfile}
              authTokenRef={authTokenRef}
              getHeaders={getHeaders}
              navigateTo={navigateTo}
              navigation={navigation}
            />
          )}

          {currentView === "Messages" && (
            <DriverChatModal
              personName={chatOtherUser?.name || ""}
              personRole={chatOtherUser?.role || "passenger"}
              messages={chatMessages}
              onSend={handleDriverChatSend}
              isRideActive={isRideActive}
              onClose={closeDriverChat}
              onOpenSidebar={() => setSidebarOpen(true)}
            />
          )}
        </View>

        {sidebarOpen && (
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSidebarOpen(false)} />
        )}

        <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <LinearGradient colors={[P.main, P.dark]} style={s.sidebarHeader}>
            <View style={s.sidebarHeaderRow}>
              <TouchableOpacity style={s.sidebarProfileTap} onPress={() => navigateTo("Profile")} activeOpacity={0.75}>
                <View style={s.sidebarAvatar}>
                  <Text style={s.sidebarAvatarTxt}>{initials(driverProfile?.name)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={s.sidebarName} numberOfLines={1}>{driverProfile?.name || "Driver"}</Text>
                  <Text style={s.sidebarPhone} numberOfLines={1}>{driverProfile?.phone || "Driver App"}</Text>
                  <View style={s.activePill}>
                    <View style={[s.activeDot, { backgroundColor: available ? "#69F0AE" : P.border }]} />
                    <Text style={s.activeTxt}>{available ? "Available" : "Unavailable"}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(172,197,168,0.7)" style={{ marginRight: 36 }} />
              </TouchableOpacity>
              <TouchableOpacity style={s.sidebarCloseBtn} onPress={() => setSidebarOpen(false)}>
                <Ionicons name="close" size={20} color={P.white} />
              </TouchableOpacity>
            </View>
            <Text style={s.profileHint}>Tap to view profile</Text>
          </LinearGradient>

          <ScrollView style={s.sidebarScroll} showsVerticalScrollIndicator={false}>
            <Text style={s.menuSectionLabel}>MAIN MENU</Text>
            {MENU.map(item => {
              const active = item.view !== "Messages" && currentView === item.view;
              const badge = item.view === "Notifications" ? unreadCount
                : item.view === "Messages" ? unreadMsgCount
                  : 0;
              return (
                <TouchableOpacity
                  key={item.view}
                  style={[s.menuItem, active && s.menuItemActive]}
                  onPress={() => navigateTo(item.view)}
                  activeOpacity={0.75}
                >
                  {active && <View style={s.menuAccent} />}
                  <View style={[s.menuIconBox, active && s.menuIconBoxActive]}>
                    <Ionicons name={active ? item.activeIcon : item.icon} size={18} color={active ? P.white : P.textLight} />
                  </View>
                  <Text style={[s.menuItemTxt, active && s.menuItemTxtActive]}>{item.label}</Text>
                  {badge > 0 && (
                    <View style={s.menuBadge}>
                      <Text style={s.menuBadgeTxt}>{badge > 9 ? "9+" : badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <View style={s.menuDivider} />

            

            {/* Leave Transporter Network — navigates to dedicated screen */}
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => navigateTo("LeaveNetwork")}
              activeOpacity={0.75}
            >
              <View style={[s.menuIconBox, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="exit-outline" size={18} color="#E65100" />
              </View>
              <Text style={[s.menuItemTxt, { color: '#E65100' }]}>Leave Transporter Network</Text>
              <Ionicons name="chevron-forward" size={14} color="#E6510080" />
            </TouchableOpacity>

            {/* Delete Account Permanently — navigates to dedicated screen */}
            <TouchableOpacity
              style={s.menuItem}
              onPress={() => navigateTo("DeleteAccount")}
              activeOpacity={0.75}
            >
              <View style={[s.menuIconBox, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="trash-outline" size={18} color={P.main} />
              </View>
              <Text style={[s.menuItemTxt, { color: P.main }]}>Delete Account Permanently</Text>
              <Ionicons name="chevron-forward" size={14} color={P.main + '80'} />
            </TouchableOpacity>

            <View style={s.menuDivider} />
            <TouchableOpacity style={s.menuItem} onPress={handleLogout} activeOpacity={0.75}>
              <View style={[s.menuIconBox, { backgroundColor: "#FFEBEE" }]}>
                <Ionicons name="log-out-outline" size={18} color={P.error} />
              </View>
              <Text style={[s.menuItemTxt, { color: P.error, fontWeight: "700" }]}>Logout</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>

        {loading && (
          <View style={s.loaderOverlay}>
            <View style={s.loaderBox}>
              <ActivityIndicator size="large" color={P.main} />
              <Text style={s.loaderTxt}>Loading…</Text>
            </View>
          </View>
        )}


      </View>
    );
  }

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: P.bg },

    appBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: STATUS_BAR_H + 10, paddingBottom: 10, elevation: 6, shadowColor: P.dark, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    appBarBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", position: "relative" },
    appBarCenter: { flex: 1, alignItems: "center" },
    appBarTitle: { fontSize: 17, fontWeight: "800", color: P.white, letterSpacing: 0.3 },
    appBarSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 1 },

    badge: { position: "absolute", top: -2, right: -2, backgroundColor: P.error, borderRadius: 9, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: P.white },
    badgeTxt: { fontSize: 9, color: P.white, fontWeight: "900" },

    overlay: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.42)", zIndex: 99 },
    sidebar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 300, backgroundColor: P.white, zIndex: 100, elevation: 20, shadowColor: "#000", shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.18, shadowRadius: 10 },

    sidebarHeader: { paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 54 : STATUS_BAR_H + 16, paddingBottom: 16 },
    sidebarHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    sidebarProfileTap: { flex: 1, flexDirection: "row", alignItems: "center" },
    sidebarAvatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
    sidebarAvatarTxt: { color: P.white, fontSize: 18, fontWeight: "800" },
    sidebarName: { fontSize: 15, fontWeight: "800", color: P.white, marginBottom: 2 },
    sidebarPhone: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 6 },
    activePill: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, alignSelf: "flex-start" },
    activeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
    activeTxt: { color: P.white, fontSize: 11, fontWeight: "600" },
    sidebarCloseBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    profileHint: { fontSize: 11, color: "rgba(172,197,168,0.6)", marginLeft: 72 },

    sidebarScroll: { flex: 1, paddingTop: 12 },
    menuSectionLabel: { fontSize: 11, fontWeight: "700", color: "#aaa", marginBottom: 6, marginLeft: 20, marginTop: 8, letterSpacing: 1.2 },

    menuItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12, position: "relative" },
    menuItemActive: { backgroundColor: P.light },
    menuAccent: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, backgroundColor: P.main, borderRadius: 2 },
    menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F5F7F5", alignItems: "center", justifyContent: "center" },
    menuIconBoxActive: { backgroundColor: P.main },
    menuItemTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: P.textMid },
    menuItemTxtActive: { color: P.textDark, fontWeight: "800" },
    menuBadge: { backgroundColor: P.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    menuBadgeTxt: { fontSize: 9, color: P.white, fontWeight: "900" },
    menuDivider: { height: 1, backgroundColor: "#E5EBE5", marginHorizontal: 16, marginVertical: 8 },

    loaderOverlay: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center", zIndex: 200 },
    loaderBox: { backgroundColor: P.white, borderRadius: 20, padding: 28, alignItems: "center", gap: 12, ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 8 } }) },
    loaderTxt: { fontSize: 13, color: P.textLight, fontWeight: "600" },
  })