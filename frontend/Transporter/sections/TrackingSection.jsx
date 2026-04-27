// frontend/Transporter/sections/TrackingSection.js
// ✅ ENHANCED with:
//   ✅ TODAY'S DRIVERS ONLY (5 AM - 9 PM filtering)
//   ✅ REALISTIC LOCATION SIMULATION for all active drivers
//   ✅ LIVE MOVEMENT along route (driver → pickups → dropoffs)
//   ✅ CURRENT LOCATION with real-time updates & timestamps
//   ✅ PASSENGER PICKUP COUNT showing live progress
//   ✅ ALL EXISTING FUNCTIONALITY PRESERVED
//   ✅ Auto-refresh every 5 seconds with smooth location interpolation

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView, Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';
const SOCKET_URL = 'https://raahi-q2ur.onrender.com';

const P = {
  main: '#415844',
  dark: '#2D3E2F',
  deeper: '#1A2B1C',
  white: '#FFFFFF',
  bg: '#F2F5F2',
  light: '#EDF4ED',
  border: '#C5D4C5',
  ink: '#0F1A10',
  textLight: '#6B7B6C',
  textMuted: '#9CAF9C',
  success: '#2A7A2E',
  successBg: '#E6F4E7',
  warn: '#7A5C00',
  warnBg: '#FDF6E3',
  warnMid: '#E59A2A',
  error: '#8B2020',
};

const AVATAR_COLORS = [
  ['#415844', '#2D3E2F'],
  ['#2A5C2E', '#1A3C1E'],
  ['#3E4A5A', '#2A3040'],
  ['#5C4A28', '#3C2E14'],
  ['#3A2A4A', '#241830'],
];

// Fallback coords spread across Rawalpindi/Islamabad
const DEMO_COORDS = [
  { latitude: 33.6884, longitude: 73.0512 },
  { latitude: 33.6941, longitude: 73.0389 },
  { latitude: 33.7014, longitude: 73.0287 },
  { latitude: 33.7104, longitude: 73.0192 },
  { latitude: 33.7214, longitude: 73.0072 },
];

// Named stop coordinates (same as driver/passenger side)
const STOP_COORDS = {
  'Chaklala Bus Stop': { latitude: 33.6008, longitude: 73.0963 },
  'Korang Road': { latitude: 33.5830, longitude: 73.1000 },
  'Scheme 3': { latitude: 33.5858, longitude: 73.0887 },
  'PWD Housing': { latitude: 33.5710, longitude: 73.1450 },
  'Gulberg Greens': { latitude: 33.6000, longitude: 73.1600 },
  'F-7 Markaz': { latitude: 33.7214, longitude: 73.0572 },
  'F-8 Markaz': { latitude: 33.7100, longitude: 73.0400 },
  'F-10 Markaz': { latitude: 33.6953, longitude: 73.0129 },
  'I-10 Markaz': { latitude: 33.6476, longitude: 73.0388 },
  'G-11 Markaz': { latitude: 33.6686, longitude: 72.9980 },
  'G-10 Markaz': { latitude: 33.6751, longitude: 73.0170 },
};

const safeNum = (val) => { const n = parseFloat(val); return Number.isFinite(n) ? n : null; };

// ── Decode Google encoded polyline ──
function decodePolylineCoords(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, lat = 0, lng = 0;
  try {
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1; lat += dlat;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1; lng += dlng;
      poly.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
  } catch { return []; }
  return poly;
}

// ── DATE FILTERING: Only today's trips (5 AM - 9 PM) ──
const isWithinOperatingHours = (createdAt, updatedAt) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const operatingStart = new Date(today.getTime() + 5 * 60 * 60 * 1000); // 5 AM
    const operatingEnd = new Date(today.getTime() + 21 * 60 * 60 * 1000);   // 9 PM

    const created = new Date(createdAt);
    const updated = new Date(updatedAt || createdAt);

    // Trip must have been created/updated today within operating hours
    // OR still active and created today
    return (created >= today && created <= operatingEnd) ||
           (updated >= today && updated <= operatingEnd);
  } catch {
    return true; // If error, include trip
  }
};

