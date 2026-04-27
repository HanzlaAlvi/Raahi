// frontend/Driver/screens/DashboardScreen.js
import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView, View, Text, TouchableOpacity,
  Platform, Dimensions, RefreshControl,
} from "react-native";
import { Ionicons }     from "@expo/vector-icons";
import { driverStyles } from "../constants/driverStyles";
import StatusBadge      from "../components/StatusBadge";

const { width } = Dimensions.get("window");

const brandGreen = "#415844";
const darkSage   = "#2D3E2F";

// Removed Animated import and blinkAnim constant

export default function DashboardScreen({
  dashboardStats,
  showAvailabilityAlert,
  setAvailabilityModalVisible,
  currentRoute,
  routeStarted,
  routeStops,
  navigateTo,
  loadAllData,
  driverIdRef,
  authTokenRef,
  loading,
  networkTransporter,
  waitingAtStop,
  pickupPassenger,
}) {

  // --- Live stops/van state ---
  const [liveStops, setLiveStops] = useState([]);
  const [vanPos, setVanPos] = useState(null);
  const [boardingIdx, setBoardingIdx] = useState(-1);
  const [waitingForBoard, setWaitingForBoard] = useState(false);
  const socketRef = useRef(null);

  // Removed useEffect hook for animated blinking alert tile

  // Socket.io for live van location and stops
  useEffect(() => {
    try {
      const { io } = require("socket.io-client");
      if (socketRef.current?.connected) return;
      const socket = io("https://raahi-q2ur.onrender.com", {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000,
      });
      socket.on("connect", () => {
        if (currentRoute?._id) {
          socket.emit("joinTrip", currentRoute._id);
        }
      });
      socket.on("vanLocationUpdate", (data) => {
        const lat = data?.latitude ?? data?.currentLocation?.latitude;
        const lng = data?.longitude ?? data?.currentLocation?.longitude;
        if (lat != null && lng != null) {
          setVanPos({ latitude: Number(lat), longitude: Number(lng) });
        }
      });
      socket.on("routeUpdate", (data) => {
        if (data?.stops) setLiveStops(data.stops);
      });
      socket.on("passengerBoarded", () => {
        setWaitingForBoard(false);
        setBoardingIdx(-1);
      });
      socketRef.current = socket;
      return () => { socket.disconnect(); };
    } catch {}
  }, [currentRoute?._id]);

  // Detect if van is at a stop and passenger not yet picked
  useEffect(() => {
    if (!liveStops || !Array.isArray(liveStops) || !vanPos) {
      setWaitingForBoard(false);
      setBoardingIdx(-1);
      return;
    }
    const idx = liveStops.findIndex(p => p.status !== "picked");
    if (idx === -1) {
      setWaitingForBoard(false);
      setBoardingIdx(-1);
      return;
    }
    const stop = liveStops[idx];
    const lat = stop.pickupLat || stop.latitude;
    const lng = stop.pickupLng || stop.longitude;
    if (lat && lng) {
      const dist = Math.sqrt(
        Math.pow(vanPos.latitude - lat, 2) + Math.pow(vanPos.longitude - lng, 2)
      );
      if (dist < 0.0005 && stop.status !== "picked") {
        setWaitingForBoard(true);
        setBoardingIdx(idx);
        return;
      }
    }
    setWaitingForBoard(false);
    setBoardingIdx(-1);
  }, [liveStops, vanPos]);

  // Fetch stops from backend
  useEffect(() => {
    async function fetchStops() {
      if (!currentRoute?._id) return;
      try {
        const res = await fetch(`https://raahi-q2ur.onrender.com/api/routes/${currentRoute._id}`);
        const data = await res.json();
        if (data?.route?.passengers) setLiveStops(data.route.passengers);
      } catch {}
    }
    fetchStops();
  }, [currentRoute?._id]);

  const onRefresh = React.useCallback(() => {
    loadAllData(driverIdRef.current, authTokenRef.current);
  }, [loadAllData, driverIdRef, authTokenRef]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F6FAF5" }}>
      <ScrollView
        style={driverStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={[brandGreen]}
            tintColor={brandGreen}
          />
        }
      >
        <View style={driverStyles.contentPadding}>

          <View style={{ marginTop: 10 }} />

          {/* ── Availability Banner ───────────────────────────────────── */}
          {showAvailabilityAlert && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setAvailabilityModalVisible?.(true)}
              style={{
                backgroundColor: brandGreen,
                borderRadius: 28,
                padding: 20,
                marginBottom: 30,
                flexDirection: "row",
                alignItems: "center",
                ...Platform.select({
                  ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 15 },
                  android: { elevation: 8 },
                }),
              }}
            >
              <View style={{ backgroundColor: "rgba(255,255,255,0.2)", padding: 12, borderRadius: 18, marginRight: 15 }}>
                <Ionicons name="calendar-clear" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#fff" }}>Schedule Tomorrow</Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                  Confirm your shift availability now
                </Text>
              </View>
              <Ionicons name="chevron-forward-circle" size={32} color="#fff" />
            </TouchableOpacity>
          )}

          {/* ── Performance Insights ──────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 }}>
            <View style={{ width: 4, height: 18, backgroundColor: brandGreen, borderRadius: 2, marginRight: 10 }} />
            <Text style={{ fontSize: 18, fontWeight: "900", color: darkSage }}>Performance Insights</Text>
          </View>

          {/* ── Stats Tiles ─────────────────────────────────────────────── */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 35 }}>
            {[
              { label: "Trips",  value: dashboardStats?.completedTrips || 0, icon: "bus",      color: brandGreen, animated: false },
              { label: "Active", value: dashboardStats?.activeTrips     || 0, icon: "navigate", color: "#3B82F6",  animated: false },
              { label: "Alert",  value: dashboardStats?.pendingTrips   || 0, icon: "timer",    color: "#C0392B",  animated: false  }, // Animated changed to false
            ].map((item, idx) => (
              <View // Changed from Animated.View to View
                key={idx}
                style={{
                  backgroundColor: "#fff",
                  width: width * 0.29,
                  borderRadius: 24,
                  paddingVertical: 20,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#C8DEC5",
                  opacity: 1, // Interpolation removed, opacity set to 1
                  ...Platform.select({
                    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
                    android: { elevation: 2 },
                  }),
                }}
              >
                <View style={{ backgroundColor: `${item.color}18`, padding: 10, borderRadius: 15, marginBottom: 10 }}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: darkSage }}>{item.value}</Text>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#7A9E76", textTransform: "uppercase" }}>
                  {item.label}
                </Text>
              </View> // Changed from Animated.View to View
            ))}
          </View>

          {/* ── Ongoing Mission ───────────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View style={{ width: 4, height: 18, backgroundColor: brandGreen, borderRadius: 2, marginRight: 10 }} />
            <Text style={{ fontSize: 18, fontWeight: "900", color: darkSage }}>Ongoing Mission</Text>
          </View>

          {/* ── FIX: currentRoute ternary — proper JSX structure ──────── */}
          {currentRoute ? (
            <View style={{ marginBottom: 35 }}>

                            {/* Waiting for board banner — with Confirm Pickup button */}
              {waitingForBoard && boardingIdx !== -1 && liveStops[boardingIdx] && (
                <View style={{
                  backgroundColor: "#FFF3CD", borderRadius: 18, padding: 18,
                  marginBottom: 14, borderWidth: 1, borderColor: "#FFD700", alignItems: "center",
                }}>
                  <Ionicons name="time" size={28} color="#FFD700" style={{ marginBottom: 8 }} />
                  <Text style={{ color: "#B8860B", fontWeight: "900", fontSize: 16 }}>
                    Waiting for {liveStops[boardingIdx].passengerName || "passenger"} to board…
                  </Text>
                  <Text style={{ color: "#B8860B", marginTop: 6, fontWeight: "700" }}>
                    Ask them to press "I am On Board" in their app.
                  </Text>
                  {waitingAtStop && pickupPassenger && (
                    <TouchableOpacity
                      onPress={pickupPassenger}
                      activeOpacity={0.85}
                      style={{
                        marginTop: 14,
                        backgroundColor: "#415844",
                        paddingVertical: 12,
                        paddingHorizontal: 28,
                        borderRadius: 14,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                        Confirm Pickup
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Route card */}
              <TouchableOpacity
                activeOpacity={waitingForBoard ? 0.5 : 0.9}
                onPress={() => { if (!waitingForBoard) navigateTo("Routes"); }}
                disabled={waitingForBoard}
                style={{
                  backgroundColor: waitingForBoard ? "#E5E7EB" : "#fff",
                  borderRadius: 32,
                  padding: 24,
                  opacity: waitingForBoard ? 0.7 : 1,
                  borderWidth: 1,
                  borderColor: "#C8DEC5",
                  ...Platform.select({
                    ios:     { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.06, shadowRadius: 20 },
                    android: { elevation: 4 },
                  }),
                }}
              >
                {/* Status + pax row */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <StatusBadge status={routeStarted ? "In Progress" : "Assigned"} />
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#EEF4ED", padding: 8, borderRadius: 12 }}>
                    <Ionicons name="people" size={16} color={brandGreen} />
                    <Text style={{ fontSize: 13, color: darkSage, fontWeight: "900", marginLeft: 6 }}>
                      {(routeStops || []).filter(s => s._isDriverOrigin !== true).length} Pax
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 22, fontWeight: "900", color: darkSage }}>
                  {currentRoute.routeName || currentRoute.name}
                </Text>

                <View style={{ flexDirection: "row", marginTop: 18, gap: 10 }}>
                  <View style={{
                    flex: 1, backgroundColor: "#F6FAF5", padding: 15,
                    borderRadius: 20, borderWidth: 1, borderColor: "#EEF4ED",
                  }}>
                    <Text style={{ fontSize: 10, color: "#7A9E76", fontWeight: "900", textTransform: "uppercase" }}>
                      Pick-up At
                    </Text>
                    <Text style={{ color: darkSage, fontSize: 16, fontWeight: "800", marginTop: 4 }}>
                      {currentRoute.pickupTime || currentRoute.timeSlot || "N/A"}
                    </Text>
                  </View>
                  <View style={{
                    flex: 1, backgroundColor: "#F6FAF5", padding: 15,
                    borderRadius: 20, borderWidth: 1, borderColor: "#EEF4ED",
                  }}>
                    <Text style={{ fontSize: 10, color: "#7A9E76", fontWeight: "900", textTransform: "uppercase" }}>
                      Route Area
                    </Text>
                    <Text style={{ color: darkSage, fontSize: 16, fontWeight: "800", marginTop: 4 }} numberOfLines={1}>
                      {currentRoute.areaLabel || "Main City"}
                    </Text>
                  </View>
                </View>

                <View style={{
                  marginTop: 25, backgroundColor: brandGreen, borderRadius: 20,
                  paddingVertical: 18, flexDirection: "row", justifyContent: "center", alignItems: "center",
                }}>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>Manage Route Details</Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                </View>
              </TouchableOpacity>

            </View>
          ) : (
            <View style={{
              backgroundColor: "#fff", borderRadius: 32, padding: 45,
              alignItems: "center", borderStyle: "dashed",
              borderWidth: 2, borderColor: "#C8DEC5", marginBottom: 35,
            }}>
              <Ionicons name="bus-outline" size={45} color="#C8DEC5" />
              <Text style={{ color: "#7A9E76", fontWeight: "700", marginTop: 15 }}>
                No routes assigned today
              </Text>
            </View>
          )}

          {/* ── Quick Access ─────────────────────────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
            <View style={{ width: 4, height: 18, backgroundColor: brandGreen, borderRadius: 2, marginRight: 10 }} />
            <Text style={{ fontSize: 18, fontWeight: "900", color: darkSage }}>Quick Access</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {/* Row 1 — 3 items */}
            {[
              { title: "Schedule", icon: "calendar", view: "Availability", bg: "#E8F5E9", color: brandGreen  },
              { title: "Routes",   icon: "map",      view: "Routes",       bg: "#FEF2F2", color: "#C0392B"   },
              { title: "History",  icon: "reader",   view: "History",      bg: "#EFF6FF", color: "#3B82F6"   },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => navigateTo(item.view)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#fff",
                  width: "31%",
                  borderRadius: 22,
                  paddingVertical: 20,
                  marginBottom: 15,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#C8DEC5",
                }}
              >
                <View style={{ backgroundColor: item.bg, padding: 12, borderRadius: 16, marginBottom: 10 }}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "900", color: darkSage }}>{item.title}</Text>
              </TouchableOpacity>
            ))}

            {/* Row 2 — 2 items */}
            {[
              { title: "Payments", icon: "wallet",  view: "Payments", bg: "#FFFBEB", color: "#F59E0B" },
              { title: "Support",  icon: "headset", view: "Support",  bg: "#F3E8FF", color: "#8B5CF6" },
            ].map((item, i) => (
              <TouchableOpacity
                key={i + 3}
                onPress={() => navigateTo(item.view)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#fff",
                  width: "48.5%",
                  borderRadius: 22,
                  paddingVertical: 20,
                  marginBottom: 15,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#C8DEC5",
                }}
              >
                <View style={{ backgroundColor: item.bg, padding: 12, borderRadius: 16, marginBottom: 10 }}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: "900", color: darkSage }}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}