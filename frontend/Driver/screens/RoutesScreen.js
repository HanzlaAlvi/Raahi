// frontend/Driver/screens/RoutesScreen.js
//
// COMPLETE MERGED VERSION — All features from both versions preserved:
//   ✅ Driver sends location every 5-10s via Socket.io (no GPS spam)
//   ✅ Only Driver calls Google Directions API — saves encodedPolyline to DB
//   ✅ Dual-confirm onboarding: passenger taps → driver confirms → both = picked
//   ✅ Driver CANNOT move to next stop until onboarding confirmed
//   ✅ Last passenger picked → GOING_TO_DESTINATION (NOT ride complete)
//   ✅ New route to final destination generated and broadcast
//   ✅ Ride complete only when driver reaches final destination
//   ✅ Smooth animated marker (no jumps)
//   ✅ DESTINATION BUG FIX: shows place name, not passenger name
//   ✅ Per-passenger chat with quick replies + typed limit
//   ✅ Reconnection + duplicate-event protection
//   ✅ OSRM road-snapped fallback when Google Directions fails
//   ✅ Passenger "Not Going" socket event + penalty banner + stop skip
//   ✅ Route Merge feature (detect + alert + coordinate)
//   ✅ FIX: Last passenger picked → auto GOING_TO_DESTINATION + destination polyline
//   ✅ FIX: Dotted polyline shown correctly for destination leg
//   ✅ FIX: allPicked triggers handleGoingToDestination automatically

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  ActivityIndicator, Platform, StyleSheet, Animated,
  TextInput, KeyboardAvoidingView, Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE   = "https://raahi-q2ur.onrender.com/api";
const SOCKET_URL = "https://raahi-q2ur.onrender.com";
const GMAPS_KEY  = "AIzaSyDs8abfEYT5Y1jQ-m9gYeL0kTAxAU5HJSU";
const MAX_TYPED  = 3;
const LOC_INTERVAL_MS = 7000;

const BRAND = "#415844";
const DARK  = "#2D3E2F";
const AMBER = "#F59E0B";
const GREEN = "#16A34A";
const RED   = "#EF4444";
const BLUE  = "#2563EB";

const DRIVER_QUICK_REPLIES = [
  { id: "d1", text: "I have arrived at your stop." },
  { id: "d2", text: "I am on my way." },
  { id: "d3", text: "Please come outside now." },
  { id: "d4", text: "I will be there in 2 minutes." },
  { id: "d5", text: "I will be there in 5 minutes." },
  { id: "d6", text: "Kindly be ready at the stop." },
  { id: "d7", text: "Route has started." },
  { id: "d8", text: "Acknowledged." },
];

const DEMO = [
  { latitude: 33.6884, longitude: 73.0512 },
  { latitude: 33.6941, longitude: 73.0389 },
  { latitude: 33.7014, longitude: 73.0287 },
  { latitude: 33.7104, longitude: 73.0192 },
  { latitude: 33.7214, longitude: 73.0072 },
];

const stopCoordinates = {
  "Chaklala Bus Stop": { latitude: 33.6008, longitude: 73.0963 },
  "Korang Road":       { latitude: 33.5830, longitude: 73.1000 },
  "Scheme 3":          { latitude: 33.5858, longitude: 73.0887 },
  "PWD Housing":       { latitude: 33.5710, longitude: 73.1450 },
  "F-7 Markaz":        { latitude: 33.7214, longitude: 73.0572 },
  "F-8 Markaz":        { latitude: 33.7100, longitude: 73.0400 },
  "F-10 Markaz":       { latitude: 33.6953, longitude: 73.0129 },
  "I-10 Markaz":       { latitude: 33.6476, longitude: 73.0388 },
  "G-11 Markaz":       { latitude: 33.6686, longitude: 72.9980 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(dL / 2) ** 2 +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveDropCoord(p) {
  const lat = p.destinationLat || p.dropLat || null;
  const lng = p.destinationLng || p.dropLng || null;
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001))
    return { latitude: Number(lat), longitude: Number(lng) };
  const key = p.destination || p.dropAddress || "";
  if (key && stopCoordinates[key]) return stopCoordinates[key];
  return null;
}

function resolveDestinationName(p) {
  const name = p.destination || p.dropAddress || p.destinationName || null;
  if (name && name.trim() && name !== p.name && name !== p.passengerName) return name;
  return "Destination";
}

function fitRegion(coords) {
  if (!coords.length) return { latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const p = 0.025;
  return {
    latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta:  Math.max(Math.max(...lats) - Math.min(...lats) + p * 2, 0.03),
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + p * 2, 0.03),
  };
}