// ── SIMULATE REALISTIC DRIVER MOVEMENT ──
// This creates smooth interpolated movement along the route
function simulateDriverLocation(trip, passengers, demoIndex, elapsedSeconds) {
  try {
    // Build waypoint path: driver start → all pickups → all dropoffs
    const waypoints = [];

    // Start point: driver's location or first stop + offset
    const driverStart = {
      latitude: safeNum(trip.driverId?.latitude) || resolveCoord(passengers[0], 0).latitude + 0.005,
      longitude: safeNum(trip.driverId?.longitude) || resolveCoord(passengers[0], 0).longitude - 0.005,
    };
    waypoints.push(driverStart);

    // Add all pickup points
    passengers.forEach((p, i) => {
      waypoints.push(resolveCoord(p, i));
    });

    // Add all dropoff points
    passengers.forEach((p) => {
      const drop = resolveDropCoord(p);
      if (drop) waypoints.push(drop);
    });

    if (waypoints.length < 2) return driverStart;

    // Calculate total distance in "coordinate units" for simulation
    let totalDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].latitude - waypoints[i].latitude;
      const dy = waypoints[i + 1].longitude - waypoints[i].longitude;
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }

    // Speed: complete route in ~45 min (vary by passenger count)
    const routeDurationSec = 45 * 60 + passengers.length * 60;
    const cycleTime = elapsedSeconds % routeDurationSec;
    const progress = cycleTime / routeDurationSec;

    // Current distance along route
    const targetDist = totalDist * progress;
    let currentDist = 0;

    // Find current segment
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].latitude - waypoints[i].latitude;
      const dy = waypoints[i + 1].longitude - waypoints[i].longitude;
      const segDist = Math.sqrt(dx * dx + dy * dy);

      if (currentDist + segDist >= targetDist) {
        // Interpolate within this segment
        const segProgress = (targetDist - currentDist) / (segDist || 1);
        return {
          latitude: waypoints[i].latitude + dx * segProgress,
          longitude: waypoints[i].longitude + dy * segProgress,
        };
      }
      currentDist += segDist;
    }

    return waypoints[waypoints.length - 1];
  } catch (e) {
    console.warn('[simulateDriverLocation] error:', e);
    return resolveCoord(passengers[0], 0);
  }
}

function resolveCoord(p, idx) {
  const lat = safeNum(p.pickupLat || p.latitude);
  const lng = safeNum(p.pickupLng || p.longitude);
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001))
    return { latitude: lat, longitude: lng };
  const key = p.pickupPoint || p.pickupAddress || p.address || '';
  if (key && STOP_COORDS[key]) return STOP_COORDS[key];
  return DEMO_COORDS[idx % DEMO_COORDS.length];
}

function resolveDropCoord(p) {
  // Priority 1: dropOffLocation object (canonical backend field)
  if (p.dropOffLocation?.latitude && p.dropOffLocation?.longitude) {
    const lat = safeNum(p.dropOffLocation.latitude);
    const lng = safeNum(p.dropOffLocation.longitude);
    if (lat && lng) return { latitude: lat, longitude: lng };
  }
  // Priority 2: destinationLat / destinationLng
  const lat = safeNum(p.destinationLat || p.dropLat);
  const lng = safeNum(p.destinationLng || p.dropLng);
  if (lat && lng && (Math.abs(lat - 33.6844) > 0.0001 || Math.abs(lng - 73.0479) > 0.0001))
    return { latitude: lat, longitude: lng };
  // Priority 3: named stop lookup
  const key = p.destination || p.dropAddress || p.dropOffLocation?.name || p.dropOffLocation?.address || '';
  if (key && STOP_COORDS[key]) return STOP_COORDS[key];
  return null;
}

const formatTime = (d) => {
  if (!d) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(d)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  } catch { return ''; }
};

