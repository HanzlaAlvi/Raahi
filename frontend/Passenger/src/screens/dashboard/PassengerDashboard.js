// frontend/Passenger/src/screens/dashboard/PassengerDashboard.js
// MERGED VERSION:
//   ✅ All File 1 functionality preserved (polls, morning conf, notifications, chat, driver card, route status card, etc.)
//   ✅ File 2 map improvements: encoded polyline reuse, smooth animated van, destination name fix
//   ✅ File 2 boarding: dual-confirm flow (boardingPending + passengerConfirmBoarding socket event)
//   ✅ File 2 socket: rideStateChange → GOING_TO_DESTINATION banner, bothConfirmed, joinRide/joinUser
//   ✅ File 2 reconnection: re-join all rooms on socket reconnect
//   ✅ vanArrived + boardingPending persistence via AsyncStorage
//   ✅ Call feature remains removed (as in File 1)

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Animated,
  Modal, TextInput, FlatList, KeyboardAvoidingView,
  Platform, Alert, RefreshControl, ActivityIndicator, StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { stopCoordinates } from "../../../../constants/coordinates";

const API_BASE_URL = "https://raahi-q2ur.onrender.com/api";
const SOCKET_URL   = "https://raahi-q2ur.onrender.com";

// ── Persistence keys ────────────────────────────────────────────────────────
const PKEY_VAN_ARRIVED  = "passenger_vanArrived";
const PKEY_VAN_STOP_ID  = "passenger_vanStopId";
const PKEY_VAN_ROUTE_ID = "passenger_vanRouteId";

const C = {
  main:"#415844", dark:"#2D3E2F", deeper:"#1A2B1C",
  light:"#EDF4ED", bg:"#F2F5F2", border:"#C5D4C5", white:"#FFFFFF", ink:"#0F1A10",
  pollBg:"#2A4A2C",    pollBorder:"#4A7A4C",    pollAccent:"#7EC87F",
  morningBg:"#3A3A1A", morningBorder:"#6A6A2A", morningAccent:"#C8C850",
  notifBg:"#1A2E3A",   notifBorder:"#2A5A6A",   notifAccent:"#6AB8C8",
  urgentBg:"#3A1A1A",  urgentBorder:"#6A2A2A",  urgentAccent:"#E87878",
  offWhite:"rgba(255,255,255,0.92)", dimWhite:"rgba(255,255,255,0.60)",
  success:"#4CAF50", warn:"#E59A2A", warnBg:"#FFF8E1", amber:"#FF9800",
  info:"#1565C0", infoBg:"#E3F2FD", blue:"#2563EB",
};

const SPEED_KMH = 40;
const FRAME_MS  = 1000;

const DEMO = [
  { latitude: 33.6884, longitude: 73.0512 },
  { latitude: 33.6941, longitude: 73.0389 },
  { latitude: 33.7014, longitude: 73.0287 },
  { latitude: 33.7104, longitude: 73.0192 },
  { latitude: 33.7214, longitude: 73.0072 },
];

// ── Decode Google encoded polyline ──────────────────────────────────────────
function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1; lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1; lng += dlng;
    poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return poly;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversine(la1, ln1, la2, ln2) {
  const R = 6371, d2r = Math.PI / 180;
  const dL = (la2 - la1) * d2r, dl = (ln2 - ln1) * d2r;
  const a  = Math.sin(dL / 2) ** 2 + Math.cos(la1 * d2r) * Math.cos(la2 * d2r) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolvePassengerCoord(p, fallbackIndex = 0) {
  const lat = p.pickupLat || p.latitude  || p.location?.coordinates?.[1] || null;
  const lng = p.pickupLng || p.longitude || p.location?.coordinates?.[0] || null;
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001))
    return { latitude: Number(lat), longitude: Number(lng) };
  const key = p.pickupPoint || p.pickupAddress || p.address || p.name || "";
  if (key && stopCoordinates?.[key]) return stopCoordinates[key];
  return DEMO[fallbackIndex % DEMO.length];
}

function resolveDropCoord(p) {
  // Priority 1: dropOffLocation object (backend canonical field)
  if (p.dropOffLocation?.latitude && p.dropOffLocation?.longitude)
    return { latitude: Number(p.dropOffLocation.latitude), longitude: Number(p.dropOffLocation.longitude) };
  // Priority 2: destinationLat / destinationLng
  const lat = p.destinationLat || p.dropLat || null;
  const lng = p.destinationLng || p.dropLng || null;
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001))
    return { latitude: Number(lat), longitude: Number(lng) };
  // Priority 3: named stop lookup
  const key = p.destination || p.dropAddress || p.dropOffLocation?.name || p.dropOffLocation?.address || "";
  if (key && stopCoordinates?.[key]) return stopCoordinates[key];
  return null;
}

// ── DESTINATION NAME FIX: use place name, not passenger name ─────────────────
function resolveDestinationName(p) {
  const name = p.dropOffLocation?.name || p.dropOffLocation?.address
    || p.destination || p.dropAddress || p.destinationName || null;
  if (name && name.trim() && name !== p.name && name !== p.passengerName) return name;
  return "Drop-off";
}