function fmtCountdown(ms) {
  if (ms <= 0) return "now";
  const s   = Math.ceil(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function parseTimeToday(timeStr) {
  if (!timeStr) return null;
  try {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m  = parseInt(match[2], 10);
    const ap = (match[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  } catch { return null; }
}

function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
}

function getStopMeta(stop, index, allStops, waitingAtStop, passengerConfirmedForStop, completedStops) {
  const isPicked  = stop.status === "picked" || completedStops.includes(stop._id);
  const isMissed  = stop.status === "missed";
  const isWaiting = stop._id === waitingAtStop;
  const firstPendingIndex = allStops.findIndex(
    s => s.status !== "picked" && s.status !== "missed"
      && !completedStops.includes(s._id) && s._id !== waitingAtStop
  );
  const isNext = !isPicked && !isMissed && !isWaiting && firstPendingIndex === index;
  const passengerConfirmed = isWaiting && !!passengerConfirmedForStop
    && (stop.passengerId?.toString() === passengerConfirmedForStop
     || stop._id?.toString()         === passengerConfirmedForStop);

  let statusLabel = "Pending", statusColor = "#94A3B8", statusIcon = "time-outline";
  if (isPicked)                         { statusLabel = "On Board";    statusColor = BRAND; statusIcon = "checkmark-circle"; }
  if (isMissed)                         { statusLabel = "Not Going";   statusColor = RED;   statusIcon = "close-circle"; }
  if (isWaiting && !passengerConfirmed) { statusLabel = "Van Arrived"; statusColor = AMBER; statusIcon = "hourglass-outline"; }
  if (isWaiting &&  passengerConfirmed) { statusLabel = "Boarded ✓";  statusColor = GREEN; statusIcon = "checkmark-circle"; }
  if (isNext)                           { statusLabel = "Next pickup"; statusColor = BLUE;  statusIcon = "navigate"; }

  return { isPicked, isMissed, isWaiting, isNext, passengerConfirmed, statusLabel, statusColor, statusIcon };
}

// ─── Decode Google encoded polyline to coordinates ────────────────────────────
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

// ─── Get Google Directions + encoded polyline ──────────────────────────────────
async function fetchGoogleRoute(origin, waypoints, destination) {
  try {
    const wpStr = waypoints
      .map(w => `${w.latitude},${w.longitude}`)
      .join("|");
    const url = `https://maps.googleapis.com/maps/api/directions/json`
      + `?origin=${origin.latitude},${origin.longitude}`
      + `&destination=${destination.latitude},${destination.longitude}`
      + (wpStr ? `&waypoints=optimize:true|${wpStr}` : "")
      + `&key=${GMAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") return null;
    return data.routes?.[0]?.overview_polyline?.points || null;
  } catch { return null; }
}

// ─── OSRM free road-snapped polyline (fallback when Google fails) ──────────────
async function fetchOsrmRoute(origin, waypoints, destination) {
  try {
    const coords = [origin, ...waypoints, destination]
      .filter(c => c?.latitude && c?.longitude)
      .map(c => `${c.longitude},${c.latitude}`)
      .join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok") return null;
    return data.routes?.[0]?.geometry?.coordinates?.map(([lng, lat]) => ({ latitude: lat, longitude: lng })) || null;
  } catch { return null; }
}

// ─── Smooth animated marker ────────────────────────────────────────────────────
function useAnimatedCoord(coord) {
  const latAnim = useRef(new Animated.Value(coord?.latitude  || 33.6844)).current;
  const lngAnim = useRef(new Animated.Value(coord?.longitude || 73.0479)).current;
  const coordRef = useRef(coord);

  useEffect(() => {
    if (!coord?.latitude || !coord?.longitude) return;
    if (
      coord.latitude  === coordRef.current?.latitude &&
      coord.longitude === coordRef.current?.longitude
    ) return;
    coordRef.current = coord;
    Animated.parallel([
      Animated.timing(latAnim, { toValue: coord.latitude,  duration: 800, useNativeDriver: false }),
      Animated.timing(lngAnim, { toValue: coord.longitude, duration: 800, useNativeDriver: false }),
    ]).start();
  }, [coord?.latitude, coord?.longitude]);

  return { latAnim, lngAnim };
}

// ─── InlineChatPanel ──────────────────────────────────────────────────────────
function InlineChatPanel({ stop, routeId, activeTripId, driverToken, driverId, onClose, socketRef }) {
  const scrollViewRef = useRef(null);
  const [messages,   setMessages]   = useState([]);
  const [typedText,  setTypedText]  = useState("");
  const [typedCount, setTypedCount] = useState(0);
  const [sending,    setSending]    = useState(false);
  const [showQuick,  setShowQuick]  = useState(false);
  const pollRef = useRef(null);
  const passengerId = stop.passengerId || stop._id;

  const getHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` });

  const fetchMessages = useCallback(async () => {
    if (!passengerId || !driverToken) return;
    try {
      const r = await fetch(`${API_BASE}/messages/${passengerId}`, { headers: getHeaders() });
      const d = await r.json();
      if (d.success) {
        const msgs = (d.messages || []).map(m => ({
          _id: m._id, text: m.text,
          fromMe: m.senderId?.toString() === driverId,
          isQuickReply: m.isQuickReply || false,
          time: new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        }));
        setMessages(msgs);
        setTypedCount(msgs.filter(m => m.fromMe && !m.isQuickReply).length);
      }
    } catch {}
  }, [passengerId, driverToken, driverId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  const sendMessage = async (text, messageType = "typed") => {
    if (!text?.trim() || sending) return;
    if (messageType === "typed" && typedCount >= MAX_TYPED) {
      Alert.alert("Limit Reached", `You have used all ${MAX_TYPED} typed messages.`);
      return;
    }
    const tempId = `tmp_${Date.now()}`;
    setMessages(prev => [...prev, { _id: tempId, text: text.trim(), fromMe: true, isQuickReply: messageType === "quick_reply", time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) }]);
    if (messageType === "typed") setTypedCount(prev => prev + 1);
    setSending(true); setTypedText(""); setShowQuick(false);
    try {
      const r = await fetch(`${API_BASE}/messages`, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ receiverId: passengerId, text: text.trim(), messageType, routeId, rideId: activeTripId }),
      });
      const d = await r.json();
      if (d.success && d.message) {
        const real = d.message;
        setMessages(prev => prev.map(m => m._id === tempId ? {
          _id: real._id, text: real.text, fromMe: true,
          isQuickReply: real.isQuickReply || false,
          time: new Date(real.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        } : m));
        socketRef?.current?.connected && activeTripId && socketRef.current.emit("rideChat", {
          tripId: activeTripId, passengerId, text: real.text, messageType, senderId: driverId, senderRole: "driver",
        });
      } else {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        if (messageType === "typed") setTypedCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      if (messageType === "typed") setTypedCount(prev => Math.max(0, prev - 1));
    } finally { setSending(false); }
  };

  const remainingTyped = MAX_TYPED - typedCount;
  const canType        = remainingTyped > 0;

  return (
    <View style={cs.panel}>
      <View style={cs.panelHeader}>
        <View style={cs.panelAvatar}><Text style={cs.panelAvatarTxt}>{getInitials(stop.passengerName)}</Text></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={cs.panelName}>{stop.passengerName}</Text>
          <Text style={cs.panelSub}>Ride chat · secure &amp; temporary</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={cs.panelClose}><Ionicons name="close" size={20} color={DARK} /></TouchableOpacity>
      </View>
      <View style={[cs.limitBar, remainingTyped === 0 && cs.limitBarFull]}>
        <Ionicons name={canType ? "create-outline" : "ban-outline"} size={12} color={canType ? "#555" : RED} />
        <Text style={[cs.limitTxt, remainingTyped === 0 && cs.limitTxtFull]}>
          {canType ? `Custom messages remaining: ${remainingTyped}/${MAX_TYPED}` : "Limit reached — use quick replies"}
        </Text>
      </View>
      <ScrollView ref={scrollViewRef} style={cs.msgList} contentContainerStyle={{ padding: 12, paddingBottom: 4 }}>
        {messages.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#aaa", fontSize: 12, marginTop: 20 }}>No messages yet.</Text>
        ) : messages.map((item, i) => (
          <View key={item._id?.toString() || `m${i}`} style={[cs.bubble, item.fromMe ? cs.bubbleMe : cs.bubbleThem]}>
            {item.isQuickReply && <Text style={cs.quickBadge}>Quick Reply</Text>}
            <Text style={[cs.bubbleTxt, item.fromMe && { color: "#fff" }]}>{item.text}</Text>
            <Text style={[cs.bubbleTime, item.fromMe && { color: "rgba(255,255,255,0.7)" }]}>{item.time}</Text>
          </View>
        ))}
      </ScrollView>
      {showQuick && (
        <View style={cs.quickPanel}>
          <Text style={cs.quickPanelTitle}>Quick Replies</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {DRIVER_QUICK_REPLIES.map(qr => (
              <TouchableOpacity key={qr.id} style={cs.quickChip} onPress={() => sendMessage(qr.text, "quick_reply")}>
                <Text style={cs.quickChipTxt}>{qr.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={120}>
        <View style={cs.inputRow}>
          <TouchableOpacity style={[cs.quickToggle, showQuick && cs.quickToggleActive]} onPress={() => setShowQuick(v => !v)}>
            <Ionicons name="flash" size={18} color={showQuick ? BRAND : "#888"} />
          </TouchableOpacity>
          <TextInput
            style={[cs.input, !canType && cs.inputDimmed]}
            placeholder={canType ? `Message... (${remainingTyped} custom left)` : "Limit reached — use quick replies ⚡"}
            placeholderTextColor={canType ? "#aaa" : "#E57373"}
            value={typedText} onChangeText={setTypedText} editable={canType}
            maxLength={300} returnKeyType="send"
            onSubmitEditing={() => sendMessage(typedText, "typed")}
          />
          <TouchableOpacity
            style={[cs.sendBtn, (!typedText.trim() || !canType || sending) && cs.sendBtnDim]}
            onPress={() => sendMessage(typedText, "typed")}
            disabled={!typedText.trim() || !canType || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Main RoutesScreen ────────────────────────────────────────────────────────
export default function RoutesScreen({
  loading, currentRoute, routeStarted, routeStops: rawStops,
  completedStops, currentLocation, startRoute, completeRoute,
  waitingAtStop, pickupPassenger, passengerConfirmedForStop,
  fetchAssignedRoutes, driverIdRef, authTokenRef,
}) {
  const mapRef    = useRef(null);
  const scrollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const socketRef = useRef(null);
  const locTimerRef          = useRef(null);
  const polylineSentRef      = useRef(false);
  const polylineOriginRef    = useRef(null);
  const pendingBroadcastRef  = useRef(null);

  // ── FIX: guard to prevent handleGoingToDestination from firing multiple times ──
  const goingToDestCalledRef = useRef(false);

  const [openChatForStopId, setOpenChatForStopId] = useState(null);
  const [unreadMap,          setUnreadMap]         = useState({});
  const [driverToken,        setDriverToken]        = useState(null);
  const [driverId,           setDriverId]           = useState(null);
  const [countdown,          setCountdown]          = useState("");

  const [notGoingIds,   setNotGoingIds]   = useState(new Set());
  const [notGoingAlert, setNotGoingAlert] = useState(null);

  const [mergeCandidate,    setMergeCandidate]    = useState(null);
  const mergeAlertShownRef  = useRef(false);
  const mergeCheckActiveRef = useRef(false);

  const [rideState,        setRideState]        = useState("PICKING_UP");
  const [encodedPolyline,  setEncodedPolyline]  = useState(null);
  const [polylineCoords,   setPolylineCoords]   = useState([]);
  const [destPolylineCoords, setDestPolylineCoords] = useState([]);

  const { latAnim, lngAnim } = useAnimatedCoord(currentLocation);

  useEffect(() => {
    (async () => {
      const tok = await AsyncStorage.getItem("authToken");
      const uid = await AsyncStorage.getItem("userId") || await AsyncStorage.getItem("driverId");
      setDriverToken(tok);
      setDriverId(uid);
    })();
  }, []);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!routeStarted || !currentRoute?._id) return;
    try {
      const { io } = require("socket.io-client");
      if (socketRef.current?.connected) return;
      const socket = io(SOCKET_URL, { transports: ["websocket", "polling"], reconnection: true, reconnectionAttempts: 8 });

      socket.on("connect", () => {
        const rideId   = currentRoute.tripId || currentRoute._id;
        const routeId  = currentRoute._id;
        socket.emit("joinRide",  { rideId,  userId: driverId, role: "driver" });
        socket.emit("joinRoute", { routeId, userId: driverId });
        if (driverId) socket.emit("joinUser", { userId: driverId });

        if (pendingBroadcastRef.current) {
          socket.emit("routeUpdate", pendingBroadcastRef.current);
          socket.emit("startRoute",  pendingBroadcastRef.current);
          pendingBroadcastRef.current = null;
        }
        if (polylineSentRef.current && polylineOriginRef.current) {
          polylineSentRef.current = false;
        }
      });

      socket.on("rideChat", (data) => {
        const { passengerId, senderId } = data || {};
        if (!senderId || senderId?.toString() === driverId?.toString()) return;
        const stopId = routeStops.find(s =>
          s.passengerId?.toString() === passengerId?.toString() ||
          s._id?.toString()         === passengerId?.toString()
        )?._id;
        if (!stopId || openChatForStopId === stopId) return;
        setUnreadMap(prev => ({ ...prev, [stopId]: (prev[stopId] || 0) + 1 }));
      });

      socket.on("passengerReady", (data) => {});

      socket.on("passengerNotGoing", (data) => {
        const { passengerId, passengerName, penaltyAmount } = data || {};
        if (!passengerId) return;
        setNotGoingIds(prev => {
          const next = new Set(prev);
          next.add(passengerId?.toString());
          return next;
        });
        setNotGoingAlert({
          name:    passengerName || "A Passenger",
          penalty: penaltyAmount || 0,
        });
        setTimeout(() => setNotGoingAlert(null), 6000);
      });

      socket.on("routeMergeRequest", (data) => {
        const { fromDriverName, destination, myEtaMin } = data || {};
        Alert.alert(
          "Incoming Route Merge Request \u{1F500}",
          `Driver ${fromDriverName || "Another Driver"} is heading to ${destination || "the same destination"} and wants to merge routes.\n\nThey arrive in ~${myEtaMin || "?"} min.\n\nBe ready to take their passengers at the shared destination.`,
          [
            { text: "Decline", style: "cancel" },
            {
              text: "Accept & Be Ready",
              onPress: () => {
                Alert.alert(
                  "Merge Accepted \u2705",
                  `Coordinate with ${fromDriverName || "the other driver"} to transfer their passengers to your van.`,
                  [{ text: "OK" }]
                );
                if (socketRef.current?.connected) {
                  socketRef.current.emit("routeMergeAccepted", {
                    fromRouteId: data?.toRouteId,
                    toRouteId:   data?.fromRouteId,
                  });
                }
              },
            },
          ]
        );
      });

      socketRef.current = socket;
    } catch {}
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [routeStarted, currentRoute?._id, driverId]);

  // ── Location broadcasting ──────────────────────────────────────────────────
  useEffect(() => {
    if (!routeStarted || !currentLocation || !socketRef.current?.connected) return;
    if (locTimerRef.current) clearInterval(locTimerRef.current);

    locTimerRef.current = setInterval(() => {
      if (!socketRef.current?.connected || !currentLocation) return;
      const rideId  = currentRoute?.tripId || currentRoute?._id;
      const routeId = currentRoute?._id;
      const locationPayload = {
        rideId, routeId,
        latitude:  currentLocation.latitude,
        longitude: currentLocation.longitude,
      };
      socketRef.current.emit("locationUpdate",       locationPayload);
      socketRef.current.emit("driverLocationUpdate", locationPayload);

      if (polylineOriginRef.current && polylineSentRef.current) {
        const movedKm = haversineKm(
          currentLocation.latitude,
          currentLocation.longitude,
          polylineOriginRef.current.latitude,
          polylineOriginRef.current.longitude
        );
        if (movedKm >= 0.3) {
          polylineSentRef.current = false;
        }
      }

      _checkAndSendEtaAlerts(currentLocation);
    }, LOC_INTERVAL_MS);

    return () => clearInterval(locTimerRef.current);
  }, [routeStarted, currentLocation?.latitude, currentLocation?.longitude]);

  const alertedPassengersRef = useRef(new Set());
  function _checkAndSendEtaAlerts(myLoc) {
    if (!socketRef.current?.connected || !routeStops.length) return;
    const rideId = currentRoute?.tripId || currentRoute?._id;
    routeStops.forEach(stop => {
      if (stop.status === "picked" || stop.status === "missed") return;
      if (!stop.coordinate) return;
      const dist = haversineKm(myLoc.latitude, myLoc.longitude, stop.coordinate.latitude, stop.coordinate.longitude);
      const etaMin = Math.max(1, Math.round((dist / 40) * 60));
      const thresholds = [10, 5, 3, 1];
      for (const t of thresholds) {
        const key = `${stop._id}_${t}`;
        if (etaMin <= t && !alertedPassengersRef.current.has(key)) {
          alertedPassengersRef.current.add(key);
          socketRef.current.emit("tenMinAlert", {
            rideId, passengerId: stop.passengerId || stop._id,
            stopName: stop.name, etaMin, alertLevel: t,
          });
        }
      }
    });
  }

  // ── Generate + broadcast Google polyline ──────────────────────────────────
  const generateAndBroadcastPolyline = useCallback(async () => {
    if (!routeStarted || !currentRoute || polylineSentRef.current) return;
    if (!currentLocation?.latitude || !currentLocation?.longitude) return;

    const dLat = Number(currentLocation.latitude);
    const dLng = Number(currentLocation.longitude);
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng) || Math.abs(dLat) > 90 || Math.abs(dLng) > 180) return;

    polylineSentRef.current = true;
    polylineOriginRef.current = { latitude: dLat, longitude: dLng };

    const pickupWaypoints = routeStops
      .filter(s => s.status !== "picked" && s.status !== "missed")
      .map(s => s.coordinate)
      .filter(Boolean);

    const dropOff = currentRoute.dropOffLocation;
    const destLat = dropOff?.latitude
      || currentRoute.destinationLat
      || currentRoute.passengers?.[0]?.destinationLat
      || currentRoute.passengers?.[0]?.dropLat;
    const destLng = dropOff?.longitude
      || currentRoute.destinationLng
      || currentRoute.passengers?.[0]?.destinationLng
      || currentRoute.passengers?.[0]?.dropLng;

    if (!destLat || !destLng) { polylineSentRef.current = false; return; }

    const dropOffLocation = {
      latitude:  Number(destLat),
      longitude: Number(destLng),
      name:      currentRoute.destination || dropOff?.name || "Destination",
      address:   currentRoute.destination || dropOff?.address || "",
    };

    const rideId  = currentRoute.tripId || currentRoute._id;
    const routeId = currentRoute._id;

    const encoded = await fetchGoogleRoute(
      { latitude: dLat, longitude: dLng },
      pickupWaypoints,
      { latitude: Number(destLat), longitude: Number(destLng) }
    );

    if (encoded) {
      setEncodedPolyline(encoded);
      setPolylineCoords(decodePolyline(encoded));

      const broadcastPayload = {
        rideId, routeId,
        encodedPolyline: encoded,
        dropOffLocation,
        destination:    currentRoute.destination    || dropOffLocation.name,
        destinationLat: Number(destLat),
        destinationLng: Number(destLng),
        driverName:     currentRoute.driverName     || "Driver",
        vehicleType:    currentRoute.vehicleType    || "Van",
        timestamp:      Date.now(),
      };

      if (socketRef.current?.connected) {
        socketRef.current.emit("routeUpdate", broadcastPayload);
        socketRef.current.emit("startRoute",  broadcastPayload);
      } else {
        pendingBroadcastRef.current = broadcastPayload;
      }

      try {
        const tok = authTokenRef?.current || driverToken;
        await fetch(`${API_BASE}/routes/${routeId}`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ encodedPolyline: encoded }),
        });
        await fetch(`${API_BASE}/trips/${rideId}`, {
          method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ encodedPolyline: encoded }),
        }).catch(() => {});
      } catch {}

    } else {
      const osrmCoords = await fetchOsrmRoute(
        { latitude: dLat, longitude: dLng },
        pickupWaypoints,
        { latitude: Number(destLat), longitude: Number(destLng) }
      );

      const fallbackCoords = osrmCoords || [
        { latitude: dLat, longitude: dLng },
        ...pickupWaypoints,
        { latitude: Number(destLat), longitude: Number(destLng) },
      ].filter(c => c?.latitude && c?.longitude);

      setPolylineCoords(fallbackCoords);

      const fallbackPayload = {
        rideId, routeId,
        encodedPolyline: null,
        waypointCoords:  fallbackCoords,
        dropOffLocation,
        destination:    currentRoute.destination    || dropOffLocation.name,
        destinationLat: Number(destLat),
        destinationLng: Number(destLng),
        driverName:     currentRoute.driverName     || "Driver",
        vehicleType:    currentRoute.vehicleType    || "Van",
        timestamp:      Date.now(),
      };

      if (socketRef.current?.connected) {
        socketRef.current.emit("routeUpdate", fallbackPayload);
        socketRef.current.emit("startRoute",  fallbackPayload);
      } else {
        pendingBroadcastRef.current = fallbackPayload;
      }

      polylineSentRef.current = true;
    }
  }, [routeStarted, currentRoute, currentLocation, routeStops, driverToken]);

  useEffect(() => {
    if (routeStarted && currentLocation && !polylineSentRef.current) {
      generateAndBroadcastPolyline();
    }
    if (!routeStarted) {
      polylineSentRef.current     = false;
      polylineOriginRef.current   = null;
      pendingBroadcastRef.current = null;
      setEncodedPolyline(null);
      setPolylineCoords([]);
      setDestPolylineCoords([]);
      alertedPassengersRef.current = new Set();
    }
  }, [routeStarted, currentLocation?.latitude]);

  const handleArrivedAtStop = useCallback((stop) => {
    if (!socketRef.current?.connected) return;
    const rideId  = currentRoute?.tripId || currentRoute?._id;
    const routeId = currentRoute?._id;
    socketRef.current.emit("arrivedAtStop", {
      rideId, routeId,
      stopId:      stop._id,
      passengerId: stop.passengerId || stop._id,
      stopName:    stop.name || "Stop",
    });
  }, [currentRoute]);

  const handleDriverConfirmBoarding = useCallback((stop) => {
    if (!socketRef.current?.connected) return;
    const rideId  = currentRoute?.tripId || currentRoute?._id;
    const routeId = currentRoute?._id;
    socketRef.current.emit("driverConfirmBoarding", {
      rideId, routeId,
      stopId:      stop._id,
      passengerId: stop.passengerId || stop._id,
    });
    if (pickupPassenger) pickupPassenger();
  }, [currentRoute, pickupPassenger]);

  // ── handleGoingToDestination ───────────────────────────────────────────────
  const handleGoingToDestination = useCallback(async () => {
    // ── FIX: prevent double-fire ──
    if (goingToDestCalledRef.current) return;
    goingToDestCalledRef.current = true;

    const rideId  = currentRoute?.tripId || currentRoute?._id;
    const routeId = currentRoute?._id;

    const dropOff  = currentRoute?.dropOffLocation;
    const destLat  = dropOff?.latitude  || currentRoute?.destinationLat;
    const destLng  = dropOff?.longitude || currentRoute?.destinationLng;
    const destName = dropOff?.name      || currentRoute?.destination || "Destination";

    if (!destLat || !destLng || !currentLocation) {
      goingToDestCalledRef.current = false;
      return;
    }

    // Set state immediately so UI updates
    setRideState("GOING_TO_DESTINATION");

    // ── FIX: clear pickup polyline so only destination line shows ──
    setPolylineCoords([]);

    const encoded = await fetchGoogleRoute(
      currentLocation,
      [],
      { latitude: destLat, longitude: destLng }
    );

    if (encoded) {
      const decodedDest = decodePolyline(encoded);
      setDestPolylineCoords(decodedDest);
      setEncodedPolyline(encoded);
    } else {
      // OSRM fallback for destination leg
      const osrmCoords = await fetchOsrmRoute(
        currentLocation,
        [],
        { latitude: destLat, longitude: destLng }
      );
      const fallback = osrmCoords || [
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
        { latitude: destLat, longitude: destLng },
      ];
      setDestPolylineCoords(fallback);
    }

    const dropOffLocation = { latitude: destLat, longitude: destLng, name: destName, address: destName };

    socketRef.current?.emit("goingToDestination", {
      rideId, routeId,
      destinationLat:  destLat,
      destinationLng:  destLng,
      destinationName: destName,
      encodedPolyline: encoded,
      dropOffLocation,
    });

    // Fit map to show driver + destination
    if (currentLocation && destLat && destLng) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
            { latitude: destLat, longitude: destLng },
          ],
          { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true }
        );
      }, 600);
    }
  }, [currentRoute, currentLocation]);

  const handleCompleteRide = useCallback(() => {
    if (rideState !== "GOING_TO_DESTINATION") {
      Alert.alert("Not Yet", "Pick up all passengers and reach destination first.");
      return;
    }
    const rideId  = currentRoute?.tripId || currentRoute?._id;
    const routeId = currentRoute?._id;
    socketRef.current?.emit("completeRide", { rideId, routeId });
    if (completeRoute) completeRoute();
  }, [rideState, currentRoute, completeRoute]);

  useEffect(() => {
    if (!routeStarted) {
      setOpenChatForStopId(null);
      setUnreadMap({});
      setRideState("PICKING_UP");
      setNotGoingIds(new Set());
      setNotGoingAlert(null);
      setDestPolylineCoords([]);
      // ── FIX: reset guard when route resets ──
      goingToDestCalledRef.current = false;
    }
  }, [routeStarted]);

  // ── Route Merge Check ──────────────────────────────────────────────────────
  const pendingPickupCount = React.useMemo(() => {
    return (rawStops || [])
      .filter(s => s._isDriverOrigin !== true)
      .filter(s => s.status !== "picked" && s.status !== "missed").length;
  }, [rawStops]);

  useEffect(() => {
    if (!routeStarted) return;
    if (mergeAlertShownRef.current) return;
    if (mergeCheckActiveRef.current) return;
    if (pendingPickupCount !== 1) return;
    if (!currentLocation?.latitude || !currentLocation?.longitude) return;

    const destLat = currentRoute?.dropOffLocation?.latitude
      || currentRoute?.destinationLat
      || currentRoute?.passengers?.[0]?.destinationLat;
    const destLng = currentRoute?.dropOffLocation?.longitude
      || currentRoute?.destinationLng
      || currentRoute?.passengers?.[0]?.destinationLng;
    if (!destLat || !destLng) return;

    const routeId = currentRoute?._id;
    if (!routeId) return;

    mergeCheckActiveRef.current = true;

    (async () => {
      try {
        const tok = authTokenRef?.current || driverToken;
        const params = new URLSearchParams({
          routeId,
          destinationLat:  destLat,
          destinationLng:  destLng,
          driverLat:       currentLocation.latitude,
          driverLng:       currentLocation.longitude,
          remainingStops:  pendingPickupCount,
          timeSlot:        currentRoute?.timeSlot || currentRoute?.pickupTime || "",
        });
        const r = await fetch(`${API_BASE}/routes/merge-candidate?${params}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const data = await r.json();
        if (data.success && data.candidate) {
          mergeAlertShownRef.current = true;
          setMergeCandidate(data.candidate);
          Alert.alert(
            "Route Merge Available 🔀",
            `Driver ${data.candidate.driverName} is heading to the same destination (${data.candidate.destination}).\n\nYour ETA: ~${data.candidate.myEtaMin} min\nTheir ETA: ~${data.candidate.otherEtaMin} min\n\nWould you like to coordinate with them?`,
            [
              { text: "Ignore", style: "cancel", onPress: () => setMergeCandidate(null) },
              {
                text: "Coordinate Merge",
                onPress: () => {
                  if (socketRef.current?.connected) {
                    socketRef.current.emit("routeMergeRequest", {
                      fromRouteId:    currentRoute?._id,
                      toRouteId:      data.candidate.routeId,
                      fromDriverName: currentRoute?.driverName || "A Driver",
                      destination:    data.candidate.destination,
                      myEtaMin:       data.candidate.myEtaMin,
                    });
                  }
                  Alert.alert("Merge Request Sent ✅", `${data.candidate.driverName} has been notified.`, [{ text: "OK" }]);
                  setMergeCandidate(null);
                },
              },
            ]
          );
        }
      } catch (e) {
        console.warn("[RouteMerge] check failed:", e.message);
      } finally {
        mergeCheckActiveRef.current = false;
      }
    })();
  }, [pendingPickupCount, routeStarted]);

  // ── Enrich stops ───────────────────────────────────────────────────────────
  const routeStops = (rawStops || [])
    .filter(s => s._isDriverOrigin !== true)
    .map((s, i) => {
      const c     = s.coordinate;
      const valid = c?.latitude && c?.longitude && Math.abs(c.latitude - 33.6844) > 0.0002;
      const pid   = s.passengerId?.toString() || s._id?.toString();
      const localMissed = notGoingIds.has(pid);
      return {
        ...s,
        coordinate:      valid ? c : DEMO[i % DEMO.length],
        status:          localMissed ? "missed" : s.status,
        _notGoingLocal:  localMissed,
      };
    });

  // ── FIX: Auto-trigger handleGoingToDestination when allPicked becomes true ──
  // This is the KEY fix — when last passenger is confirmed picked,
  // rideState should automatically switch to GOING_TO_DESTINATION
  // without driver needing to tap the button manually.
  const pickedCount   = routeStops.filter(s => (s.status === "picked" || completedStops.includes(s._id)) && !s._notGoingLocal).length;
  const notGoingCount = routeStops.filter(s => s._notGoingLocal || s.status === "missed").length;
  const pendingCount  = routeStops.filter(
    s => s.status !== "picked"
      && !completedStops.includes(s._id)
      && s.status !== "missed"
      && !s._notGoingLocal
  ).length;
  const allPicked = pendingCount === 0 && routeStops.length > 0;

  // ── FIX: useEffect watches allPicked — auto calls handleGoingToDestination ──
  useEffect(() => {
    if (
      routeStarted &&
      allPicked &&
      rideState === "PICKING_UP" &&
      !waitingAtStop &&
      currentLocation?.latitude &&
      !goingToDestCalledRef.current
    ) {
      handleGoingToDestination();
    }
  }, [allPicked, routeStarted, rideState, waitingAtStop, currentLocation?.latitude]);

  // Pulse animation
  useEffect(() => {
    if (!waitingAtStop) { pulseAnim.setValue(1); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [waitingAtStop]);

  useEffect(() => { setCountdown(""); }, [routeStarted, currentRoute]);

  const driverOriginStop = (rawStops || []).find(s => s._isDriverOrigin === true);
  const stopCoords = routeStops.map(s => s.coordinate);

  const dropStops = useMemo(() => {
    return (currentRoute?.passengers || []).map((p, i) => {
      const coord = resolveDropCoord(p);
      if (!coord) return null;
      return {
        key:           `drop-${i}`,
        coordinate:    coord,
        passengerName: p.passengerName || p.name || `Passenger ${i + 1}`,
        destination:   resolveDestinationName(p),
      };
    }).filter(Boolean);
  }, [currentRoute?.passengers]);

  const dropCoords = dropStops.map(d => d.coordinate);

  // mapPolylineCoords — only used in PICKING_UP state
  const mapPolylineCoords = polylineCoords.length > 1 ? polylineCoords : [
    ...(currentLocation
      ? [{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }]
      : (driverOriginStop ? [driverOriginStop.coordinate] : [])
    ),
    ...stopCoords,
    ...dropCoords,
  ].filter(c => c?.latitude != null && c?.longitude != null);

  const allCoordsForFit = [
    ...(driverOriginStop ? [driverOriginStop.coordinate] : []),
    ...stopCoords,
    ...dropCoords,
  ];

  useEffect(() => {
    if (!routeStarted || routeStops.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(allCoordsForFit, {
        edgePadding: { top: 70, right: 50, bottom: 70, left: 50 }, animated: true,
      });
    }, 800);
  }, [routeStarted]);

  useEffect(() => {
    if (!routeStarted || !currentLocation) return;
    mapRef.current?.animateToRegion({ ...currentLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  const scheduledLabel = currentRoute
    ? (currentRoute.routeStartTime || currentRoute.pickupTime || currentRoute.timeSlot || null)
    : null;
  const waitingStop           = waitingAtStop ? routeStops.find(s => s._id === waitingAtStop) : null;
  const passengerHasConfirmed = waitingStop && !!passengerConfirmedForStop
    && (waitingStop.passengerId?.toString() === passengerConfirmedForStop
     || waitingStop._id?.toString()         === passengerConfirmedForStop);
  const progressPct  = routeStops.length > 0 ? (pickedCount / routeStops.length) * 100 : 0;
  const activeTripId = currentRoute?.tripId || currentRoute?._id;

  const openChat  = (stopId) => { setOpenChatForStopId(stopId); setUnreadMap(prev => ({ ...prev, [stopId]: 0 })); };
  const closeChat = () => setOpenChatForStopId(null);

  useEffect(() => {
    if (!waitingAtStop || !scrollRef.current) return;
    const idx = routeStops.findIndex(s => s._id === waitingAtStop);
    if (idx < 0) return;
    setTimeout(() => scrollRef.current?.scrollTo({ y: 760 + idx * 130, animated: true }), 700);
  }, [waitingAtStop]);

  const goingToDestBanner = rideState === "GOING_TO_DESTINATION" && (
    <View style={S.goingDestBanner}>
      <Ionicons name="navigate" size={18} color="#fff" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={S.goingDestTitle}>All passengers on board!</Text>
        <Text style={S.goingDestSub}>Heading to final destination…</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F6FAF5" }}>

      {routeStarted && waitingAtStop && (
        <View style={S.stickyWrap}>
          {passengerHasConfirmed && (
            <View style={S.stickyConfirmedRow}>
              <Ionicons name="checkmark-circle" size={16} color={GREEN} />
              <Text style={S.stickyConfirmedTxt}>
                {waitingStop?.passengerName || "Passenger"} has confirmed boarding!
              </Text>
            </View>
          )}
          <View style={S.stickyBanner}>
            <Animated.View style={[S.stickyDot, { opacity: pulseAnim }]} />
            <View style={{ flex: 1 }}>
              <Text style={S.stickyTitle}>
                {passengerHasConfirmed
                  ? `${waitingStop?.passengerName || "Passenger"} is ready — confirm to continue`
                  : `Waiting for ${waitingStop?.passengerName || "passenger"} to board…`}
              </Text>
              <Text style={S.stickySubtitle} numberOfLines={1}>{"📍 "}{waitingStop?.name || "Stop"}</Text>
              {!passengerHasConfirmed && (
                <Text style={S.stickyHint}>Ask them to tap "I'm Onboarded" in their app</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[S.stickyBtn, passengerHasConfirmed && { backgroundColor: GREEN }]}
            onPress={() => handleDriverConfirmBoarding(waitingStop)}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={S.stickyBtnTxt}>Confirm Passenger Onboarded</Text>
          </TouchableOpacity>
        </View>
      )}

      {goingToDestBanner}

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading && <ActivityIndicator color={BRAND} style={{ marginVertical: 8 }} />}

        {currentRoute ? (
          <>
            <View style={S.header}>
              <Text style={S.routeTitle} numberOfLines={2}>
                {currentRoute.routeName || currentRoute.name || "Assigned Route"}
              </Text>
              {scheduledLabel && (
                <View style={S.scheduleRow}>
                  <Ionicons name="time" size={14} color={BRAND} />
                  <Text style={S.scheduleTxt}>
                    {scheduledLabel}{currentRoute.routeEndTime ? ` → ${currentRoute.routeEndTime}` : ""}
                  </Text>
                </View>
              )}
              {routeStarted && (
                <View style={S.progressWrap}>
                  <View style={[S.progressBar, { width: `${progressPct}%` }]} />
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <View style={S.chip}>
                  <Ionicons name="people" size={12} color={BRAND} />
                  <Text style={S.chipTxt}>
                    {routeStops.length} Passengers{notGoingCount > 0 ? ` (${notGoingCount} skipped)` : ""}
                  </Text>
                </View>
                {routeStarted && (
                  <View style={S.chip}>
                    <Ionicons name="checkmark-circle" size={12} color={BRAND} />
                    <Text style={S.chipTxt}>{pickedCount}/{routeStops.length - notGoingCount} picked up</Text>
                  </View>
                )}
                {rideState === "GOING_TO_DESTINATION" && (
                  <View style={[S.chip, { backgroundColor: "#E0F2FE" }]}>
                    <Ionicons name="navigate" size={12} color={BLUE} />
                    <Text style={[S.chipTxt, { color: BLUE }]}>Heading to Destination</Text>
                  </View>
                )}
              </View>

              {!routeStarted ? (
                <TouchableOpacity style={[S.btn, { backgroundColor: BRAND }]} onPress={startRoute} disabled={loading}>
                  <Ionicons name="play" size={20} color="#fff" />
                  <Text style={S.btnTxt}>Start Route</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ gap: 10 }}>
                  {!waitingAtStop && rideState === "PICKING_UP" && !allPicked && (
                    <View style={[S.btn, { backgroundColor: "#2A4A2C" }]}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#6EE7B7" }} />
                      <Text style={S.btnTxt}>Route in Progress</Text>
                    </View>
                  )}

                  {/* Manual button hidden — auto-triggers via useEffect now */}
                  {/* Kept as fallback in case auto-trigger fails */}
                  {allPicked && rideState === "PICKING_UP" && !waitingAtStop && (
                    <TouchableOpacity
                      style={[S.btn, { backgroundColor: BLUE }]}
                      onPress={handleGoingToDestination}
                    >
                      <Ionicons name="navigate" size={20} color="#fff" />
                      <Text style={S.btnTxt}>Proceed to Destination</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[S.btn, {
                      backgroundColor: waitingAtStop || rideState === "PICKING_UP"
                        ? "#94A3B8" : "#B91C1C",
                    }]}
                    onPress={rideState === "GOING_TO_DESTINATION" ? handleCompleteRide : undefined}
                    disabled={loading || !!waitingAtStop || rideState === "PICKING_UP"}
                    activeOpacity={rideState === "GOING_TO_DESTINATION" ? 0.85 : 1}
                  >
                    <Ionicons name="stop" size={20} color="#fff" />
                    <Text style={S.btnTxt}>
                      {waitingAtStop ? "Confirm pickup first…"
                        : rideState === "PICKING_UP" ? "Pick up all passengers first"
                        : "End Route (Arrived at Destination)"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ── MAP ── */}
            <View style={S.mapWrap}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={fitRegion(allCoordsForFit)}
                showsUserLocation={false}
                showsTraffic={false}
              >
                {/* Solid green pickup-route polyline — only in PICKING_UP */}
                {rideState === "PICKING_UP" && mapPolylineCoords.length > 1 && (
                  <Polyline
                    coordinates={mapPolylineCoords}
                    strokeColor={BRAND}
                    strokeWidth={5}
                  />
                )}

                {/* ── FIX: Dotted blue destination polyline — only in GOING_TO_DESTINATION ── */}
                {rideState === "GOING_TO_DESTINATION" && destPolylineCoords.length > 1 && (
                  <Polyline
                    coordinates={destPolylineCoords}
                    strokeColor={BLUE}
                    strokeWidth={5}
                    lineDashPattern={[12, 6]}
                  />
                )}

                {/* Pickup stop markers */}
                {routeStops.map((stop, i) => {
                  const { isPicked, isMissed, isWaiting } = getStopMeta(
                    stop, i, routeStops, waitingAtStop, passengerConfirmedForStop, completedStops
                  );
                  const bg = isPicked ? BRAND : isMissed ? RED : isWaiting ? AMBER : "#64748B";
                  return (
                    <Marker key={stop._id || `stop-${i}`} coordinate={stop.coordinate}
                      anchor={{ x: 0.5, y: 0.5 }} title={stop.passengerName} description={stop.name}>
                      <View style={{ alignItems: "center" }}>
                        <View style={[S.pin, { backgroundColor: bg }]}>
                          {isPicked ? <Ionicons name="checkmark" size={14} color="#fff" />
                            : isMissed ? <Ionicons name="close" size={14} color="#fff" />
                            : <Text style={S.pinNum}>{i + 1}</Text>}
                        </View>
                        <View style={[S.pinLbl, { backgroundColor: bg }]}>
                          <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }} numberOfLines={1}>
                            {(stop.passengerName || `S${i + 1}`).split(" ")[0]}
                          </Text>
                        </View>
                      </View>
                    </Marker>
                  );
                })}

                {/* Drop-off pins */}
                {dropStops.map((drop) => (
                  <Marker
                    key={drop.key}
                    coordinate={drop.coordinate}
                    anchor={{ x: 0.5, y: 1 }}
                    title={`Drop: ${drop.destination}`}
                    description={drop.passengerName}
                    zIndex={2}
                  >
                    <View style={{ alignItems: "center" }}>
                      <View style={S.dropPin}>
                        <Ionicons name="flag" size={14} color="#fff" />
                      </View>
                      <View style={[S.pinLbl, { backgroundColor: "#DC2626" }]}>
                        <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }} numberOfLines={1}>
                          {(drop.destination || "Drop").split(" ")[0]}
                        </Text>
                      </View>
                    </View>
                  </Marker>
                ))}

                {/* Smooth animated driver marker */}
                {currentLocation && routeStarted && (() => {
                  const animCoord = { latitude: latAnim, longitude: lngAnim };
                  return (
                    <Marker.Animated
                      coordinate={animCoord}
                      anchor={{ x: 0.5, y: 0.5 }}
                      title="Van"
                      zIndex={10}
                    >
                      <View style={S.van}>
                        <Ionicons name="bus" size={20} color="#fff" />
                      </View>
                    </Marker.Animated>
                  );
                })()}
              </MapView>
              {routeStarted && (
                <View style={S.liveBadge}>
                  <View style={S.liveDot} />
                  <Text style={S.liveTxt}>LIVE</Text>
                </View>
              )}
              {encodedPolyline && rideState === "PICKING_UP" && (
                <View style={[S.liveBadge, { right: 10, left: undefined, backgroundColor: "#1E40AF" }]}>
                  <Ionicons name="navigate" size={10} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={S.liveTxt}>MAPS</Text>
                </View>
              )}
              {rideState === "GOING_TO_DESTINATION" && destPolylineCoords.length > 1 && (
                <View style={[S.liveBadge, { right: 10, left: undefined, backgroundColor: BLUE }]}>
                  <Ionicons name="flag" size={10} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={S.liveTxt}>DEST</Text>
                </View>
              )}
            </View>

            {/* Not Going Alert Banner */}
            {notGoingAlert && (
              <View style={{
                marginHorizontal: 16, marginTop: 12, backgroundColor: "#DC2626",
                borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
              }}>
                <Ionicons name="close-circle" size={26} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 14 }}>
                    {notGoingAlert.name} is NOT going today 🚫
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
                    {notGoingAlert.penalty > 0
                      ? `Their stop has been skipped. Penalty of Rs. ${notGoingAlert.penalty} applied.`
                      : "Their stop has been skipped. Proceed to next passenger."}
                  </Text>
                </View>
                <Ionicons
                  name="close" size={18} color="rgba(255,255,255,0.7)"
                  onPress={() => setNotGoingAlert(null)}
                />
              </View>
            )}

            {/* Passenger Sequence list */}
            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={[S.secTitle, { marginBottom: 12 }]}>
                {"Passenger Sequence"}
                {routeStarted
                  ? `  (${pickedCount}/${routeStops.length - notGoingCount} done${notGoingCount > 0 ? `, ${notGoingCount} skipped` : ""})`
                  : ""}
              </Text>

              {routeStops.map((stop, i) => {
                const {
                  isPicked, isMissed, isWaiting, isNext,
                  passengerConfirmed, statusLabel, statusColor, statusIcon,
                } = getStopMeta(stop, i, routeStops, waitingAtStop, passengerConfirmedForStop, completedStops);

                const numBg     = isPicked ? BRAND : isMissed ? RED : isWaiting ? AMBER : isNext ? BLUE : "#94A3B8";
                const chatOpen  = openChatForStopId === stop._id;
                const unreadCnt = unreadMap[stop._id] || 0;
                const showChat  = routeStarted && !isPicked && !isMissed;

                return (
                  <View key={stop._id || `list-${i}`}>
                    <View style={[
                      S.stopRow,
                      isWaiting && S.stopRowWaiting,
                      isNext    && S.stopRowNext,
                      isPicked  && S.stopRowPicked,
                    ]}>
                      <View style={[S.stopNum, { backgroundColor: numBg }]}>
                        {isPicked ? <Ionicons name="checkmark" size={14} color="#fff" />
                          : isMissed ? <Ionicons name="close" size={14} color="#fff" />
                          : <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>{i + 1}</Text>}
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: isPicked ? "#9CA3AF" : DARK }}>
                          {stop.passengerName}
                        </Text>
                        <Text style={{ fontSize: 12, color: "#7A9E76", marginTop: 1 }} numberOfLines={1}>
                          {"📍 "}{stop.name}
                        </Text>
                        {passengerConfirmed && (
                          <View style={S.confirmedInline}>
                            <Ionicons name="checkmark-circle" size={13} color={GREEN} />
                            <Text style={S.confirmedInlineTxt}>Passenger confirmed boarding</Text>
                          </View>
                        )}
                        {isWaiting && !passengerConfirmed && (
                          <Text style={{ fontSize: 11, color: "#B45309", marginTop: 4, fontStyle: "italic" }}>
                            Ask passenger to tap "I'm Onboarded"
                          </Text>
                        )}
                        {isWaiting && (
                          <TouchableOpacity
                            onPress={() => handleDriverConfirmBoarding(stop)}
                            activeOpacity={0.85}
                            style={[S.inlineBtn, passengerConfirmed && { backgroundColor: GREEN }]}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={S.inlineBtnTxt}>Confirm Passenger Onboarded</Text>
                          </TouchableOpacity>
                        )}
                        {isNext && (
                          <Text style={{ fontSize: 11, color: BLUE, fontWeight: "700", marginTop: 3 }}>
                            {"🚐 Van heading here next"}
                          </Text>
                        )}
                        {stop._notGoingLocal && (
                          <View style={{
                            flexDirection: "row", alignItems: "center", marginTop: 4,
                            backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 6,
                            paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start",
                          }}>
                            <Ionicons name="close-circle" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "800" }}>
                              Opted out — Stop Skipped
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6, minWidth: 64 }}>
                        <View style={{ alignItems: "center" }}>
                          <Ionicons name={statusIcon} size={18} color={statusColor} />
                          <Text style={{ fontSize: 10, color: statusColor, fontWeight: "700", marginTop: 2, textAlign: "right" }}>
                            {statusLabel}
                          </Text>
                        </View>
                        {showChat && driverToken && (
                          <TouchableOpacity
                            style={[S.chatBtn, chatOpen && S.chatBtnActive]}
                            onPress={() => chatOpen ? closeChat() : openChat(stop._id)}
                            activeOpacity={0.8}
                          >
                            <View style={{ position: "relative" }}>
                              <Ionicons
                                name={chatOpen ? "chatbubble" : "chatbubble-outline"}
                                size={17} color={chatOpen ? "#fff" : BRAND}
                              />
                              {unreadCnt > 0 && !chatOpen && (
                                <View style={S.redDot}>
                                  <Text style={S.redDotTxt}>{unreadCnt > 9 ? "9+" : unreadCnt}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[S.chatBtnTxt, chatOpen && { color: "#fff" }]}>
                              {chatOpen ? "Close" : "Chat"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {chatOpen && driverToken && (
                      <InlineChatPanel
                        stop={stop}
                        routeId={currentRoute?._id}
                        activeTripId={activeTripId}
                        driverToken={driverToken}
                        driverId={driverId}
                        onClose={closeChat}
                        socketRef={socketRef}
                      />
                    )}
                  </View>
                );
              })}

              {rideState === "GOING_TO_DESTINATION" && currentRoute?.destination && (
                <View style={[S.stopRow, { borderColor: BLUE, borderWidth: 2, backgroundColor: "#EFF6FF" }]}>
                  <View style={[S.stopNum, { backgroundColor: BLUE }]}>
                    <Ionicons name="flag" size={14} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: DARK }}>Final Destination</Text>
                    <Text style={{ fontSize: 12, color: BLUE, marginTop: 1 }} numberOfLines={2}>
                      {"🏁 "}{currentRoute.destination}
                    </Text>
                  </View>
                  <Ionicons name="navigate" size={20} color={BLUE} />
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 40 }}>
            <Ionicons name="map" size={52} color="#ACC5A8" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: "900", color: DARK, textAlign: "center" }}>No Active Routes</Text>
            <Text style={{ fontSize: 14, color: "#7A9E76", textAlign: "center", marginTop: 8, lineHeight: 20 }}>
              Transporter will assign a route after the poll closes.
            </Text>
            <TouchableOpacity
              style={[S.btn, { backgroundColor: BRAND, marginTop: 28, paddingHorizontal: 30 }]}
              onPress={() => fetchAssignedRoutes(driverIdRef.current, authTokenRef.current)}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={S.btnTxt}>Check Assignments</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  stickyWrap: {
    backgroundColor: "#FFFBEB", borderBottomWidth: 2, borderBottomColor: AMBER,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, gap: 8, zIndex: 50,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 6 } }),
  },
  stickyConfirmedRow: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DCFCE7",
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: "#86EFAC",
  },
  stickyConfirmedTxt:  { fontSize: 12, fontWeight: "800", color: "#15803D", flex: 1 },
  stickyBanner:        { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stickyDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: AMBER, marginTop: 4 },
  stickyTitle:         { fontSize: 14, fontWeight: "800", color: "#92400E" },
  stickySubtitle:      { fontSize: 12, color: "#B45309", marginTop: 2 },
  stickyHint:          { fontSize: 11, color: "#B45309", marginTop: 3, fontStyle: "italic" },
  stickyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: BRAND, borderRadius: 14, paddingVertical: 13, gap: 8,
    ...Platform.select({ ios: { shadowColor: BRAND, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 4 } }),
  },
  stickyBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },

  goingDestBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: BLUE, paddingHorizontal: 16, paddingVertical: 12,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 4 } }),
  },
  goingDestTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  goingDestSub:   { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },

  header: {
    backgroundColor: "#fff", borderRadius: 22, padding: 18, margin: 16, marginBottom: 0,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }),
  },
  routeTitle:     { fontSize: 20, fontWeight: "900", color: DARK, marginBottom: 4 },
  scheduleRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  scheduleTxt:    { fontSize: 13, color: BRAND, fontWeight: "700" },
  countdownBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countdownTxt:   { color: "#92400E", fontSize: 11, fontWeight: "800" },
  progressWrap:   { height: 5, backgroundColor: "#E5EBE5", borderRadius: 3, marginTop: 6, marginBottom: 2, overflow: "hidden" },
  progressBar:    { height: 5, backgroundColor: BRAND, borderRadius: 3 },
  chip:    { flexDirection: "row", alignItems: "center", backgroundColor: "#EEF4ED", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 4 },
  chipTxt: { fontSize: 12, color: DARK, fontWeight: "700" },
  btn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 15, gap: 8 },
  btnTxt:  { color: "#fff", fontWeight: "900", fontSize: 15 },

  mapWrap: {
    height: 300, marginHorizontal: 16, marginTop: 16, borderRadius: 24,
    overflow: "hidden", borderWidth: 2, borderColor: "#C8DEC5", position: "relative",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 5 } }),
  },
  liveBadge: {
    position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center",
    backgroundColor: "#1D4ED8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6EE7B7", marginRight: 5 },
  liveTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },

  secTitle: { fontSize: 17, fontWeight: "900", color: DARK },
  stopRow: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff",
    borderRadius: 16, padding: 14, marginBottom: 6,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 }, android: { elevation: 2 } }),
  },
  stopRowWaiting: { borderWidth: 2, borderColor: AMBER, backgroundColor: "#FFFBEB" },
  stopRowNext:    { borderWidth: 1.5, borderColor: BLUE, backgroundColor: "#EFF6FF" },
  stopRowPicked:  { opacity: 0.55 },
  stopNum:        { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 2 },

  confirmedInline: {
    flexDirection: "row", alignItems: "center", marginTop: 5, gap: 4,
    backgroundColor: "#DCFCE7", borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6, alignSelf: "flex-start",
  },
  confirmedInlineTxt: { fontSize: 11, color: GREEN, fontWeight: "700" },
  inlineBtn: {
    marginTop: 8, flexDirection: "row", alignItems: "center", backgroundColor: BRAND,
    alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10, gap: 5,
  },
  inlineBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 12 },
  chatBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EEF4ED", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1.5, borderColor: "#C8DEC5",
  },
  chatBtnActive: { backgroundColor: BRAND, borderColor: BRAND },
  chatBtnTxt:    { fontSize: 12, fontWeight: "800", color: BRAND },
  redDot: {
    position: "absolute", top: -5, right: -6, backgroundColor: RED, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#fff",
  },
  redDotTxt: { fontSize: 8, color: "#fff", fontWeight: "900" },
  dropPin:  { width: 28, height: 28, borderRadius: 14, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff", elevation: 4 },
  pin:      { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 4 },
  pinNum:   { color: "#fff", fontWeight: "900", fontSize: 13 },
  pinLbl:   { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 1, maxWidth: 80, alignItems: "center" },
  van:      { width: 46, height: 46, borderRadius: 23, backgroundColor: "#2A4A2C", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 9 },
});

const cs = StyleSheet.create({
  panel: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 8, marginTop: 2,
    borderWidth: 1.5, borderColor: "#C8DEC5", overflow: "hidden",
    ...Platform.select({ ios: { shadowColor: BRAND, shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }),
  },
  panelHeader:    { flexDirection: "row", alignItems: "center", backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 10 },
  panelAvatar:    { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  panelAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  panelName:      { fontSize: 14, fontWeight: "800", color: "#fff" },
  panelSub:       { fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  panelClose:     { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  limitBar:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFDE7", paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#FFF9C4" },
  limitBarFull:   { backgroundColor: "#FFEBEE" },
  limitTxt:       { fontSize: 11, color: "#555", flex: 1 },
  limitTxtFull:   { color: RED },
  msgList:        { maxHeight: 200 },
  bubble:         { maxWidth: "80%", borderRadius: 14, padding: 10, marginVertical: 3 },
  bubbleMe:       { alignSelf: "flex-end", backgroundColor: BRAND },
  bubbleThem:     { alignSelf: "flex-start", backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  bubbleTxt:      { fontSize: 13, color: DARK, lineHeight: 18 },
  bubbleTime:     { fontSize: 9, color: "#888", marginTop: 3, textAlign: "right" },
  quickBadge:     { fontSize: 9, color: "#666", backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, alignSelf: "flex-start", marginBottom: 3 },
  quickPanel:     { backgroundColor: "#F8FFF8", borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 8 },
  quickPanelTitle:{ fontSize: 11, color: "#888", fontWeight: "700", marginBottom: 6 },
  quickChip:      { backgroundColor: "#EEF4ED", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: "#C8DEC5" },
  quickChipTxt:   { fontSize: 12, color: DARK, fontWeight: "600" },
  inputRow:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  quickToggle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  quickToggleActive: { backgroundColor: "#EEF4ED" },
  input:          { flex: 1, backgroundColor: "#F5F5F5", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: DARK, maxHeight: 80 },
  inputDimmed:    { backgroundColor: "#FAFAFA", color: "#ccc" },
  sendBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  sendBtnDim:     { backgroundColor: "#C8DEC5" },
});