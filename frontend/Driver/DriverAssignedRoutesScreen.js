// frontend/Driver/DriverAssignedRoutesScreen.js
// UPDATED: Real backend data, Socket.io live van tracking, Google Maps PROVIDER_GOOGLE
// This is the TRANSPORTER view — shows live van position + all passengers on map
// Transporter joins the trip socket room and receives real-time vanLocationUpdate

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Alert,
  Modal, Dimensions, ActivityIndicator, StyleSheet,
  Platform, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

const API_BASE_URL        = "https://raahi-q2ur.onrender.com/api";
const SOCKET_URL          = "https://raahi-q2ur.onrender.com";
const GOOGLE_MAPS_API_KEY = "AIzaSyAcJ_VcbM_Dn64YLSIkJ-zrqlwXXMvjnnQ";

const BRAND = "#415844";
const DARK  = "#2D3E2F";

// Fallback Rawalpindi/Islamabad coords if DB has no coordinates
const DEMO_COORDS = [
  { latitude: 33.6884, longitude: 73.0512 },
  { latitude: 33.6941, longitude: 73.0389 },
  { latitude: 33.7014, longitude: 73.0287 },
  { latitude: 33.7104, longitude: 73.0192 },
  { latitude: 33.7214, longitude: 73.0072 },
];

function fitRegion(coords) {
  if (!coords || !coords.length) {
    return { latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  }
  const lats = coords.map(c => c.latitude);
  const lngs = coords.map(c => c.longitude);
  const pad  = 0.03;
  return {
    latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta:  Math.max(Math.max(...lats) - Math.min(...lats) + pad * 2, 0.04),
    longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs) + pad * 2, 0.04),
  };
}