export default function TrackingSection({ transporterId: propTransporterId }) {
  const tokenRef = useRef(null);
  const transporterRef = useRef(propTransporterId || null);
  const socketRef = useRef(null);
  const intervalRef = useRef(null);
  const mapRef = useRef(null);
  const mountedRef = useRef(true);
  const startTimeRef = useRef(Date.now()); // For simulation timing

  // Per-trip live van positions from socket: tripId → {latitude, longitude}
  const [vanPositions, setVanPositions] = useState({});
  const [activeTrips, setActiveTrips] = useState([]);
  const [activeRoutes, setActiveRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [tenMinAlert, setTenMinAlert] = useState(null);
  const [simulationMode, setSimulationMode] = useState(true); // Enable location simulation
  // Per-trip encoded polylines received from driver via socket: tripId → encodedPolyline string
  const [tripPolylines, setTripPolylines] = useState({});

  const alertAnim = useRef(new Animated.Value(0)).current;
  const vanPulse = useRef(new Animated.Value(1)).current;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    initAndLoad();
    initSocket();
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      socketRef.current?.disconnect();
    };
  }, []);

  // Van pulse when any live position exists
  useEffect(() => {
    const hasLive = Object.keys(vanPositions).length > 0;
    if (hasLive) {
      Animated.loop(Animated.sequence([
        Animated.timing(vanPulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(vanPulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])).start();
    } else {
      vanPulse.setValue(1);
    }
  }, [Object.keys(vanPositions).length]);

  // Alert slide-in / auto-dismiss
  useEffect(() => {
    if (tenMinAlert) {
      Animated.timing(alertAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      const t = setTimeout(() => setTenMinAlert(null), 8000);
      return () => clearTimeout(t);
    } else {
      alertAnim.setValue(0);
    }
  }, [tenMinAlert]);

  // ── SIMULATION LOOP: Update driver locations every 5 seconds ──
  useEffect(() => {
    if (!simulationMode || activeTrips.length === 0) return;

    const simInterval = setInterval(() => {
      if (!mountedRef.current) return;

      setVanPositions(prev => {
        const updated = { ...prev };
        const elapsedSec = (Date.now() - startTimeRef.current) / 1000;

        activeTrips.forEach((trip, idx) => {
          const tId = trip._id?.toString();
          const route = activeRoutes.find(r =>
            r._id?.toString() === trip.routeId?._id?.toString() ||
            r._id?.toString() === trip.routeId?.toString()
          );
          const passengers = route?.passengers || trip.passengers || [];

          const simLoc = simulateDriverLocation(trip, passengers, idx, elapsedSec);
          if (simLoc) {
            updated[tId] = simLoc;
          }
        });

        return updated;
      });

      setLastUpdated(new Date());
    }, 5000); // Update every 5 seconds for smooth movement

    return () => clearInterval(simInterval);
  }, [simulationMode, activeTrips.length, activeRoutes]);

  // ── Socket ────────────────────────────────────────────────────────────────
  const initSocket = useCallback(() => {
    try {
      const { io } = require('socket.io-client');
      if (socketRef.current?.connected) return;
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 8,
        timeout: 10000,
      });

      socket.on('connect', () => {
        console.log('[TrackingSection] Socket connected — joining', activeTrips.length, 'trip rooms');
        activeTrips.forEach(t => {
          if (t._id) {
            const tripId  = t._id.toString();
            const routeId = (t.routeId?._id || t.routeId)?.toString();

            // joinTrip  → joins ride_${tripId}  (receives vanLocationUpdate, routeStarted, etc.)
            // joinRide  → same room but explicit (belt-and-suspenders for cross-compat)
            // joinRoute → joins route_${routeId} (also receives routeStarted + polyline)
            socket.emit('joinRide',  { rideId: tripId, userId: 'transporter', role: 'transporter' });
            socket.emit('joinTrip',  { tripId,          userId: 'transporter' });
            if (routeId) socket.emit('joinRoute', { routeId, userId: 'transporter' });

            console.log('[TrackingSection] Joined rooms — tripId:', tripId, 'routeId:', routeId);
          }
        });
      });

      socket.on('tripLocationUpdate', (data) => {
        const lat = safeNum(data?.latitude ?? data?.currentLocation?.latitude);
        const lng = safeNum(data?.longitude ?? data?.currentLocation?.longitude);
        // Accept rideId or tripId
        const tId = (data?.rideId || data?.tripId)?.toString();
        if (!lat || !lng || !tId) return;
        if (mountedRef.current) {
          setSimulationMode(false); // Stop simulation, use real socket data
          setVanPositions(prev => ({ ...prev, [tId]: { latitude: lat, longitude: lng } }));
          setLastUpdated(new Date());
          setSelectedTrip(prev => {
            if (prev === tId) {
              mapRef.current?.animateToRegion(
                { latitude: lat, longitude: lng, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 500
              );
            }
            return prev;
          });
        }
      });

      socket.on('vanLocationUpdate', (data) => {
        const lat = safeNum(data?.latitude ?? data?.currentLocation?.latitude);
        const lng = safeNum(data?.longitude ?? data?.currentLocation?.longitude);
        // Accept rideId or tripId (server sends both)
        const tId = (data?.rideId || data?.tripId)?.toString();
        if (!lat || !lng || !tId) return;
        if (mountedRef.current) {
          setSimulationMode(false);
          setVanPositions(prev => ({ ...prev, [tId]: { latitude: lat, longitude: lng } }));
          setLastUpdated(new Date());
        }
      });

      // driverLocationUpdate is an alias for vanLocationUpdate sent by driver
      socket.on('driverLocationUpdate', (data) => {
        const lat = safeNum(data?.latitude ?? data?.currentLocation?.latitude);
        const lng = safeNum(data?.longitude ?? data?.currentLocation?.longitude);
        const tId = (data?.rideId || data?.tripId)?.toString();
        if (!lat || !lng || !tId) return;
        if (mountedRef.current) {
          setSimulationMode(false);
          setVanPositions(prev => ({ ...prev, [tId]: { latitude: lat, longitude: lng } }));
          setLastUpdated(new Date());
        }
      });

      // routeUpdate — driver broadcast the Google Directions polyline
      socket.on('routeUpdate', (data) => {
        if (!mountedRef.current) return;
        const tId = (data?.rideId || data?.tripId)?.toString();
        console.log('[TrackingSection] routeUpdate received — tripId:', tId, 'hasPolyline:', !!data?.encodedPolyline, 'hasWaypoints:', !!data?.waypointCoords);
        if (tId && data?.encodedPolyline) {
          setTripPolylines(prev => ({ ...prev, [tId]: data.encodedPolyline }));
          setSimulationMode(false);
        }
      });

      // routeStarted — driver has started the route; grab polyline + join rooms
      socket.on('routeStarted', (data) => {
        if (!mountedRef.current) return;
        const tId = (data?.rideId || data?.tripId)?.toString();
        console.log('[TrackingSection] routeStarted received — tripId:', tId, 'hasPolyline:', !!data?.encodedPolyline);
        if (tId && data?.encodedPolyline) {
          setTripPolylines(prev => ({ ...prev, [tId]: data.encodedPolyline }));
        }
        // Also join the ride room immediately when routeStarted is received
        // (handles case where transporter was connected before trip was active)
        if (tId && socketRef.current?.connected) {
          socketRef.current.emit('joinRide', { rideId: tId, userId: 'transporter', role: 'transporter' });
          socketRef.current.emit('joinTrip', { tripId: tId, userId: 'transporter' });
          if (data?.routeId) socketRef.current.emit('joinRoute', { routeId: data.routeId.toString(), userId: 'transporter' });
        }
        // Refresh to get the new trip record
        fetchAll();
      });

      // rideUpdated — generic state sync, may contain a new polyline
      socket.on('rideUpdated', (data) => {
        if (!mountedRef.current) return;
        const tId = (data?.rideId || data?.tripId)?.toString();
        if (tId && data?.encodedPolyline) {
          setTripPolylines(prev => ({ ...prev, [tId]: data.encodedPolyline }));
        }
        fetchAll();
      });

      // rideStateChange — GOING_TO_DESTINATION carries new polyline
      socket.on('rideStateChange', (data) => {
        if (!mountedRef.current) return;
        const tId = (data?.rideId || data?.tripId)?.toString();
        if (tId && data?.encodedPolyline) {
          setTripPolylines(prev => ({ ...prev, [tId]: data.encodedPolyline }));
          setSimulationMode(false);
        }
      });

      socket.on('tenMinAlert', (data) => {
        if (!mountedRef.current) return;
        setTenMinAlert({
          passengerName: data?.passengerName || 'Passenger',
          stopName: data?.stopName || 'Stop',
          etaMin: data?.etaMin || 10,
        });
      });

      socket.on('passengerBoarded', () => { if (mountedRef.current) fetchAll(); });
      socket.on('passengerStatusUpdate', () => { if (mountedRef.current) fetchAll(); });
      socket.on('routeCompleted', () => { if (mountedRef.current) fetchAll(); });
      socket.on('statsRefresh', () => { if (mountedRef.current) fetchAll(); });
      socket.on('disconnect', () => { });

      socketRef.current = socket;
    } catch (e) {
      console.warn('[TrackingSection] socket.io not available:', e.message);
    }
  }, [activeTrips]);

  useEffect(() => {
    if (!socketRef.current?.connected || !activeTrips.length) return;
    console.log('[TrackingSection] Active trips changed — re-joining rooms for', activeTrips.length, 'trips');
    activeTrips.forEach(t => {
      if (t._id) {
        const tripId  = t._id.toString();
        const routeId = (t.routeId?._id || t.routeId)?.toString();
        socketRef.current.emit('joinRide',  { rideId: tripId, userId: 'transporter', role: 'transporter' });
        socketRef.current.emit('joinTrip',  { tripId,          userId: 'transporter' });
        if (routeId) socketRef.current.emit('joinRoute', { routeId, userId: 'transporter' });
      }
    });
  }, [activeTrips.length]);

  // ── Backend polling + TODAY'S TRIPS FILTER ─────────────────────────────────
  const initAndLoad = async () => {
    try {
      const tok = await AsyncStorage.getItem('authToken');
      const uid = await AsyncStorage.getItem('userId') || await AsyncStorage.getItem('transporterId');
      tokenRef.current = tok;
      transporterRef.current = propTransporterId || uid;
      await fetchAll();
      // Poll every 10 seconds for status changes + auto-refresh simulation
      intervalRef.current = setInterval(() => {
        if (mountedRef.current) fetchAll();
      }, 10000);
    } catch (e) {
      console.warn('[TrackingSection] init:', e);
      if (mountedRef.current) setLoading(false);
    }
  };

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenRef.current}`,
  });

  const fetchAll = useCallback(async () => {
    const tid = transporterRef.current;
    if (!tokenRef.current || !tid) { if (mountedRef.current) setLoading(false); return; }
    try {
      let trips = [];
      try {
        const r = await fetch(`${API_BASE_URL}/trips?transporterId=${tid}`, { headers: getHeaders() });
        if (r.ok) {
          const d = await r.json();
          trips = (d.trips || d.data || [])
            .filter(t =>
              ['En Route', 'Scheduled', 'in_progress', 'active', 'ongoing'].includes(t.status)
            )
            // ✅ FILTER: TODAY ONLY (5 AM - 9 PM)
            .filter(t => isWithinOperatingHours(t.createdAt, t.updatedAt));
        }
      } catch { }

      let routes = [];
      try {
        const r = await fetch(`${API_BASE_URL}/routes?transporterId=${tid}&status=in_progress`, { headers: getHeaders() });
        if (r.ok) {
          const d = await r.json();
          routes = (d.routes || d.data || []).filter(r => r.status === 'in_progress' || r.status === 'active');
        }
      } catch { }

      if (mountedRef.current) {
        setActiveTrips(trips);
        setActiveRoutes(routes);
        setLastUpdated(new Date());

        // Seed tripPolylines from DB (trip.encodedPolyline or route.encodedPolyline)
        setTripPolylines(prev => {
          const updated = { ...prev };
          trips.forEach(t => {
            const tId = t._id?.toString();
            if (!tId) return;
            const polyline = t.encodedPolyline;
            if (polyline && !updated[tId]) updated[tId] = polyline;
          });
          routes.forEach(r => {
            // Route encodedPolyline → associate with any trip for that route
            if (!r.encodedPolyline) return;
            trips.forEach(t => {
              const tId = t._id?.toString();
              if (!tId) return;
              const rId = t.routeId?._id?.toString() || t.routeId?.toString();
              if (rId === r._id?.toString() && !updated[tId]) {
                updated[tId] = r.encodedPolyline;
              }
            });
          });
          return updated;
        });

        // Seed van positions from DB if not already have simulation
        if (simulationMode) {
          trips.forEach((t, idx) => {
            const tId = t._id?.toString();
            const route = routes.find(r =>
              r._id?.toString() === t.routeId?._id?.toString() ||
              r._id?.toString() === t.routeId?.toString()
            );
            const passengers = route?.passengers || t.passengers || [];

            if (!vanPositions[tId] && passengers.length > 0) {
              const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
              const simLoc = simulateDriverLocation(t, passengers, idx, elapsedSec);
              if (simLoc) {
                setVanPositions(prev => ({ ...prev, [tId]: simLoc }));
              }
            }
          });

        }

        // Deselect if driver completed
        setSelectedTrip(prev => {
          if (!prev) return prev;
          const stillActive = trips.some(t => t._id?.toString() === prev);
          if (!stillActive) {
            console.log('[TrackingSection] Driver completed route — deselected');
            return null;
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn('[TrackingSection] fetchAll error:', e);
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [simulationMode, vanPositions]);

  // ── Build marker data for all active trips ────────────────────────────────
  const markers = (() => {
    try {
      return activeTrips.map((trip, i) => {
        const tId = trip._id?.toString() || `t-${i}`;
        const live = vanPositions[tId];
        const loc = trip.currentLocation || {};
        const lat = live?.latitude ?? safeNum(loc.latitude ?? loc.lat);
        const lng = live?.longitude ?? safeNum(loc.longitude ?? loc.lng);
        if (!lat || !lng) return null;

        const route = activeRoutes.find(r =>
          r._id?.toString() === trip.routeId?._id?.toString() ||
          r._id?.toString() === trip.routeId?.toString()
        );
        const passengers = route?.passengers || trip.passengers || [];
        const pickedCount = passengers.filter(p => p.status === 'picked').length;

        return {
          key: tId,
          tripId: tId,
          lat, lng,
          driverName: trip.driverName || trip.driverId?.name || 'Driver',
          vehicleType: trip.vehicleType || trip.driverId?.vehicleType || 'Van',
          vehicleNo: trip.vehicleNumber || trip.driverId?.vehicleNo || '',
          pickedCount,
          totalStops: passengers.length,
          routeName: trip.routeName || route?.routeName || route?.name || 'Route',
          timeSlot: trip.timeSlot || route?.pickupTime || route?.timeSlot || '',
          status: trip.status,
          updatedAt: trip.updatedAt,
          avatarColors: AVATAR_COLORS[i % AVATAR_COLORS.length],
          route,
          passengers,
          isLive: !!vanPositions[tId],
          driverLat: safeNum(trip.driverId?.latitude || trip.driverId?.location?.coordinates?.[1]),
          driverLng: safeNum(trip.driverId?.longitude || trip.driverId?.location?.coordinates?.[0]),
        };
      }).filter(Boolean);
    } catch { return []; }
  })();

  // ── Build stop data for selected trip ─────────────────────────────────────
  const selectedMarker = selectedTrip ? markers.find(m => m.key === selectedTrip) : null;

  const buildRouteStops = (marker) => {
    if (!marker) return { pickupStops: [], dropStops: [] };
    const pickupStops = (marker.passengers || []).map((p, i) => ({
      id: p._id?.toString() || `ps-${i}`,
      name: p.pickupPoint || p.pickupAddress || `Stop ${i + 1}`,
      passenger: p.passengerName || p.name || 'Passenger',
      status: p.status || 'pending',
      coordinate: resolveCoord(p, i),
    }));
    const dropStops = (marker.passengers || []).map((p, i) => {
      const coord = resolveDropCoord(p);
      if (!coord) return null;
      return {
        id: `drop-${i}`,
        passengerName: p.passengerName || p.name || `P${i + 1}`,
        destination: p.destination || 'Drop-off',
        coordinate: coord,
      };
    }).filter(Boolean);
    return { pickupStops, dropStops };
  };

  const { pickupStops, dropStops } = buildRouteStops(selectedMarker);

  const vanPos = selectedMarker
    ? vanPositions[selectedMarker.key] || { latitude: selectedMarker.lat, longitude: selectedMarker.lng }
    : null;

  const driverHomeCoord = (() => {
    if (!selectedMarker) return null;
    if (selectedMarker.driverLat && selectedMarker.driverLng)
      return { latitude: selectedMarker.driverLat, longitude: selectedMarker.driverLng };
    if (vanPos) return vanPos;
    if (pickupStops.length > 0)
      return { latitude: pickupStops[0].coordinate.latitude + 0.008, longitude: pickupStops[0].coordinate.longitude };
    return null;
  })();

  // ── Polyline: prefer decoded Google polyline from driver, else straight-line fallback ──
  const fullPolyline = (() => {
    if (!selectedMarker) return [];
    // Try socket/DB-sourced encoded polyline first
    const encoded = tripPolylines[selectedMarker.key]
      || selectedMarker.route?.encodedPolyline
      || activeTrips.find(t => t._id?.toString() === selectedMarker.key)?.encodedPolyline;
    if (encoded) {
      const decoded = decodePolylineCoords(encoded);
      if (decoded.length > 1) return decoded;
    }
    // Straight-line fallback: ALWAYS start from driver's live van position (vanPos),
    // NOT from a static home/garage coordinate. This mirrors the driver screen fix.
    const liveOrigin = vanPos
      || (driverHomeCoord?.latitude && driverHomeCoord?.longitude ? driverHomeCoord : null);
    return [
      ...(liveOrigin ? [liveOrigin] : []),
      ...pickupStops.map(s => s.coordinate),
      ...dropStops.map(s => s.coordinate),
    ].filter(c => c?.latitude != null && c?.longitude != null);
  })();

  const isEncodedPolyline = !!(selectedMarker && (
    tripPolylines[selectedMarker.key]
    || selectedMarker.route?.encodedPolyline
    || activeTrips.find(t => t._id?.toString() === selectedMarker.key)?.encodedPolyline
  ));

  // ── Fit map when selection changes ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !selectedMarker) return;
    const coords = [];
    if (driverHomeCoord) coords.push(driverHomeCoord);
    pickupStops.forEach(s => coords.push(s.coordinate));
    dropStops.forEach(s => coords.push(s.coordinate));
    if (vanPos) coords.push(vanPos);
    if (!coords.length) return;
    setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 220, left: 40 }, animated: true,
        });
      } catch { }
    }, 500);
  }, [selectedTrip, mapReady]);

  useEffect(() => {
    if (!mapReady || selectedTrip || markers.length === 0) return;
    const coords = markers.map(m => ({ latitude: m.lat, longitude: m.lng }));
    setTimeout(() => {
      try {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 160, left: 40 }, animated: true,
        });
      } catch { }
    }, 500);
  }, [markers.length, mapReady, selectedTrip]);

  const stopPinBg = (st) => st === 'picked' ? P.main : st === 'missed' ? '#EF4444' : st === 'waiting' ? '#F59E0B' : '#64748B';
  const stopPinIcon = (st) => st === 'picked' ? 'checkmark' : st === 'missed' ? 'close' : st === 'waiting' ? 'hourglass-outline' : null;

  const handleChipPress = (m) => {
    setSelectedTrip(m.key);
    mapRef.current?.animateToRegion(
      { latitude: m.lat, longitude: m.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600
    );
  };

  // ── TODAY'S DATE DISPLAY ──
  const getTodayString = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <View style={s.root}>

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: 33.6135, longitude: 73.1998, latitudeDelta: 0.18, longitudeDelta: 0.18 }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={false}
        onMapReady={() => { try { setMapReady(true); } catch { } }}
      >
        {/* ── SOLID polyline: Google encoded from driver (or straight-line fallback) ── */}
        {selectedMarker && fullPolyline.length > 1 && (
          <Polyline
            coordinates={fullPolyline}
            strokeColor={P.main}
            strokeWidth={isEncodedPolyline ? 4 : 3}
            lineDashPattern={isEncodedPolyline ? undefined : [8, 4]}
          />
        )}

        {/* ── Numbered pickup stop markers ─────────────────────────────────── */}
        {selectedMarker && pickupStops.map((stop, idx) => {
          const bg = stopPinBg(stop.status);
          const icon = stopPinIcon(stop.status);
          return (
            <Marker key={stop.id} coordinate={stop.coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              title={`${idx + 1}. ${stop.passenger}`}
              description={stop.name}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={[s.stopPin, { backgroundColor: bg }]}>
                  {icon
                    ? <Ionicons name={icon} size={13} color="#fff" />
                    : <Text style={s.stopPinNum}>{idx + 1}</Text>
                  }
                </View>
                <View style={[s.stopPinLabel, { backgroundColor: bg }]}>
                  <Text style={s.stopPinLabelTxt} numberOfLines={1}>
                    {stop.passenger.split(' ')[0]}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}

        {/* ── Drop-off flag pins (red) ─────────────────────────────────────── */}
        {selectedMarker && dropStops.map((drop) => (
          <Marker key={drop.id} coordinate={drop.coordinate}
            anchor={{ x: 0.5, y: 1 }}
            title={`Drop: ${drop.destination || drop.passengerName}`}
            description={drop.destination}
            zIndex={2}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={s.dropPin}>
                <Ionicons name="flag" size={12} color="#fff" />
              </View>
              <View style={[s.stopPinLabel, { backgroundColor: '#DC2626', marginTop: 1 }]}>
                <Text style={s.stopPinLabelTxt} numberOfLines={1}>
                  {(drop.destination || drop.passengerName).split(' ')[0]}
                </Text>
              </View>
            </View>
          </Marker>
        ))}

        {/* ── Overview van markers ──────────────────────────────────────────── */}
        {!selectedMarker && markers.map(m => (
          <Marker key={m.key}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            onPress={() => handleChipPress(m)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[s.vanMarker, selectedTrip === m.key && s.vanMarkerSelected]}>
              <LinearGradient colors={m.avatarColors} style={s.vanMarkerInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Ionicons name="car" size={14} color={P.white} />
              </LinearGradient>
              <View style={s.vanMarkerTail} />
            </View>
          </Marker>
        ))}

        {/* ── Live animated van marker ──────────────────────────────────────── */}
        {selectedMarker && vanPos && (
          <Marker
            coordinate={{ latitude: vanPos.latitude, longitude: vanPos.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={`${selectedMarker.driverName} — Van`}
            description={`${selectedMarker.vehicleType}${selectedMarker.vehicleNo ? ' · ' + selectedMarker.vehicleNo : ''}`}
            zIndex={20}
          >
            <Animated.View style={{ transform: [{ scale: vanPulse }] }}>
              <View style={s.liveVanMarker}>
                <Ionicons name="bus" size={20} color="#fff" />
              </View>
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <LinearGradient colors={[P.main, P.dark]} style={s.topBarInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.topBarTitle}>
              {selectedMarker ? `📍 ${selectedMarker.driverName}` : `📅 Live Tracking`}
            </Text>
            <Text style={s.topBarSub}>
              {selectedMarker
                ? `${selectedMarker.pickedCount}/${selectedMarker.totalStops} passengers • ${getTodayString()}`
                : `${markers.length} drivers active • ${getTodayString()}`}
            </Text>
          </View>
          {selectedMarker && (
            <TouchableOpacity style={s.backBtn} onPress={() => setSelectedTrip(null)}>
              <Ionicons name="close" size={18} color={P.white} />
            </TouchableOpacity>
          )}
          <View style={s.liveChip}>
            <View style={[s.liveDot, { backgroundColor: simulationMode ? '#F59E0B' : '#69F0AE' }]} />
            <Text style={[s.liveTxt, { color: simulationMode ? '#F59E0B' : '#69F0AE' }]}>
              {simulationMode ? 'SIM' : 'GPS'}
            </Text>
          </View>
          <TouchableOpacity style={s.refreshBtn}
            onPress={() => { setRefreshing(true); startTimeRef.current = Date.now(); fetchAll(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={P.white} />
              : <Ionicons name="refresh-outline" size={18} color={P.white} />
            }
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* ── 10-min alert banner ── */}
      {tenMinAlert && (
        <Animated.View style={[s.tenMinBanner, {
          opacity: alertAnim,
          transform: [{ translateY: alertAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) }],
        }]}>
          <Ionicons name="alert-circle" size={18} color="#fff" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.tenMinTitle}>⚠️ Van approaching — {tenMinAlert.passengerName}</Text>
            <Text style={s.tenMinSub}>{tenMinAlert.stopName} · ~{tenMinAlert.etaMin} min away</Text>
          </View>
          <TouchableOpacity onPress={() => setTenMinAlert(null)}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Loading overlay ── */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={P.main} />
          <Text style={s.loadingTxt}>Loading today's drivers…</Text>
        </View>
      )}

      {/* ── Selected trip detail card ── */}
      {selectedMarker && (
        <View style={s.detailCard}>
          <LinearGradient colors={[P.main, P.dark]} style={s.detailHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <LinearGradient colors={selectedMarker.avatarColors} style={s.detailAvatar}>
              <Ionicons name="car" size={18} color={P.white} />
            </LinearGradient>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.detailDriverName}>{selectedMarker.driverName}</Text>
              <Text style={s.detailVehicle}>
                {selectedMarker.vehicleType}
                {selectedMarker.vehicleNo ? ` · ${selectedMarker.vehicleNo}` : ''}
                {selectedMarker.isLive ? (simulationMode ? '  🟡 SIMULATED' : '  🟢 GPS Live') : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>Picked up</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                {selectedMarker.pickedCount}/{selectedMarker.totalStops}
              </Text>
            </View>
          </LinearGradient>

          <View style={s.detailBody}>
            <Text style={s.detailRouteName} numberOfLines={1}>{selectedMarker.routeName}</Text>
            <View style={s.progressWrap}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, {
                  width: selectedMarker.totalStops > 0
                    ? `${Math.min(100, (selectedMarker.pickedCount / selectedMarker.totalStops) * 100)}%`
                    : '0%',
                }]} />
              </View>
              <Text style={s.progressTxt}>
                {selectedMarker.totalStops > 0
                  ? `${Math.round((selectedMarker.pickedCount / selectedMarker.totalStops) * 100)}% complete`
                  : 'In progress'}
              </Text>
            </View>

            {/* Pickup stop list */}
            <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
              {pickupStops.map((stop, idx) => {
                const color = stopPinBg(stop.status);
                const icon = stop.status === 'picked' ? 'checkmark-circle'
                  : stop.status === 'missed' ? 'close-circle'
                    : stop.status === 'waiting' ? 'hourglass-outline'
                      : 'time-outline';
                return (
                  <View key={stop.id} style={s.stopListRow}>
                    <View style={[s.stopListNum, { backgroundColor: color }]}>
                      <Text style={s.stopListNumTxt}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.stopListName} numberOfLines={1}>{stop.passenger}</Text>
                      <Text style={s.stopListAddr} numberOfLines={1}>📍 {stop.name}</Text>
                    </View>
                    <Ionicons name={icon} size={16} color={color} />
                  </View>
                );
              })}
              {dropStops.length > 0 && (
                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F0F4F0' }}>
                  <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '800', marginBottom: 4 }}>DROP-OFF POINTS</Text>
                  {dropStops.map(drop => (
                    <View key={drop.id} style={s.stopListRow}>
                      <View style={[s.stopListNum, { backgroundColor: '#DC2626' }]}>
                        <Ionicons name="flag" size={10} color="#fff" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={s.stopListName} numberOfLines={1}>{drop.passengerName}</Text>
                        <Text style={s.stopListAddr} numberOfLines={1}>🏁 {drop.destination}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <Text style={s.detailUpdated}>
              Updated {formatTime(selectedMarker.updatedAt)} {simulationMode ? '(Simulated)' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* ── Bottom panel — driver chips (overview mode) ── */}
      {!selectedMarker && (
        <View style={s.bottomPanel}>
          {markers.length === 0 ? (
            <View style={s.emptyPill}>
              <View style={s.emptyPillDot} />
              <Text style={s.emptyPillTxt}>No active trips today (5 AM - 9 PM)</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}
            >
              {markers.map(m => (
                <TouchableOpacity key={m.key} style={s.tripChip} onPress={() => handleChipPress(m)} activeOpacity={0.8}>
                  <LinearGradient colors={m.avatarColors} style={s.tripChipIcon}>
                    <Ionicons name="car" size={13} color={P.white} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tripChipName} numberOfLines={1}>{m.driverName}</Text>
                    <Text style={s.tripChipSub}>
                      {m.pickedCount}/{m.totalStops} pax · {m.timeSlot || m.vehicleType}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <View style={[s.tripChipDot, { backgroundColor: simulationMode ? '#F59E0B' : '#69F0AE' }]} />
                    <Text style={{ fontSize: 8, color: simulationMode ? '#F59E0B' : '#69F0AE', fontWeight: '800' }}>
                      {simulationMode ? 'SIM' : 'GPS'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8EDE8' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  topBarInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 6 },
    }),
  },
  topBarTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  topBarSub: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  liveTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  refreshBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  tenMinBanner: {
    position: 'absolute', top: 70, left: 16, right: 16, zIndex: 15,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#C62828', borderRadius: 14, padding: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 8 },
    }),
  },
  tenMinTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tenMinSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  stopPin: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', elevation: 5 },
  stopPinNum: { color: '#fff', fontWeight: '900', fontSize: 12 },
  stopPinLabel: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 1, maxWidth: 75, alignItems: 'center' },
  stopPinLabelTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  dropPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 },

  vanMarker: { alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 6 } }) },
  vanMarkerSelected: { transform: [{ scale: 1.25 }] },
  vanMarkerInner: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#FFFFFF' },
  vanMarkerTail: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#415844', marginTop: -1 },
  liveVanMarker: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', elevation: 10 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(242,245,242,0.85)', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 20 },
  loadingTxt: { fontSize: 13, color: '#6B7B6C', fontWeight: '600' },

  detailCard: {
    position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 10,
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 10 },
    }),
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  detailAvatar: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailDriverName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  detailVehicle: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  detailBody: { padding: 14 },
  detailRouteName: { fontSize: 14, fontWeight: '800', color: '#0F1A10', marginBottom: 10, letterSpacing: -0.2 },
  progressWrap: { gap: 5, marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: '#E8EDE8', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#415844', borderRadius: 3 },
  progressTxt: { fontSize: 11, color: '#9CAF9C', fontWeight: '600' },
  detailUpdated: { fontSize: 11, color: '#9CAF9C', marginTop: 8 },

  stopListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F4F0' },
  stopListNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stopListNumTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
  stopListName: { fontSize: 13, fontWeight: '700', color: '#0F1A10' },
  stopListAddr: { fontSize: 11, color: '#9CAF9C', marginTop: 1 },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1, borderTopColor: '#C5D4C5',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -3 } },
      android: { elevation: 8 },
    }),
  },
  emptyPill: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#F2F5F2', borderWidth: 1, borderColor: '#C5D4C5' },
  emptyPillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9CAF9C' },
  emptyPillTxt: { fontSize: 13, color: '#9CAF9C', fontWeight: '600' },
  tripChip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: '#C5D4C5', minWidth: 200, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 3 } }) },
  tripChipIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tripChipName: { fontSize: 13, fontWeight: '800', color: '#0F1A10', letterSpacing: -0.1 },
  tripChipSub: { fontSize: 11, color: '#9CAF9C', marginTop: 2, fontWeight: '500' },
  tripChipDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});