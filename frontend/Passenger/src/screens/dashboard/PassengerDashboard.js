// frontend/Passenger/src/screens/dashboard/PassengerDashboard.js
// FIXES:
//   1) Simulation properly starts from driver location → P1 → P2 → ... → Destination
//   2) Van arrives at passenger stop → shows "I'm On Board" + "Not Going Today" buttons ON MAP (no popup)
//   3) "Not Going Today" penalty: 50 Rs first time, then +10 each time (60, 70, 80...)
//   4) After boarding OR declining → van moves to next stop automatically
//   5) Driver location fetched from DB
//   6) All existing functionality preserved

import React, { useState, useEffect, useRef } from "react";
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

const PKEY_VAN_ARRIVED    = "passenger_vanArrived";
const PKEY_VAN_STOP_ID    = "passenger_vanStopId";
const PKEY_VAN_ROUTE_ID   = "passenger_vanRouteId";
const PKEY_PENALTY_COUNT  = "passenger_penaltyCount";
const PKEY_PENALTY_TOTAL  = "passenger_penaltyTotal";

const C = {
  main:"#415844", dark:"#2D3E2F", deeper:"#1A2B1C",
  light:"#EDF4ED", bg:"#F2F5F2", border:"#C5D4C5", white:"#FFFFFF", ink:"#0F1A10",
  pollBg:"#2A4A2C",    pollBorder:"#4A7A4C",    pollAccent:"#7EC87F",
  morningBg:"#3A3A1A", morningBorder:"#6A6A2A", morningAccent:"#C8C850",
  notifBg:"#1A2E3A",   notifBorder:"#2A5A6A",   notifAccent:"#6AB8C8",
  urgentBg:"#3A1A1A",  urgentBorder:"#6A2A2A",  urgentAccent:"#E87878",
  offWhite:"rgba(255,255,255,0.92)", dimWhite:"rgba(255,255,255,0.60)",
  success:"#4CAF50", warn:"#E59A2A", warnBg:"#FFF8E1", amber:"#FF9800",
  info:"#1565C0", infoBg:"#E3F2FD",
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

function haversine(la1, ln1, la2, ln2) {
  const R = 6371, d2r = Math.PI / 180;
  const dL = (la2 - la1) * d2r, dl = (ln2 - ln1) * d2r;
  const a  = Math.sin(dL / 2) ** 2 + Math.cos(la1 * d2r) * Math.cos(la2 * d2r) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByProximityLocal(passengers, fromLat, fromLng) {
  if (!passengers || passengers.length === 0) return passengers;
  const remaining = passengers.map((p, origIndex) => ({
    ...p,
    _resolvedCoord: resolvePassengerCoord(p, origIndex),
  }));
  const sorted = [];
  let curLat = fromLat;
  let curLng = fromLng;
  while (remaining.length > 0) {
    let nearestIdx  = 0;
    let nearestDist = Infinity;
    remaining.forEach((p, idx) => {
      const c = p._resolvedCoord;
      const d = haversine(curLat, curLng, c.latitude, c.longitude);
      if (d < nearestDist) { nearestDist = d; nearestIdx = idx; }
    });
    const nearest = remaining.splice(nearestIdx, 1)[0];
    sorted.push(nearest);
    curLat = nearest._resolvedCoord.latitude;
    curLng = nearest._resolvedCoord.longitude;
  }
  return sorted;
}

function resolvePassengerCoord(p, fallbackIndex = 0) {
  const lat = p.pickupLat || p.latitude  || p.location?.coordinates?.[1] || null;
  const lng = p.pickupLng || p.longitude || p.location?.coordinates?.[0] || null;
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001)) {
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  const key = p.pickupPoint || p.pickupAddress || p.address || p.name || '';
  if (key && stopCoordinates?.[key]) return stopCoordinates[key];
  return DEMO[fallbackIndex % DEMO.length];
}

function resolveDropCoord(p) {
  const lat = p.destinationLat || p.dropLat || null;
  const lng = p.destinationLng || p.dropLng || null;
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001)) {
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  const key = p.destination || p.dropAddress || '';
  if (key && stopCoordinates?.[key]) return stopCoordinates[key];
  return null;
}