function haversine(la1, ln1, la2, ln2) {
  const R = 6371, d2r = Math.PI / 180;
  const dL = (la2 - la1) * d2r, dl = (ln2 - ln1) * d2r;
  const a  = Math.sin(dL / 2) ** 2 + Math.cos(la1 * d2r) * Math.cos(la2 * d2r) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DriverAssignedRoutesScreen({ navigation }) {
  const authTokenRef    = useRef(null);
  const transporterIdRef = useRef(null);
  const socketRef       = useRef(null);
  const activeTripIdRef = useRef(null);
  const mapRef          = useRef(null);

  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeRoutes,  setActiveRoutes]  = useState([]);
  const [activeTrips,   setActiveTrips]   = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedTrip,  setSelectedTrip]  = useState(null);
  const [vanPosition,   setVanPosition]   = useState(null);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [mapExpanded,   setMapExpanded]   = useState(false);
  const [detailStop,    setDetailStop]    = useState(null);
  const [showDetail,    setShowDetail]    = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for live van marker
  useEffect(() => {
    if (isLiveTracking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isLiveTracking]);

  // Load auth data on mount
  useEffect(() => {
    loadAuth();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const loadAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const uid   = await AsyncStorage.getItem("userId");
      if (!token || !uid) {
        navigation?.reset({ index: 0, routes: [{ name: "Login" }] });
        return;
      }
      authTokenRef.current      = token;
      transporterIdRef.current  = uid;
      await fetchData(token, uid);
      initSocket();
    } catch (e) {
      console.error("[DriverAssignedRoutesScreen] loadAuth:", e);
    }
  };

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${authTokenRef.current}`,
  });

  // Fetch all assigned routes and active trips
  const fetchData = async (tok, uid) => {
    setLoading(true);
    try {
      const tId = uid || transporterIdRef.current;
      const token = tok || authTokenRef.current;

      // Fetch routes
      const routeRes = await fetch(
        `${API_BASE_URL}/routes?transporterId=${tId}`,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      const routeData = await routeRes.json();
      const routes = (routeData.routes || routeData.data || []).filter(r =>
        ["assigned", "in_progress", "active"].includes(r.status)
      );
      setActiveRoutes(routes);

      // Fetch active trips
      const tripRes = await fetch(
        `${API_BASE_URL}/trips/active?transporterId=${tId}`,
        { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
      );
      const tripData = await tripRes.json();
      const trips = tripData.trips || tripData.data || [];
      setActiveTrips(trips);

      // Auto-select first in_progress route
      const liveRoute = routes.find(r => r.status === "in_progress");
      if (liveRoute) {
        setSelectedRoute(liveRoute);
        // Find matching trip
        const matchTrip = trips.find(t =>
          t.routeId?.toString() === liveRoute._id?.toString() ||
          t.routeId === liveRoute._id
        );
        if (matchTrip) {
          setSelectedTrip(matchTrip);
          activeTripIdRef.current = matchTrip._id?.toString();
          // Get last known van location from trip
          const lat = matchTrip.currentLocation?.latitude;
          const lng = matchTrip.currentLocation?.longitude;
          if (lat && lng) {
            setVanPosition({ latitude: Number(lat), longitude: Number(lng) });
          }
        }
      } else if (routes.length > 0) {
        setSelectedRoute(routes[0]);
      }
    } catch (e) {
      console.error("[fetchData]:", e);
    } finally {
      setLoading(false);
    }
  };

  // Socket.io — transporter joins trip room to receive live van updates
  const initSocket = useCallback(() => {
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
        console.log("[Socket] Transporter connected:", socket.id);
        // Join trip room if we have an active trip
        if (activeTripIdRef.current) {
          socket.emit("joinTrip", activeTripIdRef.current);
          console.log("[Socket] Transporter joined trip room:", activeTripIdRef.current);
        }
      });

      // Real-time van location from driver
      socket.on("vanLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat != null && lng != null) {
          const newPos = { latitude: Number(lat), longitude: Number(lng) };
          setVanPosition(newPos);
          setIsLiveTracking(true);

          // Smoothly animate map to follow van
          mapRef.current?.animateToRegion(
            { ...newPos, latitudeDelta: 0.025, longitudeDelta: 0.025 },
            600
          );
        }
      });

      // Passenger status changed (boarded / missed)
      socket.on("passengerStatusUpdate", (data) => {
        console.log("[Socket] Transporter received passengerStatusUpdate:", data);
        // Refresh trip data to show updated passenger status
        fetchData(authTokenRef.current, transporterIdRef.current);
      });

      // Route completed
      socket.on("routeCompleted", () => {
        setIsLiveTracking(false);
        Alert.alert("Route Completed", "The driver has completed this route.");
        fetchData(authTokenRef.current, transporterIdRef.current);
      });

      socket.on("disconnect", (reason) => {
        console.log("[Socket] Transporter disconnected:", reason);
        setIsLiveTracking(false);
      });

      socketRef.current = socket;
    } catch (e) {
      console.log("[Socket] socket.io-client not available:", e.message);
    }
  }, []);

  // Join socket room when selectedTrip changes
  useEffect(() => {
    if (!selectedTrip?._id) return;
    const tripId = selectedTrip._id.toString();
    activeTripIdRef.current = tripId;
    if (socketRef.current?.connected) {
      socketRef.current.emit("joinTrip", tripId);
      console.log("[Socket] Transporter joined new trip room:", tripId);
    }
    // Load last known van position
    const lat = selectedTrip.currentLocation?.latitude;
    const lng = selectedTrip.currentLocation?.longitude;
    if (lat && lng) {
      setVanPosition({ latitude: Number(lat), longitude: Number(lng) });
    }
  }, [selectedTrip?._id]);

  // Auto-fit map when route changes
  useEffect(() => {
    if (!selectedRoute) return;
    const coords = buildStopCoords(selectedRoute);
    if (coords.length < 1) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 70, right: 50, bottom: 70, left: 50 },
        animated: true,
      });
    }, 600);
  }, [selectedRoute?._id]);

  const buildStopCoords = (route) => {
    if (!route) return [];
    const passengers = route.passengers || [];
    const coords = passengers.map((p, i) => {
      const lat = p.pickupLat || p.latitude || 0;
      const lng = p.pickupLng || p.longitude || 0;
      const valid = lat && lng && Math.abs(lat - 33.6844) > 0.0002;
      return valid ? { latitude: lat, longitude: lng } : DEMO_COORDS[i % DEMO_COORDS.length];
    });
    // Add destination
    if (route.destinationLat && route.destinationLng) {
      coords.push({ latitude: route.destinationLat, longitude: route.destinationLng });
    }
    return coords;
  };

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    setVanPosition(null);
    setIsLiveTracking(false);
    // Find matching trip
    const matchTrip = activeTrips.find(t =>
      t.routeId?.toString() === route._id?.toString() ||
      t.routeId === route._id
    );
    if (matchTrip) {
      setSelectedTrip(matchTrip);
    } else {
      setSelectedTrip(null);
    }
  };

  const openStopDetail = (stop) => {
    setDetailStop(stop);
    setShowDetail(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(authTokenRef.current, transporterIdRef.current);
    setRefreshing(false);
  };

  // Build enriched stop list from selected route
  const routeStops = selectedRoute
    ? (selectedRoute.passengers || []).map((p, i) => {
        const lat = p.pickupLat || p.latitude || 0;
        const lng = p.pickupLng || p.longitude || 0;
        const valid = lat && lng && Math.abs(lat - 33.6844) > 0.0002;
        const coord = valid ? { latitude: lat, longitude: lng } : DEMO_COORDS[i % DEMO_COORDS.length];

        // Check status from matching trip passengers
        let passengerStatus = p.status || "pending";
        if (selectedTrip?.passengers) {
          const tripP = selectedTrip.passengers.find(tp =>
            tp._id?.toString() === p.passengerId?.toString() ||
            tp.passengerId?.toString() === p.passengerId?.toString()
          );
          if (tripP?.status) passengerStatus = tripP.status;
        }
        return {
          id:            p._id?.toString() || `p-${i}`,
          passengerId:   p.passengerId?.toString(),
          name:          `Stop ${i + 1} - ${p.pickupPoint || p.pickupAddress || "Pickup"}`,
          passenger:     p.passengerName || "Passenger",
          status:        passengerStatus,
          pickupPoint:   p.pickupPoint || p.pickupAddress || "N/A",
          destination:   p.destination || selectedRoute.destination || "Destination",
          coordinate:    coord,
          vehiclePref:   p.vehiclePreference || null,
        };
      })
    : [];

  const stopCoords    = routeStops.map(s => s.coordinate);
  const pickedCount   = routeStops.filter(s => s.status === "picked").length;
  const missedCount   = routeStops.filter(s => s.status === "missed").length;
  const pendingCount  = routeStops.length - pickedCount - missedCount;
  const progressPct   = routeStops.length ? (pickedCount / routeStops.length) * 100 : 0;

  // Polyline: all stops + destination
  const polylineCoords = [...stopCoords];
  if (selectedRoute?.destinationLat && selectedRoute?.destinationLng) {
    polylineCoords.push({ latitude: selectedRoute.destinationLat, longitude: selectedRoute.destinationLng });
  }

  const isRouteActive = selectedRoute?.status === "in_progress";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assigned Routes</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {isLiveTracking && (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveChipTxt}>LIVE</Text>
            </View>
          )}
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={refreshing}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing && (
        <ActivityIndicator color={BRAND} size="large" style={{ marginTop: 20 }} />
      )}

      {!loading && activeRoutes.length === 0 && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Ionicons name="map-outline" size={60} color="#ACC5A8" />
          <Text style={{ fontSize: 18, fontWeight: "800", color: DARK, marginTop: 16, textAlign: "center" }}>
            No Active Routes
          </Text>
          <Text style={{ color: "#7A9E76", marginTop: 8, textAlign: "center", lineHeight: 20 }}>
            No routes are currently assigned or in progress.
          </Text>
          <TouchableOpacity style={[styles.actionBtn, { marginTop: 24 }]} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.actionBtnTxt}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeRoutes.length > 0 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Route selector tabs — if multiple routes */}
          {activeRoutes.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 4 }}>
              {activeRoutes.map(route => (
                <TouchableOpacity
                  key={route._id}
                  style={[styles.routeTab, selectedRoute?._id === route._id && styles.routeTabActive]}
                  onPress={() => handleSelectRoute(route)}
                >
                  <Text style={[styles.routeTabTxt, selectedRoute?._id === route._id && { color: "#fff" }]} numberOfLines={1}>
                    {route.routeName || route.name || "Route"}
                  </Text>
                  {route.status === "in_progress" && (
                    <View style={styles.routeTabLiveDot} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {selectedRoute && (
            <>
              {/* Route Summary Card */}
              <View style={[styles.card, { marginHorizontal: 16, marginTop: 12 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {selectedRoute.routeName || selectedRoute.name || "Route"}
                  </Text>
                  <View style={[styles.statusBadge, {
                    backgroundColor: isRouteActive ? "#DEF7E5" : "#FEF3C7"
                  }]}>
                    <Text style={[styles.statusBadgeTxt, {
                      color: isRouteActive ? "#15803D" : "#92400E"
                    }]}>
                      {isRouteActive ? "In Progress" : "Assigned"}
                    </Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <StatBox icon="people" label="Total" value={routeStops.length} color={DARK} />
                  <StatBox icon="checkmark-circle" label="Picked" value={pickedCount} color="#15803D" />
                  <StatBox icon="close-circle" label="Missed" value={missedCount} color="#DC2626" />
                  <StatBox icon="time" label="Pending" value={pendingCount} color="#D97706" />
                </View>

                {/* Progress bar */}
                {isRouteActive && (
                  <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: "#7A9E76", fontWeight: "700" }}>Progress</Text>
                      <Text style={{ fontSize: 12, color: BRAND, fontWeight: "800" }}>{progressPct.toFixed(0)}%</Text>
                    </View>
                    <View style={styles.progBg}>
                      <View style={[styles.progFill, { width: `${progressPct}%` }]} />
                    </View>
                  </View>
                )}

                {/* Route meta info */}
                <View style={{ marginTop: 12, gap: 5 }}>
                  {(selectedRoute.routeStartTime || selectedRoute.pickupTime || selectedRoute.timeSlot) && (
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={14} color={BRAND} />
                      <Text style={styles.metaTxt}>
                        Pickup: {selectedRoute.routeStartTime || selectedRoute.pickupTime || selectedRoute.timeSlot}
                        {selectedRoute.routeEndTime ? ` → ${selectedRoute.routeEndTime}` : ""}
                      </Text>
                    </View>
                  )}
                  {selectedRoute.driverName && (
                    <View style={styles.metaRow}>
                      <Ionicons name="person-outline" size={14} color={BRAND} />
                      <Text style={styles.metaTxt}>Driver: {selectedRoute.driverName}</Text>
                    </View>
                  )}
                  {selectedRoute.vehicleType && (
                    <View style={styles.metaRow}>
                      <Ionicons name="car-outline" size={14} color={BRAND} />
                      <Text style={styles.metaTxt}>Vehicle: {selectedRoute.vehicleType}</Text>
                    </View>
                  )}
                  {selectedRoute.destination && (
                    <View style={styles.metaRow}>
                      <Ionicons name="flag-outline" size={14} color="#DC2626" />
                      <Text style={styles.metaTxt}>Destination: {selectedRoute.destination}</Text>
                    </View>
                  )}
                </View>

                {/* Live tracking info */}
                {isLiveTracking && vanPosition && (
                  <View style={styles.liveTrackingBanner}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Ionicons name="radio" size={18} color="#15803D" />
                    </Animated.View>
                    <Text style={styles.liveTrackingTxt}>
                      Live van location: {vanPosition.latitude.toFixed(5)}, {vanPosition.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}
                {isRouteActive && !isLiveTracking && (
                  <View style={[styles.liveTrackingBanner, { backgroundColor: "#FFF8E1", borderColor: "#F59E0B" }]}>
                    <Ionicons name="time-outline" size={18} color="#D97706" />
                    <Text style={[styles.liveTrackingTxt, { color: "#92400E" }]}>
                      Waiting for driver to start emitting location...
                    </Text>
                  </View>
                )}
              </View>

              {/* GOOGLE MAP — shows full route + van live position */}
              <View style={[styles.mapContainer, { height: mapExpanded ? height * 0.6 : 280 }, { marginHorizontal: 16 }]}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFill}
                  initialRegion={fitRegion(stopCoords.length ? stopCoords : DEMO_COORDS.slice(0, 3))}
                  showsUserLocation={false}
                  showsTraffic={isRouteActive}
                  showsBuildings={true}
                  showsCompass={true}
                  mapType="standard"
                >
                  {/* Full route polyline: all stops → destination */}
                  {polylineCoords.length > 1 && (
                    <Polyline
                      coordinates={polylineCoords}
                      strokeColor={BRAND}
                      strokeWidth={5}
                      lineDashPattern={isRouteActive ? undefined : [10, 5]}
                    />
                  )}

                  {/* Destination marker */}
                  {selectedRoute.destinationLat && selectedRoute.destinationLng && (
                    <Marker
                      coordinate={{ latitude: selectedRoute.destinationLat, longitude: selectedRoute.destinationLng }}
                      title="Destination"
                      description={selectedRoute.destination || "Final Stop"}
                      anchor={{ x: 0.5, y: 1 }}
                    >
                      <View style={styles.destMarker}>
                        <Ionicons name="flag" size={18} color="#fff" />
                      </View>
                    </Marker>
                  )}

                  {/* Passenger stop markers */}
                  {routeStops.map((stop, index) => {
                    const isPicked  = stop.status === "picked";
                    const isMissed  = stop.status === "missed";
                    const isPending = !isPicked && !isMissed;
                    const bg        = isPicked ? BRAND : isMissed ? "#DC2626" : "#F59E0B";

                    return (
                      <Marker
                        key={stop.id}
                        coordinate={stop.coordinate}
                        title={`Stop ${index + 1}: ${stop.passenger}`}
                        description={stop.pickupPoint}
                        onPress={() => openStopDetail(stop)}
                        anchor={{ x: 0.5, y: 0.5 }}
                      >
                        <View style={styles.stopMarkerWrap}>
                          <View style={[styles.stopMarker, { backgroundColor: bg }]}>
                            {isPicked
                              ? <Ionicons name="checkmark" size={13} color="#fff" />
                              : isMissed
                              ? <Ionicons name="close"     size={13} color="#fff" />
                              : <Text style={styles.stopMarkerNum}>{index + 1}</Text>
                            }
                          </View>
                          <View style={[styles.stopMarkerLabel, { backgroundColor: bg }]}>
                            <Text style={styles.stopMarkerLabelTxt} numberOfLines={1}>
                              {stop.passenger.split(" ")[0]}
                            </Text>
                          </View>
                        </View>
                      </Marker>
                    );
                  })}

                  {/* Live van marker — shown when route is in_progress */}
                  {vanPosition && isRouteActive && (
                    <Marker
                      coordinate={vanPosition}
                      title="Van (Live)"
                      description={selectedRoute.driverName ? `Driver: ${selectedRoute.driverName}` : "Driver's van"}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={20}
                    >
                      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <View style={styles.vanMarker}>
                          <Ionicons name="bus" size={20} color="#fff" />
                        </View>
                      </Animated.View>
                    </Marker>
                  )}
                </MapView>

                {/* Map overlay controls */}
                <View style={styles.mapOverlay}>
                  <TouchableOpacity
                    style={styles.mapButton}
                    onPress={() => setMapExpanded(!mapExpanded)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={mapExpanded ? "contract" : "expand"} size={16} color="#fff" />
                    <Text style={styles.mapButtonText}>{mapExpanded ? "Collapse" : "Expand"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Live badge */}
                {isRouteActive && (
                  <View style={styles.mapLiveBadge}>
                    <View style={styles.mapLiveDot} />
                    <Text style={styles.mapLiveTxt}>
                      {isLiveTracking ? "LIVE • Google Maps" : "Google Maps"}
                    </Text>
                  </View>
                )}
              </View>

              {/* Passenger list */}
              <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
                <Text style={styles.cardTitle}>Passenger Stops</Text>
                <Text style={{ fontSize: 12, color: "#7A9E76", marginBottom: 14, marginTop: 2 }}>
                  Tap a stop to see details
                </Text>

                {routeStops.map((stop, index) => {
                  const isPicked = stop.status === "picked";
                  const isMissed = stop.status === "missed";
                  const bg       = isPicked ? "#F0F7EE" : isMissed ? "#FEF2F2" : "#fff";
                  const borderC  = isPicked ? "#A7D9A0" : isMissed ? "#FECACA" : "#E2EBE1";
                  const dotC     = isPicked ? BRAND : isMissed ? "#DC2626" : "#D97706";

                  return (
                    <TouchableOpacity
                      key={stop.id}
                      style={[styles.stopRow, { backgroundColor: bg, borderColor: borderC }]}
                      onPress={() => openStopDetail(stop)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[styles.stopNumBadge, { backgroundColor: dotC }]}>
                          {isPicked
                            ? <Ionicons name="checkmark" size={14} color="#fff" />
                            : isMissed
                            ? <Ionicons name="close"     size={14} color="#fff" />
                            : <Text style={styles.stopNumTxt}>{index + 1}</Text>
                          }
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.stopPassengerName} numberOfLines={1}>{stop.passenger}</Text>
                          <Text style={styles.stopAddress} numberOfLines={1}>📍 {stop.pickupPoint}</Text>
                          {stop.vehiclePref && (
                            <Text style={{ fontSize: 11, color: "#7A9E76", marginTop: 2 }}>
                              Pref: {stop.vehiclePref}
                            </Text>
                          )}
                        </View>

                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <View style={[styles.stopStatusBadge, {
                            backgroundColor: isPicked ? "#DEF7E5" : isMissed ? "#FEE2E2" : "#FEF3C7"
                          }]}>
                            <Text style={[styles.stopStatusTxt, {
                              color: isPicked ? "#15803D" : isMissed ? "#DC2626" : "#92400E"
                            }]}>
                              {isPicked ? "Boarded" : isMissed ? "Missed" : "Pending"}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* Stop detail modal */}
      <Modal visible={showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Stop Details</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Ionicons name="close" size={24} color={DARK} />
              </TouchableOpacity>
            </View>

            {detailStop && (
              <>
                <View style={styles.modalRow}>
                  <Ionicons name="person" size={18} color={BRAND} />
                  <Text style={styles.modalLabel}>Passenger:</Text>
                  <Text style={styles.modalValue}>{detailStop.passenger}</Text>
                </View>
               <View style={styles.modalRow}>
  <Ionicons name="location" size={18} color="#F59E0B" />
  <Text style={styles.modalLabel}>Pickup:</Text>
  <Text style={[styles.modalValue, { flex: 1 }]}>
    {detailStop.pickupPoint}
  </Text>
</View>
                <View style={styles.modalRow}>
                  <Ionicons name="flag" size={18} color="#DC2626" />
                  <Text style={styles.modalLabel}>Drop:</Text>
                  <Text style={styles.modalValue}>{detailStop.destination}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Ionicons name="information-circle" size={18} color={BRAND} />
                  <Text style={styles.modalLabel}>Status:</Text>
                  <View style={[styles.stopStatusBadge, {
                    backgroundColor: detailStop.status === "picked" ? "#DEF7E5" : detailStop.status === "missed" ? "#FEE2E2" : "#FEF3C7"
                  }]}>
                    <Text style={[styles.stopStatusTxt, {
                      color: detailStop.status === "picked" ? "#15803D" : detailStop.status === "missed" ? "#DC2626" : "#92400E"
                    }]}>
                      {detailStop.status === "picked" ? "Boarded ✅" : detailStop.status === "missed" ? "Missed ❌" : "Pending ⏳"}
                    </Text>
                  </View>
                </View>
                {detailStop.vehiclePref && (
                  <View style={styles.modalRow}>
                    <Ionicons name="car" size={18} color={BRAND} />
                    <Text style={styles.modalLabel}>Vehicle Pref:</Text>
                    <Text style={styles.modalValue}>{detailStop.vehiclePref}</Text>
                  </View>
                )}
                <View style={styles.modalRow}>
                  <Ionicons name="map" size={18} color={BRAND} />
                  <Text style={styles.modalLabel}>Coords:</Text>
                  <Text style={styles.modalValue}>
                    {detailStop.coordinate.latitude.toFixed(5)}, {detailStop.coordinate.longitude.toFixed(5)}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity style={[styles.actionBtn, { marginTop: 16 }]} onPress={() => setShowDetail(false)}>
              <Text style={styles.actionBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatBox({ icon, label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: "#F2F5F2" },
  header:             { backgroundColor: BRAND, paddingTop: Platform.OS === "android" ? 40 : 54, paddingBottom: 16, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:        { fontSize: 22, fontWeight: "900", color: "#fff" },
  refreshBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  liveChip:           { flexDirection: "row", alignItems: "center", backgroundColor: "#15803D", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  liveDot:            { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6EE7B7" },
  liveChipTxt:        { color: "#fff", fontSize: 11, fontWeight: "900" },
  card:               { backgroundColor: "#fff", borderRadius: 20, padding: 18, ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }) },
  cardTitle:          { fontSize: 18, fontWeight: "900", color: DARK },
  statusBadge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeTxt:     { fontSize: 12, fontWeight: "800" },
  statsRow:           { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  statBox:            { flex: 1, alignItems: "center", gap: 3 },
  statValue:          { fontSize: 20, fontWeight: "900" },
  statLabel:          { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  progBg:             { height: 10, backgroundColor: "#E0E7E0", borderRadius: 5, overflow: "hidden" },
  progFill:           { height: "100%", backgroundColor: BRAND, borderRadius: 5 },
  metaRow:            { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTxt:            { fontSize: 13, color: "#4B5563", fontWeight: "600", flex: 1 },
  liveTrackingBanner: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#DEF7E5", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#A7D9A0" },
  liveTrackingTxt:    { fontSize: 12, color: "#15803D", fontWeight: "700", flex: 1 },
  mapContainer:       { borderRadius: 20, overflow: "hidden", marginTop: 12, borderWidth: 2, borderColor: "#C8DEC5", position: "relative", ...Platform.select({ ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 }, android: { elevation: 5 } }) },
  mapOverlay:         { position: "absolute", bottom: 10, right: 10 },
  mapButton:          { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  mapButtonText:      { color: "#fff", fontSize: 12, fontWeight: "700" },
  mapLiveBadge:       { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#1D4ED8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  mapLiveDot:         { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6EE7B7" },
  mapLiveTxt:         { color: "#fff", fontSize: 11, fontWeight: "800" },
  vanMarker:          { width: 46, height: 46, borderRadius: 23, backgroundColor: "#2563EB", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 10 },
  destMarker:         { width: 42, height: 42, borderRadius: 21, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 8 },
  stopMarkerWrap:     { alignItems: "center" },
  stopMarker:         { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 5 },
  stopMarkerNum:      { color: "#fff", fontWeight: "900", fontSize: 12 },
  stopMarkerLabel:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 1, maxWidth: 70, alignItems: "center" },
  stopMarkerLabelTxt: { color: "#fff", fontSize: 8, fontWeight: "800" },
  routeTab:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: "#E0E7E0", marginRight: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  routeTabActive:     { backgroundColor: BRAND },
  routeTabTxt:        { fontSize: 13, fontWeight: "700", color: DARK, maxWidth: 140 },
  routeTabLiveDot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#6EE7B7" },
  stopRow:            { flexDirection: "row", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1 },
  stopNumBadge:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stopNumTxt:         { color: "#fff", fontWeight: "900", fontSize: 14 },
  stopPassengerName:  { fontSize: 15, fontWeight: "800", color: DARK },
  stopAddress:        { fontSize: 12, color: "#7A9E76", fontWeight: "600", marginTop: 2 },
  stopStatusBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stopStatusTxt:      { fontSize: 11, fontWeight: "800" },
  actionBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: BRAND, borderRadius: 14, paddingVertical: 13, gap: 8 },
  actionBtnTxt:       { color: "#fff", fontWeight: "900", fontSize: 15 },
  modalOverlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:          { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle:         { fontSize: 20, fontWeight: "900", color: DARK },
  modalRow:           { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F4F0" },
  modalLabel:         { fontSize: 14, fontWeight: "700", color: "#64748B", width: 80 },
  modalValue:         { fontSize: 14, fontWeight: "600", color: DARK, flex: 1 },
});