function lerp(a, b, t) {
  return {
    latitude:  a.latitude  + (b.latitude  - a.latitude)  * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function fitRegion(coords) {
  if (!coords || !coords.length)
    return { latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.06, longitudeDelta: 0.06 };
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const pad  = 0.025;
  return {
    latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta:  Math.max(Math.max(...lats) - Math.min(...lats) + pad * 2, 0.04),
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + pad * 2, 0.04),
  };
}

const getInitials = (name = "") => name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

// ── Smooth animated van marker ────────────────────────────────────────────────
function useSmoothVanPos(vanPos) {
  const latAnim = useRef(new Animated.Value(vanPos?.latitude  || 33.6844)).current;
  const lngAnim = useRef(new Animated.Value(vanPos?.longitude || 73.0479)).current;
  const prevPos = useRef(vanPos);

  useEffect(() => {
    if (!vanPos?.latitude || !vanPos?.longitude) return;
    if (
      vanPos.latitude  === prevPos.current?.latitude &&
      vanPos.longitude === prevPos.current?.longitude
    ) return;
    prevPos.current = vanPos;
    Animated.parallel([
      Animated.timing(latAnim, { toValue: vanPos.latitude,  duration: 900, useNativeDriver: false }),
      Animated.timing(lngAnim, { toValue: vanPos.longitude, duration: 900, useNativeDriver: false }),
    ]).start();
  }, [vanPos?.latitude, vanPos?.longitude]);

  return { latAnim, lngAnim };
}

// ── Stop pin color helper ─────────────────────────────────────────────────────
const stopBg = (status) => {
  if (status === "picked")  return C.main;
  if (status === "missed")  return "#EF4444";
  if (status === "waiting") return C.amber;
  return "#64748B";
};

export default function PassengerDashboard({ navigation }) {
  const userTokenRef    = useRef(null);
  const userIdRef       = useRef(null);
  const intervalRef     = useRef(null);
  const socketRef       = useRef(null);
  const activeTripIdRef = useRef(null);
  const mapRef          = useRef(null);

  const [userProfile,      setUserProfile]      = useState(null);
  const [pickupPoint,      setPickupPoint]       = useState("");
  const [assignedRoute,    setAssignedRoute]     = useState(null);
  const [routeDriver,      setRouteDriver]       = useState(null);
  const [driverInfo,       setDriverInfo]        = useState({ name:"Driver", rating:4.8, vehicleNumber:"N/A", vehicleModel:"Van" });
  const [myPassengerEntry, setMyPassengerEntry]  = useState(null);
  const [myStopIndex,      setMyStopIndex]       = useState(-1);
  const [isNextPickup,     setIsNextPickup]      = useState(false);
  const [pickedBeforeMe,   setPickedBeforeMe]    = useState(0);
  const [totalPassengers,  setTotalPassengers]   = useState(0);
  const [allPassengers,    setAllPassengers]     = useState([]);

  // Tracking state
  const [vanPos,              setVanPos]              = useState(null);
  const [driverHomeCoord,     setDriverHomeCoord]     = useState(null); // driver's home/start position
  const [etaToMe,             setEtaToMe]             = useState(null);
  const [vanArrived,          setVanArrived]           = useState(false);
  const [boarded,             setBoarded]              = useState(false);
  const [markingBoard,        setMarkingBoard]         = useState(false);
  const [useLiveTripLocation, setUseLiveTripLocation]  = useState(false);

  // ── Polyline from driver (reuse, no recalculation) ──────────────────────
  const [encodedPolyline, setEncodedPolyline] = useState(null);
  const polylineCoords = useMemo(() => decodePolyline(encodedPolyline), [encodedPolyline]);

  // ── Ride state ────────────────────────────────────────────────────────────
  const [rideState,     setRideState]     = useState("PICKING_UP");
  const [finalDestName, setFinalDestName] = useState(null);
  const [tripCompleted, setTripCompleted] = useState(false);

  // ── Boarding (dual-confirm flow) ──────────────────────────────────────────
  const [boardingPending,    setBoardingPending]    = useState(false);
  const [boardingStopId,     setBoardingStopId]     = useState(null);
  const [confirmingBoarding, setConfirmingBoarding] = useState(false);
  // In-app boarding modal (replaces Alert.alert for YES/NO boarding)
  const [showBoardingModal,  setShowBoardingModal]  = useState(false);
  const [boardingStopName,   setBoardingStopName]   = useState("");
  // Passenger tapped YES — waiting for driver to confirm
  const [passengerSaidYes,   setPassengerSaidYes]   = useState(false);

  // ── "I'm Not Going" feature ───────────────────────────────────────────────
  const [showNotGoingModal,  setShowNotGoingModal]  = useState(false);
  const [notGoingLoading,    setNotGoingLoading]    = useState(false);
  const [notGoingOffenses,   setNotGoingOffenses]   = useState(0);
  const [notGoingDone,       setNotGoingDone]       = useState(false);

  // ── Smart Arrival Alert modal (in-app, no push) ───────────────────────────
  // Queue of { level, emoji, title, body } — dismiss one, next auto-shows
  const [arrivalAlertQueue,  setArrivalAlertQueue]  = useState([]);
  const shownAlertLevels = useRef(new Set()); // prevent duplicate modals per level
  const arrivalAlertAnim = useRef(new Animated.Value(0)).current;

  const simRef     = useRef(null);
  const segRef     = useRef(0);
  const stepRef    = useRef(0);
  const alertedRef = useRef(false);
  const stopsRef   = useRef([]);

  const [activePolls,      setActivePolls]      = useState([]);
  const [showPollModal,    setShowPollModal]     = useState(false);
  const [selectedPoll,     setSelectedPoll]      = useState(null);
  const [loadingResponse,  setLoadingResponse]   = useState("");
  const shownPollIds = useRef(new Set());

  const [showMorningConf, setShowMorningConf] = useState(false);
  const [morningTrip,     setMorningTrip]     = useState(null);
  const [notifications,   setNotifications]   = useState([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
  // callVisible REMOVED — no call feature
  const [chatVisible,     setChatVisible]     = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatMessages,    setChatMessages]    = useState([]);
  const [inputText,       setInputText]       = useState("");
  const [typedCount,      setTypedCount]      = useState(0);
  const [chatSending,     setChatSending]     = useState(false);
  const flatListRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading,    setLoading]    = useState(false);

  const fadeAnim         = useRef(new Animated.Value(0)).current;
  const cardAnim         = useRef(new Animated.Value(0)).current;
  const pulseAnim        = useRef(new Animated.Value(1)).current;
  const blinkAnim        = useRef(new Animated.Value(0)).current;
  const pollSlideAnim    = useRef(new Animated.Value(-200)).current;
  const pollPulseAnim    = useRef(new Animated.Value(1)).current;
  const morningSlideAnim = useRef(new Animated.Value(-200)).current;
  const morningPulseAnim = useRef(new Animated.Value(1)).current;
  const nextPickupPulse  = useRef(new Animated.Value(1)).current;
  const vanPulse         = useRef(new Animated.Value(1)).current;
  const boardingPulse    = useRef(new Animated.Value(1)).current;

  // Smooth van marker
  const { latAnim, lngAnim } = useSmoothVanPos(vanPos);

  useEffect(() => {
    loadAuthData();
    initSocket();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(simRef.current);
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!userTokenRef.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const ms = assignedRoute?.status === "in_progress" ? 8000 : 20000;
    intervalRef.current = setInterval(() => fetchAll(userTokenRef.current, userIdRef.current), ms);
  }, [assignedRoute?.status]);

  useEffect(() => {
    if (assignedRoute?.status === "in_progress" && allPassengers.length > 1 && !boarded && !useLiveTripLocation) {
      startPassengerSim();
    } else {
      clearInterval(simRef.current);
    }
    return () => clearInterval(simRef.current);
  }, [assignedRoute?.status, allPassengers.length, boarded, useLiveTripLocation]);

  // Van pulse when close / arrived / boarding pending
  useEffect(() => {
    if (vanArrived || boardingPending || (etaToMe !== null && etaToMe <= 10)) {
      Animated.loop(Animated.sequence([
        Animated.timing(vanPulse, { toValue:1.3, duration:600, useNativeDriver:true }),
        Animated.timing(vanPulse, { toValue:1,   duration:600, useNativeDriver:true }),
      ])).start();
    } else {
      vanPulse.setValue(1);
    }
  }, [vanArrived, etaToMe, boardingPending]);

  // Boarding button pulse
  useEffect(() => {
    if (!boardingPending) { boardingPulse.setValue(1); return; }
    Animated.loop(Animated.sequence([
      Animated.timing(boardingPulse, { toValue:1.04, duration:700, useNativeDriver:true }),
      Animated.timing(boardingPulse, { toValue:1,    duration:700, useNativeDriver:true }),
    ])).start();
  }, [boardingPending]);

  // Auto-follow van in live mode
  useEffect(() => {
    if (!vanPos || !useLiveTripLocation) return;
    mapRef.current?.animateToRegion(
      { ...vanPos, latitudeDelta:0.025, longitudeDelta:0.025 }, 600
    );
  }, [vanPos?.latitude, vanPos?.longitude, useLiveTripLocation]);

  // Entrance animations
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue:1, duration:800, useNativeDriver:true }).start();
    Animated.spring(cardAnim, { toValue:1, tension:50, friction:7, useNativeDriver:true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(blinkAnim, { toValue:1, duration:800, useNativeDriver:false }),
      Animated.timing(blinkAnim, { toValue:0, duration:800, useNativeDriver:false }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:1.3, duration:1000, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:1000, useNativeDriver:true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(nextPickupPulse, { toValue:1.03, duration:900, useNativeDriver:true }),
      Animated.timing(nextPickupPulse, { toValue:1,    duration:900, useNativeDriver:true }),
    ])).start();
  }, []);

  // ── Arrival alert slide-in animation ─────────────────────────────────────
  useEffect(() => {
    if (arrivalAlertQueue.length > 0) {
      arrivalAlertAnim.setValue(0);
      Animated.spring(arrivalAlertAnim, { toValue:1, tension:60, friction:9, useNativeDriver:true }).start();
    }
  }, [arrivalAlertQueue.length]);

  // ── Helper: push a new alert level (de-duplicates by level) ──────────────
  const pushArrivalAlert = (level, emoji, title, body) => {
    const key = `level_${level}`;
    if (shownAlertLevels.current.has(key)) return; // already shown this level
    shownAlertLevels.current.add(key);
    setArrivalAlertQueue(prev => {
      const exists = prev.some(a => a.level === level);
      if (exists) return prev;
      return [...prev, { level, emoji, title, body }];
    });
  };

  // ── Dismiss top alert from queue ──────────────────────────────────────────
  const dismissTopArrivalAlert = () => {
    Animated.timing(arrivalAlertAnim, { toValue:0, duration:220, useNativeDriver:true }).start(() => {
      setArrivalAlertQueue(prev => prev.slice(1));
    });
  };

  // Reset alert level tracking when boarding is done
  useEffect(() => {
    if (boarded) shownAlertLevels.current = new Set();
  }, [boarded]);

  // Restore boarding state from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.multiGet([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID]).then(results => {
      const arrived = results[0][1] === "true";
      const stopId  = results[1][1] || null;
      if (arrived && !boarded) {
        setVanArrived(true);
        setBoardingPending(true);
        setBoardingStopId(stopId);
      }
    }).catch(() => {});
  }, []);

  // ── Socket.io ──────────────────────────────────────────────────────────────
  const initSocket = () => {
    try {
      const { io } = require("socket.io-client");
      if (socketRef.current?.connected) return;

      const socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        timeout: 10000,
      });

      socket.on("connect", () => {
        console.log("[Socket] Passenger connected:", socket.id);
        // Re-join ALL rooms on reconnect
        if (activeTripIdRef.current) {
          socket.emit("joinRide",  { rideId: activeTripIdRef.current, userId: userIdRef.current, role: "passenger" });
          socket.emit("joinTrip",  { tripId: activeTripIdRef.current, userId: userIdRef.current });
        }
        if (userIdRef.current) socket.emit("joinUser", { userId: userIdRef.current });
      });

      // ── POLYLINE from driver — reuse without recalculating ─────────────────
      socket.on("routeUpdate", (data) => {
        console.log('[Passenger] routeUpdate received, has polyline:', !!data?.encodedPolyline, 'rideId:', data?.rideId);
        if (data?.encodedPolyline) {
          setEncodedPolyline(data.encodedPolyline);
          setUseLiveTripLocation(true);
          clearInterval(simRef.current);
        }
        // Also handle straight-line fallback when Google API fails on driver side
        if (!data?.encodedPolyline && data?.waypointCoords?.length > 1) {
          console.log('[Passenger] routeUpdate: using straight-line fallback coords');
          // waypointCoords are raw lat/lng — handled by passenger's own fallback renderer
        }
      });

      // ── Real-time van location from driver ─────────────────────────────────
      socket.on("vanLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat == null || lng == null) return;
        const newPos = { latitude: Number(lat), longitude: Number(lng) };
        setVanPos(newPos);
        setUseLiveTripLocation(true);
        clearInterval(simRef.current);

        // Check 10-min threshold from live GPS
        const myIdx = myStopIndex;
        if (myIdx >= 0 && stopsRef.current.length > myIdx && !alertedRef.current) {
          const myCoord = stopsRef.current[myIdx]?.coordinate;
          if (myCoord) {
            const dist = haversine(newPos.latitude, newPos.longitude, myCoord.latitude, myCoord.longitude);
            const eta  = Math.max(1, Math.round((dist / SPEED_KMH) * 60));
            setEtaToMe(eta);
            if (eta <= 10) {
              alertedRef.current = true;
              Alert.alert(
                "🚨 Van is 10 Minutes Away!",
                `Van is ~${eta} minute${eta === 1 ? "" : "s"} away from your stop!\nGet ready at: ${stopsRef.current[myIdx]?.name || "your pickup"}`,
                [{ text: "Got it! 👍" }]
              );
            }
          }
        }
      });

      // ── driverLocationUpdate — server re-broadcasts under this alias too ──────
      // Server sends BOTH 'vanLocationUpdate' AND 'driverLocationUpdate' on every
      // locationUpdate from driver. We listen to both for resilience.
      socket.on("driverLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat == null || lng == null) return;
        console.log('[Passenger] driverLocationUpdate:', Number(lat).toFixed(5), Number(lng).toFixed(5));
        const newPos = { latitude: Number(lat), longitude: Number(lng) };
        setVanPos(newPos);
        setUseLiveTripLocation(true);
        clearInterval(simRef.current);
      });

      // ── tripLocationUpdate (same as vanLocationUpdate, accept both) ─────────
      socket.on("tripLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat == null || lng == null) return;
        const newPos = { latitude: Number(lat), longitude: Number(lng) };
        setVanPos(newPos);
        setUseLiveTripLocation(true);
        clearInterval(simRef.current);
      });

      // ── Ride state changes ─────────────────────────────────────────────────
      socket.on("rideStateChange", (data) => {
        if (!data) return;
        if (data.state === "GOING_TO_DESTINATION") {
          setRideState("GOING_TO_DESTINATION");
          setFinalDestName(data.destinationName || "Destination");
          if (data.encodedPolyline) setEncodedPolyline(data.encodedPolyline);
        }
        if (data.state === "COMPLETED") {
          setRideState("COMPLETED");
          setTripCompleted(true);
        }
      });

      // ── tenMinAlert — driver simulation emits tiered ETA alerts ────────────
      socket.on("tenMinAlert", (data) => {
        const myId    = userIdRef.current;
        const isForMe = data?.passengerId?.toString() === myId || data?.passengerId === myId;
        if (!isForMe) return;

        const eta      = data?.etaMin    || data?.alertLevel || 10;
        const level    = data?.alertLevel || 10;
        const stop     = data?.stopName  || stopsRef.current[myStopIndex]?.name || "your pickup point";
        const levelKey = `alert_${level}`;
        if (alertedRef.current === levelKey) return;
        alertedRef.current = levelKey;
        setEtaToMe(eta);

        const cfg = {
          10: { emoji:"⏱️", title:"Be Ready! Vehicle Approaching",  body:`Vehicle arriving in ~${eta} min at:\n${stop}\n\nStart making your way to the pickup point.` },
          5:  { emoji:"🚐", title:"5 Minutes Away — Head Out Now!", body:`Vehicle is ~${eta} min away at:\n${stop}\n\nPlease go to your pickup point now!` },
          3:  { emoji:"⚠️", title:"Almost There — 3 Minutes!",      body:`Vehicle arriving in ~${eta} min at:\n${stop}\n\nBe at your spot RIGHT NOW!` },
          1:  { emoji:"🚨", title:"Vehicle is 1 Minute Away!",      body:`Vehicle is 1 min away at:\n${stop}\n\nYour driver is almost here — don't miss it!` },
        }[level] || { emoji:"⏱️", title:"Van Alert", body:`Van ~${eta} min away at ${stop}` };

        // Show in-app modal instead of native Alert
        setArrivalAlert(cfg);
      });

      // ── boardingRequest — van arrived at THIS passenger's stop ─────────────
      socket.on("boardingRequest", (data) => {
        const myId    = userIdRef.current;
        const isForMe = data?.passengerId?.toString() === myId || data?.passengerId === myId;
        if (!isForMe || boarded) return;

        setVanArrived(true);
        setBoardingPending(true);
        setBoardingStopId(data?.stopId || null);
        setBoardingStopName(data?.stopName || "your stop");
        clearInterval(simRef.current);

        // Persist so button reappears after app restart
        AsyncStorage.multiSet([
          [PKEY_VAN_ARRIVED,  "true"],
          [PKEY_VAN_STOP_ID,  data?.stopId?.toString()  || ""],
          [PKEY_VAN_ROUTE_ID, data?.routeId?.toString() || ""],
        ]).catch(() => {});

        // Show in-app modal instead of native Alert
        setShowBoardingModal(true);
      });

      // ── bothConfirmed — driver + passenger both confirmed → boarded ────────
      socket.on("bothConfirmed", (data) => {
        const myId = userIdRef.current;
        if (data?.passengerId?.toString() === myId || data?.passengerId === myId) {
          setBoarded(true);
          setVanArrived(false);
          setBoardingPending(false);
          setPassengerSaidYes(false);
          setBoardingStopId(null);
          clearInterval(simRef.current);
          AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});
        }
      });

      // ── passengerBoarded / passengerStatusUpdate — legacy + driver-side ────
      socket.on("passengerBoarded", (data) => {
        const myId = userIdRef.current;
        if (data?.passengerId?.toString() === myId) {
          setBoarded(true); setVanArrived(false); setBoardingPending(false);
        }
      });
      socket.on("passengerStatusUpdate", (data) => {
        const myId = userIdRef.current;
        if (data?.passengerId?.toString() === myId || data?.passengerId === myId) {
          if (data.status === "picked") {
            setBoarded(true);
            setVanArrived(false);
            setBoardingPending(false);
            clearInterval(simRef.current);
          }
        }
      });

      socket.on("rideCompleted", () => {
        setTripCompleted(true); setRideState("COMPLETED");
        setUseLiveTripLocation(false); clearInterval(simRef.current);
        setChatVisible(false); setUnreadChatCount(0);
      });

      socket.on("routeCompleted", () => {
        setUseLiveTripLocation(false);
        clearInterval(simRef.current);
        setChatVisible(false);
        setUnreadChatCount(0);
      });

      // ── rideChat — real-time message from driver ───────────────────────────
      socket.on("rideChat", (data) => {
        const myId = userIdRef.current;
        if (!data?.senderId || data.senderId?.toString() === myId?.toString()) return;
        if (data?.senderRole !== "driver") return;
        if (!chatVisible) setUnreadChatCount(prev => prev + 1);
      });

      socket.on("chatEnded", () => {
        setChatVisible(false);
        setUnreadChatCount(0);
      });

      socket.on("statsRefresh", () => {
        console.log("[Socket] statsRefresh received — pulling fresh data");
        fetchAll(userTokenRef.current, userIdRef.current);
      });

      // ── routeStarted — driver pressed Start Route ──────────────────────────
      socket.on("routeStarted", (data) => {
        console.log("[Passenger] routeStarted received — rideId:", data?.rideId, "polyline:", !!data?.encodedPolyline);
        // Immediately refresh so driver card + map appear
        fetchAll(userTokenRef.current, userIdRef.current);
        // Load polyline immediately if driver already generated it
        if (data?.encodedPolyline) {
          setEncodedPolyline(data.encodedPolyline);
          setUseLiveTripLocation(true);
        }
        // ✅ FIX: Store driver home so van starts at correct position
        if (data?.driverLat && data?.driverLng) {
          setDriverHomeCoord({ latitude: Number(data.driverLat), longitude: Number(data.driverLng) });
        }
        // Persist drop-off location from server payload
        if (data?.dropOffLocation) {
          setAssignedRoute(prev => prev ? {
            ...prev,
            dropOffLocation: data.dropOffLocation,
            destinationLat:  data.dropOffLocation.latitude  || prev.destinationLat,
            destinationLng:  data.dropOffLocation.longitude || prev.destinationLng,
            destination:     data.dropOffLocation.name      || prev.destination,
          } : prev);
        }
        // Update passenger coords from payload (server now sends full coords)
        if (Array.isArray(data?.passengers) && data.passengers.length > 0) {
          setAllPassengers(prev => {
            if (!prev?.length) return data.passengers;
            return prev.map(existing => {
              const updated = data.passengers.find(p =>
                p.passengerId?.toString() ===
                  (existing.passengerId?.toString() || existing._id?.toString())
              );
              return updated ? { ...existing, ...updated } : existing;
            });
          });
        }
        // Join the ride room immediately
        if (data?.rideId && socketRef.current?.connected) {
          socketRef.current.emit("joinRide",  { rideId: data.rideId, userId: userIdRef.current, role: "passenger" });
          socketRef.current.emit("joinTrip",  { tripId: data.rideId, userId: userIdRef.current });
          activeTripIdRef.current = data.rideId;
        }
      });

      // ── rideUpdated — generic state sync (includes polyline updates) ──────
      socket.on("rideUpdated", (data) => {
        // If a polyline is bundled in, apply it immediately without waiting for fetchAll
        if (data?.encodedPolyline) {
          setEncodedPolyline(data.encodedPolyline);
          setUseLiveTripLocation(true);
        }
        if (data?.dropOffLocation) {
          setAssignedRoute(prev => prev ? {
            ...prev,
            dropOffLocation: data.dropOffLocation,
            destinationLat:  data.dropOffLocation.latitude  || prev.destinationLat,
            destinationLng:  data.dropOffLocation.longitude || prev.destinationLng,
            destination:     data.dropOffLocation.name      || prev.destination,
          } : prev);
        }
        fetchAll(userTokenRef.current, userIdRef.current);
      });

      socket.on("disconnect", (reason) => {
        console.log("[Socket] Passenger disconnected:", reason);
        setUseLiveTripLocation(false);
      });

      socketRef.current = socket;
    } catch (e) {
      console.log("[Socket] socket.io-client not available:", e.message);
    }
  };

  // Re-join socket rooms when active trip changes
  useEffect(() => {
    if (!activeTripIdRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit("joinRide",  { rideId: activeTripIdRef.current, userId: userIdRef.current, role: "passenger" });
    socketRef.current.emit("joinTrip",  { tripId: activeTripIdRef.current, userId: userIdRef.current });
    if (userIdRef.current) socketRef.current.emit("joinUser", { userId: userIdRef.current });
    console.log("[Socket] Passenger joined trip room:", activeTripIdRef.current);
  }, [activeTripIdRef.current]); // eslint-disable-line

  // ── PASSENGER confirms boarding → emits socket event to driver ─────────────
  const handlePassengerConfirmBoarding = async () => {
    if (confirmingBoarding || boarded) return;
    setConfirmingBoarding(true);
    try {
      const myId   = userIdRef.current;
      const rideId = activeTripIdRef.current;
      const tok    = userTokenRef.current;

      // HTTP confirmation (persist to DB)
      if (rideId && tok) {
        await fetch(`${API_BASE_URL}/trips/${rideId}/passenger-confirm`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body:    JSON.stringify({ stopIndex: myStopIndex, passengerId: myId }),
        }).catch(() => {});
      }

      // Socket event — driver receives this immediately and resumes simulation
      if (socketRef.current?.connected && rideId) {
        socketRef.current.emit("passengerConfirmBoarding", {
          rideId, tripId: rideId,
          stopId:      boardingStopId || myId,
          passengerId: myId,
        });
      }

      setBoardingPending(false);
      setPassengerSaidYes(true);  // Show "Pending Confirmation" until driver confirms
      setShowBoardingModal(false);
      // Wait for "bothConfirmed" from server before setting boarded=true
    } catch (e) {
      Alert.alert("Error", "Could not confirm boarding. Please try again.");
    } finally {
      setConfirmingBoarding(false);
    }
  };

  // ── "I'm Not Going" handler ───────────────────────────────────────────────
  const handleNotGoing = async () => {
    if (notGoingLoading || notGoingDone) return;
    setNotGoingLoading(true);
    try {
      const tok     = userTokenRef.current;
      const routeId = assignedRoute?._id;
      const myId    = userIdRef.current;
      if (!tok || !routeId || !myId) throw new Error('Missing auth info');

      const res  = await fetch(
        `${API_BASE_URL}/routes/${routeId}/stops/${myId}/not-going`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` } }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed');

      setNotGoingOffenses(data.offenseCount || 0);
      setNotGoingDone(true);
      setShowNotGoingModal(false);
      setBoardingPending(false);
      setVanArrived(false);

      if (socketRef.current?.connected) {
        const rideId = activeTripIdRef.current;
        socketRef.current.emit('passengerNotGoing', {
          rideId, routeId,
          passengerId:  myId,
          penaltyAmount: data.penaltyAmount,
          offenseCount:  data.offenseCount,
        });
      }

      Alert.alert(
        '✅ Noted',
        data.penaltyAmount > 0
          ? `You have been marked as Not Going.\nA penalty of Rs. ${data.penaltyAmount} has been added to your account (Offense #${data.offenseCount}).`
          : 'You have been marked as Not Going. The driver has been notified.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not process. Please try again.');
    } finally {
      setNotGoingLoading(false);
    }
  };

  // ── Local simulation fallback (when no live GPS) ───────────────────────────
  // Simulation path: driverHome → stop1 → stop2 → ... → lastStop → destination
  const startPassengerSim = () => {
    clearInterval(simRef.current);
    const stops = buildStops();
    if (stops.length < 2) return;
    stopsRef.current   = stops;
    segRef.current     = 0;
    stepRef.current    = 0;
    alertedRef.current = false;
    setVanPos(stops[0].coordinate);

    // Figure out which segment index corresponds to MY stop
    // buildStops prepends driver-origin as index 0, so my actual stop
    // in the stops array is myStopIndex + 1 (if driverHomeCoord exists)
    const mySimIndex = (driverHomeCoord?.latitude && driverHomeCoord?.longitude)
      ? myStopIndex + 1   // +1 because driver-origin is at index 0
      : myStopIndex;

    simRef.current = setInterval(() => {
      const ss = stopsRef.current;
      if (!ss || ss.length < 2) { clearInterval(simRef.current); return; }

      let seg      = segRef.current;
      let progress = stepRef.current;
      const totalSegs = ss.length - 1;
      if (seg >= totalSegs) { clearInterval(simRef.current); return; }

      const segDistKm    = haversine(
        ss[seg].coordinate.latitude,     ss[seg].coordinate.longitude,
        ss[seg + 1].coordinate.latitude, ss[seg + 1].coordinate.longitude
      );
      const kmPerTick    = (SPEED_KMH * FRAME_MS) / 3600000;
      const stepFraction = segDistKm > 0 ? kmPerTick / segDistKm : 0.015;

      progress += stepFraction;

      if (progress >= 1) {
        progress = 0;
        seg      += 1;
        if (seg >= totalSegs) {
          clearInterval(simRef.current);
          segRef.current  = seg;
          stepRef.current = progress;
          return;
        }
        // When van arrives at MY stop segment (not boarded yet) → trigger boarding
        if (seg === mySimIndex && !boarded) {
          setVanArrived(true);
          clearInterval(simRef.current);
          segRef.current  = seg;
          stepRef.current = progress;
          return;
        }
      }

      const pos = lerp(ss[seg].coordinate, ss[seg + 1].coordinate, progress);
      setVanPos(pos);

      // ETA to MY stop
      if (mySimIndex >= 0 && mySimIndex < ss.length && seg < mySimIndex) {
        const myCoord = ss[mySimIndex].coordinate;
        const dist    = haversine(pos.latitude, pos.longitude, myCoord.latitude, myCoord.longitude);
        const eta     = Math.max(1, Math.round((dist / SPEED_KMH) * 60));
        setEtaToMe(eta);

        if (eta <= 10 && !alertedRef.current) {
          alertedRef.current = true;
          Alert.alert(
            "🚨 Van is 10 Minutes Away!",
            `Van will reach your stop in ~${eta} minute${eta === 1 ? "" : "s"}!\nGet ready at: ${ss[mySimIndex]?.name || "your stop"}`,
            [{ text: "Got it! I'm Ready! 👍" }]
          );
        }
      }

      segRef.current  = seg;
      stepRef.current = progress;
    }, FRAME_MS);
  };

  // buildStops: driver home → all passenger pickups → destination
  const buildStops = () => {
    const passengerStops = (allPassengers || []).map((p, i) => {
      const coord = resolvePassengerCoord(p, i);
      return {
        _id:           p._id?.toString() || `p-${i}`,
        name:          p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
        passengerName: p.passengerName || "Passenger",
        coordinate:    coord,
      };
    });

    // Resolve destination stop
    const destLat = assignedRoute?.dropOffLocation?.latitude
      || assignedRoute?.destinationLat
      || allPassengers?.[0]?.destinationLat
      || allPassengers?.[0]?.dropLat
      || null;
    const destLng = assignedRoute?.dropOffLocation?.longitude
      || assignedRoute?.destinationLng
      || allPassengers?.[0]?.destinationLng
      || allPassengers?.[0]?.dropLng
      || null;
    const destName = assignedRoute?.dropOffLocation?.name
      || assignedRoute?.destination
      || "Destination";

    const destStop = (destLat && destLng)
      ? [{ _id: "destination", name: destName, passengerName: "Destination", coordinate: { latitude: Number(destLat), longitude: Number(destLng) } }]
      : [];

    // Prepend driver's home as origin so van starts there
    if (driverHomeCoord?.latitude && driverHomeCoord?.longitude) {
      return [
        { _id: "driver-origin", name: "Driver Start", passengerName: "Driver", coordinate: driverHomeCoord },
        ...passengerStops,
        ...destStop,
      ];
    }
    return [...passengerStops, ...destStop];
  };

  // ── Auth & data ────────────────────────────────────────────────────────────
  const loadAuthData = async () => {
    try {
      const token    = await AsyncStorage.getItem("authToken");
      const storedId = await AsyncStorage.getItem("userId");
      const udStr    = await AsyncStorage.getItem("userData");
      if (!token || !storedId) { navigation.reset({ index:0, routes:[{ name:"Login" }] }); return; }
      userTokenRef.current = token;
      userIdRef.current    = storedId;
      if (udStr) {
        const ud = JSON.parse(udStr);
        setUserProfile(ud);
        setPickupPoint(ud.pickupPoint || ud.address || "");
      }
      await fetchAll(token, storedId);
    } catch (e) { console.error("loadAuthData:", e); }
  };

  const getHeaders = (tok) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tok || userTokenRef.current}`,
  });

  const fetchAll = async (tok, uid) => {
    await Promise.allSettled([
      fetchAssignedRoute(tok, uid),
      fetchActivePolls(tok, uid),
      fetchNotifications(tok, uid),
      fetchCurrentTrip(tok, uid),
    ]);
  };

  const fetchAssignedRoute = async (tok, uid) => {
    const t = tok || userTokenRef.current, id = uid || userIdRef.current;
    if (!t || !id) return;
    try {
      const res    = await fetch(`${API_BASE_URL}/routes?passengerId=${id}`, { headers: getHeaders(t) });
      const data   = await res.json();
      const routes = data.routes || data.data || [];
      const route  = routes.find(r => ["assigned","in_progress","active"].includes(r.status));
      if (route) {
        setAssignedRoute(route);

        // Get polyline from DB if driver has already generated it
        if (route.encodedPolyline && !encodedPolyline) {
          setEncodedPolyline(route.encodedPolyline);
        }

        const passengers = route.passengers || [];
        setAllPassengers(passengers);
        setTotalPassengers(passengers.length);

        // Store driver's home so van starts there, not at stop 1
        const drvLat = route.driverLat ?? route.assignedDriverLat ?? null;
        const drvLng = route.driverLng ?? route.assignedDriverLng ?? null;
        if (drvLat && drvLng) {
          setDriverHomeCoord({ latitude: Number(drvLat), longitude: Number(drvLng) });
        }

        const myIdx   = passengers.findIndex(p =>
          (p.passengerId?.toString() || p._id?.toString()) === id
        );
        setMyStopIndex(myIdx);
        const myEntry = myIdx >= 0 ? passengers[myIdx] : null;
        setMyPassengerEntry(myEntry || null);

        if (myEntry?.status === "picked") {
          setBoarded(true);
          setVanArrived(false);
          setBoardingPending(false);
          clearInterval(simRef.current);
          AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});
        }

        const before = myIdx >= 0 ? passengers.slice(0, myIdx) : [];
        setPickedBeforeMe(before.filter(p => p.status === "picked").length);
        setIsNextPickup(
          route.status === "in_progress" &&
          before.filter(p => p.status !== "picked").length === 0 &&
          myEntry?.status !== "picked" && myIdx >= 0
        );

        stopsRef.current = (passengers || []).map((p, i) => ({
          _id:        p._id?.toString() || `p-${i}`,
          name:       p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
          coordinate: resolvePassengerCoord(p, i),
        }));

        const drv = route.assignedDriver;
        if (drv && typeof drv === "object" && drv.name) {
          // Populated object — use directly
          setRouteDriver(drv);
          setDriverInfo({
            name:          drv.name          || "Driver",
            rating:        drv.rating        || 4.8,
            vehicleNumber: drv.vehicleNo     || drv.vehicleNumber || "N/A",
            vehicleModel:  drv.vehicleType   || drv.vehicleModel  || "Van",
            latitude:      drv.latitude      || drv.location?.coordinates?.[1] || null,
            longitude:     drv.longitude     || drv.location?.coordinates?.[0] || null,
          });
        } else if (route.driverName) {
          // Fallback: driverName is a plain string stored on route
          setRouteDriver({ _id: route.assignedDriver, name: route.driverName });
          setDriverInfo({
            name:          route.driverName,
            rating:        4.8,
            vehicleNumber: route.vehicleNumber || route.vehicleNo || "N/A",
            vehicleModel:  route.vehicleType   || "Van",
            latitude:      null,
            longitude:     null,
          });
        }
      } else {
        setAssignedRoute(prev => {
          if (prev && prev.status === "in_progress") {
            setTripCompleted(true);
            setTimeout(() => setTripCompleted(false), 8000);
          }
          return null;
        });
        setMyPassengerEntry(null);
        setIsNextPickup(false);
        setVanPos(null);
      }
    } catch (e) { console.error("fetchAssignedRoute:", e); }
  };

  const fetchActivePolls = async (tok, uid) => {
    const t = tok || userTokenRef.current, id = uid || userIdRef.current;
    if (!t || !id) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/polls/active`, { headers: getHeaders(t) });
      const data = await res.json();
      if (data.success && data.polls?.length > 0) {
        setActivePolls(data.polls);
        const unanswered = data.polls.filter(poll => {
          if (poll.status !== "active") return false;
          if (shownPollIds.current.has(poll._id?.toString())) return false;
          return !poll.responses?.find(r => {
            const rid = r.passengerId?._id?.toString() || r.passengerId?.toString() || r.passengerId;
            return rid === id;
          });
        });
        if (unanswered.length > 0 && !showPollModal) {
          const poll = unanswered[0];
          shownPollIds.current.add(poll._id?.toString());
          setSelectedPoll(poll);
          setLoadingResponse("");
          setShowPollModal(true);
          animateAlert(pollSlideAnim, pollPulseAnim);
        }
      } else { setActivePolls([]); }
    } catch {}
  };

  const fetchNotifications = async (tok, uid) => {
    const t = tok || userTokenRef.current, id = uid || userIdRef.current;
    if (!t || !id) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/notifications`, { headers: getHeaders(t) });
      const data = await res.json();
      if (data.success) {
        const n = data.notifications || data.data || [];
        setNotifications(n);
        setUnreadCount(n.filter(x => !x.read).length);
      }
    } catch {}
  };

  const fetchCurrentTrip = async (tok, uid) => {
    const t = tok || userTokenRef.current, id = uid || userIdRef.current;
    if (!t || !id) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/trips`, { headers: getHeaders(t) });
      const data = await res.json();
      if (data.success && data.trips?.length > 0) {
        const myTrips = data.trips.filter(trip =>
          trip.passengers?.some(p => {
            const pId = p._id?._id?.toString() || p._id?.toString() || p._id;
            return pId === id;
          })
        );
        const active = myTrips.find(tr => ["Scheduled","En Route","Ready","ongoing","active"].includes(tr.status));
        if (active) {
          const tripId = active._id?.toString();
          if (tripId && activeTripIdRef.current !== tripId) {
            activeTripIdRef.current = tripId;
            if (socketRef.current?.connected) {
              socketRef.current.emit("joinRide",  { rideId: tripId, userId: userIdRef.current, role: "passenger" });
              socketRef.current.emit("joinTrip",  { tripId, userId: userIdRef.current });
              if (userIdRef.current) socketRef.current.emit("joinUser", { userId: userIdRef.current });
              console.log("[Socket] Passenger joined trip room:", tripId);
            }
          }
          // Get trip polyline too
          if (active.encodedPolyline && !encodedPolyline) {
            setEncodedPolyline(active.encodedPolyline);
          }
          const lat = active.currentLocation?.latitude;
          const lng = active.currentLocation?.longitude;
          if (lat != null && lng != null) {
            setVanPos({ latitude: Number(lat), longitude: Number(lng) });
            setUseLiveTripLocation(true);
          } else {
            setUseLiveTripLocation(false);
          }
          const myP = active.passengers?.find(p => {
            const pId = p._id?._id?.toString() || p._id?.toString() || p._id;
            return pId === id;
          });
          if (active.status === "Ready" && !myP?.confirmedMorning && !showMorningConf) {
            setShowMorningConf(true);
            setMorningTrip(active);
            animateAlert(morningSlideAnim, morningPulseAnim);
          }
        }
      } else {
        setUseLiveTripLocation(false);
      }
    } catch {}
  };

  // ── Board Van (manual UI button fallback) ─────────────────────────────────
  const handleBoardVan = async () => {
    if (!assignedRoute || !myPassengerEntry) return;
    try {
      setMarkingBoard(true);
      const stopId = myPassengerEntry._id;
      const res = await fetch(
        `${API_BASE_URL}/routes/${assignedRoute._id}/stops/${stopId}/status`,
        { method:"PUT", headers:getHeaders(), body:JSON.stringify({ status:"picked" }) }
      );
      const data = await res.json();
      if (data.success) {
        setBoarded(true);
        setVanArrived(false);
        setBoardingPending(false);
        clearInterval(simRef.current);
        AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});
        // Emit passengerBoarded to unblock driver simulation
        if (socketRef.current?.connected && activeTripIdRef.current) {
          socketRef.current.emit("passengerBoarded", {
            tripId:      activeTripIdRef.current,
            passengerId: userIdRef.current,
            status:      "picked",
          });
        }
        Alert.alert("✅ Boarded!", "You're on the vehicle. Enjoy your ride!", [{ text:"OK" }]);
        await fetchAssignedRoute(userTokenRef.current, userIdRef.current);
      } else {
        Alert.alert("Error", data.message || "Could not mark as boarded.");
      }
    } catch { Alert.alert("Error", "Connection failed."); }
    finally { setMarkingBoard(false); }
  };

  // ── Poll response ──────────────────────────────────────────────────────────
  const submitPollResponse = async (responseValue) => {
    if (!selectedPoll || !responseValue || loadingResponse) return;
    try {
      setLoadingResponse(responseValue);
      const up   = userProfile;
      const body = {
        response: responseValue, selectedTimeSlot: null,
        pickupPoint: up?.pickupPoint || pickupPoint || null,
        pickupLat: up?.latitude || null, pickupLng: up?.longitude || null,
        destination: up?.destination || null, dropLat: up?.destinationLatitude || null,
        dropLng: up?.destinationLongitude || null, vehiclePreference: up?.vehiclePreference || null,
      };
      const res  = await fetch(`${API_BASE_URL}/polls/${selectedPoll._id}/respond`, { method:"POST", headers:getHeaders(), body:JSON.stringify(body) });
      const data = await res.json();
      if (data.success) {
        setShowPollModal(false); setSelectedPoll(null); setLoadingResponse("");
        dismissAlert(pollSlideAnim, pollPulseAnim);
        Alert.alert("Response Submitted ✅", responseValue === "yes" ? "You've confirmed travel." : "Confirmed — not traveling.", [{ text:"OK" }]);
        await fetchActivePolls(userTokenRef.current, userIdRef.current);
      } else { Alert.alert("Error", data.message || "Could not submit."); }
    } catch { Alert.alert("Error", "Connection failed."); }
    finally { setLoadingResponse(""); }
  };

  const submitMorningConf = async (willTravel) => {
    if (!morningTrip) return;
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/trips/${morningTrip._id}/confirm-passenger`, { method:"POST", headers:getHeaders(), body:JSON.stringify({ traveling:willTravel }) });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Confirmed ✅", willTravel ? "Driver notified." : "Confirmed — not traveling today.", [{
          text:"OK", onPress: () => {
            setShowMorningConf(false);
            setMorningTrip(null);
            dismissAlert(morningSlideAnim, morningPulseAnim);
          }
        }]);
      }
    } catch { Alert.alert("Error", "Failed. Try again."); }
    finally { setLoading(false); }
  };

  const markNotifRead = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method:"PUT", headers:getHeaders() });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read:true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const animateAlert  = (sl, pl) => { sl.setValue(-200); Animated.parallel([Animated.timing(sl, { toValue:0, duration:500, useNativeDriver:true }), Animated.loop(Animated.sequence([Animated.timing(pl, { toValue:1.02, duration:1200, useNativeDriver:true }), Animated.timing(pl, { toValue:1, duration:1200, useNativeDriver:true })]))]).start(); };
  const dismissAlert  = (sl, pl) => { pl.stopAnimation(); Animated.timing(sl, { toValue:-200, duration:300, useNativeDriver:true }).start(); };

  const blinkOpacity   = blinkAnim.interpolate({ inputRange:[0,1], outputRange:[0.6,1] });
  const cardTranslateY = cardAnim.interpolate({ inputRange:[0,1], outputRange:[50,0] });

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll(userTokenRef.current, userIdRef.current);
    setRefreshing(false);
  };

  const chatPollRef = useRef(null);

  const fetchChatMessages = async (driverId) => {
    if (!driverId) return;
    try {
      const tok  = userTokenRef.current;
      const myId = userIdRef.current;
      const res  = await fetch(`${API_BASE_URL}/messages/${driverId}`, { headers: getHeaders(tok) });
      const data = await res.json();
      if (data.success) {
        const msgs = (data.messages || []).map(m => ({
          _id:          m._id,
          text:         m.text,
          fromDriver:   m.senderId?.toString() !== myId?.toString(),
          fromMe:       m.senderId?.toString() === myId?.toString(),
          isQuickReply: m.isQuickReply || false,
          time: new Date(m.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }),
        }));
        setChatMessages(msgs);
        const myTyped = (data.messages || []).filter(
          m => m.senderId?.toString() === myId?.toString() && m.messageType === "typed"
        ).length;
        setTypedCount(myTyped);
        fetch(`${API_BASE_URL}/messages/${driverId}/read`, {
          method: "PUT", headers: getHeaders(tok),
        }).catch(() => {});
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) { console.warn("fetchChatMessages:", e); }
  };

  const openChatWithDriver = async () => {
    const driverId = routeDriver?._id;
    if (!driverId) { Alert.alert("No Driver", "Driver not assigned yet."); return; }
    if (assignedRoute?.status !== "in_progress") {
      Alert.alert("Chat Unavailable", "Chat is only available when the driver has started the route."); return;
    }
    setChatMessages([]);
    setTypedCount(0);
    setUnreadChatCount(0);
    setChatVisible(true);
    await fetchChatMessages(driverId);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => fetchChatMessages(driverId), 4000);
  };

  const closeChatWithDriver = () => {
    setChatVisible(false);
    setUnreadChatCount(0);
    if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null; }
  };

  const sendMessage = async (text, messageType = "typed") => {
    const msgText = text || inputText;
    if (!msgText?.trim()) return;
    const driverId = routeDriver?._id;
    if (!driverId) { Alert.alert("Error", "No driver assigned."); return; }
    if (chatSending) return;

    const myId  = userIdRef.current;
    const tempId = `tmp_${Date.now()}`;
    const tempMsg = {
      _id: tempId, text: msgText.trim(), fromDriver: false, fromMe: true,
      isQuickReply: messageType === "quick_reply",
      time: new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }),
    };
    setChatMessages(prev => [...prev, tempMsg]);
    if (messageType === "typed") setTypedCount(prev => prev + 1);
    setInputText("");
    setChatSending(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: "POST",
        headers: getHeaders(userTokenRef.current),
        body: JSON.stringify({
          receiverId: driverId,
          text: msgText.trim(),
          messageType,
          routeId: assignedRoute?._id || null,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        const real = data.message;
        setChatMessages(prev => prev.map(m => m._id === tempId ? {
          _id: real._id, text: real.text, fromDriver: false, fromMe: true,
          isQuickReply: real.isQuickReply || false,
          time: new Date(real.createdAt).toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }),
        } : m));
      } else {
        setChatMessages(prev => prev.filter(m => m._id !== tempId));
        if (messageType === "typed") setTypedCount(prev => Math.max(0, prev - 1));
        if (data.code === "TYPED_LIMIT_REACHED") {
          Alert.alert("Limit Reached", "You have used all 3 typed messages. Use quick replies.");
        } else {
          Alert.alert("Error", data.message || "Could not send message.");
        }
      }
    } catch {
      setChatMessages(prev => prev.filter(m => m._id !== tempId));
      if (messageType === "typed") setTypedCount(prev => Math.max(0, prev - 1));
      Alert.alert("Error", "Network error. Could not send.");
    } finally {
      setChatSending(false);
    }
  };

  const getRouteStatusInfo = () => {
    if (!assignedRoute) return { label:"No Route Assigned", color:"#999", icon:"information-circle-outline", bg:"#f5f5f5" };
    const s = (assignedRoute.status || "").toLowerCase();
    if (s === "assigned") return { label:"Route Assigned — Waiting to Start", color:"#5C35A0", icon:"time-outline", bg:"#EDE7F6" };
    if (s === "in_progress") {
      if (boarded || myPassengerEntry?.status === "picked") return { label:"You're On Board! 🎉", color:C.main, icon:"checkmark-circle", bg:C.light };
      if (vanArrived || boardingPending) return { label:"Van Has Arrived! Board Now!", color:"#B91C1C", icon:"navigate", bg:"#FFEBEE" };
      if (isNextPickup) return { label:"Van is Coming For You!", color:"#C62828", icon:"navigate", bg:"#FFEBEE" };
      return { label:"Van En Route — Picking Up", color:C.info, icon:"car", bg:C.infoBg };
    }
    if (s === "completed") return { label:"Trip Completed ✅", color:C.main, icon:"checkmark-done-circle", bg:C.light };
    return { label:"Scheduled", color:"#7A5C00", icon:"calendar-outline", bg:C.warnBg };
  };

  // ── Map data (memoized) ────────────────────────────────────────────────────
  const mapStops = useMemo(() => {
    return (allPassengers || []).map((p, i) => ({
      _id:           p._id?.toString() || `p-${i}`,
      name:          p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
      passengerName: p.passengerName || "Passenger",
      coordinate:    resolvePassengerCoord(p, i),
      status:        p.status || "pending",
      isMe:          (p.passengerId?.toString() || p._id?.toString()) === userIdRef.current,
    }));
  }, [allPassengers]);

  const dropStops = useMemo(() => {
    return (allPassengers || []).map((p, i) => {
      const coord = resolveDropCoord(p);
      if (!coord) return null;
      return {
        key:          `drop-${i}`,
        coordinate:   coord,
        passengerName: p.passengerName || p.name || `Passenger ${i + 1}`,
        destination:  resolveDestinationName(p),   // ← FIX: place name not passenger name
        isMyDrop:     i === myStopIndex,
      };
    }).filter(Boolean);
  }, [allPassengers, myStopIndex]);

  // Polyline for map: prefer Google encoded polyline, else straight-line fallback
  const mapPolylineCoords = useMemo(() => {
    if (polylineCoords.length > 1) return polylineCoords;
    const picks = mapStops.map(s => s.coordinate);
    const drops = dropStops.map(d => d.coordinate);
    return [...(vanPos ? [vanPos] : []), ...picks, ...drops];
  }, [polylineCoords, mapStops, dropStops, vanPos]);

  // ── LIVE MAP ───────────────────────────────────────────────────────────────
  const renderLiveMap = () => {
    if (!assignedRoute || assignedRoute.status !== "in_progress") return null;

    const vanCoord = vanPos || driverHomeCoord || null;
    const allCoords = [
      ...mapStops.map(s => s.coordinate),
      ...dropStops.map(d => d.coordinate),
      ...(vanCoord ? [vanCoord] : []),
    ];
    const initialRegion = vanCoord
      ? { latitude:vanCoord.latitude, longitude:vanCoord.longitude, latitudeDelta:0.04, longitudeDelta:0.04 }
      : fitRegion(allCoords);

    return (
      <Animated.View style={{ transform:[{ translateY:cardTranslateY }], marginBottom:14 }}>
        <View style={ds.card}>
          <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.cardHeader}>
            <Icon name="map" size={18} color="#fff" />
            <Text style={ds.cardHeaderTxt}>Live Van Location</Text>
            <View style={ds.liveChip}>
              <View style={ds.liveDot} />
              <Text style={ds.liveTxt}>{useLiveTripLocation ? "GPS LIVE" : "SIM"}</Text>
            </View>
            {encodedPolyline && (
              <View style={[ds.liveChip, { backgroundColor:"rgba(37,99,235,0.3)", marginLeft:4 }]}>
                <Icon name="navigate" size={9} color="#93C5FD" style={{ marginRight:3 }} />
                <Text style={[ds.liveTxt, { color:"#93C5FD" }]}>ROUTE</Text>
              </View>
            )}
          </LinearGradient>

          <View style={{ height:260, overflow:"hidden", borderBottomLeftRadius:16, borderBottomRightRadius:16 }}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={{ flex:1 }}
              initialRegion={initialRegion}
              showsUserLocation={false}
              showsTraffic={false}
              showsBuildings={true}
              showsCompass={true}
              mapType="standard"
            >
              {/* ── Route polyline — encoded (from driver) or straight-line fallback ── */}
              {mapPolylineCoords.length > 1 && (
                <Polyline
                  coordinates={mapPolylineCoords}
                  strokeColor={C.main}
                  strokeWidth={encodedPolyline ? 4 : 5}
                />
              )}

              {/* ── Drop-off pins with DESTINATION NAME fix ── */}
              {dropStops.map(drop => (
                <Marker
                  key={drop.key}
                  coordinate={drop.coordinate}
                  anchor={{ x:0.5, y:1 }}
                  title={drop.destination}          // ← destination name (not passenger name)
                  description={drop.passengerName}  // ← passenger name in description
                  zIndex={drop.isMyDrop ? 15 : 2}
                >
                  <View style={{ alignItems:"center" }}>
                    <View style={[ds.destPin, { backgroundColor: drop.isMyDrop ? "#DC2626" : "#EF4444" }]}>
                      <Icon name="flag" size={14} color="#fff" />
                    </View>
                    {drop.isMyDrop && (
                      <View style={{ backgroundColor:"#DC2626", paddingHorizontal:5, paddingVertical:2, borderRadius:4, marginTop:2 }}>
                        <Text style={{ color:"#fff", fontSize:8, fontWeight:"900" }}>YOUR DROP</Text>
                      </View>
                    )}
                  </View>
                </Marker>
              ))}

              {/* ── Numbered stop markers for ALL passengers ── */}
              {mapStops.map((st, i) => {
                const isMyStop = i === myStopIndex;
                const bg = isMyStop ? C.amber : stopBg(allPassengers[i]?.status || "pending");
                return (
                  <Marker
                    key={st._id}
                    coordinate={st.coordinate}
                    anchor={{ x:0.5, y:0.5 }}
                    title={st.passengerName}
                    description={`Stop ${i + 1}: ${st.name}`}
                    zIndex={isMyStop ? 10 : 1}
                  >
                    <View style={{ alignItems:"center" }}>
                      {isMyStop ? (
                        <View style={{ alignItems:"center" }}>
                          <View style={{ backgroundColor:C.amber, paddingHorizontal:8, paddingVertical:4, borderRadius:8, borderWidth:2, borderColor:"#fff" }}>
                            <Text style={{ color:"#fff", fontWeight:"900", fontSize:11 }}>YOU</Text>
                          </View>
                          <View style={{ width:0, height:0, borderLeftWidth:6, borderRightWidth:6, borderTopWidth:6, borderLeftColor:"transparent", borderRightColor:"transparent", borderTopColor:C.amber }} />
                        </View>
                      ) : (
                        <View style={[ds.stopPin, { backgroundColor:bg }]}>
                          <Text style={{ color:"#fff", fontWeight:"900", fontSize:10 }}>{i + 1}</Text>
                        </View>
                      )}
                    </View>
                  </Marker>
                );
              })}

              {/* ── Smooth animated van marker ── */}
              {vanCoord && (() => {
                const animCoord = { latitude: latAnim, longitude: lngAnim };
                return (
                  <Marker.Animated
                    coordinate={animCoord}
                    anchor={{ x:0.5, y:0.5 }}
                    title="Van"
                    description={driverInfo.name}
                    zIndex={20}
                  >
                    <Animated.View style={{ transform:[{ scale:vanPulse }] }}>
                      <View style={ds.vanMarker}>
                        <Icon name="bus" size={18} color="#fff" />
                      </View>
                    </Animated.View>
                  </Marker.Animated>
                );
              })()}
            </MapView>
          </View>

          {/* ETA bar */}
          <View style={ds.etaBar}>
            <Icon name="hourglass-outline" size={15} color={etaToMe && etaToMe <= 10 ? "#EF4444" : C.amber} />
            <Text style={[ds.etaBarTxt, etaToMe && etaToMe <= 10 && { color:"#EF4444", fontWeight:"800" }]}>
              {(boarded || myPassengerEntry?.status === "picked")
                ? "✅ You're on board!"
                : (vanArrived || boardingPending)
                ? "🚐 Van is HERE — Board Now!"
                : etaToMe
                ? `Van arrives at your stop in ~${etaToMe} min${etaToMe <= 10 ? " ⚠️" : ""}`
                : "Calculating your ETA…"}
            </Text>
          </View>

          {/* Board button — appears when van has arrived and passenger hasn't confirmed yet */}
          {(boardingPending && !boarded && myPassengerEntry?.status !== "picked") && (
            <Animated.View style={{ transform:[{ scale:boardingPulse }] }}>
              <TouchableOpacity
                style={{ backgroundColor:C.main, margin:12, borderRadius:14, paddingVertical:14, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8 }}
                onPress={handlePassengerConfirmBoarding}
                disabled={confirmingBoarding}
              >
                {confirmingBoarding
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Icon name="checkmark-circle" size={22} color="#fff" />
                      <Text style={{ color:"#fff", fontWeight:"900", fontSize:16 }}>I'm On Board! ✅</Text>
                    </>
                }
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    );
  };

  // ── Active route banner ────────────────────────────────────────────────────
  const renderActiveRouteBanner = () => {
    if (!assignedRoute || assignedRoute.status !== "in_progress") return null;
    if (boarded || myPassengerEntry?.status === "picked") return null;

    // Show GOING_TO_DESTINATION banner if applicable
    if (rideState === "GOING_TO_DESTINATION") {
      return (
        <View style={ds.goingDestBanner}>
          <Icon name="navigate" size={18} color="#fff" />
          <View style={{ flex:1, marginLeft:10 }}>
            <Text style={ds.goingDestTitle}>All passengers on board!</Text>
            <Text style={ds.goingDestSub}>Heading to {finalDestName || "final destination"}…</Text>
          </View>
        </View>
      );
    }

    const isUrgent = vanArrived || boardingPending || isNextPickup;
    return (
      <Animated.View style={{ transform:[{ scale:nextPickupPulse }], marginHorizontal:16, marginBottom:10 }}>
        <LinearGradient
          colors={isUrgent ? ["#3A1A1A","#5A2020"] : [C.dark, C.deeper]}
          start={{ x:0,y:0 }} end={{ x:1,y:1 }}
          style={ds.activeBanner}
        >
          <View style={[ds.activeBannerIcon, { backgroundColor: isUrgent ? "rgba(232,120,120,0.2)" : "rgba(126,200,127,0.15)" }]}>
            <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
              <Icon name={isUrgent ? "navigate" : "car"} size={28} color={isUrgent ? C.urgentAccent : C.pollAccent} />
            </Animated.View>
          </View>
          <View style={{ flex:1, marginLeft:14 }}>
            <Text style={[ds.activeBannerTitle, { color: isUrgent ? C.urgentAccent : C.pollAccent }]}>
              {(vanArrived || boardingPending) ? "🚐 Van is HERE!" : isNextPickup ? "🚨 Van is Coming For You!" : "🚐 Van is En Route"}
            </Text>
            <Text style={ds.activeBannerSub}>
              {(vanArrived || boardingPending) ? "Board the van now!" : isNextPickup ? "Get ready at your stop!" : `${pickedBeforeMe} of ${totalPassengers} picked up`}
            </Text>
            {etaToMe && !(vanArrived || boardingPending) && (
              <View style={ds.etaPill}>
                <Icon name="hourglass-outline" size={11} color={etaToMe <= 10 ? "#EF4444" : C.warn} />
                <Text style={[ds.etaPillTxt, etaToMe <= 10 && { color:"#EF4444" }]}>ETA: ~{etaToMe} min{etaToMe <= 10 ? " ⚠️" : ""}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  // ── Route status card ──────────────────────────────────────────────────────
  const renderRouteStatusCard = () => {
    const si = getRouteStatusInfo();
    return (
      <Animated.View style={{ transform:[{ translateY:cardTranslateY }], marginBottom:14 }}>
        <View style={ds.card}>
          <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.cardHeader}>
            <Icon name="car" size={18} color="#fff" />
            <Text style={ds.cardHeaderTxt}>Today's Route</Text>
            {assignedRoute?.status === "in_progress" && (
              <View style={ds.liveChip}><View style={ds.liveDot} /><Text style={ds.liveTxt}>LIVE</Text></View>
            )}
          </LinearGradient>
          {assignedRoute ? (
            <View style={ds.cardBody}>
              <View style={[ds.statusPill, { backgroundColor:si.bg }]}>
                <Icon name={si.icon} size={14} color={si.color} />
                <Text style={[ds.statusPillTxt, { color:si.color }]}>{si.label}</Text>
              </View>
              <Text style={ds.routeName}>{assignedRoute.routeName || assignedRoute.name || "Route"}</Text>
              <View style={ds.infoGrid}>
                <View style={ds.infoItem}><Icon name="time-outline" size={15} color={C.main} /><Text style={ds.infoLabel}>Pickup</Text><Text style={ds.infoValue}>{assignedRoute.pickupTime || assignedRoute.timeSlot || "N/A"}</Text></View>
                <View style={ds.infoItem}><Icon name="people-outline" size={15} color={C.main} /><Text style={ds.infoLabel}>Passengers</Text><Text style={ds.infoValue}>{totalPassengers}</Text></View>
                {assignedRoute.estimatedKm && <View style={ds.infoItem}><Icon name="map-outline" size={15} color={C.main} /><Text style={ds.infoLabel}>Distance</Text><Text style={ds.infoValue}>{assignedRoute.estimatedKm}</Text></View>}
                {pickedBeforeMe > 0 && <View style={ds.infoItem}><Icon name="checkmark-done-outline" size={15} color={C.success} /><Text style={ds.infoLabel}>Picked</Text><Text style={[ds.infoValue, { color:C.success }]}>{pickedBeforeMe}/{totalPassengers}</Text></View>}
              </View>
              {(myPassengerEntry?.pickupPoint || myPassengerEntry?.pickupAddress) && (
                <View style={ds.pickupRow}>
                  <Icon name="location" size={15} color={C.amber} />
                  <Text style={ds.pickupLabel}>My Stop:</Text>
                  <Text style={ds.pickupValue} numberOfLines={1}>{myPassengerEntry.pickupPoint || myPassengerEntry.pickupAddress}</Text>
                </View>
              )}
              {assignedRoute.destination && (
                <View style={[ds.pickupRow, { backgroundColor:"#FEE2E2" }]}>
                  <Icon name="flag-outline" size={15} color="#DC2626" />
                  <Text style={[ds.pickupLabel, { color:"#DC2626" }]}>Destination:</Text>
                  <Text style={[ds.pickupValue, { color:"#DC2626" }]} numberOfLines={1}>{assignedRoute.destination}</Text>
                </View>
              )}
              {(boarded || myPassengerEntry?.status === "picked") && (
                <View style={[ds.statusRow, { backgroundColor:C.light }]}>
                  <Icon name="checkmark-circle" size={17} color={C.main} />
                  <Text style={[ds.statusRowTxt, { color:C.main }]}>You're on board ✅</Text>
                </View>
              )}
              {/* Board button in route card (manual fallback) */}
              {(vanArrived || boardingPending) && !boarded && myPassengerEntry?.status !== "picked" && (
                <Animated.View style={{ transform:[{ scale:boardingPulse }] }}>
                  <TouchableOpacity
                    style={{ backgroundColor:C.main, borderRadius:12, paddingVertical:13, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8, marginTop:10 }}
                    onPress={handlePassengerConfirmBoarding}
                    disabled={confirmingBoarding}
                  >
                    {confirmingBoarding
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <><Icon name="checkmark-circle" size={20} color="#fff" /><Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>I'm On Board!</Text></>
                    }
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          ) : (
            <View style={ds.cardBody}>
              <View style={[ds.statusPill, { backgroundColor:"#f5f5f5" }]}>
                <Icon name="information-circle-outline" size={14} color="#999" />
                <Text style={[ds.statusPillTxt, { color:"#999" }]}>No route assigned for today</Text>
              </View>
              <Text style={ds.noRouteTxt}>Your transporter hasn't assigned a route yet.</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  // ── Driver & Route Info Card ───────────────────────────────────────────────
  const renderDriverCard = () => {
    const hasDriver = assignedRoute && routeDriver;
    const myPickup  = myPassengerEntry?.pickupPoint || myPassengerEntry?.pickupAddress || assignedRoute?.pickupPoint || "—";
    const myDropoff = resolveDestinationName(myPassengerEntry || assignedRoute || {});

    return (
      <Animated.View style={{ transform:[{ translateY:cardTranslateY }], marginBottom:14 }}>
        <View style={ds.card}>
          {/* ── Card Header ── */}
          <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.cardHeader}>
            <Icon name="person" size={18} color="#fff" />
            <Text style={ds.cardHeaderTxt}>Your Driver & Trip Info</Text>
            {hasDriver && (
              <View style={[ds.liveChip, { backgroundColor:"rgba(165,214,167,0.2)" }]}>
                <View style={[ds.liveDot, { backgroundColor:"#A5D6A7" }]} />
                <Text style={[ds.liveTxt, { color:"#A5D6A7" }]}>
                  {assignedRoute.status === "in_progress" ? "ACTIVE" : "ASSIGNED"}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* ── Driver assignment status ── */}
          {hasDriver ? (
            <>
              {/* Driver Info Row */}
              <View style={ds.driverBox}>
                <LinearGradient colors={[C.main, C.dark]} style={ds.driverAvatar}>
                  <Text style={ds.driverAvatarTxt}>{getInitials(driverInfo.name)}</Text>
                </LinearGradient>
                <View style={{ flex:1, marginLeft:14 }}>
                  <Text style={ds.driverName}>{driverInfo.name}</Text>
                  <Text style={{ fontSize:11, color:"#888", marginBottom:3 }}>
                    ID: {routeDriver._id?.toString().slice(-6).toUpperCase() || "—"}
                  </Text>
                  <View style={ds.ratingRow}>
                    {[1,2,3,4,5].map(star => (
                      <Icon key={star} name={star <= Math.round(driverInfo.rating) ? "star" : "star-outline"} size={13} color="#FFD700" />
                    ))}
                    <Text style={ds.ratingTxt}> {driverInfo.rating}</Text>
                  </View>
                  <View style={ds.vehicleRow}>
                    <Icon name="car-sport-outline" size={13} color="#666" />
                    <Text style={ds.vehicleTxt}>{driverInfo.vehicleModel}</Text>
                    {driverInfo.vehicleNumber !== "N/A" && (
                      <View style={ds.plateBadge}>
                        <Text style={ds.plateTxt}>{driverInfo.vehicleNumber}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {/* Chat button — shown only during active ride */}
                <View style={ds.driverActions}>
                  {assignedRoute?.status === "in_progress" && (
                    <TouchableOpacity
                      style={[ds.actionBtn, { position:"relative" }]}
                      onPress={openChatWithDriver}
                    >
                      <Icon name="chatbubble-ellipses" size={19} color={C.main} />
                      {unreadChatCount > 0 && (
                        <View style={ds.chatRedDot}>
                          <Text style={ds.chatRedDotTxt}>
                            {unreadChatCount > 9 ? "9+" : unreadChatCount}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* ── Pickup / Drop-off info card ── */}
              <View style={{ paddingHorizontal:14, paddingBottom:12 }}>
                {/* Pickup location row */}
                <View style={ds.tripInfoRow}>
                  <View style={[ds.tripDot, { backgroundColor: C.amber }]} />
                  <View style={{ flex:1 }}>
                    <Text style={ds.tripInfoLabel}>Pickup Location</Text>
                    <Text style={ds.tripInfoValue} numberOfLines={2}>{myPickup}</Text>
                  </View>
                  <Icon name="location" size={16} color={C.amber} />
                </View>

                {/* Connector line */}
                <View style={{ marginLeft:6, width:2, height:12, backgroundColor:"#E0E0E0", marginVertical:2 }} />

                {/* Drop-off location row — highlighted */}
                <View style={[ds.tripInfoRow, { backgroundColor:"#FEE2E2", borderRadius:10, borderWidth:1, borderColor:"#FECACA" }]}>
                  <View style={[ds.tripDot, { backgroundColor:"#DC2626" }]} />
                  <View style={{ flex:1 }}>
                    <Text style={[ds.tripInfoLabel, { color:"#991B1B" }]}>Drop-off Location</Text>
                    <Text style={[ds.tripInfoValue, { color:"#DC2626", fontWeight:"800" }]} numberOfLines={2}>{myDropoff}</Text>
                  </View>
                  <Icon name="flag" size={16} color="#DC2626" />
                </View>
              </View>

              {/* Status chips bar */}
              <View style={ds.routeInfoBar}>
                <View style={ds.routeInfoChip}>
                  <Icon name="time-outline" size={13} color={C.main} />
                  <Text style={ds.routeInfoTxt}>{assignedRoute.pickupTime || assignedRoute.timeSlot || "N/A"}</Text>
                </View>
                {assignedRoute.vehicleType && (
                  <View style={ds.routeInfoChip}>
                    <Icon name="bus-outline" size={13} color={C.main} />
                    <Text style={ds.routeInfoTxt}>{assignedRoute.vehicleType}</Text>
                  </View>
                )}
                <View style={[ds.routeInfoChip, { backgroundColor: assignedRoute.status === "in_progress" ? C.light : C.warnBg }]}>
                  <View style={[ds.liveDot, { backgroundColor: assignedRoute.status === "in_progress" ? C.main : C.amber, width:6, height:6 }]} />
                  <Text style={[ds.routeInfoTxt, { color: assignedRoute.status === "in_progress" ? C.main : "#7A5C00", fontWeight:"700" }]}>
                    {assignedRoute.status === "in_progress" ? "Active" : "Scheduled"}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={ds.cardBody}>
              {/* ── "No Driver Assigned" with clear status ── */}
              <View style={{ alignItems:"center", paddingVertical:10 }}>
                <View style={{ width:52, height:52, borderRadius:26, backgroundColor:"#F3F4F6", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
                  <Icon name="person-outline" size={26} color="#9CA3AF" />
                </View>
                <Text style={{ fontSize:15, fontWeight:"800", color:"#374151", marginBottom:4 }}>
                  {assignedRoute ? "No Driver Assigned Yet" : "No Route Assigned"}
                </Text>
                <Text style={ds.noRouteTxt}>
                  {assignedRoute
                    ? "Your transporter is in the process of assigning a driver to your route."
                    : "Your transporter hasn't assigned a route yet. Check back soon."}
                </Text>
                {assignedRoute && (
                  <View style={[ds.statusPill, { backgroundColor:"#FEF3C7", marginTop:10, alignSelf:"center" }]}>
                    <Icon name="time-outline" size={13} color="#B45309" />
                    <Text style={[ds.statusPillTxt, { color:"#B45309" }]}>Pending Driver Assignment</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <View style={ds.container}>
      <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={ds.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Icon name="menu" size={27} color="#fff" />
        </TouchableOpacity>
        <Text style={ds.headerTitle}>Dashboard</Text>
        <TouchableOpacity style={ds.notifWrap} onPress={() => navigation.navigate("Notifications")}>
          <Icon name="notifications" size={25} color="#fff" />
          {(unreadCount > 0 || showPollModal || showMorningConf || isNextPickup || vanArrived || boardingPending) && (
            <Animated.View style={[ds.blinkDot, { opacity:blinkOpacity }]} />
          )}
          {unreadCount > 0 && (
            <View style={ds.badge}>
              <Text style={ds.badgeTxt}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={ds.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.main]} tintColor={C.main} />}
      >
        <View style={{ height:14 }} />

        {/* ── BOARDING: Pending Confirmation (after passenger said YES) ── */}
        {passengerSaidYes && !boarded && (
          <View style={[ds.boardingBanner, { backgroundColor:"#1D4ED8", flexDirection:"column", alignItems:"stretch" }]}>
            <View style={{ flexDirection:"row", alignItems:"center", marginBottom:10 }}>
              <View style={ds.boardingIconWrap}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={ds.boardingBannerTitle}>⏳ Pending Confirmation</Text>
                <Text style={ds.boardingBannerSub}>Waiting for driver to confirm your boarding…</Text>
              </View>
            </View>
            <View style={{ backgroundColor:"rgba(255,255,255,0.15)", borderRadius:10, padding:10 }}>
              <Text style={{ color:"rgba(255,255,255,0.9)", fontSize:12, textAlign:"center" }}>
                Your "I'm on board" signal has been sent to the driver. The ride will start once the driver confirms.
              </Text>
            </View>
          </View>
        )}

        {/* ── BOARDING: YES / NO confirmation banner (van has arrived) ── */}
        {boardingPending && !boarded && !passengerSaidYes && (
          <Animated.View style={[ds.boardingBanner, { transform:[{ scale:boardingPulse }], flexDirection:"column", alignItems:"stretch" }]}>
            <View style={{ flexDirection:"row", alignItems:"center", marginBottom:12 }}>
              <View style={ds.boardingIconWrap}>
                <Icon name="bus" size={24} color="#fff" />
              </View>
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={ds.boardingBannerTitle}>🚐 Van has arrived at your stop!</Text>
                <Text style={ds.boardingBannerSub}>
                  {boardingStopName ? `📍 ${boardingStopName}` : "Are you boarding the van?"}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection:"row", gap:10 }}>
              <TouchableOpacity
                style={{ flex:1, backgroundColor:"#415844", borderRadius:12, paddingVertical:13, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8 }}
                onPress={handlePassengerConfirmBoarding}
                disabled={confirmingBoarding}
                activeOpacity={0.85}
              >
                {confirmingBoarding
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Icon name="checkmark-circle" size={20} color="#fff" /><Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>YES, I'm On Board</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex:1, backgroundColor:"rgba(255,255,255,0.2)", borderRadius:12, paddingVertical:13, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8, borderWidth:1.5, borderColor:"rgba(255,255,255,0.5)" }}
                onPress={() => {
                  setBoardingPending(false);
                  setVanArrived(false);
                  AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});
                }}
                disabled={confirmingBoarding}
                activeOpacity={0.85}
              >
                <Icon name="close-circle" size={20} color="#fff" />
                <Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>NO, Not Yet</Text>
              </TouchableOpacity>
            </View>

            {/* ── I'm Not Going Button ── */}
            {!notGoingDone && (
              <TouchableOpacity
                style={{ marginTop:10, backgroundColor:"#DC2626", borderRadius:12, paddingVertical:12, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8 }}
                onPress={() => setShowNotGoingModal(true)}
                activeOpacity={0.85}
              >
                <Icon name="close-circle" size={20} color="#fff" />
                <Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>I'm NOT Going Today 🚫</Text>
              </TouchableOpacity>
            )}
            {notGoingDone && (
              <View style={{ marginTop:10, backgroundColor:"rgba(220,38,38,0.25)", borderRadius:12, paddingVertical:12, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8 }}>
                <Icon name="close-circle" size={20} color="#fca5a5" />
                <Text style={{ color:"#fca5a5", fontWeight:"900", fontSize:15 }}>Marked as Not Going ✓</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── GOING TO DESTINATION banner ── */}
        {rideState === "GOING_TO_DESTINATION" && (
          <View style={ds.goingDestBanner}>
            <Icon name="navigate" size={18} color="#fff" />
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={ds.goingDestTitle}>All passengers on board!</Text>
              <Text style={ds.goingDestSub}>Heading to {finalDestName || "final destination"}…</Text>
            </View>
          </View>
        )}

        {/* ── TRIP COMPLETED banner ── */}
        {tripCompleted && (
          <View style={[ds.boardingBanner, { backgroundColor:"#1A2B1C" }]}>
            <Icon name="flag" size={22} color="#fff" />
            <Text style={[ds.boardingBannerTitle, { marginLeft:10, flex:1 }]}>Trip completed! You have arrived. 🎉</Text>
          </View>
        )}

        {/* Poll alert */}
        {showPollModal && selectedPoll && (
          <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:pollSlideAnim },{ scale:pollPulseAnim }], marginTop:16, marginBottom:4 }}>
            <LinearGradient colors={["#415844","#7b807b"]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.alertBox}>
              <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
                <Icon name="help-circle" size={26} color="#fff" />
              </Animated.View>
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={ds.alertTitle}>{selectedPoll.title}</Text>
                <Text style={ds.alertText}>{selectedPoll.question || "Will you travel tomorrow?"}</Text>
                <View style={ds.alertBtns}>
                  <TouchableOpacity style={[ds.confirmBtn, { opacity:loadingResponse ? 0.65 : 1 }]} onPress={() => submitPollResponse("yes")} disabled={!!loadingResponse} activeOpacity={0.8}>
                    {loadingResponse === "yes" ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="checkmark-circle" size={16} color="#fff" /><Text style={ds.btnText}>Yes, I'll Travel</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[ds.cancelBtn, { opacity:loadingResponse ? 0.65 : 1 }]} onPress={() => submitPollResponse("no")} disabled={!!loadingResponse} activeOpacity={0.8}>
                    {loadingResponse === "no" ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="close-circle" size={16} color="#fff" /><Text style={ds.btnText}>No</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Morning confirmation */}
        {showMorningConf && morningTrip && (
          <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:morningSlideAnim },{ scale:morningPulseAnim }], marginTop:showPollModal ? 8 : 16, marginBottom:4 }}>
            <LinearGradient colors={["#415844","#7b807b"]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.alertBox}>
              <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
                <Icon name="bus" size={26} color="#fff" />
              </Animated.View>
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={ds.alertTitle}>Final Confirmation</Text>
                <Text style={ds.alertText}>Are you still traveling today? Van will start soon!</Text>
                <View style={ds.alertBtns}>
                  <TouchableOpacity style={ds.confirmBtn} onPress={() => submitMorningConf(true)} disabled={loading}>
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="checkmark-circle" size={16} color="#fff" /><Text style={ds.btnText}>Yes, Traveling</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={ds.cancelBtn} onPress={() => submitMorningConf(false)} disabled={loading}>
                    <Icon name="close-circle" size={16} color="#fff" /><Text style={ds.btnText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Unread notification alerts */}
        {notifications.filter(n => !n.read && ["route","confirmation","general","next_pickup","trip_started"].includes(n.type)).slice(0,2).map(n => (
          <Animated.View key={n._id} style={{ opacity:fadeAnim, transform:[{ translateY:cardTranslateY }], marginTop:8, marginBottom:4 }}>
            <LinearGradient
              colors={n.type === "next_pickup" ? ["#F44336","#C62828"] : ["#415844","#7b807b"]}
              start={{ x:0,y:0 }} end={{ x:1,y:1 }}
              style={ds.alertBox}
            >
              <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
                <Icon name={n.type === "next_pickup" ? "navigate" : "information-circle"} size={26} color="#fff" />
              </Animated.View>
              <View style={{ flex:1, marginLeft:12 }}>
                <Text style={ds.alertTitle}>{n.title}</Text>
                <Text style={ds.alertText}>{n.message}</Text>
                <View style={ds.alertBtns}>
                  <TouchableOpacity style={ds.confirmBtn} onPress={() => { markNotifRead(n._id); navigation.navigate("Notifications"); }}>
                    <Icon name="eye" size={16} color="#fff" /><Text style={ds.btnText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={ds.cancelBtn} onPress={() => markNotifRead(n._id)}>
                    <Icon name="close-circle" size={16} color="#fff" /><Text style={ds.btnText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        ))}

        <View style={{ paddingHorizontal:16 }}>
          {renderActiveRouteBanner()}
          {renderRouteStatusCard()}
          {renderLiveMap()}
          {renderDriverCard()}
        </View>
        <View style={{ height:30 }} />
      </ScrollView>

      {/* Chat modal — fully connected to backend */}
      <Modal visible={chatVisible} animationType="slide">
        <View style={ds.chatContainer}>
          {/* Header */}
          <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={ds.chatHeader}>
            <TouchableOpacity onPress={closeChatWithDriver} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={ds.chatAvatar}>
              <Text style={ds.chatAvatarTxt}>{getInitials(driverInfo.name)}</Text>
            </View>
            <View style={{ flex:1 }}>
              <Text style={ds.chatName}>{driverInfo.name}</Text>
              <Text style={ds.chatSub}>Driver</Text>
            </View>
          </LinearGradient>

          {/* Ride-active status banner */}
          {assignedRoute?.status !== "in_progress" ? (
            <View style={ds.chatBanner}>
              <Icon name="lock-closed-outline" size={14} color="#c0392b" />
              <Text style={[ds.chatBannerTxt, { color:"#c0392b" }]}>
                {"  "}Chat is only available during an active ride
              </Text>
            </View>
          ) : (
            <View style={ds.chatBanner}>
              <Icon name="create-outline" size={14} color={typedCount < 3 ? "#555" : "#c0392b"} />
              <Text style={[ds.chatBannerTxt, { color: typedCount < 3 ? "#555" : "#c0392b" }]}>
                {"  "}{typedCount < 3
                  ? `Typed messages remaining: ${3 - typedCount}/3`
                  : "No typed messages left — use quick replies"}
              </Text>
            </View>
          )}

          {/* Messages list */}
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={(item, i) => item._id?.toString() || String(i)}
            renderItem={({ item }) => (
              <View style={[ds.bubble, item.fromDriver ? ds.bubbleDriver : ds.bubbleUser]}>
                {item.isQuickReply && (
                  <View style={ds.quickBadge}>
                    <Text style={ds.quickBadgeTxt}>⚡ Quick Reply</Text>
                  </View>
                )}
                <Text style={[ds.bubbleTxt, item.fromDriver ? {} : { color:"#fff" }]}>{item.text}</Text>
                <Text style={[ds.bubbleTime, item.fromDriver ? {} : { color:"rgba(255,255,255,0.7)" }]}>{item.time}</Text>
              </View>
            )}
            contentContainerStyle={{ padding:16, paddingBottom:8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated:true })}
            ListEmptyComponent={
              <View style={{ alignItems:"center", paddingTop:60 }}>
                <Icon name="chatbubble-ellipses-outline" size={48} color="#ccc" />
                <Text style={{ color:"#bbb", marginTop:12, fontSize:14 }}>No messages yet</Text>
                <Text style={{ color:"#ccc", fontSize:12, marginTop:4, textAlign:"center", paddingHorizontal:30 }}>
                  {assignedRoute?.status === "in_progress"
                    ? "Send a message or quick reply below"
                    : "Start an active ride to chat with your driver"}
                </Text>
              </View>
            }
          />

          {/* Quick replies row */}
          {assignedRoute?.status === "in_progress" && (
            <View style={ds.quickRow}>
              <Text style={{ fontSize:11, color:"#888", fontWeight:"700", paddingHorizontal:12, paddingBottom:4 }}>Quick Replies</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:12 }}>
                {[
                  "I am on my way to the stop.",
                  "I will need approximately 2 minutes.",
                  "I will need approximately 5 minutes.",
                  "I am currently delayed. Please wait.",
                  "I am reaching the stop now.",
                  "I have arrived at the stop.",
                  "Please proceed. I am ready.",
                  "Kindly wait for 1 minute.",
                ].map((qr, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={ds.quickChip}
                    onPress={() => sendMessage(qr, "quick_reply")}
                  >
                    <Text style={ds.quickChipTxt}>{qr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input row */}
          {assignedRoute?.status === "in_progress" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={80}>
              <View style={ds.chatInputRow}>
                <TextInput
                  style={[ds.chatInput, typedCount >= 3 && { backgroundColor:"#fafafa", color:"#bbb" }]}
                  placeholder={typedCount < 3 ? `Type a message... (${3 - typedCount} left)` : "Use quick replies above ↑"}
                  placeholderTextColor={typedCount < 3 ? "#999" : "#c0392b"}
                  value={inputText}
                  onChangeText={setInputText}
                  editable={typedCount < 3}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={() => sendMessage(inputText, "typed")}
                  disabled={!inputText.trim() || typedCount >= 3 || chatSending}
                >
                  <LinearGradient
                    colors={inputText.trim() && typedCount < 3 ? [C.main, C.dark] : ["#ccc","#bbb"]}
                    style={ds.sendBtn}
                  >
                    <Icon name="send" size={17} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      {loading && (
        <View style={ds.loadingOverlay}>
          <ActivityIndicator size="large" color={C.main} />
          <Text style={{ color:"#fff", marginTop:10, fontSize:15 }}>Loading...</Text>
        </View>
      )}

      {/* ── "I'm Not Going" Confirmation Modal ── */}
      <Modal visible={showNotGoingModal} transparent animationType="fade" onRequestClose={() => setShowNotGoingModal(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"center", alignItems:"center", paddingHorizontal:24 }}>
          <View style={{ backgroundColor:"#1E293B", borderRadius:20, padding:24, width:"100%", maxWidth:380 }}>
            <View style={{ alignItems:"center", marginBottom:18 }}>
              <View style={{ width:60, height:60, borderRadius:30, backgroundColor:"rgba(220,38,38,0.2)", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <Icon name="close-circle" size={36} color="#EF4444" />
              </View>
              <Text style={{ color:"#F1F5F9", fontSize:20, fontWeight:"900", textAlign:"center" }}>
                Not Going Today?
              </Text>
              <Text style={{ color:"#94A3B8", fontSize:13, textAlign:"center", marginTop:6 }}>
                This will notify your driver and mark you as absent.
              </Text>
            </View>
            <View style={{ backgroundColor:"rgba(239,68,68,0.12)", borderRadius:14, padding:16, marginBottom:18, borderWidth:1, borderColor:"rgba(239,68,68,0.25)" }}>
              <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:8 }}>
                <Text style={{ color:"#94A3B8", fontSize:13 }}>This will be your</Text>
                <Text style={{ color:"#EF4444", fontSize:13, fontWeight:"800" }}>
                  Offense #{notGoingOffenses + 1}
                </Text>
              </View>
              <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:4 }}>
                <Text style={{ color:"#94A3B8", fontSize:13 }}>Penalty amount</Text>
                <Text style={{ color:"#EF4444", fontSize:15, fontWeight:"900" }}>
                  + Rs. {(notGoingOffenses + 1) * 50}
                </Text>
              </View>
              <Text style={{ color:"#64748B", fontSize:11, marginTop:8, textAlign:"center" }}>
                Penalty is added to your monthly payment to the transporter.
              </Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor:"#DC2626", borderRadius:12, paddingVertical:14, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8, marginBottom:10 }}
              onPress={handleNotGoing}
              disabled={notGoingLoading}
              activeOpacity={0.85}
            >
              {notGoingLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Icon name="close-circle" size={20} color="#fff" /><Text style={{ color:"#fff", fontWeight:"900", fontSize:15 }}>Yes, I'm Not Going</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={{ borderRadius:12, paddingVertical:13, alignItems:"center", backgroundColor:"rgba(255,255,255,0.08)" }}
              onPress={() => setShowNotGoingModal(false)}
              disabled={notGoingLoading}
              activeOpacity={0.85}
            >
              <Text style={{ color:"#94A3B8", fontWeight:"700", fontSize:15 }}>Cancel — I'll Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ds = StyleSheet.create({
  container:         { flex:1, backgroundColor:"#F5F7FA" },
  header:            { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:18, paddingTop:46, paddingBottom:10 },
  headerTitle:       { fontSize:20, fontWeight:"800", color:"#fff", letterSpacing:0.5 },
  notifWrap:         { position:"relative", padding:4 },
  blinkDot:          { position:"absolute", top:2, right:2, width:10, height:10, borderRadius:5, backgroundColor:"#E87878" },
  badge:             { position:"absolute", top:-4, right:-4, backgroundColor:"#7A3030", borderRadius:9, minWidth:18, height:18, alignItems:"center", justifyContent:"center", paddingHorizontal:3 },
  badgeTxt:          { color:"#fff", fontSize:10, fontWeight:"800" },
  scroll:            { paddingBottom:30 },

  // ── Boarding banner ──────────────────────────────────────────────────────
  boardingBanner: {
    flexDirection:"row", alignItems:"center",
    backgroundColor:"#B45309", margin:16, borderRadius:16, padding:14,
    ...Platform.select({ ios:{ shadowColor:"#000", shadowOpacity:0.2, shadowRadius:8, shadowOffset:{ width:0, height:4 } }, android:{ elevation:6 } }),
  },
  boardingIconWrap:       { width:44, height:44, borderRadius:22, backgroundColor:"rgba(255,255,255,0.2)", alignItems:"center", justifyContent:"center" },
  boardingBannerTitle:    { fontSize:15, fontWeight:"900", color:"#fff" },
  boardingBannerSub:      { fontSize:12, color:"rgba(255,255,255,0.8)", marginTop:2 },
  boardingConfirmBtn:     { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#415844", borderRadius:12, paddingHorizontal:14, paddingVertical:10 },
  boardingConfirmBtnTxt:  { color:"#fff", fontWeight:"900", fontSize:13 },

  // ── Going to destination banner ──────────────────────────────────────────
  goingDestBanner: {
    flexDirection:"row", alignItems:"center", gap:10,
    backgroundColor:"#1D4ED8", marginHorizontal:16, marginBottom:10, borderRadius:14, padding:14,
    ...Platform.select({ ios:{ shadowColor:"#000", shadowOpacity:0.15, shadowRadius:6, shadowOffset:{ width:0, height:3 } }, android:{ elevation:4 } }),
  },
  goingDestTitle: { color:"#fff", fontWeight:"900", fontSize:14 },
  goingDestSub:   { color:"rgba(255,255,255,0.8)", fontSize:12, marginTop:2 },

  alertBox:          { flexDirection:"row", borderRadius:16, padding:16, marginHorizontal:16, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.18, shadowRadius:8, elevation:6 },
  alertTitle:        { fontSize:15, fontWeight:"800", color:"#fff", marginBottom:4 },
  alertText:         { fontSize:13, color:"rgba(255,255,255,0.9)", marginBottom:2 },
  alertBtns:         { flexDirection:"row", marginTop:10, gap:8 },
  confirmBtn:        { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.2)", paddingVertical:8, paddingHorizontal:14, borderRadius:20, gap:6 },
  cancelBtn:         { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(0,0,0,0.2)", paddingVertical:8, paddingHorizontal:14, borderRadius:20, gap:6 },
  btnText:           { color:"#fff", fontWeight:"700", fontSize:13 },
  activeBanner:      { flexDirection:"row", alignItems:"center", borderRadius:16, padding:16, ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.2,shadowRadius:10,shadowOffset:{width:0,height:4}}, android:{elevation:6} }) },
  activeBannerIcon:  { width:52, height:52, borderRadius:16, alignItems:"center", justifyContent:"center", flexShrink:0 },
  activeBannerTitle: { fontSize:16, fontWeight:"900", marginBottom:4, letterSpacing:-0.2 },
  activeBannerSub:   { fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:18 },
  etaPill:           { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"rgba(229,154,42,0.2)", borderRadius:8, paddingVertical:4, paddingHorizontal:8, alignSelf:"flex-start", marginTop:6 },
  etaPillTxt:        { fontSize:11, fontWeight:"700", color:"#E59A2A" },
  card:              { backgroundColor:"#fff", borderRadius:16, marginBottom:2, overflow:"hidden", ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.08,shadowRadius:8,shadowOffset:{width:0,height:2}}, android:{elevation:4} }) },
  cardHeader:        { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:12, gap:8 },
  cardHeaderTxt:     { fontSize:15, fontWeight:"800", color:"#fff", flex:1 },
  cardBody:          { padding:16 },
  liveChip:          { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"rgba(255,255,255,0.15)", borderRadius:8, paddingVertical:3, paddingHorizontal:8 },
  liveDot:           { width:7, height:7, borderRadius:3.5, backgroundColor:"#fff" },
  liveTxt:           { color:"#fff", fontSize:9, fontWeight:"800", letterSpacing:0.8 },
  statusPill:        { flexDirection:"row", alignItems:"center", alignSelf:"flex-start", paddingVertical:6, paddingHorizontal:12, borderRadius:20, gap:6, marginBottom:12 },
  statusPillTxt:     { fontSize:13, fontWeight:"700" },
  routeName:         { fontSize:17, fontWeight:"800", color:"#0F1A10", marginBottom:12, letterSpacing:-0.3 },
  infoGrid:          { flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:12 },
  infoItem:          { backgroundColor:"#F0F9F1", borderRadius:10, padding:10, alignItems:"center", minWidth:90, flex:1 },
  infoLabel:         { fontSize:10, color:"#888", marginTop:4, marginBottom:2 },
  infoValue:         { fontSize:14, fontWeight:"700", color:"#333" },
  pickupRow:         { flexDirection:"row", alignItems:"center", backgroundColor:"#FFF8E1", borderRadius:10, padding:10, gap:6, marginBottom:8 },
  pickupLabel:       { fontSize:13, fontWeight:"700", color:"#FF9800" },
  pickupValue:       { fontSize:13, color:"#555", flex:1 },
  statusRow:         { flexDirection:"row", alignItems:"center", borderRadius:10, padding:10, gap:8, marginTop:4 },
  statusRowTxt:      { fontSize:13, fontWeight:"700" },
  noRouteTxt:        { color:"#999", fontSize:14, lineHeight:20, marginTop:4 },
  driverBox:         { flexDirection:"row", alignItems:"flex-start", padding:16 },
  driverAvatar:      { width:56, height:56, borderRadius:17, alignItems:"center", justifyContent:"center" },
  driverAvatarTxt:   { fontSize:20, fontWeight:"900", color:"#fff" },
  driverName:        { fontSize:16, fontWeight:"800", color:"#0F1A10", marginBottom:4, letterSpacing:-0.2 },
  ratingRow:         { flexDirection:"row", alignItems:"center", marginBottom:4 },
  ratingTxt:         { fontSize:12, color:"#666" },
  vehicleRow:        { flexDirection:"row", alignItems:"center", gap:5, marginBottom:3 },
  vehicleTxt:        { fontSize:13, color:"#555" },
  plateBadge:        { backgroundColor:"#F5F5F5", borderRadius:6, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor:"#E0E0E0" },
  plateTxt:          { fontSize:11, fontWeight:"700", color:"#333", letterSpacing:1 },
  driverActions:     { alignItems:"center", paddingLeft:8 },
  actionBtn:         { width:40, height:40, borderRadius:20, borderWidth:1.5, borderColor:"#415844", alignItems:"center", justifyContent:"center" },
  routeInfoBar:      { flexDirection:"row", borderTopWidth:1, borderTopColor:"#F0F0F0", padding:12, gap:8, flexWrap:"wrap" },
  routeInfoChip:     { flexDirection:"row", alignItems:"center", backgroundColor:"#F0F9F1", borderRadius:8, paddingVertical:5, paddingHorizontal:10, gap:4 },
  routeInfoTxt:      { fontSize:12, color:"#555", fontWeight:"600" },
  vanMarker:         { backgroundColor:"#415844", padding:7, borderRadius:18, borderWidth:2, borderColor:"#fff", elevation:6 },
  stopPin:           { width:26, height:26, borderRadius:13, alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#fff", elevation:3 },
  destPin:           { width:34, height:34, borderRadius:17, backgroundColor:"#DC2626", alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#fff", elevation:5 },
  etaBar:            { flexDirection:"row", alignItems:"center", padding:12, gap:8, backgroundColor:"#FFF8E1" },
  etaBarTxt:         { fontSize:13, color:"#FF9800", fontWeight:"600", flex:1 },
  chatContainer:     { flex:1, backgroundColor:"#F2F5F2" },
  chatHeader:        { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingTop:50, paddingBottom:14, gap:12 },
  chatAvatar:        { width:38, height:38, borderRadius:19, backgroundColor:"rgba(255,255,255,0.3)", alignItems:"center", justifyContent:"center" },
  chatAvatarTxt:     { fontSize:15, fontWeight:"800", color:"#fff" },
  chatName:          { fontSize:15, fontWeight:"800", color:"#fff" },
  chatSub:           { fontSize:12, color:"rgba(255,255,255,0.8)" },
  chatBanner:        { flexDirection:"row", alignItems:"center", backgroundColor:"#fffde7", paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#eee" },
  chatBannerTxt:     { fontSize:12, flex:1 },
  bubble:            { maxWidth:"75%", borderRadius:16, padding:12, marginBottom:8 },
  bubbleDriver:      { backgroundColor:"#fff", alignSelf:"flex-start", elevation:2 },
  bubbleUser:        { backgroundColor:"#415844", alignSelf:"flex-end" },
  bubbleTxt:         { fontSize:14, color:"#0F1A10" },
  bubbleTime:        { fontSize:11, color:"#999", marginTop:4, textAlign:"right" },
  quickBadge:        { backgroundColor:"rgba(0,0,0,0.07)", borderRadius:8, paddingHorizontal:6, paddingVertical:2, alignSelf:"flex-start", marginBottom:4 },
  quickBadgeTxt:     { fontSize:9, color:"#666" },
  quickRow:          { backgroundColor:"#fff", paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor:"#eee" },
  quickChip:         { backgroundColor:"#e8f5e9", borderRadius:20, paddingHorizontal:14, paddingVertical:8, marginRight:8, borderWidth:1, borderColor:"#415844" },
  quickChipTxt:      { color:"#2e7d32", fontSize:12, fontWeight:"600" },
  chatInputRow:      { flexDirection:"row", alignItems:"center", padding:12, backgroundColor:"#fff", gap:8, borderTopWidth:1, borderTopColor:"#F0F0F0" },
  chatInput:         { flex:1, backgroundColor:"#F2F5F2", borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:14, color:"#0F1A10", maxHeight:100 },
  sendBtn:           { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center" },
  chatRedDot:        { position:"absolute", top:-5, right:-5, backgroundColor:"#EF4444", borderRadius:8, minWidth:16, height:16, alignItems:"center", justifyContent:"center", paddingHorizontal:2, borderWidth:1.5, borderColor:"#fff" },
  chatRedDotTxt:     { fontSize:8, color:"#fff", fontWeight:"900" },
  loadingOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)", alignItems:"center", justifyContent:"center", zIndex:999 },

  // ── Trip info card (pickup / dropoff rows) ────────────────────────────────
  tripInfoRow:       { flexDirection:"row", alignItems:"center", backgroundColor:"#F8FAFF", borderRadius:10, padding:11, gap:10, marginBottom:0 },
  tripDot:           { width:10, height:10, borderRadius:5, flexShrink:0 },
  tripInfoLabel:     { fontSize:10, color:"#888", fontWeight:"700", marginBottom:2, textTransform:"uppercase", letterSpacing:0.5 },
  tripInfoValue:     { fontSize:13, color:"#1F2937", fontWeight:"700", lineHeight:18 },
});