function lerp(a, b, t) {
  return {
    latitude:  a.latitude  + (b.latitude  - a.latitude)  * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function fitRegion(coords) {
  if (!coords || !coords.length)
    return { latitude:33.6844, longitude:73.0479, latitudeDelta:0.06, longitudeDelta:0.06 };
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

export default function PassengerDashboard({ navigation }) {
  const userTokenRef      = useRef(null);
  const userIdRef         = useRef(null);
  const intervalRef       = useRef(null);
  const socketRef         = useRef(null);
  const activeTripIdRef   = useRef(null);
  const mapRef            = useRef(null);
  const driverLocationRef = useRef(null);

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
  const [etaToMe,             setEtaToMe]             = useState(null);
  const [vanArrived,          setVanArrived]           = useState(false);
  const [boarded,             setBoarded]              = useState(false);
  const [markingBoard,        setMarkingBoard]         = useState(false);
  const [markingDecline,      setMarkingDecline]       = useState(false);
  const [useLiveTripLocation, setUseLiveTripLocation]  = useState(false);
  const [penaltyInfo,         setPenaltyInfo]          = useState({ count:0, total:0 });
  const [tripCompleted,       setTripCompleted]        = useState(false);

  // Sim refs
  const simRef     = useRef(null);
  const segRef     = useRef(0);
  const stepRef    = useRef(0);
  const alertedRef = useRef(false);
  const stopsRef   = useRef([]);
  // Track which stop index sim is currently targeting (so after boarding we jump to next)
  const simTargetStopRef = useRef(-1);

  const [activePolls,      setActivePolls]      = useState([]);
  const [showPollModal,    setShowPollModal]     = useState(false);
  const [selectedPoll,     setSelectedPoll]      = useState(null);
  const [loadingResponse,  setLoadingResponse]   = useState("");
  const shownPollIds = useRef(new Set());

  const [showMorningConf, setShowMorningConf] = useState(false);
  const [morningTrip,     setMorningTrip]     = useState(null);
  const [notifications,   setNotifications]   = useState([]);
  const [unreadCount,     setUnreadCount]     = useState(0);
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
  const boardBtnScale    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPenaltyInfo();
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

  // ── Start/stop simulation based on state ──────────────────────────────────
  useEffect(() => {
    if (assignedRoute?.status === "in_progress" && allPassengers.length > 0 && !boarded && !useLiveTripLocation && !vanArrived) {
      startPassengerSim();
    } else if (boarded || vanArrived) {
      // Don't clear sim on vanArrived — we pause it internally
    } else {
      clearInterval(simRef.current);
    }
    return () => clearInterval(simRef.current);
  }, [assignedRoute?.status, allPassengers.length, boarded, useLiveTripLocation]);

  // Van pulse when close or arrived
  useEffect(() => {
    if (vanArrived || (etaToMe !== null && etaToMe <= 10)) {
      Animated.loop(Animated.sequence([
        Animated.timing(vanPulse, { toValue:1.3, duration:600, useNativeDriver:true }),
        Animated.timing(vanPulse, { toValue:1,   duration:600, useNativeDriver:true }),
      ])).start();
    } else {
      vanPulse.setValue(1);
    }
  }, [vanArrived, etaToMe]);

  // Board button slide-in when van arrives
  useEffect(() => {
    if (vanArrived && !boarded) {
      Animated.spring(boardBtnScale, { toValue:1, tension:60, friction:6, useNativeDriver:true }).start();
    } else {
      boardBtnScale.setValue(0);
    }
  }, [vanArrived, boarded]);

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

  // ── Load penalty info from storage ────────────────────────────────────────
  const loadPenaltyInfo = async () => {
    try {
      const [[, countStr], [, totalStr]] = await AsyncStorage.multiGet([
        PKEY_PENALTY_COUNT, PKEY_PENALTY_TOTAL,
      ]);
      setPenaltyInfo({
        count: parseInt(countStr || "0", 10),
        total: parseInt(totalStr || "0", 10),
      });
    } catch {}
  };

  // ── Socket.io ──────────────────────────────────────────────────────────────
  const initSocket = () => {
    try {
      const { io } = require("socket.io-client");
      if (socketRef.current?.connected) return;

      const socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      socket.on("connect", () => {
        console.log("[Socket] Passenger connected:", socket.id);
        if (activeTripIdRef.current) {
          socket.emit("joinTrip", { tripId: activeTripIdRef.current, userId: userIdRef.current });
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

        // ETA from live GPS
        setMyStopIndex(myIdx => {
          if (myIdx >= 0 && stopsRef.current.length > myIdx) {
            const myCoord = stopsRef.current[myIdx]?.coordinate;
            if (myCoord) {
              const dist = haversine(newPos.latitude, newPos.longitude, myCoord.latitude, myCoord.longitude);
              const eta  = Math.max(1, Math.round((dist / SPEED_KMH) * 60));
              setEtaToMe(eta);
            }
          }
          return myIdx;
        });
      });

      socket.on("tripLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat == null || lng == null) return;
        setVanPos({ latitude: Number(lat), longitude: Number(lng) });
        setUseLiveTripLocation(true);
        clearInterval(simRef.current);
      });

      // ── tenMinAlert — tiered alerts ────────────────────────────────────────
      socket.on("tenMinAlert", (data) => {
        const myId    = userIdRef.current;
        const isForMe = data?.passengerId?.toString() === myId || data?.passengerId === myId;
        if (!isForMe) return;

        const eta   = data?.etaMin || data?.alertLevel || 10;
        const level = data?.alertLevel || 10;
        const stop  = data?.stopName || "your pickup point";

        const levelKey = `alert_${level}`;
        if (alertedRef.current === levelKey) return;
        alertedRef.current = levelKey;

        setEtaToMe(eta);

        const levelConfig = {
          10: { emoji: "⏱️", title: "Be Ready! Vehicle Approaching",  body: `Vehicle arriving in ~${eta} min at:\n${stop}\n\nStart making your way to the pickup point.` },
          5:  { emoji: "🚐", title: "5 Minutes Away — Head Out Now!", body: `Vehicle is ~${eta} min away at:\n${stop}\n\nPlease go to your pickup point now!` },
          3:  { emoji: "⚠️", title: "Almost There — 3 Minutes!",      body: `Vehicle arriving in ~${eta} min at:\n${stop}\n\nBe at your spot RIGHT NOW!` },
          1:  { emoji: "🚨", title: "Vehicle is 1 Minute Away!",      body: `Vehicle is 1 min away at:\n${stop}\n\nYour driver is almost here — don't miss it!` },
        };

        const cfg = levelConfig[level] || levelConfig[10];
        Alert.alert(`${cfg.emoji} ${cfg.title}`, cfg.body, [{ text: level <= 3 ? "On My Way! 🏃" : "Got it 👍" }]);
      });

      // ── boardingRequest — van arrived at THIS passenger's stop ─────────────
      // We do NOT show a popup. We set vanArrived=true so the UI buttons appear on map.
      socket.on("boardingRequest", (data) => {
        const myId    = userIdRef.current;
        const isForMe = data?.passengerId?.toString() === myId || data?.passengerId === myId;
        if (!isForMe || boarded) return;

        setVanArrived(true);
        clearInterval(simRef.current); // pause sim while waiting

        AsyncStorage.multiSet([
          [PKEY_VAN_ARRIVED,  "true"],
          [PKEY_VAN_STOP_ID,  data?.stopId?.toString()  || ""],
          [PKEY_VAN_ROUTE_ID, data?.routeId?.toString() || ""],
        ]).catch(() => {});
      });

      // ── passengerStatusUpdate — driver manually marked as picked ───────────
      socket.on("passengerStatusUpdate", (data) => {
        const myId = userIdRef.current;
        if (data?.passengerId?.toString() === myId || data?.passengerId === myId) {
          if (data.status === "picked") {
            setBoarded(true);
            setVanArrived(false);
            clearInterval(simRef.current);
          }
        }
      });

      socket.on("routeCompleted", () => {
        setUseLiveTripLocation(false);
        clearInterval(simRef.current);
        setChatVisible(false);
        setUnreadChatCount(0);
        setTripCompleted(true);
        setTimeout(() => setTripCompleted(false), 8000);
      });

      socket.on("rideChat", (data) => {
        const myId = userIdRef.current;
        if (!data?.senderId || data.senderId?.toString() === myId?.toString()) return;
        if (data?.senderRole !== "driver") return;
        setUnreadChatCount(prev => prev + 1);
      });

      socket.on("chatEnded", () => {
        setChatVisible(false);
        setUnreadChatCount(0);
      });

      socket.on('statsRefresh', () => {
        fetchAll(userTokenRef.current, userIdRef.current);
      });

      socket.on("disconnect", () => {
        setUseLiveTripLocation(false);
      });

      socketRef.current = socket;
    } catch (e) {
      console.log("[Socket] socket.io-client not available:", e.message);
    }
  };

  useEffect(() => {
    if (!activeTripIdRef.current) return;
    if (socketRef.current?.connected) {
      socketRef.current.emit("joinTrip", { tripId: activeTripIdRef.current, userId: userIdRef.current });
    }
  }, [activeTripIdRef.current]); // eslint-disable-line

  // ── Local simulation ───────────────────────────────────────────────────────
  // Flow: driverOrigin → P1 → P2 → ... → Pn → Destination
  // Van PAUSES at MY stop, showing "I'm On Board" + "Not Going Today" buttons.
  // After confirmation (either way), sim resumes from next stop.
  const startPassengerSim = (resumeFromSeg = -1) => {
    clearInterval(simRef.current);
    const stops = buildStops();
    if (stops.length < 2) return;
    stopsRef.current = stops;

    // If resumeFromSeg provided, start from there; else start from 0
    if (resumeFromSeg >= 0) {
      segRef.current  = resumeFromSeg;
      stepRef.current = 0;
    } else {
      segRef.current  = 0;
      stepRef.current = 0;
      alertedRef.current = false;
    }

    setVanPos(stops[segRef.current].coordinate);

    // myStopIndex in sorted allPassengers list → index in full stops array = myIdx + 1
    // stops[0] = driverOrigin, stops[1..n] = passengers, stops[n+1..] = destinations
    const myIdx = myStopIndex;
    const mySimStopIdx = myIdx >= 0 ? myIdx + 1 : -1;
    simTargetStopRef.current = mySimStopIdx;

    simRef.current = setInterval(() => {
      const ss = stopsRef.current;
      if (!ss || ss.length < 2) { clearInterval(simRef.current); return; }

      let seg      = segRef.current;
      let progress = stepRef.current;
      const totalSegs = ss.length - 1;
      if (seg >= totalSegs) { clearInterval(simRef.current); return; }

      const segDistKm = haversine(
        ss[seg].coordinate.latitude,     ss[seg].coordinate.longitude,
        ss[seg + 1].coordinate.latitude, ss[seg + 1].coordinate.longitude
      );
      const kmPerTick    = (SPEED_KMH * FRAME_MS) / 3600000;
      const stepFraction = segDistKm > 0 ? kmPerTick / segDistKm : 0.015;

      progress += stepFraction;

      if (progress >= 1) {
        progress = 0;
        seg += 1;

        if (seg >= totalSegs) {
          clearInterval(simRef.current);
          segRef.current  = seg;
          stepRef.current = progress;
          return;
        }

        // Did we just ARRIVE at MY pickup stop?
        const targetIdx = simTargetStopRef.current;
        if (targetIdx > 0 && seg === targetIdx) {
          // Pause here — show boarding buttons on map
          setVanArrived(true);
          setVanPos(ss[seg].coordinate);
          clearInterval(simRef.current);
          segRef.current  = seg;
          stepRef.current = progress;

          // Also persist arrived state
          AsyncStorage.multiSet([
            [PKEY_VAN_ARRIVED,  "true"],
            [PKEY_VAN_STOP_ID,  ss[seg]._id?.toString() || ""],
            [PKEY_VAN_ROUTE_ID, assignedRoute?._id?.toString() || ""],
          ]).catch(() => {});
          return;
        }
      }

      // Interpolate position
      const pos = lerp(ss[seg].coordinate, ss[seg + 1].coordinate, progress);
      setVanPos(pos);

      // ETA to my stop
      const targetIdx = simTargetStopRef.current;
      if (targetIdx > 0 && targetIdx < ss.length && seg < targetIdx) {
        const myCoord = ss[targetIdx].coordinate;
        const dist    = haversine(pos.latitude, pos.longitude, myCoord.latitude, myCoord.longitude);
        const eta     = Math.max(1, Math.round((dist / SPEED_KMH) * 60));
        setEtaToMe(eta);

        if (eta <= 10 && alertedRef.current !== 'done10') {
          alertedRef.current = 'done10';
          Alert.alert(
            '🚨 Van is 10 Minutes Away!',
            `Van will reach your stop in ~${eta} minute${eta === 1 ? '' : 's'}!\nGet ready at: ${ss[targetIdx].name}`,
            [{ text: "Got it! 👍" }]
          );
        }
      }

      segRef.current  = seg;
      stepRef.current = progress;
    }, FRAME_MS);
  };

  // Resume simulation after current passenger (skip to next segment)
  const resumeSimAfterStop = () => {
    const ss = stopsRef.current;
    if (!ss || ss.length < 2) return;
    const nextSeg = segRef.current + 1; // move past MY stop
    if (nextSeg >= ss.length - 1) return; // was last stop
    startPassengerSim(nextSeg);
  };

  const buildStops = () => {
    const firstPax = (allPassengers || [])[0];
    const firstPaxCoord = firstPax ? resolvePassengerCoord(firstPax, 0) : null;

    const driverCoord = (() => {
      // Priority 1: driverLocationRef (fetched from DB)
      if (driverLocationRef.current?.latitude && driverLocationRef.current?.longitude) {
        return { latitude: driverLocationRef.current.latitude, longitude: driverLocationRef.current.longitude };
      }
      // Priority 2: live socket van position
      if (vanPos?.latitude && vanPos?.longitude) {
        return { latitude: vanPos.latitude, longitude: vanPos.longitude };
      }
      // Priority 3: route currentLocation
      const cl = assignedRoute?.currentLocation;
      if (cl?.latitude && cl?.longitude &&
          (Math.abs(cl.latitude - 33.6844) > 0.0001 || Math.abs(cl.longitude - 73.0479) > 0.0001)) {
        return { latitude: Number(cl.latitude), longitude: Number(cl.longitude) };
      }
      // Priority 4: driver profile coords
      if (driverInfo?.latitude && driverInfo?.longitude &&
          (Math.abs(driverInfo.latitude - 33.6844) > 0.0001 || Math.abs(driverInfo.longitude - 73.0479) > 0.0001)) {
        return { latitude: Number(driverInfo.latitude), longitude: Number(driverInfo.longitude) };
      }
      // Priority 5: offset above first passenger
      if (firstPaxCoord) {
        return { latitude: firstPaxCoord.latitude + 0.012, longitude: firstPaxCoord.longitude - 0.006 };
      }
      return { latitude: 33.6984, longitude: 73.0379 };
    })();

    const driverOrigin = {
      _id: "driver-origin",
      _isDriverOrigin: true,
      name: "Driver Start",
      passengerName: "Driver",
      coordinate: driverCoord,
    };

    const passengerStops = (allPassengers || []).map((p, i) => {
      const coord = resolvePassengerCoord(p, i);
      return {
        _id:           p._id?.toString() || `p-${i}`,
        passengerId:   p.passengerId?.toString() || p._id?.toString(),
        name:          p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
        passengerName: p.passengerName || "Passenger",
        coordinate:    coord,
      };
    });

    const destStops = [];
    if (assignedRoute?.destinationLat && assignedRoute?.destinationLng) {
      destStops.push({
        _id: "destination",
        _isDestination: true,
        name: assignedRoute.destination || "Destination",
        passengerName: "Destination",
        coordinate: { latitude: Number(assignedRoute.destinationLat), longitude: Number(assignedRoute.destinationLng) },
      });
    } else {
      (allPassengers || []).forEach((p, i) => {
        const coord = resolveDropCoord(p);
        if (coord) {
          destStops.push({
            _id: `drop-${i}`,
            _isDestination: true,
            name: p.destination || p.dropAddress || "Drop-off",
            passengerName: p.passengerName || `Passenger ${i + 1}`,
            coordinate: coord,
          });
        }
      });
    }

    return [driverOrigin, ...passengerStops, ...destStops];
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

      // Restore vanArrived from storage
      try {
        const [[, savedVanArrived]] = await AsyncStorage.multiGet([PKEY_VAN_ARRIVED]);
        if (savedVanArrived === "true") {
          setTimeout(() => setVanArrived(true), 1200);
        }
      } catch {}
    } catch (e) { console.error("loadAuthData:", e); }
  };

  const getHeaders = (tok) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${tok || userTokenRef.current}`,
  });

  // ── Fetch driver's real location from DB ───────────────────────────────────
  const fetchDriverLocation = async (driverId, tok) => {
    if (!driverId) return;
    const t = tok || userTokenRef.current;
    if (!t) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/drivers/${driverId}`, { headers: getHeaders(t) });
      const data = await res.json();
      const drv  = data.driver || data.data || data;
      const lat  = drv?.latitude  || drv?.location?.coordinates?.[1] || null;
      const lng  = drv?.longitude || drv?.location?.coordinates?.[0] || null;
      if (lat && lng &&
          (Math.abs(Number(lat) - 33.6844) > 0.0001 || Math.abs(Number(lng) - 73.0479) > 0.0001)) {
        driverLocationRef.current = { latitude: Number(lat), longitude: Number(lng) };
        console.log('[Passenger] Driver location fetched from DB:', driverLocationRef.current);
      }
    } catch (e) {
      console.warn('[Passenger] fetchDriverLocation error:', e.message);
    }
  };

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
        const rawPassengers = route.passengers || [];

        const drv0 = route.assignedDriver;
        let dHomeLat = 33.6844, dHomeLng = 73.0479;
        if (drv0 && typeof drv0 === "object" && drv0.name) {
          dHomeLat = drv0.latitude  || drv0.location?.coordinates?.[1] || 33.6844;
          dHomeLng = drv0.longitude || drv0.location?.coordinates?.[0] || 73.0479;
        } else if (route.currentLocation?.latitude) {
          dHomeLat = route.currentLocation.latitude;
          dHomeLng = route.currentLocation.longitude;
        }

        const passengers = sortByProximityLocal(rawPassengers, dHomeLat, dHomeLng);
        setAllPassengers(passengers);
        setTotalPassengers(passengers.length);

        const myIdx = passengers.findIndex(p =>
          (p.passengerId?.toString() || p._id?.toString()) === id
        );
        setMyStopIndex(myIdx);
        const myEntry = myIdx >= 0 ? passengers[myIdx] : null;
        setMyPassengerEntry(myEntry || null);

        if (myEntry?.status === "picked") {
          setBoarded(true);
          setVanArrived(false);
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

        stopsRef.current = passengers.map((p, i) => ({
          _id:        p._id?.toString() || `p-${i}`,
          name:       p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
          coordinate: resolvePassengerCoord(p, i),
        }));

        const drv = route.assignedDriver;
        if (drv && typeof drv === "object") {
          setRouteDriver(drv);
          setDriverInfo({
            name:          drv.name          || "Driver",
            rating:        drv.rating        || 4.8,
            vehicleNumber: drv.vehicleNo     || drv.vehicleNumber || "N/A",
            vehicleModel:  drv.vehicleType   || drv.vehicleModel  || "Van",
            latitude:      drv.latitude      || drv.location?.coordinates?.[1] || null,
            longitude:     drv.longitude     || drv.location?.coordinates?.[0] || null,
          });

          const dLat = drv.latitude  || drv.location?.coordinates?.[1];
          const dLng = drv.longitude || drv.location?.coordinates?.[0];
          if (dLat && dLng &&
              (Math.abs(Number(dLat) - 33.6844) > 0.0001 || Math.abs(Number(dLng) - 73.0479) > 0.0001)) {
            driverLocationRef.current = { latitude: Number(dLat), longitude: Number(dLng) };
          }

          const drvId = drv._id?.toString() || drv.id?.toString();
          if (drvId) fetchDriverLocation(drvId, t).catch(() => {});
        }
      } else {
        setAssignedRoute(prev => {
          if (prev && prev.status === 'in_progress') {
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
              socketRef.current.emit("joinTrip", { tripId, userId: userIdRef.current });
            }
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

  // ── "I'm On Board!" handler ───────────────────────────────────────────────
  const handleBoardVan = async () => {
    if (!assignedRoute || !myPassengerEntry || markingBoard) return;
    setMarkingBoard(true);
    try {
      const stopId = myPassengerEntry._id;
      const res = await fetch(
        `${API_BASE_URL}/routes/${assignedRoute._id}/stops/${stopId}/status`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ status: "picked" }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setBoarded(true);
        setVanArrived(false);
        clearInterval(simRef.current);
        AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});

        // Emit passengerBoarded → driver sim resumes
        if (socketRef.current?.connected && activeTripIdRef.current) {
          socketRef.current.emit("passengerBoarded", {
            tripId:      activeTripIdRef.current,
            passengerId: userIdRef.current,
            status:      "picked",
          });
        }

        // Resume local sim for remaining passengers (so map still shows van moving)
        resumeSimAfterStop();

        await fetchAssignedRoute(userTokenRef.current, userIdRef.current);
      } else {
        Alert.alert("Error", data.message || "Could not mark as boarded.");
      }
    } catch {
      Alert.alert("Error", "Connection failed. Please try again.");
    } finally {
      setMarkingBoard(false);
    }
  };

  // ── "Not Going Today" handler — penalty: 50 first, then 10 more each time ─
  // So: 1st = 50, 2nd = 60, 3rd = 70, 4th = 80 ...
  const handleNotGoingToday = async () => {
    if (markingDecline) return;
    setMarkingDecline(true);
    try {
      // Calculate penalty
      const [[, countStr], [, totalStr]] = await AsyncStorage.multiGet([
        PKEY_PENALTY_COUNT, PKEY_PENALTY_TOTAL,
      ]);
      const prevCount = parseInt(countStr || "0", 10);
      const prevTotal = parseInt(totalStr || "0", 10);
      // 1st time: 50, 2nd: 60, 3rd: 70 ... (50 + prevCount * 10)
      const penalty  = 50 + prevCount * 10;
      const newCount = prevCount + 1;
      const newTotal = prevTotal + penalty;

      await AsyncStorage.multiSet([
        [PKEY_PENALTY_COUNT, newCount.toString()],
        [PKEY_PENALTY_TOTAL, newTotal.toString()],
      ]);

      setPenaltyInfo({ count: newCount, total: newTotal });

      // Clear arrived state
      setVanArrived(false);
      AsyncStorage.multiRemove([PKEY_VAN_ARRIVED, PKEY_VAN_STOP_ID, PKEY_VAN_ROUTE_ID]).catch(() => {});

      // Emit to driver — van should move to next stop
      if (socketRef.current?.connected && activeTripIdRef.current) {
        socketRef.current.emit("passengerDeclined", {
          tripId:      activeTripIdRef.current,
          passengerId: userIdRef.current,
        });
        socketRef.current.emit("passengerBoarded", {
          tripId:      activeTripIdRef.current,
          passengerId: userIdRef.current,
          status:      "missed",
        });
      }

      // Resume local sim to next stop
      resumeSimAfterStop();

      Alert.alert(
        "⚠️ Penalty Applied",
        `Penalty for not boarding: Rs. ${penalty}\nTotal penalties: Rs. ${newTotal}\n\n(Each missed boarding increases penalty by Rs. 10)`,
        [{ text: "Understood" }]
      );

      await fetchAssignedRoute(userTokenRef.current, userIdRef.current);
    } catch (e) {
      Alert.alert("Error", "Could not process. Try again.");
    } finally {
      setMarkingDecline(false);
    }
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
        fetch(`${API_BASE_URL}/messages/${driverId}/read`, { method:"PUT", headers:getHeaders(tok) }).catch(() => {});
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
      if (vanArrived) return { label:"Van Has Arrived! Board Now!", color:"#B91C1C", icon:"navigate", bg:"#FFEBEE" };
      if (isNextPickup) return { label:"Van is Coming For You!", color:"#C62828", icon:"navigate", bg:"#FFEBEE" };
      return { label:"Van En Route — Picking Up", color:C.info, icon:"car", bg:C.infoBg };
    }
    if (s === "completed") return { label:"Trip Completed ✅", color:C.main, icon:"checkmark-done-circle", bg:C.light };
    return { label:"Scheduled", color:"#7A5C00", icon:"calendar-outline", bg:C.warnBg };
  };

  // ── LIVE MAP ───────────────────────────────────────────────────────────────
  const renderLiveMap = () => {
    if (!assignedRoute || assignedRoute.status !== "in_progress") return null;

    const stops    = buildStops();
    const vanCoord = vanPos || (stops.length > 0 ? stops[0].coordinate : null);
    const driverStartCoord = stops.length > 0 ? stops[0].coordinate : { latitude:33.6844, longitude:73.0479 };

    const passengerStops = (allPassengers || []).map((p, i) => ({
      index:       i,
      passengerId: p.passengerId?.toString() || p._id?.toString(),
      name:        p.passengerName || p.name || `Passenger ${i + 1}`,
      address:     p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
      status:      p.status || 'pending',
      coordinate:  resolvePassengerCoord(p, i),
      isMe:        (p.passengerId?.toString() || p._id?.toString()) === userIdRef.current,
    }));

    const destCoord = (() => {
      if (assignedRoute.destinationLat && assignedRoute.destinationLng)
        return { latitude: assignedRoute.destinationLat, longitude: assignedRoute.destinationLng };
      const lastDrop = (allPassengers || []).map(p => resolveDropCoord(p)).filter(Boolean).pop();
      return lastDrop || null;
    })();

    const orderedCoords = [
      driverStartCoord,
      ...passengerStops.map(s => s.coordinate),
      ...(destCoord ? [destCoord] : []),
    ];

    let coveredCoords = [];
    let aheadCoords   = [];

    if (vanCoord && orderedCoords.length > 1) {
      let nearestSeg  = 0;
      let nearestDist = Infinity;
      for (let s = 0; s < orderedCoords.length - 1; s++) {
        const midLat = (orderedCoords[s].latitude  + orderedCoords[s + 1].latitude)  / 2;
        const midLng = (orderedCoords[s].longitude + orderedCoords[s + 1].longitude) / 2;
        const d = haversine(vanCoord.latitude, vanCoord.longitude, midLat, midLng);
        if (d < nearestDist) { nearestDist = d; nearestSeg = s; }
      }
      coveredCoords = [...orderedCoords.slice(0, nearestSeg + 1), vanCoord];
      aheadCoords   = [vanCoord, ...orderedCoords.slice(nearestSeg + 1)];
    } else {
      aheadCoords = orderedCoords;
    }

    const allCoords = [
      ...passengerStops.map(s => s.coordinate),
      ...(destCoord ? [destCoord] : []),
      ...(vanCoord ? [vanCoord] : []),
    ];
    const initialRegion = vanCoord
      ? { latitude:vanCoord.latitude, longitude:vanCoord.longitude, latitudeDelta:0.04, longitudeDelta:0.04 }
      : fitRegion(allCoords);

    const showBoardingButtons = vanArrived && !boarded && myPassengerEntry?.status !== "picked";

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
          </LinearGradient>

          <View style={{ height:300, overflow:"hidden" }}>
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
              {/* Covered path — grey dotted */}
              {coveredCoords.length > 1 && (
                <Polyline coordinates={coveredCoords} strokeColor="#9E9E9E" strokeWidth={4} lineDashPattern={[6,8]} />
              )}
              {/* Ahead path — green solid */}
              {aheadCoords.length > 1 && (
                <Polyline coordinates={aheadCoords} strokeColor={C.main} strokeWidth={5} />
              )}

              {/* Driver START marker */}
              <Marker coordinate={driverStartCoord} anchor={{ x:0.5, y:0.5 }} title="Driver Start" zIndex={5}>
                <View style={{ alignItems:'center' }}>
                  <View style={{ backgroundColor:'#1565C0', padding:6, borderRadius:12, borderWidth:2, borderColor:'#fff' }}>
                    <Icon name="home" size={13} color="#fff" />
                  </View>
                  <View style={{ backgroundColor:'#1565C0', paddingHorizontal:5, paddingVertical:2, borderRadius:4, marginTop:2 }}>
                    <Text style={{ color:'#fff', fontSize:8, fontWeight:'900' }}>START</Text>
                  </View>
                </View>
              </Marker>

              {/* Passenger pickup markers */}
              {passengerStops.map((st, i) => {
                const isPicked = st.status === 'picked';
                const isMissed = st.status === 'missed';
                const bg = st.isMe ? C.amber : isPicked ? C.main : isMissed ? '#EF4444' : '#64748B';
                return (
                  <Marker
                    key={`pax-${st.passengerId || i}`}
                    coordinate={st.coordinate}
                    anchor={{ x:0.5, y:1 }}
                    title={st.name}
                    description={st.address}
                    zIndex={st.isMe ? 12 : isPicked ? 3 : 4}
                  >
                    <View style={{ alignItems:'center' }}>
                      <View style={{
                        backgroundColor: st.isMe ? C.amber : bg,
                        paddingHorizontal:7, paddingVertical:4, borderRadius:8,
                        borderWidth:1.5, borderColor:'#fff', maxWidth:120,
                        alignItems:'center',
                        shadowColor:'#000', shadowOffset:{width:0,height:1},
                        shadowOpacity:0.25, shadowRadius:2, elevation:4,
                      }}>
                        {st.isMe ? (
                          <Text style={{ color:'#fff', fontWeight:'900', fontSize:11 }}>YOU 📍</Text>
                        ) : (
                          <>
                            <Text style={{ color:'#fff', fontWeight:'800', fontSize:10 }} numberOfLines={1}>{`P${i+1}: ${st.name}`}</Text>
                            <Text style={{ color:'rgba(255,255,255,0.85)', fontSize:8 }} numberOfLines={1}>{st.address}</Text>
                          </>
                        )}
                      </View>
                      <View style={{ width:0, height:0, borderLeftWidth:6, borderRightWidth:6, borderTopWidth:7, borderLeftColor:'transparent', borderRightColor:'transparent', borderTopColor: st.isMe ? C.amber : bg }} />
                      <View style={{ width:20, height:20, borderRadius:10, backgroundColor:bg, alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'#fff', marginTop:1 }}>
                        {isPicked ? <Icon name="checkmark" size={12} color="#fff" />
                          : isMissed ? <Icon name="close" size={12} color="#fff" />
                          : <Text style={{ color:'#fff', fontWeight:'900', fontSize:9 }}>{i+1}</Text>}
                      </View>
                    </View>
                  </Marker>
                );
              })}

              {/* Destination marker */}
              {destCoord && (
                <Marker coordinate={destCoord} anchor={{ x:0.5, y:1 }} title="Destination" zIndex={6}>
                  <View style={{ alignItems:'center' }}>
                    <View style={{ backgroundColor:'#DC2626', paddingHorizontal:8, paddingVertical:4, borderRadius:8, borderWidth:1.5, borderColor:'#fff' }}>
                      <Text style={{ color:'#fff', fontWeight:'900', fontSize:10 }}>🏁 DEST</Text>
                    </View>
                    <View style={{ width:0, height:0, borderLeftWidth:6, borderRightWidth:6, borderTopWidth:7, borderLeftColor:'transparent', borderRightColor:'transparent', borderTopColor:'#DC2626' }} />
                    <View style={ds.destPin}><Icon name="flag" size={14} color="#fff" /></View>
                  </View>
                </Marker>
              )}

              {/* Live van marker */}
              {vanCoord && (
                <Marker coordinate={vanCoord} anchor={{ x:0.5, y:0.5 }} title={`Van — ${driverInfo.name}`} zIndex={20}>
                  <Animated.View style={{ transform:[{ scale:vanPulse }] }}>
                    <View style={ds.vanMarker}>
                      <Icon name="bus" size={18} color="#fff" />
                    </View>
                  </Animated.View>
                </Marker>
              )}
            </MapView>
          </View>

          {/* ETA bar */}
          <View style={ds.etaBar}>
            <Icon name="hourglass-outline" size={15} color={etaToMe && etaToMe <= 10 ? "#EF4444" : C.amber} />
            <Text style={[ds.etaBarTxt, etaToMe && etaToMe <= 10 && { color:"#EF4444", fontWeight:"800" }]}>
              {(boarded || myPassengerEntry?.status === "picked")
                ? "✅ You're on board!"
                : vanArrived
                ? "🚐 Van is OUTSIDE your stop!"
                : etaToMe
                ? `Van arrives at your stop in ~${etaToMe} min${etaToMe <= 10 ? " ⚠️" : ""}`
                : "Calculating your ETA…"}
            </Text>
          </View>

          {/* ── BOARDING BUTTONS — shown directly on map card when van arrives ── */}
          {showBoardingButtons && (
            <Animated.View style={{ transform:[{ scale:boardBtnScale }] }}>
              {/* Van arrived announcement bar */}
              <View style={ds.arrivedBar}>
                <Animated.View style={{ transform:[{ scale:pulseAnim }] }}>
                 <Icon name="bus" size={22} color="#fff" />
                </Animated.View>
                <View style={{ flex:1, marginLeft:10 }}>
                  <Text style={ds.arrivedTitle}>🚐 Van is Outside!</Text>
                  <Text style={ds.arrivedSub}>
                    {myPassengerEntry?.pickupPoint || myPassengerEntry?.pickupAddress || "Your pickup stop"}
                  </Text>
                  {penaltyInfo.count > 0 && (
                    <Text style={ds.penaltyNote}>
                      ⚠️ Next penalty: Rs. {50 + penaltyInfo.count * 10}
                    </Text>
                  )}
                </View>
              </View>

              {/* Two action buttons */}
              <View style={ds.boardingBtnRow}>
                {/* I'm On Board */}
                <TouchableOpacity
                  style={ds.boardBtn}
                  onPress={handleBoardVan}
                  disabled={markingBoard || markingDecline}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={[C.main, C.dark]} style={ds.boardBtnInner}>
                    {markingBoard
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Icon name="checkmark-circle" size={22} color="#fff" />
                          <Text style={ds.boardBtnTxt}>I'm On Board!</Text>
                          <Text style={ds.boardBtnSub}>✅ Confirm boarding</Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                {/* Not Going Today */}
                <TouchableOpacity
                  style={ds.declineBtn}
                  onPress={handleNotGoingToday}
                  disabled={markingBoard || markingDecline}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#B91C1C","#7F1D1D"]} style={ds.boardBtnInner}>
                    {markingDecline
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <>
                          <Icon name="close-circle" size={22} color="#fff" />
                          <Text style={ds.boardBtnTxt}>Not Going Today</Text>
                          <Text style={ds.boardBtnSub}>
                            ⚠️ Penalty: Rs. {50 + penaltyInfo.count * 10}
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Penalty summary if any */}
          {penaltyInfo.count > 0 && !showBoardingButtons && (
            <View style={ds.penaltySummaryBar}>
              <Icon name="warning-outline" size={14} color="#B45309" />
              <Text style={ds.penaltySummaryTxt}>
                Total penalties: Rs. {penaltyInfo.total} ({penaltyInfo.count} missed boarding{penaltyInfo.count > 1 ? 's' : ''})
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  // ── Active route banner ────────────────────────────────────────────────────
  const renderActiveRouteBanner = () => {
    if (!assignedRoute || assignedRoute.status !== "in_progress") return null;
    if (boarded || myPassengerEntry?.status === "picked") return null;
    const isUrgent = vanArrived || isNextPickup;
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
              {vanArrived ? "🚐 Van is HERE — Board Now!" : isNextPickup ? "🚨 Van is Coming For You!" : "🚐 Van is En Route"}
            </Text>
            <Text style={ds.activeBannerSub}>
              {vanArrived ? "See map below — tap I'm On Board or Not Going Today" : isNextPickup ? "Get ready at your stop!" : `${pickedBeforeMe} of ${totalPassengers} picked up`}
            </Text>
            {etaToMe && !vanArrived && (
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

  // ── Driver card ────────────────────────────────────────────────────────────
  const renderDriverCard = () => {
    const hasDriver = assignedRoute && routeDriver;
    return (
      <Animated.View style={{ transform:[{ translateY:cardTranslateY }], marginBottom:14 }}>
        <View style={ds.card}>
          <LinearGradient colors={[C.main, C.dark]} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={ds.cardHeader}>
            <Icon name="person" size={18} color="#fff" />
            <Text style={ds.cardHeaderTxt}>Your Driver</Text>
            {hasDriver && (
              <View style={[ds.liveChip, { backgroundColor:"rgba(165,214,167,0.2)" }]}>
                <View style={[ds.liveDot, { backgroundColor:"#A5D6A7" }]} />
                <Text style={[ds.liveTxt, { color:"#A5D6A7" }]}>
                  {assignedRoute.status === "in_progress" ? "ACTIVE" : "ASSIGNED"}
                </Text>
              </View>
            )}
          </LinearGradient>
          {hasDriver ? (
            <>
              <View style={ds.driverBox}>
                <LinearGradient colors={[C.main, C.dark]} style={ds.driverAvatar}>
                  <Text style={ds.driverAvatarTxt}>{getInitials(driverInfo.name)}</Text>
                </LinearGradient>
                <View style={{ flex:1, marginLeft:14 }}>
                  <Text style={ds.driverName}>{driverInfo.name}</Text>
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
                <View style={ds.driverActions}>
                  {assignedRoute?.status === "in_progress" && (
                    <TouchableOpacity style={[ds.actionBtn, { position:"relative" }]} onPress={openChatWithDriver}>
                      <Icon name="chatbubble-ellipses" size={19} color={C.main} />
                      {unreadChatCount > 0 && (
                        <View style={ds.chatRedDot}>
                          <Text style={ds.chatRedDotTxt}>{unreadChatCount > 9 ? "9+" : unreadChatCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
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
              <Text style={ds.noRouteTxt}>{assignedRoute ? "Driver not yet assigned." : "No route assigned yet."}</Text>
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
          {(unreadCount > 0 || showPollModal || showMorningConf || isNextPickup || vanArrived) && (
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

        {/* Trip completed banner */}
        {tripCompleted && (
          <View style={{ backgroundColor:C.main, marginHorizontal:16, borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
            <Icon name="checkmark-done-circle" size={24} color="#fff" />
            <Text style={{ color:'#fff', fontWeight:'800', fontSize:15 }}>Trip Completed! 🎉</Text>
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

        {/* Unread notifications */}
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

      {/* Chat modal */}
      <Modal visible={chatVisible} animationType="slide">
        <View style={ds.chatContainer}>
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

          {assignedRoute?.status !== "in_progress" ? (
            <View style={ds.chatBanner}>
              <Icon name="lock-closed-outline" size={14} color="#c0392b" />
              <Text style={[ds.chatBannerTxt, { color:"#c0392b" }]}>{"  "}Chat is only available during an active ride</Text>
            </View>
          ) : (
            <View style={ds.chatBanner}>
              <Icon name="create-outline" size={14} color={typedCount < 3 ? "#555" : "#c0392b"} />
              <Text style={[ds.chatBannerTxt, { color: typedCount < 3 ? "#555" : "#c0392b" }]}>
                {"  "}{typedCount < 3 ? `Typed messages remaining: ${3 - typedCount}/3` : "No typed messages left — use quick replies"}
              </Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={(item, i) => item._id?.toString() || String(i)}
            renderItem={({ item }) => (
              <View style={[ds.bubble, item.fromDriver ? ds.bubbleDriver : ds.bubbleUser]}>
                {item.isQuickReply && (
                  <View style={ds.quickBadge}><Text style={ds.quickBadgeTxt}>⚡ Quick Reply</Text></View>
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
              </View>
            }
          />

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
                  <TouchableOpacity key={idx} style={ds.quickChip} onPress={() => sendMessage(qr, "quick_reply")}>
                    <Text style={ds.quickChipTxt}>{qr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

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
    </View>
  );
}

const ds = StyleSheet.create({
  container:          { flex:1, backgroundColor:"#F5F7FA" },
  header:             { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:18, paddingTop:46, paddingBottom:10 },
  headerTitle:        { fontSize:20, fontWeight:"800", color:"#fff", letterSpacing:0.5 },
  notifWrap:          { position:"relative", padding:4 },
  blinkDot:           { position:"absolute", top:2, right:2, width:10, height:10, borderRadius:5, backgroundColor:"#E87878" },
  badge:              { position:"absolute", top:-4, right:-4, backgroundColor:"#7A3030", borderRadius:9, minWidth:18, height:18, alignItems:"center", justifyContent:"center", paddingHorizontal:3 },
  badgeTxt:           { color:"#fff", fontSize:10, fontWeight:"800" },
  scroll:             { paddingBottom:30 },
  alertBox:           { flexDirection:"row", borderRadius:16, padding:16, marginHorizontal:16, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.18, shadowRadius:8, elevation:6 },
  alertTitle:         { fontSize:15, fontWeight:"800", color:"#fff", marginBottom:4 },
  alertText:          { fontSize:13, color:"rgba(255,255,255,0.9)", marginBottom:2 },
  alertBtns:          { flexDirection:"row", marginTop:10, gap:8 },
  confirmBtn:         { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,255,255,0.2)", paddingVertical:8, paddingHorizontal:14, borderRadius:20, gap:6 },
  cancelBtn:          { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(0,0,0,0.2)", paddingVertical:8, paddingHorizontal:14, borderRadius:20, gap:6 },
  btnText:            { color:"#fff", fontWeight:"700", fontSize:13 },
  activeBanner:       { flexDirection:"row", alignItems:"center", borderRadius:16, padding:16, ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.2,shadowRadius:10,shadowOffset:{width:0,height:4}}, android:{elevation:6} }) },
  activeBannerIcon:   { width:52, height:52, borderRadius:16, alignItems:"center", justifyContent:"center", flexShrink:0 },
  activeBannerTitle:  { fontSize:16, fontWeight:"900", marginBottom:4, letterSpacing:-0.2 },
  activeBannerSub:    { fontSize:13, color:"rgba(255,255,255,0.75)", lineHeight:18 },
  etaPill:            { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"rgba(229,154,42,0.2)", borderRadius:8, paddingVertical:4, paddingHorizontal:8, alignSelf:"flex-start", marginTop:6 },
  etaPillTxt:         { fontSize:11, fontWeight:"700", color:"#E59A2A" },
  card:               { backgroundColor:"#fff", borderRadius:16, marginBottom:2, overflow:"hidden", ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.08,shadowRadius:8,shadowOffset:{width:0,height:2}}, android:{elevation:4} }) },
  cardHeader:         { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:12, gap:8 },
  cardHeaderTxt:      { fontSize:15, fontWeight:"800", color:"#fff", flex:1 },
  cardBody:           { padding:16 },
  liveChip:           { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"rgba(255,255,255,0.15)", borderRadius:8, paddingVertical:3, paddingHorizontal:8 },
  liveDot:            { width:7, height:7, borderRadius:3.5, backgroundColor:"#fff" },
  liveTxt:            { color:"#fff", fontSize:9, fontWeight:"800", letterSpacing:0.8 },
  statusPill:         { flexDirection:"row", alignItems:"center", alignSelf:"flex-start", paddingVertical:6, paddingHorizontal:12, borderRadius:20, gap:6, marginBottom:12 },
  statusPillTxt:      { fontSize:13, fontWeight:"700" },
  routeName:          { fontSize:17, fontWeight:"800", color:"#0F1A10", marginBottom:12, letterSpacing:-0.3 },
  infoGrid:           { flexDirection:"row", flexWrap:"wrap", gap:10, marginBottom:12 },
  infoItem:           { backgroundColor:"#F0F9F1", borderRadius:10, padding:10, alignItems:"center", minWidth:90, flex:1 },
  infoLabel:          { fontSize:10, color:"#888", marginTop:4, marginBottom:2 },
  infoValue:          { fontSize:14, fontWeight:"700", color:"#333" },
  pickupRow:          { flexDirection:"row", alignItems:"center", backgroundColor:"#FFF8E1", borderRadius:10, padding:10, gap:6, marginBottom:8 },
  pickupLabel:        { fontSize:13, fontWeight:"700", color:"#FF9800" },
  pickupValue:        { fontSize:13, color:"#555", flex:1 },
  statusRow:          { flexDirection:"row", alignItems:"center", borderRadius:10, padding:10, gap:8, marginTop:4 },
  statusRowTxt:       { fontSize:13, fontWeight:"700" },
  noRouteTxt:         { color:"#999", fontSize:14, lineHeight:20, marginTop:4 },
  driverBox:          { flexDirection:"row", alignItems:"flex-start", padding:16 },
  driverAvatar:       { width:56, height:56, borderRadius:17, alignItems:"center", justifyContent:"center" },
  driverAvatarTxt:    { fontSize:20, fontWeight:"900", color:"#fff" },
  driverName:         { fontSize:16, fontWeight:"800", color:"#0F1A10", marginBottom:4, letterSpacing:-0.2 },
  ratingRow:          { flexDirection:"row", alignItems:"center", marginBottom:4 },
  ratingTxt:          { fontSize:12, color:"#666" },
  vehicleRow:         { flexDirection:"row", alignItems:"center", gap:5, marginBottom:3 },
  vehicleTxt:         { fontSize:13, color:"#555" },
  plateBadge:         { backgroundColor:"#F5F5F5", borderRadius:6, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor:"#E0E0E0" },
  plateTxt:           { fontSize:11, fontWeight:"700", color:"#333", letterSpacing:1 },
  driverActions:      { alignItems:"center", paddingLeft:8 },
  actionBtn:          { width:40, height:40, borderRadius:20, borderWidth:1.5, borderColor:"#415844", alignItems:"center", justifyContent:"center" },
  routeInfoBar:       { flexDirection:"row", borderTopWidth:1, borderTopColor:"#F0F0F0", padding:12, gap:8, flexWrap:"wrap" },
  routeInfoChip:      { flexDirection:"row", alignItems:"center", backgroundColor:"#F0F9F1", borderRadius:8, paddingVertical:5, paddingHorizontal:10, gap:4 },
  routeInfoTxt:       { fontSize:12, color:"#555", fontWeight:"600" },
  vanMarker:          { backgroundColor:"#415844", padding:7, borderRadius:18, borderWidth:2, borderColor:"#fff", elevation:6 },
  destPin:            { width:34, height:34, borderRadius:17, backgroundColor:"#DC2626", alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#fff", elevation:5 },
  etaBar:             { flexDirection:"row", alignItems:"center", padding:12, gap:8, backgroundColor:"#FFF8E1" },
  etaBarTxt:          { fontSize:13, color:"#FF9800", fontWeight:"600", flex:1 },
  // Boarding UI
  arrivedBar:         { flexDirection:"row", alignItems:"center", backgroundColor:"#1A2B1C", padding:14, gap:0 },
  arrivedTitle:       { fontSize:16, fontWeight:"900", color:"#fff", marginBottom:2 },
  arrivedSub:         { fontSize:12, color:"rgba(255,255,255,0.75)" },
  penaltyNote:        { fontSize:11, color:"#FCA5A5", marginTop:3, fontWeight:"700" },
  boardingBtnRow:     { flexDirection:"row", padding:12, gap:10 },
  boardBtn:           { flex:1, borderRadius:14, overflow:"hidden" },
  declineBtn:         { flex:1, borderRadius:14, overflow:"hidden" },
  boardBtnInner:      { paddingVertical:14, alignItems:"center", justifyContent:"center", gap:4 },
  boardBtnTxt:        { color:"#fff", fontWeight:"900", fontSize:15 },
  boardBtnSub:        { color:"rgba(255,255,255,0.8)", fontSize:11, fontWeight:"600" },
  penaltySummaryBar:  { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FEF3C7", padding:10, paddingHorizontal:14 },
  penaltySummaryTxt:  { fontSize:12, color:"#92400E", fontWeight:"600", flex:1 },
  // Chat
  chatContainer:      { flex:1, backgroundColor:"#F2F5F2" },
  chatHeader:         { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingTop:50, paddingBottom:14, gap:12 },
  chatAvatar:         { width:38, height:38, borderRadius:19, backgroundColor:"rgba(255,255,255,0.3)", alignItems:"center", justifyContent:"center" },
  chatAvatarTxt:      { fontSize:15, fontWeight:"800", color:"#fff" },
  chatName:           { fontSize:15, fontWeight:"800", color:"#fff" },
  chatSub:            { fontSize:12, color:"rgba(255,255,255,0.8)" },
  chatBanner:         { flexDirection:"row", alignItems:"center", backgroundColor:"#fffde7", paddingHorizontal:14, paddingVertical:8, borderBottomWidth:1, borderBottomColor:"#eee" },
  chatBannerTxt:      { fontSize:12, flex:1 },
  bubble:             { maxWidth:"75%", borderRadius:16, padding:12, marginBottom:8 },
  bubbleDriver:       { backgroundColor:"#fff", alignSelf:"flex-start", elevation:2 },
  bubbleUser:         { backgroundColor:"#415844", alignSelf:"flex-end" },
  bubbleTxt:          { fontSize:14, color:"#0F1A10" },
  bubbleTime:         { fontSize:11, color:"#999", marginTop:4, textAlign:"right" },
  quickBadge:         { backgroundColor:"rgba(0,0,0,0.07)", borderRadius:8, paddingHorizontal:6, paddingVertical:2, alignSelf:"flex-start", marginBottom:4 },
  quickBadgeTxt:      { fontSize:9, color:"#666" },
  quickRow:           { backgroundColor:"#fff", paddingHorizontal:12, paddingVertical:10, borderTopWidth:1, borderTopColor:"#eee" },
  quickChip:          { backgroundColor:"#e8f5e9", borderRadius:20, paddingHorizontal:14, paddingVertical:8, marginRight:8, borderWidth:1, borderColor:"#415844" },
  quickChipTxt:       { color:"#2e7d32", fontSize:12, fontWeight:"600" },
  chatInputRow:       { flexDirection:"row", alignItems:"center", padding:12, backgroundColor:"#fff", gap:8, borderTopWidth:1, borderTopColor:"#F0F0F0" },
  chatInput:          { flex:1, backgroundColor:"#F2F5F2", borderRadius:20, paddingHorizontal:16, paddingVertical:10, fontSize:14, color:"#0F1A10", maxHeight:100 },
  sendBtn:            { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center" },
  chatRedDot:         { position:"absolute", top:-5, right:-5, backgroundColor:"#EF4444", borderRadius:8, minWidth:16, height:16, alignItems:"center", justifyContent:"center", paddingHorizontal:2, borderWidth:1.5, borderColor:"#fff" },
  chatRedDotTxt:      { fontSize:8, color:"#fff", fontWeight:"900" },
  loadingOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)", alignItems:"center", justifyContent:"center", zIndex:999 },
});