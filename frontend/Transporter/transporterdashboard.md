// import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// import {
// View, Text, ScrollView, TouchableOpacity, TextInput,
// StyleSheet, SafeAreaView, Alert, RefreshControl,
// Animated, Dimensions, ActivityIndicator, Modal,
// StatusBar, Image,
// } from 'react-native';
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
// import Icon from 'react-native-vector-icons/MaterialIcons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useNavigation } from '@react-navigation/native';

// const { width } = Dimensions.get('window');

// // ─── COLOUR PALETTE ───────────────────────────────────────────────────────────
// const C = {
// primary: '#B8E040',
// primaryDark: '#638b0c',
// primaryLight: '#f5f8eb',
// primaryPale: '#EAF5C2',
// primaryGhost: '#F5FAE8',
// white: '#FFFFFF',
// offWhite: '#F8F9FA',
// black: '#000000',
// textDark: '#0A0A0A',
// textMid: '#3A3A3A',
// textLight: '#6B6B6B',
// border: '#D4EC80',
// divider: '#EDF5C8',
// headerBg: '#8BBF1E',
// headerText: '#FFFFFF',
// error: '#DC2626',
// errorLight: '#FEE2E2',
// warning: '#f63722',
// warningLight: '#FEF3C7',
// success: '#16A34A',
// successLight: '#DCFCE7',
// };

// // ─── CONSTANTS ────────────────────────────────────────────────────────────────
// const VEHICLE_CAPS = { car: 4, van: 12, bus: 30 };
// const VEHICLE_INFO = {
// car: { icon: 'Car', label: 'Car', desc: 'Suzuki/Toyota City Car', capacity: 4 },
// van: { icon: 'Van', label: 'Van', desc: 'Toyota HiAce/Shehzore', capacity: 12 },
// bus: { icon: 'Bus', label: 'Bus', desc: 'Hino/Isuzu Coach Bus', capacity: 30 },
// };

// // ─── PAKISTAN FUEL DATA ───────────────────────────────────────────────────────
// const PK_FUEL = {
// consumption: { car: 12, van: 15, bus: 30 },
// fuelType: { car: 'petrol', van: 'diesel', bus: 'diesel' },
// pricePerLitre: { petrol: 278, diesel: 283 },
// roadFactor: { car: 1.38, van: 1.32, bus: 1.28 },
// avgSpeedKmh: { car: 28, van: 23, bus: 20 },
// minRouteKm: { car: 8, van: 12, bus: 20 },
// minFuelLitres: { car: 1.0, van: 2.0, bus: 6.0 },
// };

// const OPT_WEIGHTS = { distance: 0.35, time: 0.35, fuel: 0.30 };
// const NOMINATIM = 'https://nominatim.openstreetmap.org';
// const SOLVICE_API_KEY = 'dc6ef2c9-6e86-4049-aa96-663750b1ee5a';
// const SOLVICE_BASE = 'https://api.solvice.io';
// const API_BASE = 'https://raahi-q2ur.onrender.com/api';

// const FALLBACK_DEST = { lat: 33.6135, lng: 73.1998, address: 'Destination' };

// const DEST_CLUSTER_RADIUS_KM = 2.5;
// const MIN_ROUTE_PASSENGERS = 2;
// const MAX_MERGE_RADIUS_KM = 12;
// const SOLO_MERGE_RADIUS_KM = 15;
// const CAR_MAX_SPREAD_KM = 8;

// // ─── FORMATTERS ───────────────────────────────────────────────────────────────
// const fmtTime = (m) => { const mm = Math.round(m); if (mm < 60) return `${mm} min`; const h = Math.floor(mm / 60), r = mm % 60; return r === 0 ? `${h}h` : `${h}h ${r}m`; };
// const fmtKm = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${parseFloat(km).toFixed(1)} km`;
// const fmtLitres = (l) => `${parseFloat(l).toFixed(2)} L`;
// const fmtPKR = (r) => `Rs. ${Math.round(r).toLocaleString('en-PK')}`;

// const MENU_ITEMS = [
// { key: 'overview', label: 'Dashboard', icon: 'dashboard' },
// { key: 'profile', label: 'My Profile', icon: 'account-circle' },
// { key: 'poll', label: 'Availability Polls', icon: 'poll' },
// { key: 'smart-route', label: 'Smart Routes', icon: 'auto-awesome' },
// { key: 'routes', label: 'Routes', icon: 'map' },
// { key: 'assign', label: 'Assign Driver', icon: 'assignment-ind' },
// { key: 'tracking', label: 'Live Tracking', icon: 'my-location' },
// { key: 'driver-req', label: 'Driver Requests', icon: 'group-add' },
// { key: 'pass-req', label: 'Passenger Requests', icon: 'person-add' },
// { key: 'payments', label: 'Payments', icon: 'account-balance-wallet' },
// { key: 'complaints', label: 'Complaints', icon: 'support-agent' },
// { key: 'notifications', label: 'Notifications', icon: 'notifications-active' },
// ];

// const ROUTE_COLORS = ['#B8E040', '#FF9800', '#2196F3', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722'];

// // ══════════════════════════════════════════════════════════════════════════════
// // ─── FIX: SAFE ASSIGNED-DRIVER HELPERS ───────────────────────────────────────
// // MongoDB .populate() returns an object; un-populated fields are plain strings.
// // These helpers handle BOTH cases safely everywhere in the UI.
// // ══════════════════════════════════════════════════════════════════════════════

// /\*_
// _ Always returns a plain string ID (or null) from an assignedDriver field
// _ regardless of whether it is a populated object or a raw ObjectId string.
// _/
// function getAssignedDriverId(assignedDriver) {
// if (!assignedDriver) return null;
// if (typeof assignedDriver === 'object') {
// return String(assignedDriver.\_id || assignedDriver.id || '');
// }
// return String(assignedDriver);
// }

// /\*_
// _ Returns the driver's display name.
// _ Tries the populated object first, then falls back to searching the local
// _ drivers array by ID, then falls back to the raw string value.
// \*/
// function getAssignedDriverName(assignedDriver, driversList = []) {
// if (!assignedDriver) return null;
// // Populated object → use name directly
// if (typeof assignedDriver === 'object') {
// return assignedDriver.name || assignedDriver.driverName || 'Assigned Driver';
// }
// // Raw string ID → look up in drivers list
// const found = driversList.find(
// d => String(d.\_id || d.id) === String(assignedDriver),
// );
// return found?.name || null;
// }

// /\*_
// _ Returns the vehicle type string from an assignedDriver field.
// \*/
// function getAssignedDriverVehicle(assignedDriver, driversList = []) {
// if (!assignedDriver) return null;
// if (typeof assignedDriver === 'object') {
// return assignedDriver.vehicleType || assignedDriver.vehicle || null;
// }
// const found = driversList.find(
// d => String(d.\_id || d.id) === String(assignedDriver),
// );
// return found?.vehicleType || found?.vehicle || null;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // UTILITY HELPERS
// // ══════════════════════════════════════════════════════════════════════════════

// function safeNum(val, fallback = 0) {
// const n = parseFloat(val);
// return (!isNaN(n) && isFinite(n)) ? n : fallback;
// }

// function isValidGPS(lat, lng) {
// const la = safeNum(lat), ln = safeNum(lng);
// return (la !== 0 || ln !== 0) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
// }

// function haversineKm(lat1, lng1, lat2, lng2) {
// const la1 = safeNum(lat1), ln1 = safeNum(lng1);
// const la2 = safeNum(lat2), ln2 = safeNum(lng2);
// if (!isValidGPS(la1, ln1) || !isValidGPS(la2, ln2)) return 0;
// const R = 6371;
// const dLat = (la2 - la1) _ Math.PI / 180;
// const dLng = (ln2 - ln1) _ Math.PI / 180;
// const a = Math.sin(dLat / 2) ** 2
// + Math.cos(la1 _ Math.PI / 180) _ Math.cos(la2 _ Math.PI / 180)
// _ Math.sin(dLng / 2) ** 2;
// return R _ 2 _ Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// function centroid(points) {
// const v = points.filter(p => isValidGPS(p.lat, p.lng));
// if (!v.length) return FALLBACK_DEST;
// return {
// lat: v.reduce((s, p) => s + safeNum(p.lat), 0) / v.length,
// lng: v.reduce((s, p) => s + safeNum(p.lng), 0) / v.length,
// };
// }

// function isToday(dateVal) {
// if (!dateVal) return false;
// try {
// const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
// if (isNaN(d.getTime())) return false;
// const today = new Date();
// return (
// d.getFullYear() === today.getFullYear() &&
// d.getMonth() === today.getMonth() &&
// d.getDate() === today.getDate()
// );
// } catch (\_) { return false; }
// }

// function getMostCommonArea(addresses) {
// if (!addresses.length) return 'Area';
// const parts = addresses.map(a => {
// const s = String(a || ''), p = s.split(',');
// return p.length > 1 ? p[1].trim() : p[0].trim();
// }).filter(Boolean);
// const freq = {};
// parts.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
// return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Route';
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // PASSENGER NORMALIZATION
// // ══════════════════════════════════════════════════════════════════════════════

// function normalizePassenger(raw, idx) {
// return {
// id: raw.id ?? raw._id?.$oid ?? raw.\_id ?? `p_${idx}`,
//     name:              raw.name ?? raw.passengerName ?? `Passenger ${idx + 1}`,
// pickupLat: safeNum(raw.pickupLat ?? raw.latitude ?? raw.pickupLocation?.lat),
// pickupLng: safeNum(raw.pickupLng ?? raw.longitude ?? raw.pickupLocation?.lng),
// pickupAddress: raw.pickupAddress ?? raw.pickupPoint ?? raw.address ?? '',
// dropLat: safeNum(raw.dropLat ?? raw.destinationLatitude ?? raw.dropLocation?.lat),
// dropLng: safeNum(raw.dropLng ?? raw.destinationLongitude ?? raw.dropLocation?.lng),
// dropAddress: raw.dropAddress ?? raw.destination ?? raw.destinationAddress ?? '',
// vehiclePreference: raw.vehiclePreference ?? null,
// timeSlot: raw.selectedTimeSlot ?? raw.timeSlot ?? null,
// };
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // VEHICLE PREFERENCE ENGINE
// // ══════════════════════════════════════════════════════════════════════════════

// function canMergeByPreference(pA, pB) {
// const a = pA.vehiclePreference;
// const b = pB.vehiclePreference;
// if (a === 'car' && b === 'car') return true;
// if (a === 'car' || b === 'car') return false;
// return true;
// }

// function resolveVehicleForGroup(passengers, preferredType = null) {
// const prefs = passengers.map(p => p.vehiclePreference).filter(Boolean);
// const unique = [...new Set(prefs)];
// if (unique.length && unique.every(p => p === 'car')) return 'car';
// if (unique.length && unique.every(p => p === 'bus')) return 'bus';
// if (unique.length && unique.every(p => p === 'van')) return passengers.length <= VEHICLE_CAPS.van ? 'van' : 'bus';
// if (preferredType && preferredType !== 'car') {
// const count = passengers.length;
// if (preferredType === 'bus') return 'bus';
// if (preferredType === 'van') return count <= VEHICLE_CAPS.van ? 'van' : 'bus';
// }
// const count = passengers.length;
// if (count <= VEHICLE_CAPS.car) return 'car';
// if (count <= VEHICLE_CAPS.van) return 'van';
// return 'bus';
// }

// function carPassengersWithinSpread(passengers) {
// for (let i = 0; i < passengers.length; i++) {
// for (let j = i + 1; j < passengers.length; j++) {
// const dist = haversineKm(
// passengers[i].pickupLat, passengers[i].pickupLng,
// passengers[j].pickupLat, passengers[j].pickupLng,
// );
// if (dist > CAR_MAX_SPREAD_KM) return false;
// }
// }
// return true;
// }

// function splitCarPassengersByDistance(carPassengers) {
// if (!carPassengers.length) return [];
// const groups = [];
// const remaining = [...carPassengers];
// while (remaining.length > 0) {
// const group = [remaining.splice(0, 1)[0]];
// let changed = true;
// while (changed && remaining.length > 0) {
// changed = false;
// for (let i = remaining.length - 1; i >= 0; i--) {
// const candidate = remaining[i];
// const fitsGroup = group.every(gp =>
// haversineKm(gp.pickupLat, gp.pickupLng, candidate.pickupLat, candidate.pickupLng) <= CAR_MAX_SPREAD_KM,
// );
// if (fitsGroup && group.length < VEHICLE_CAPS.car) {
// group.push(remaining.splice(i, 1)[0]);
// changed = true;
// }
// }
// }
// groups.push(group);
// }
// return groups;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // ROUTE OPTIMIZATION ALGORITHMS
// // ══════════════════════════════════════════════════════════════════════════════

// function nearestNeighborSort(passengers) {
// if (passengers.length <= 1) return [...passengers];
// const sorted = [];
// const remaining = [...passengers];
// let cur = remaining.splice(0, 1)[0];
// sorted.push(cur);
// while (remaining.length) {
// let ni = 0, nd = Infinity;
// remaining.forEach((p, i) => {
// const d = haversineKm(cur.pickupLat, cur.pickupLng, p.pickupLat, p.pickupLng);
// if (d < nd) { nd = d; ni = i; }
// });
// cur = remaining.splice(ni, 1)[0];
// sorted.push(cur);
// }
// return sorted;
// }

// function twoOptImprove(stops) {
// if (stops.length <= 2) return stops;
// let improved = true, best = [...stops];
// while (improved) {
// improved = false;
// for (let i = 0; i < best.length - 1; i++) {
// for (let j = i + 1; j < best.length; j++) {
// const p1 = best[i], p2 = best[(i + 1) % best.length];
// const p3 = best[j], p4 = best[(j + 1) % best.length];
// const before = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng)
// + haversineKm(p3.lat, p3.lng, p4?.lat ?? best[0].lat, p4?.lng ?? best[0].lng);
// const after = haversineKm(p1.lat, p1.lng, p3.lat, p3.lng)
// + haversineKm(p2.lat, p2.lng, p4?.lat ?? best[0].lat, p4?.lng ?? best[0].lng);
// if (after < before - 0.01) {
// best = [...best.slice(0, i + 1), ...best.slice(i + 1, j + 1).reverse(), ...best.slice(j + 1)];
// improved = true;
// }
// }
// }
// }
// return best;
// }

// function detectOutliers(passengers) {
// if (passengers.length <= 1) return { inliers: passengers, outliers: [] };
// const cent = centroid(passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// const distances = passengers.map(p => ({ p, dist: haversineKm(cent.lat, cent.lng, p.pickupLat, p.pickupLng) }));
// const sorted = [...distances].sort((a, b) => a.dist - b.dist);
// const q3 = sorted[Math.floor(sorted.length * 0.75)]?.dist || 18;
// const threshold = Math.max(q3 \* 1.8, 18);
// return {
// inliers: distances.filter(d => d.dist <= threshold).map(d => d.p),
// outliers: distances.filter(d => d.dist > threshold).map(d => d.p),
// };
// }

// function groupPassengersByDestination(passengers) {
// const groups = [];
// for (const p of passengers) {
// const dLat = safeNum(p.dropLat) || FALLBACK*DEST.lat;
// const dLng = safeNum(p.dropLng) || FALLBACK_DEST.lng;
// let matched = null;
// for (const g of groups) {
// if (haversineKm(g.destLat, g.destLng, dLat, dLng) <= DEST_CLUSTER_RADIUS_KM) { matched = g; break; }
// }
// if (matched) {
// matched.passengers.push(p);
// const n = matched.passengers.length;
// matched.destLat = (matched.destLat * (n - 1) + dLat) / n;
// matched.destLng = (matched.destLng \_ (n - 1) + dLng) / n;
// if (!matched.destAddress || matched.destAddress === FALLBACK_DEST.address)
// matched.destAddress = p.dropAddress || matched.destAddress;
// } else {
// groups.push({ destLat: dLat, destLng: dLng, destAddress: p.dropAddress || FALLBACK_DEST.address, passengers: [p] });
// }
// }
// return groups;
// }

// function clarkWrightSavings(passengers, depot, maxCap) {
// if (!passengers.length) return [];
// let routes = passengers.map((p, i) => ({ id: `r_${i}`, passengers: [p] }));
// const savings = [];
// for (let i = 0; i < passengers.length; i++) {
// for (let j = i + 1; j < passengers.length; j++) {
// const pi = passengers[i], pj = passengers[j];
// if (!canMergeByPreference(pi, pj)) continue;
// const di = haversineKm(depot.lat, depot.lng, pi.pickupLat, pi.pickupLng);
// const dj = haversineKm(depot.lat, depot.lng, pj.pickupLat, pj.pickupLng);
// const dij = haversineKm(pi.pickupLat, pi.pickupLng, pj.pickupLat, pj.pickupLng);
// savings.push({ i, j, saving: di + dj - dij });
// }
// }
// savings.sort((a, b) => b.saving - a.saving);
// for (const { i, j } of savings) {
// const rI = routes.find(r => r.passengers.some(p => p.id === passengers[i].id));
// const rJ = routes.find(r => r.passengers.some(p => p.id === passengers[j].id));
// if (!rI || !rJ || rI.id === rJ.id) continue;
// if (rI.passengers.length + rJ.passengers.length > maxCap) continue;
// if (!rI.passengers.every(a => rJ.passengers.every(b => canMergeByPreference(a, b)))) continue;
// const cI = centroid(rI.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// const cJ = centroid(rJ.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// if (haversineKm(cI.lat, cI.lng, cJ.lat, cJ.lng) > MAX_MERGE_RADIUS_KM) continue;
// routes = routes.filter(r => r.id !== rI.id && r.id !== rJ.id);
// routes.push({ id: rI.id, passengers: [...rI.passengers, ...rJ.passengers] });
// }
// return routes.map(r => r.passengers);
// }

// function mergeSmallRoutes(routes) {
// let changed = true;
// let result = routes.map(r => ({ ...r, passengers: [...r.passengers] }));
// while (changed) {
// changed = false;
// const smallIdx = result.findIndex(r => r.passengers.length < MIN_ROUTE_PASSENGERS);
// if (smallIdx === -1) break;
// const small = result[smallIdx];
// const isCarGrp = small.passengers.every(p => p.vehiclePreference === 'car');
// const smallCent = centroid(small.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// let bestIdx = -1, bestDist = Infinity;
// result.forEach((target, idx) => {
// if (idx === smallIdx) return;
// const allCompat = small.passengers.every(sp => target.passengers.every(tp => canMergeByPreference(sp, tp)));
// if (!allCompat) return;
// const merged = [...target.passengers, ...small.passengers];
// const vForMerge = resolveVehicleForGroup(merged);
// if (merged.length > VEHICLE_CAPS[vForMerge]) return;
// if (isCarGrp || target.passengers.every(p => p.vehiclePreference === 'car')) {
// if (!carPassengersWithinSpread(merged)) return;
// }
// const tCent = centroid(target.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// const dist = haversineKm(smallCent.lat, smallCent.lng, tCent.lat, tCent.lng);
// const rad = small.passengers.length === 1 ? SOLO_MERGE_RADIUS_KM : MAX_MERGE_RADIUS_KM;
// if (dist < rad && dist < bestDist) { bestDist = dist; bestIdx = idx; }
// });
// if (bestIdx !== -1) {
// const target = result[bestIdx];
// const mergedPax = [...target.passengers, ...small.passengers];
// const mergedForced = (target.forced === 'car' || small.forced === 'car')
// ? 'car'
// : resolveVehicleForGroup(mergedPax, target.forced || small.forced);
// result[bestIdx] = {
// ...target,
// passengers: mergedPax,
// forced: mergedForced,
// mergedFrom: (target.mergedFrom || 0) + small.passengers.length,
// };
// result.splice(smallIdx, 1);
// changed = true;
// } else break;
// }
// return result;
// }

// function splitOversizedRoutes(routes) {
// const result = [];
// for (const route of routes) {
// const vType = route.forced || resolveVehicleForGroup(route.passengers);
// const cap = VEHICLE_CAPS[vType];
// if (route.passengers.length <= cap) {
// result.push(route);
// } else {
// const sorted = nearestNeighborSort(route.passengers);
// for (let i = 0; i < sorted.length; i += cap)
// result.push({ ...route, passengers: sorted.slice(i, i + cap) });
// }
// }
// return result;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // FUEL CALCULATION
// // ══════════════════════════════════════════════════════════════════════════════

// function calculateFuel(distanceKm, vehicleType) {
// const consumption = PK*FUEL.consumption[vehicleType] || 15;
// const fuelType = PK_FUEL.fuelType[vehicleType] || 'diesel';
// const pricePerL = PK_FUEL.pricePerLitre[fuelType];
// const minFuel = PK_FUEL.minFuelLitres[vehicleType] || 2.0;
// const rawFuel = (distanceKm * consumption) / 100;
// const fuelLitres = Math.max(rawFuel, minFuel);
// return {
// fuelLitres: parseFloat(fuelLitres.toFixed(2)),
// fuelCostPKR: Math.round(fuelLitres \_ pricePerL),
// fuelType,
// consumption,
// };
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // REVERSE GEOCODING
// // ══════════════════════════════════════════════════════════════════════════════

// async function reverseGeocode(lat, lng) {
// try {
// const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
// const res = await fetch(url, { headers: { 'User-Agent': 'TransporterApp/1.0' } });
// if (!res.ok) throw new Error(`HTTP ${res.status}`);
// const data = await res.json();
// if (data && data.display_name) {
// const addr = data.address || {};
// const parts = [
// addr.road || addr.pedestrian || addr.footway || addr.hamlet,
// addr.suburb || addr.neighbourhood || addr.village || addr.quarter,
// addr.city || addr.town || addr.county || addr.state,
// ].filter(Boolean);
// return parts.length ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
// }
// } catch (e) { console.warn(`reverseGeocode failed (${lat},${lng}):`, e.message); }
// return `${safeNum(lat).toFixed(4)}, ${safeNum(lng).toFixed(4)}`;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // SOLVICE ROUTE MATRIX
// // ══════════════════════════════════════════════════════════════════════════════

// async function getSolviceRoute(waypoints, destination) {
// try {
// const allPts = [...waypoints, destination];
// const locations = allPts.map((p, i) => ({ id: `loc_${i}`, lat: safeNum(p.lat), lng: safeNum(p.lng) }));
// const res = await fetch(`${SOLVICE_BASE}/v2/matrix`, {
// method: 'POST',
// headers: { 'Authorization': SOLVICE_API_KEY, 'Content-Type': 'application/json' },
// body: JSON.stringify({ sources: locations.map(l => l.id), destinations: locations.map(l => l.id), locations, profile: 'car' }),
// });
// if (!res.ok) throw new Error(`HTTP ${res.status}`);
// const data = await res.json();
// if (data?.distances && data?.durations) {
// let distM = 0, durS = 0;
// for (let i = 0; i < allPts.length - 1; i++) {
// distM += data.distances?.[i]?.[i + 1] || 0;
// durS += data.durations?.[i]?.[i + 1] || 0;
// }
// if (distM > 0 && distM < 500000)
// return { distanceKm: distM / 1000, durationMins: Math.max(10, Math.round(durS / 60)), source: 'solvice' };
// }
// } catch (e) { console.warn('[Solvice] matrix:', e.message); }
// return null;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // SMART DRIVER ASSIGNMENT SCORER
// // ══════════════════════════════════════════════════════════════════════════════

// function scoreDriversForRoute(route, driversList) {
// const routeVehicle = route.vehicleType || 'van';
// const routePaxCount = route.passengers?.length || 0;
// const routePaxPrefs = (route.passengers || []).map(p => p.vehiclePreference).filter(Boolean);
// const hasCarPaxOnly = routePaxPrefs.length > 0 && routePaxPrefs.every(p => p === 'car');

// return driversList.map(driver => {
// let score = 0;
// const reasons = [];
// const dVehicle = driver.vehicleType || driver.vehicle || 'van';
// const dCap = VEHICLE_CAPS[dVehicle] || driver.capacity || 8;
// const dFill = driver.passengers?.length || 0;
// const dAvailable = dCap - dFill;

// if (dVehicle === routeVehicle) {
// score += 50; reasons.push(`Vehicle match (${VEHICLE_INFO[dVehicle]?.label || dVehicle})`);
// } else if (dAvailable >= routePaxCount) {
// score += 15; reasons.push('Different vehicle but sufficient capacity');
// } else {
// score -= 20; reasons.push('Vehicle type mismatch');
// }
// if (dAvailable >= routePaxCount) {
// score += 20; reasons.push(`Capacity sufficient (${dAvailable} seats free)`);
// } else {
// score -= 30; reasons.push('Insufficient capacity');
// }
// if (hasCarPaxOnly && dVehicle !== 'car') { score -= 40; reasons.push('Passengers require a car'); }
// if (hasCarPaxOnly && dVehicle === 'car') { score += 20; reasons.push('Matches car-only requirement'); }
// if (driver.status === 'active') { score += 15; reasons.push('Driver is active'); }
// else { score -= 10; reasons.push('Driver is not active'); }
// if (dFill === 0) { score += 10; reasons.push('No current passengers'); }
// else if (dFill <= 2) { score += 5; reasons.push('Light load'); }

// return { driver, score, reasons };
// }).sort((a, b) => b.score - a.score);
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // MAIN ROUTE OPTIMIZATION ENGINE
// // ══════════════════════════════════════════════════════════════════════════════

// class RouteOptimizationEngine {
// async optimize(allPassengers, onProgress) {
// const passengers = allPassengers.map((r, i) => normalizePassenger(r, i));
// const valid = passengers.filter(p => isValidGPS(p.pickupLat, p.pickupLng));
// const invalid = passengers.filter(p => !isValidGPS(p.pickupLat, p.pickupLng));

// onProgress?.(`Validating ${passengers.length} passengers...`);
// if (invalid.length) console.warn('[VRP] No GPS:', invalid.map(p => p.name));

// onProgress?.('Fetching pickup addresses...');
// for (let i = 0; i < valid.length; i++) {
// const p = valid[i];
// if ((!p.pickupAddress || p.pickupAddress === 'Pickup Point') && p.pickupLat && p.pickupLng) {
// valid[i] = { ...p, pickupAddress: await reverseGeocode(p.pickupLat, p.pickupLng) };
// onProgress?.(`Geocoding ${i + 1}/${valid.length}: ${valid[i].pickupAddress}`);
// await new Promise(r => setTimeout(r, 1100));
// }
// }

// onProgress?.('Clustering passengers by destination...');
// const destGroups = groupPassengersByDestination(valid);
// onProgress?.(`Found ${destGroups.length} destination group(s)`);

// let allRouteGroups = [];

// for (const destGroup of destGroups) {
// const { destLat, destLng, destAddress, passengers: destPax } = destGroup;
// const depot = { lat: destLat, lng: destLng };
// onProgress?.(`Optimizing routes to: ${destAddress} (${destPax.length} pax)`);

// const carStrict = destPax.filter(p => p.vehiclePreference === 'car');
// const busStrict = destPax.filter(p => p.vehiclePreference === 'bus');
// const vanStrict = destPax.filter(p => p.vehiclePreference === 'van');
// const autoAssign = destPax.filter(p => !p.vehiclePreference);

// const processSubgroup = (paxList, maxCap, forced) => {
// if (!paxList.length) return;
// const { inliers, outliers } = detectOutliers(paxList);
// let routes = inliers.length > 0 ? clarkWrightSavings(inliers, depot, maxCap) : [];
// for (const outlier of outliers) {
// let merged = false;
// for (let i = 0; i < routes.length; i++) {
// if (routes[i].length >= maxCap) continue;
// if (!routes[i].every(p => canMergeByPreference(p, outlier))) continue;
// const c = centroid(routes[i].map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
// if (haversineKm(c.lat, c.lng, outlier.pickupLat, outlier.pickupLng) <= SOLO_MERGE_RADIUS_KM) {
// routes[i].push(outlier); merged = true; break;
// }
// }
// if (!merged) routes.push([outlier]);
// }
// routes.forEach(r => allRouteGroups.push({ passengers: r, forced, destLat, destLng, destAddress }));
// };

// if (carStrict.length > 0) {
// const carClusters = splitCarPassengersByDistance(carStrict);
// carClusters.forEach(cluster => processSubgroup(cluster, VEHICLE_CAPS.car, 'car'));
// }
// const flexGroup = [...vanStrict, ...busStrict];
// if (flexGroup.length > 0) {
// const merged = [...vanStrict, ...busStrict];
// if (merged.length <= VEHICLE_CAPS.van) {
// processSubgroup(merged, VEHICLE_CAPS.van, vanStrict.length >= busStrict.length ? 'van' : 'bus');
// } else {
// processSubgroup(vanStrict, VEHICLE_CAPS.van, 'van');
// processSubgroup(busStrict, VEHICLE_CAPS.bus, 'bus');
// }
// }
// processSubgroup(autoAssign, VEHICLE_CAPS.bus, null);
// }

// onProgress?.('Merging small routes...');
// allRouteGroups = mergeSmallRoutes(allRouteGroups);
// allRouteGroups = splitOversizedRoutes(allRouteGroups);

// if (invalid.length > 0) {
// for (let i = 0; i < invalid.length; i += VEHICLE_CAPS.van)
// allRouteGroups.push({
// passengers: invalid.slice(i, i + VEHICLE_CAPS.van),
// forced: null,
// warning: 'No GPS coordinates — manual pickup required',
// destLat: FALLBACK_DEST.lat,
// destLng: FALLBACK_DEST.lng,
// destAddress: FALLBACK_DEST.address,
// });
// }

// if (!allRouteGroups.length) return [];
// onProgress?.(`Computing road distances for ${allRouteGroups.length} route(s)...`);

// const routeResults = await Promise.allSettled(
// allRouteGroups.map(async ({ passengers: paxList, forced, warning, destLat, destLng, destAddress }, idx) => {
// const vType = forced || resolveVehicleForGroup(paxList);
// const cap = VEHICLE_CAPS[vType];
// const dest = { lat: safeNum(destLat, FALLBACK_DEST.lat), lng: safeNum(destLng, FALLBACK_DEST.lng), address: destAddress || FALLBACK_DEST.address };
// const nnSorted = nearestNeighborSort(paxList);
// const optimized = twoOptImprove(nnSorted.map(p => ({ ...p, lat: p.pickupLat, lng: p.pickupLng })));
// const waypoints = optimized
// .map(p => ({ lat: safeNum(p.pickupLat || p.lat), lng: safeNum(p.pickupLng || p.lng) }))
// .filter(w => isValidGPS(w.lat, w.lng));

// let distanceKm = 0, durationMins = 0;
// if (waypoints.length > 0) {
// const solvice = await getSolviceRoute(waypoints, dest);
// if (solvice && solvice.distanceKm > 0 && solvice.distanceKm < 300) {
// distanceKm = Math.max(solvice.distanceKm, PK*FUEL.minRouteKm[vType] || 12);
// durationMins = solvice.durationMins;
// } else {
// let straight = 0;
// for (let i = 0; i < waypoints.length - 1; i++)
// straight += haversineKm(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
// straight += haversineKm(waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng, dest.lat, dest.lng);
// const roadKm = straight * (PK*FUEL.roadFactor[vType] || 1.32);
// distanceKm = Math.max(roadKm, PK_FUEL.minRouteKm[vType] || 12);
// durationMins = Math.max(10, Math.round((distanceKm / (PK_FUEL.avgSpeedKmh[vType] || 23)) * 60));
// }
// } else {
// distanceKm = PK_FUEL.minRouteKm[vType] || 12;
// durationMins = Math.round((distanceKm / (PK_FUEL.avgSpeedKmh[vType] || 23)) \* 60);
// }

// const { fuelLitres, fuelCostPKR, fuelType, consumption } = calculateFuel(distanceKm, vType);
// const areaLabel = getMostCommonArea(paxList.map(p => p.pickupAddress));
// const hasCarPref = paxList.some(p => p.vehiclePreference === 'car');
// const hasFlexPref = paxList.some(p => p.vehiclePreference === 'van' || p.vehiclePreference === 'bus');
// const stops = [
// ...optimized.map(p => ({
// name: p.name,
// address: p.pickupAddress || `${safeNum(p.pickupLat).toFixed(4)}, ${safeNum(p.pickupLng).toFixed(4)}`,
// lat: safeNum(p.pickupLat || p.lat),
// lng: safeNum(p.pickupLng || p.lng),
// type: 'pickup',
// })),
// { name: 'Destination', address: dest.address, lat: dest.lat, lng: dest.lng, type: 'dropoff' },
// ];

// return {
// id: `route_${Date.now()}_${idx}`,
// vehicleType: vType,
// passengerCount: paxList.length,
// capacity: cap,
// passengers: paxList,
// stops,
// destination: dest.address,
// destinationLat: dest.lat,
// destinationLng: dest.lng,
// estimatedKm: fmtKm(distanceKm),
// estimatedTime: fmtTime(durationMins),
// estimatedFuel: fmtLitres(fuelLitres),
// fuelCostPKR: fmtPKR(fuelCostPKR),
// fuelType,
// consumption: `${consumption.toFixed(1)} L/100km`,
// fuelRatePerKm: parseFloat((fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3)),
// rawDistanceKm: parseFloat(distanceKm.toFixed(2)),
// rawDurationMins: durationMins,
// rawFuelLitres: fuelLitres,
// rawFuelCostPKR: fuelCostPKR,
// preferenceGroup: hasCarPref || hasFlexPref,
// areaLabel,
// warning: warning || null,
// warnings: warning ? [warning] : [],
// };
// }),
// );

// const final = routeResults.filter(r => r.status === 'fulfilled').map(r => r.value);
// final.sort((a, b) => {
// const aHasCar = a.passengers.some(p => p.vehiclePreference === 'car');
// const bHasCar = b.passengers.some(p => p.vehiclePreference === 'car');
// if (aHasCar && !bHasCar) return -1;
// if (!aHasCar && bHasCar) return 1;
// if (a.preferenceGroup && !b.preferenceGroup) return -1;
// if (!a.preferenceGroup && b.preferenceGroup) return 1;
// return b.passengerCount - a.passengerCount;
// });
// return final;
// }
// }

// const optimizer = new RouteOptimizationEngine();

// // ══════════════════════════════════════════════════════════════════════════════
// // API SERVICE
// // ══════════════════════════════════════════════════════════════════════════════

// class ApiService {
// async getAuthData() {
// try {
// const [token, transporterId, userId, td] = await Promise.all([
// AsyncStorage.getItem('authToken'),
// AsyncStorage.getItem('transporterId'),
// AsyncStorage.getItem('userId'),
// AsyncStorage.getItem('transporterData'),
// ]);
// let parsedData = null;
// try { parsedData = td ? JSON.parse(td) : null; } catch (\_) {}
// const resolvedId = transporterId || userId || parsedData?.id || parsedData?.\_id || null;
// return { token, transporterId: resolvedId, transporterData: parsedData };
// } catch { return { token: null, transporterId: null, transporterData: null }; }
// }

// async call(endpoint, options = {}) {
// const { token } = await this.getAuthData();
// if (!token) throw new Error('Authentication required');
// const res = await fetch(`${API_BASE}${endpoint}`, {
// ...options,
// headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
// });
// const text = await res.text();
// if (!res.ok) {
// if (res.status === 401 || res.status === 403) throw new Error('Authentication failed — please login again');
// let errMsg = `Server Error ${res.status}`;
// try { const j = JSON.parse(text); errMsg = j.message || j.error || errMsg; } catch {}
// throw new Error(errMsg);
// }
// return text ? JSON.parse(text) : {};
// }

// async getProfile() {
// const { transporterId } = await this.getAuthData();
// if (!transporterId) { const r = await this.call('/profile'); return this.\_normalizeProfile(r, ''); }
// const r = await this.call(`/transporter/profile/${transporterId}`);
// return this.\_normalizeProfile(r.data || r.transporter || r, transporterId);
// }

// \_normalizeProfile(p, fallbackId) {
// return {
// id: p.\_id || p.id || fallbackId,
// name: p.name || 'Transporter',
// email: p.email || '',
// phone: p.phone || p.phoneNumber || 'N/A',
// company: p.company || p.companyName || 'Transport Co.',
// address: p.address || 'N/A',
// license: p.license || p.licenseNumber || 'N/A',
// registrationDate: p.registrationDate ? new Date(p.registrationDate).toLocaleDateString() : 'N/A',
// location: p.location || p.address || 'N/A',
// status: p.status || 'active',
// profileImage: p.profileImage || null,
// };
// }

// async updateProfile(data) {
// const { transporterId } = await this.getAuthData();
// return this.call(`/transporter/profile/${transporterId}`, { method: 'PUT', body: JSON.stringify(data) });
// }

// async getStats() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/dashboard/stats?transporterId=${transporterId}`);
// const s = r.stats || r.data || r;
// return {
// activeDrivers: +s.activeDrivers || 0,
// totalPassengers: +s.totalPassengers || 0,
// completedTrips: +s.completedTrips || 0,
// ongoingTrips: +s.ongoingTrips || 0,
// complaints: +s.complaints || 0,
// paymentsReceived: +s.paymentsReceived || 0,
// paymentsPending: +s.paymentsPending || 0,
// };
// }

// async getPolls() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/polls?transporterId=${transporterId}`);
// return Array.isArray(r) ? r : (r.polls || r.data || []);
// }

// async createPoll(data) {
// const { transporterId } = await this.getAuthData();
// return this.call('/polls', { method: 'POST', body: JSON.stringify({ ...data, transporterId }) });
// }

// async deletePoll(id) { return this.call(`/polls/${id}`, { method: 'DELETE' }); }

// async getDrivers() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/drivers?transporterId=${transporterId}`);
// return Array.isArray(r) ? r : (r.drivers || r.data || []);
// }

// async saveUnassignedRoute(routeData) {
// const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
// const { transporterId: authTid } = await this.getAuthData();
// const stopStrings = (routeData.stops || []).map(s => typeof s === 'string' ? s : (s.address || s.name || 'Stop'));
// const passengerList = (routeData.passengers || []).map(p => ({
// passengerId: p.id || p.\_id || null,
// passengerName: p.name || 'Passenger',
// pickupPoint: p.pickupAddress || p.pickupPoint || 'Pickup',
// destination: p.dropAddress || p.destination || '',
// destinationLat: p.dropLat,
// destinationLng: p.dropLng,
// vehiclePreference: p.vehiclePreference || null,
// status: 'pending',
// }));
// return this.call('/routes', {
// method: 'POST',
// body: JSON.stringify({
// name: routeData.routeName,
// routeName: routeData.routeName,
// pollId: routeData.pollId,
// startPoint: routeData.startPoint || stopStrings[0] || 'Multiple Pickup Points',
// destination: routeData.destination,
// destinationLat: routeData.destinationLat,
// destinationLng: routeData.destinationLng,
// timeSlot: routeData.timeSlot,
// pickupTime: routeData.pickupTime || routeData.timeSlot,
// date: tomorrow.toISOString(),
// passengers: passengerList,
// stops: stopStrings,
// estimatedTime: routeData.estimatedTime,
// estimatedFuel: routeData.estimatedFuel,
// estimatedKm: routeData.estimatedKm,
// fuelCostPKR: routeData.fuelCostPKR,
// fuelType: routeData.fuelType,
// fuelRatePerKm: routeData.fuelRatePerKm,
// vehicleType: routeData.vehicleType,
// status: 'unassigned',
// transporterId: routeData.transporterId || authTid,
// }),
// });
// }

// async assignDriverToRoute(routeId, driverId) {
// return this.call(`/routes/${routeId}/assign-driver`, { method: 'PUT', body: JSON.stringify({ driverId, assignedDriver: driverId }) });
// }

// async reassignDriverToRoute(routeId, driverId) {
// return this.call(`/routes/${routeId}/assign-driver`, { method: 'PUT', body: JSON.stringify({ driverId, assignedDriver: driverId }) });
// }

// async getDriverRequests() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/join-requests?type=driver&transporterId=${transporterId}`);
// return (Array.isArray(r) ? r : (r.requests || r.data || [])).filter(x => x.status === 'pending');
// }

// async approveDriverRequest(id) {
// const { transporterId } = await this.getAuthData();
// return this.call(`/join-requests/${id}/accept`, { method: 'PUT', body: JSON.stringify({ transporterId }) });
// }

// async rejectDriverRequest(id) { return this.call(`/join-requests/${id}/reject`, { method: 'PUT' }); }

// async getPassengerRequests() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/join-requests?type=passenger&transporterId=${transporterId}`);
// return (Array.isArray(r) ? r : (r.requests || r.data || [])).filter(x => x.status === 'pending');
// }

// async approvePassengerRequest(id) {
// const { transporterId } = await this.getAuthData();
// return this.call(`/join-requests/${id}/accept`, { method: 'PUT', body: JSON.stringify({ transporterId }) });
// }

// async rejectPassengerRequest(id) { return this.call(`/join-requests/${id}/reject`, { method: 'PUT' }); }

// async getRoutes() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/routes?transporterId=${transporterId}`);
// return Array.isArray(r) ? r : (r.routes || r.data || []);
// }

// async getTrips() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/trips?transporterId=${transporterId}`);
// return Array.isArray(r) ? r : (r.trips || r.data || []);
// }

// async getComplaints() {
// const { transporterId } = await this.getAuthData();
// const r = await this.call(`/complaints?transporterId=${transporterId}`);
// return Array.isArray(r) ? r : (r.complaints || r.data || []);
// }

// async getNotifications() {
// const r = await this.call('/notifications');
// return Array.isArray(r) ? r : (r.notifications || r.data || []);
// }

// async markRead(id) { return this.call(`/notifications/${id}/read`, { method: 'PUT' }); }
// }

// const api = new ApiService();

// // ══════════════════════════════════════════════════════════════════════════════
// // CLOCK TIME PICKER
// // ══════════════════════════════════════════════════════════════════════════════

// const TimePicker = ({ visible, onClose, onSelect }) => {
// const [mode, setMode] = useState('hour');
// const [hour, setHour] = useState(7);
// const [minute, setMinute] = useState(0);
// const [period, setPeriod] = useState('AM');

// const CLOCK_SIZE = 240, CENTER = 120, RADIUS = 90, HAND_RADIUS = 80;

// useEffect(() => {
// if (visible) { setMode('hour'); setHour(7); setMinute(0); setPeriod('AM'); }
// }, [visible]);

// const hourNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
// const minuteNumbers = Array.from({ length: 12 }, (_, i) => i \* 5);

// const getNumPosition = (index, total, r) => {
// const angle = ((index / total) _ 2 _ Math.PI) - (Math.PI / 2);
// return { x: CENTER + r _ Math.cos(angle), y: CENTER + r _ Math.sin(angle) };
// };

// const handAngle = mode === 'hour' ? ((hour / 12) _ 360) - 90 : ((minute / 60) _ 360) - 90;
// const handRad = (handAngle _ Math.PI) / 180;
// const handX = CENTER + HAND_RADIUS _ Math.cos(handRad);
// const handY = CENTER + HAND_RADIUS \* Math.sin(handRad);

// const handleClockPress = (evt) => {
// const { locationX, locationY } = evt.nativeEvent;
// const dx = locationX - CENTER, dy = locationY - CENTER;
// let angle = Math.atan2(dy, dx) \* (180 / Math.PI) + 90;
// if (angle < 0) angle += 360;
// if (mode === 'hour') {
// let h = Math.round(angle / 30);
// if (h === 0) h = 12;
// if (h > 12) h = 12;
// setHour(h);
// setTimeout(() => setMode('minute'), 300);
// } else {
// let m = Math.round(angle / 6);
// if (m >= 60) m = 0;
// setMinute(m);
// }
// };

// const dH = String(hour).padStart(2, '0');
// const dM = String(minute).padStart(2, '0');

// return (
// <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
// <View style={clk.overlay}>
// <View style={clk.box}>
// <View style={clk.hdr}>
// <Icon name="alarm" size={18} color={C.black} style={{ marginRight: 8 }} />
// <Text style={clk.hdrTxt}>Set Pickup Time</Text>
// </View>
// <View style={clk.digitalRow}>
// <TouchableOpacity onPress={() => setMode('hour')} style={[clk.digitBox, mode === 'hour' && clk.digitBoxOn]}>
// <Text style={[clk.digitTxt, mode === 'hour' && clk.digitTxtOn]}>{dH}</Text>
// </TouchableOpacity>
// <Text style={clk.colon}>:</Text>
// <TouchableOpacity onPress={() => setMode('minute')} style={[clk.digitBox, mode === 'minute' && clk.digitBoxOn]}>
// <Text style={[clk.digitTxt, mode === 'minute' && clk.digitTxtOn]}>{dM}</Text>
// </TouchableOpacity>
// <View style={clk.ampmCol}>
// {['AM', 'PM'].map(p => (
// <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[clk.ampmBtn, period === p && clk.ampmBtnOn]}>
// <Text style={[clk.ampmTxt, period === p && clk.ampmTxtOn]}>{p}</Text>
// </TouchableOpacity>
// ))}
// </View>
// </View>
// <Text style={clk.modeLabel}>{mode === 'hour' ? 'SELECT HOUR' : 'SELECT MINUTE'}</Text>
// <View style={clk.clockWrap}>
// <View
// style={[clk.clockFace, { width: CLOCK_SIZE, height: CLOCK_SIZE, borderRadius: CLOCK_SIZE / 2 }]}
// onStartShouldSetResponder={() => true}
// onResponderGrant={handleClockPress}
// onResponderMove={handleClockPress}
// >
// {(mode === 'hour' ? hourNumbers : minuteNumbers).map((n, i) => {
// const pos = getNumPosition(i, 12, RADIUS);
// const isSel = mode === 'hour' ? n === hour : (minute === n || (i === 0 && minute < 3));
// return (
// <TouchableOpacity
// key={n}
// onPress={() => {
// if (mode === 'hour') { setHour(n); setTimeout(() => setMode('minute'), 300); }
// else { setMinute(n); }
// }}
// style={[clk.clockNum, { left: pos.x - 18, top: pos.y - 18, backgroundColor: isSel ? C.primary : 'transparent' }]}
// >
// <Text style={[clk.clockNumTxt, { color: isSel ? C.primaryDark : C.textDark, fontSize: mode === 'minute' ? 12 : 14 }]}>
// {mode === 'minute' ? String(n).padStart(2, '0') : n}
// </Text>
// </TouchableOpacity>
// );
// })}
// <View style={[clk.centerDot, { left: CENTER - 5, top: CENTER - 5 }]} />
// <View style={[clk.handLine, { left: CENTER, top: CENTER, width: HAND_RADIUS, transform: [{ translateX: -2 }, { rotate: `${handAngle + 90}deg` }, { translateX: -HAND_RADIUS / 2 }] }]} />
// <View style={[clk.handDot, { left: handX - 10, top: handY - 10 }]} />
// </View>
// </View>
// {mode === 'minute' && (
// <View style={clk.quickMin}>
// {[0, 15, 30, 45].map(m => (
// <TouchableOpacity key={m} style={[clk.quickMinBtn, minute === m && clk.quickMinBtnOn]} onPress={() => setMinute(m)}>
// <Text style={[clk.quickMinTxt, minute === m && clk.quickMinTxtOn]}>:{String(m).padStart(2, '0')}</Text>
// </TouchableOpacity>
// ))}
// </View>
// )}
// <View style={clk.actions}>
// <TouchableOpacity style={clk.cancelBtn} onPress={onClose}>
// <Text style={clk.cancelTxt}>Cancel</Text>
// </TouchableOpacity>
// <TouchableOpacity style={clk.confirmBtn} onPress={() => { onSelect(`${dH}:${dM} ${period}`); onClose(); }}>
// <Icon name="check" size={15} color={C.primaryDark} />
// <Text style={clk.confirmTxt}>{dH}:{dM} {period}</Text>
// </TouchableOpacity>
// </View>
// </View>
// </View>
// </Modal>
// );
// };

// const clk = StyleSheet.create({
// overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
// box: { backgroundColor: C.white, borderRadius: 20, width: '100%', maxWidth: 340, overflow: 'hidden', elevation: 20 },
// hdr: { backgroundColor: C.primary, flexDirection: 'row', alignItems: 'center', padding: 16 },
// hdrTxt: { fontSize: 16, fontWeight: '900', color: C.black },
// digitalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 10, paddingHorizontal: 20, gap: 4 },
// digitBox: { backgroundColor: C.primaryGhost, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 2, borderColor: C.border },
// digitBoxOn: { backgroundColor: C.primary, borderColor: C.primaryDark },
// digitTxt: { fontSize: 36, fontWeight: '900', color: C.textDark },
// digitTxtOn: { color: C.black },
// colon: { fontSize: 36, fontWeight: '900', color: C.textDark, marginHorizontal: 2 },
// ampmCol: { marginLeft: 10, gap: 5 },
// ampmBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: C.primaryGhost, borderWidth: 2, borderColor: C.border },
// ampmBtnOn: { backgroundColor: C.primary, borderColor: C.primaryDark },
// ampmTxt: { fontSize: 12, fontWeight: '800', color: C.textDark },
// ampmTxtOn: { color: C.black },
// modeLabel: { textAlign: 'center', fontSize: 10, fontWeight: '800', color: C.textLight, letterSpacing: 2, marginBottom: 8 },
// clockWrap: { alignItems: 'center', paddingBottom: 10 },
// clockFace: { backgroundColor: C.primaryGhost, borderWidth: 2, borderColor: C.border, position: 'relative' },
// clockNum: { position: 'absolute', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
// clockNumTxt: { fontWeight: '800' },
// centerDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: C.primaryDark },
// handLine: { position: 'absolute', height: 3, backgroundColor: C.primaryDark, borderRadius: 2 },
// handDot: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, borderWidth: 3, borderColor: C.primaryDark },
// quickMin: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12, justifyContent: 'center' },
// quickMinBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.primaryGhost, alignItems: 'center', borderWidth: 2, borderColor: C.border },
// quickMinBtnOn: { backgroundColor: C.primary, borderColor: C.primaryDark },
// quickMinTxt: { fontSize: 13, fontWeight: '700', color: C.textDark },
// quickMinTxtOn: { color: C.black, fontWeight: '900' },
// actions: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 4 },
// cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
// cancelTxt: { fontWeight: '700', color: C.textDark, fontSize: 14 },
// confirmBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: C.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
// confirmTxt: { color: C.black, fontWeight: '900', fontSize: 14 },
// });

// // ══════════════════════════════════════════════════════════════════════════════
// // REUSABLE COMPONENTS
// // ══════════════════════════════════════════════════════════════════════════════

// const Avatar = ({ uri, name, size = 60 }) => {
// const init = useMemo(() => {
// if (!name) return 'T';
// const pts = name.trim().split(' ');
// return pts.length > 1 ? `${pts[0][0]}${pts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
// }, [name]);
// return (
// <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.white }}>
// {uri
// ? <Image source={{ uri }} style={{ width: size, height: size }} />
// : <Text style={{ color: C.black, fontSize: size * 0.35, fontWeight: '900' }}>{init}</Text>
// }
// </View>
// );
// };

// const StatCard = ({ label, value, iconName, onPress }) => (
// <TouchableOpacity style={s.statCard} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
// <View style={s.statIconWrap}><Icon name={iconName} size={20} color={C.primaryDark} /></View>
// <Text style={s.statValue}>{value ?? '—'}</Text>
// <Text style={s.statLabel}>{label}</Text>
// </TouchableOpacity>
// );

// const FuelBadge = ({ fuelType, fuelCostPKR, estimatedFuel, estimatedKm, vehicleType }) => {
// const isDiesel = fuelType === 'diesel';
// const consumption = PK_FUEL.consumption[vehicleType] || (isDiesel ? 15 : 12);
// const pricePerL = PK_FUEL.pricePerLitre[fuelType] || (isDiesel ? 283 : 278);
// return (
// <View style={s.fuelBadge}>
// <View style={s.fuelIconBox}>
// <Icon name="local-gas-station" size={20} color={C.primaryDark} />
// </View>
// <View style={{ marginLeft: 10, flex: 1 }}>
// <Text style={s.fuelBadgeType}>{isDiesel ? 'Diesel' : 'Petrol'} — {VEHICLE_INFO[vehicleType]?.label || vehicleType}</Text>
// <Text style={s.fuelBadgeVal}>{estimatedFuel}{fuelCostPKR ? ` · ${typeof fuelCostPKR === 'string' ? fuelCostPKR : fmtPKR(fuelCostPKR)}` : ''}</Text>
// <Text style={s.fuelBadgeNote}>Rs.{pricePerL}/L · {consumption}L per 100km</Text>
// </View>
// </View>
// );
// };

// function decodePolyline(encoded) {
// const points = [];
// let index = 0, lat = 0, lng = 0;
// while (index < encoded.length) {
// let b, shift = 0, result = 0;
// do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
// lat += result & 1 ? ~(result >> 1) : result >> 1;
// shift = 0; result = 0;
// do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
// lng += result & 1 ? ~(result >> 1) : result >> 1;
// points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
// }
// return points;
// }

// function prefLabel(pref, count) {
// if (!pref || pref === 'auto') return `${count} Auto-assign`;
// const info = VEHICLE_INFO[pref];
// if (pref === 'car') return `${count} Car (strict)`;
// return `${count} ${info?.label || pref} (flexible)`;
// }

// // ══════════════════════════════════════════════════════════════════════════════
// // OVERALL MAP VIEW
// // ══════════════════════════════════════════════════════════════════════════════

// const OverallMapView = ({ routes, onClose }) => {
// const [routePolylines, setRoutePolylines] = useState({});
// const [loadingRoutes, setLoadingRoutes] = useState(true);
// const mapRef = useRef(null);

// const allStops = useMemo(() =>
// routes.flatMap((r, ri) =>
// (r.stops || [])
// .filter(s => s && isValidGPS(s.lat, s.lng))
// .map(s => ({ ...s, routeIdx: ri, routeLabel: r.areaLabel || `Route ${ri + 1}`, vehicleType: r.vehicleType })),
// ), [routes]);

// const region = useMemo(() => {
// if (!allStops.length) return { latitude: 33.6135, longitude: 73.1998, latitudeDelta: 0.15, longitudeDelta: 0.15 };
// const lats = allStops.map(s => safeNum(s.lat));
// const lngs = allStops.map(s => safeNum(s.lng));
// return {
// latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
// longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
// latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) _ 1.5, 0.05),
// longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) _ 1.5, 0.05),
// };
// }, [allStops]);

// useEffect(() => {
// let cancelled = false;
// const fetchAll = async () => {
// setLoadingRoutes(true);
// for (let ri = 0; ri < routes.length; ri++) {
// if (cancelled) return;
// const r = routes[ri];
// const stops = (r.stops || []).filter(s => s && isValidGPS(s.lat, s.lng));
// if (stops.length < 2) continue;
// const origin = stops[0], dest = stops[stops.length - 1];
// const mids = stops.slice(1, -1).map(s => `${safeNum(s.lat)},${safeNum(s.lng)}`).join('|');
// try {
// const params = new URLSearchParams({ origin: `${safeNum(origin.lat)},${safeNum(origin.lng)}`, destination: `${safeNum(dest.lat)},${safeNum(dest.lng)}`, mode: 'driving' });
// if (mids) params.append('waypoints', mids);
// const res = await fetch(`${API_BASE}/directions?${params}`);
// const ct = res.headers.get('content-type') || '';
// if (!ct.includes('application/json')) continue;
// const data = await res.json();
// if (data.success && data.routes?.[0]?.overview_polyline?.encoded) {
// const poly = decodePolyline(data.routes[0].overview_polyline.encoded);
// if (!cancelled) setRoutePolylines(prev => ({ ...prev, [ri]: poly }));
// }
// } catch (e) { console.warn(`[OverallMap] route ${ri} failed:`, e.message); }
// }
// if (!cancelled) setLoadingRoutes(false);
// };
// fetchAll();
// return () => { cancelled = true; };
// }, [routes]);

// const totalPax = routes.reduce((s, r) => s + (r.passengerCount || 0), 0);
// const totalFuelPKR = routes.reduce((s, r) => s + (r.rawFuelCostPKR || 0), 0);
// const totalFuelL = routes.reduce((s, r) => s + (r.rawFuelLitres || 0), 0);
// const uniqueDests = [...new Set(routes.map(r => r.destination).filter(Boolean))];

// return (
// <Modal visible animationType="slide" onRequestClose={onClose}>
// <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
// <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
// <View style={om.header}>
// <TouchableOpacity onPress={onClose} style={om.backBtn}>
// <Icon name="arrow-back" size={22} color={C.white} />
// </TouchableOpacity>
// <View style={{ flex: 1, marginLeft: 10 }}>
// <Text style={om.headerTitle}>All Routes Overview</Text>
// <Text style={om.headerSub}>{routes.length} routes · {totalPax} passengers · {uniqueDests.length} destination(s)</Text>
// </View>
// {loadingRoutes && <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 4 }} />}
// </View>
// <View style={{ flex: 1 }}>
// <MapView ref={mapRef} style={{ flex: 1 }} provider={PROVIDER*GOOGLE} initialRegion={region} showsTraffic showsBuildings>
// {routes.map((r, ri) => {
// const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
// const poly = routePolylines[ri];
// const stops = (r.stops || []).filter(s => s && isValidGPS(s.lat, s.lng));
// return (
// <React.Fragment key={ri}>
// {poly?.length > 0
// ? <Polyline coordinates={poly} strokeColor={color} strokeWidth={4} />
// : stops.length > 1
// ? <Polyline coordinates={stops.map(s => ({ latitude: safeNum(s.lat), longitude: safeNum(s.lng) }))} strokeColor={color} strokeWidth={3} lineDashPattern={[8, 5]} />
// : null
// }
// {stops.map((stop, si) => {
// const isDrop = stop.type === 'dropoff';
// const isFirst = si === 0;
// return (
// <Marker
// key={`${ri}*${si}`}
//                         coordinate={{ latitude: safeNum(stop.lat), longitude: safeNum(stop.lng) }}
//                         title={stop.name || (isDrop ? 'Destination' : `Stop ${si + 1}`)}
//                         description={`Route ${ri + 1}: ${stop.address || ''}`}
//                       >
//                         <View style={[om.markerPin, {
//                           backgroundColor: isDrop ? '#1a1a1a' : isFirst ? color : C.white,
//                           borderColor:     color,
//                           width:           isDrop || isFirst ? 36 : 26,
//                           height:          isDrop || isFirst ? 36 : 26,
//                           borderRadius:    isDrop || isFirst ? 18 : 13,
//                         }]}>
//                           <Icon
//                             name={isDrop ? 'flag' : isFirst ? 'directions-car' : 'person-pin-circle'}
//                             size={isDrop || isFirst ? 18 : 12}
//                             color={isDrop ? color : isFirst ? C.black : '#333'}
//                           />
//                         </View>
//                       </Marker>
//                     );
//                   })}
//                 </React.Fragment>
//               );
//             })}
//           </MapView>
//           <View style={om.legendBox}>
//             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
//               {routes.map((r, ri) => (
//                 <View key={ri} style={[om.legendItem, { borderLeftColor: ROUTE_COLORS[ri % ROUTE_COLORS.length] }]}>
//                   <Icon name={r.vehicleType === 'car' ? 'directions-car' : r.vehicleType === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={18} color={C.textDark} />
//                   <View>
//                     <Text style={om.legendLabel}>{r.areaLabel || `Route ${ri + 1}`}</Text>
// <Text style={om.legendSub}>{r.passengerCount} pax · {r.estimatedKm}</Text>
// </View>
// </View>
// ))}
// </ScrollView>
// </View>
// </View>
// <View style={om.bottomPanel}>
// <View style={om.summaryRow}>
// <View style={om.summaryBox}><Icon name="directions-bus" size={20} color={C.primary} /><Text style={om.summaryVal}>{routes.length}</Text><Text style={om.summaryLbl}>Routes</Text></View>
// <View style={om.summaryDiv} />
// <View style={om.summaryBox}><Icon name="groups" size={20} color={C.primary} /><Text style={om.summaryVal}>{totalPax}</Text><Text style={om.summaryLbl}>Passengers</Text></View>
// <View style={om.summaryDiv} />
// <View style={om.summaryBox}><Icon name="local-gas-station" size={20} color={C.primary} /><Text style={om.summaryVal}>{totalFuelL.toFixed(1)} L</Text><Text style={om.summaryLbl}>Fuel</Text></View>
// <View style={om.summaryDiv} />
// <View style={om.summaryBox}><Icon name="account-balance-wallet" size={20} color={C.primary} /><Text style={om.summaryVal}>Rs.{Math.round(totalFuelPKR / 1000)}k</Text><Text style={om.summaryLbl}>Cost</Text></View>
// </View>
// {uniqueDests.length > 0 && (
// <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
// <Text style={{ fontSize: 11, fontWeight: '800', color: C.textLight, letterSpacing: 1 }}>DESTINATIONS</Text>
// {uniqueDests.map((d, i) => (
// <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
// <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
// <Text style={{ fontSize: 12, color: C.textMid, fontWeight: '600' }} numberOfLines={1}>{d}</Text>
// </View>
// ))}
// </View>
// )}
// </View>
// </SafeAreaView>
// </Modal>
// );
// };

// const om = StyleSheet.create({
// header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333' },
// backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
// headerTitle: { fontSize: 15, fontWeight: '800', color: C.white },
// headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
// markerPin: { justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
// legendBox: { position: 'absolute', bottom: 12, left: 12, right: 12 },
// legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderLeftWidth: 4, elevation: 3 },
// legendLabel: { fontSize: 12, fontWeight: '800', color: C.textDark },
// legendSub: { fontSize: 10, color: C.textLight, marginTop: 1 },
// bottomPanel: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 12 },
// summaryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center' },
// summaryBox: { flex: 1, alignItems: 'center', gap: 3 },
// summaryDiv: { width: 1, height: 36, backgroundColor: C.divider },
// summaryVal: { fontSize: 14, fontWeight: '900', color: C.textDark },
// summaryLbl: { fontSize: 10, color: C.textLight, fontWeight: '600' },
// });

// // ══════════════════════════════════════════════════════════════════════════════
// // SMART ROUTE CARD
// // ══════════════════════════════════════════════════════════════════════════════

// const SmartRouteCard = ({ result, onConfirm, onDiscard, isConfirming }) => {
// const [expanded, setExpanded] = useState(false);
// const vi = VEHICLE_INFO[result.vehicleType] || VEHICLE_INFO.van;

// const prefSummary = useMemo(() => {
// const counts = {};
// (result.passengers || []).forEach(p => {
// const pref = p.vehiclePreference || 'auto';
// counts[pref] = (counts[pref] || 0) + 1;
// });
// return counts;
// }, [result.passengers]);

// const vehicleIcon = result.vehicleType === 'car'
// ? 'directions-car' : result.vehicleType === 'bus'
// ? 'directions-bus' : 'airport-shuttle';

// return (
// <View style={s.card}>
// <View style={[s.cardAccentBar, { backgroundColor: C.primary }]} />

// <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
// <View style={s.vIconWrap}>
// <Icon name={vehicleIcon} size={24} color={C.primaryDark} />
// </View>
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle} numberOfLines={1}>
// {vi.label} Route — {result.passengerCount}/{result.capacity} passengers
// </Text>
// <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{result.areaLabel || 'Route'}</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
// <View style={s.chip}><Text style={s.chipTxt}>{vi.label} · cap {vi.capacity}</Text></View>
// <View style={[s.chip, { backgroundColor: C.warningLight, borderColor: C.warning }]}>
// <Text style={[s.chipTxt, { color: C.warning }]}>Needs Driver</Text>
// </View>
// {result.preferenceGroup && (
// <View style={[s.chip, { backgroundColor: C.successLight, borderColor: C.success }]}>
// <Text style={[s.chipTxt, { color: C.success }]}>Preference Route</Text>
// </View>
// )}
// </View>
// </View>
// </View>

// {Object.keys(prefSummary).length > 0 && (
// <View style={s.prefBreakdown}>
// <Text style={s.prefBreakdownLabel}>PASSENGER PREFERENCES</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
// {Object.entries(prefSummary).map(([pref, count]) => {
// const isStrict = pref === 'car';
// const isAuto = pref === 'auto';
// return (
// <View key={pref} style={[s.prefChip, {
// backgroundColor: isStrict ? '#FFF3E0' : isAuto ? C.offWhite : C.primaryGhost,
// borderColor: isStrict ? '#FF9800' : isAuto ? C.divider : C.border,
// }]}>
// <Icon
// name={isStrict ? 'directions-car' : isAuto ? 'shuffle' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'}
// size={12}
// color={isStrict ? '#E65100' : isAuto ? C.textLight : C.primaryDark}
// />
// <Text style={[s.prefChipTxt, { color: isStrict ? '#E65100' : isAuto ? C.textLight : C.primaryDark }]}>
// {prefLabel(pref, count)}
// </Text>
// </View>
// );
// })}
// <View style={[s.prefChip, { backgroundColor: C.primaryPale, borderColor: C.primary }]}>
// <Icon name={vehicleIcon} size={12} color={C.primaryDark} />
// <Text style={[s.prefChipTxt, { color: C.primaryDark }]}>Assigned: {vi.label}</Text>
// </View>
// </View>
// </View>
// )}

// {result.warning && (
// <View style={s.warnBox}>
// <Icon name="warning" size={14} color={C.warning} />
// <Text style={s.warnTxt}>{result.warning}</Text>
// </View>
// )}

// {result.destination && (
// <View style={[s.detailRow, { backgroundColor: C.primaryGhost, borderRadius: 8, padding: 9, marginBottom: 10 }]}>
// <Icon name="flag" size={14} color={C.primaryDark} />
// <Text style={[s.detailTxt, { fontWeight: '700' }]} numberOfLines={2}>{result.destination}</Text>
// </View>
// )}

// <View style={s.statsRow}>
// {[
// { i: 'straighten', v: result.estimatedKm, l: 'Road Dist.' },
// { i: 'schedule', v: result.estimatedTime, l: 'Est. Time' },
// { i: 'local-gas-station', v: result.estimatedFuel, l: 'Fuel' },
// ].map((item, idx, arr) => (
// <React.Fragment key={idx}>
// <View style={s.statBox}>
// <Icon name={item.i} size={16} color={C.primaryDark} />
// <Text style={s.statBoxVal}>{item.v}</Text>
// <Text style={s.statBoxLbl}>{item.l}</Text>
// </View>
// {idx < arr.length - 1 && <View style={s.statDiv} />}
// </React.Fragment>
// ))}
// </View>

// <FuelBadge fuelType={result.fuelType} fuelCostPKR={result.fuelCostPKR} estimatedFuel={result.estimatedFuel} estimatedKm={result.estimatedKm} vehicleType={result.vehicleType} />

// <View style={[s.srcBadge, { marginTop: 6 }]}>
// <Icon name="calculate" size={12} color={C.primaryDark} />
// <Text style={s.srcTxt}>{result.estimatedKm} × Rs.{result.fuelType === 'diesel' ? 283 : 278}/L @ {PK_FUEL.consumption[result.vehicleType] || 15}L/100km = {result.fuelCostPKR}</Text>
// </View>

// <TouchableOpacity style={s.stopsHeader} onPress={() => setExpanded(!expanded)}>
// <Text style={s.stopsTitle}>Route Stops ({result.stops?.length || 0})</Text>
// <Icon name={expanded ? 'expand-less' : 'expand-more'} size={22} color={C.primaryDark} />
// </TouchableOpacity>

// {expanded && (result.stops || []).map((stop, i) => (
// <View key={i} style={s.stopRow}>
// <View style={[s.stopDot, { backgroundColor: stop.type === 'pickup' ? C.primary : C.primaryDark }]} />
// <View style={{ flex: 1 }}>
// <Text style={s.stopName}>
// {typeof stop === 'string' ? stop : stop.name}
// {typeof stop !== 'string' && (
// <Text style={{ fontWeight: '700', color: stop.type === 'pickup' ? C.primaryDark : C.textLight }}>
// {' '}{stop.type === 'pickup' ? 'Pickup' : 'Drop-off'}
// </Text>
// )}
// </Text>
// {typeof stop !== 'string' && stop.address && (
// <Text style={s.stopAddr} numberOfLines={2}>{stop.address}</Text>
// )}
// </View>
// </View>
// ))}

// {expanded && result.passengers?.length > 0 && (
// <View style={{ marginTop: 8 }}>
// <Text style={s.stopsTitle}>Passengers ({result.passengers.length})</Text>
// {result.passengers.map((p, i) => (
// <View key={i} style={s.paxRow}>
// <View style={s.paxAvatar}>
// <Text style={{ fontSize: 11, fontWeight: '900', color: C.primaryDark }}>
// {(p.name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
// </Text>
// </View>
// <View style={{ flex: 1 }}>
// <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{p.name}</Text>
// {p.pickupAddress && <Text style={{ fontSize: 11, color: C.textLight }} numberOfLines={1}>{p.pickupAddress}</Text>}
// {(p.dropAddress || p.destination) && (
// <Text style={{ fontSize: 11, color: C.primaryDark, fontWeight: '600' }} numberOfLines={1}>{p.dropAddress || p.destination}</Text>
// )}
// {p.vehiclePreference && (
// <View style={[s.chip, { marginTop: 4,
// backgroundColor: p.vehiclePreference === 'car' ? '#FFF3E0' : C.primaryGhost,
// borderColor: p.vehiclePreference === 'car' ? '#FF9800' : C.border,
// }]}>
// <Icon name={p.vehiclePreference === 'car' ? 'directions-car' : 'airport-shuttle'} size={11} color={p.vehiclePreference === 'car' ? '#E65100' : C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 4, color: p.vehiclePreference === 'car' ? '#E65100' : C.primaryDark }]}>
// {p.vehiclePreference === 'car' ? 'Car only (strict)' : `${VEHICLE_INFO[p.vehiclePreference]?.label || p.vehiclePreference} (flexible)`}
// </Text>
// </View>
// )}
// </View>
// </View>
// ))}
// </View>
// )}

// <View style={s.twoBtn}>
// <TouchableOpacity style={s.discardBtn} onPress={onDiscard}>
// <Icon name="delete-outline" size={16} color={C.white} />
// <Text style={s.btnTxt}>Discard</Text>
// </TouchableOpacity>
// <TouchableOpacity style={[s.confirmBtnGreen, isConfirming && { opacity: 0.6 }]} onPress={onConfirm} disabled={isConfirming}>
// {isConfirming
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="save" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Save Route</Text></>
// }
// </TouchableOpacity>
// </View>
// </View>
// );
// };

// // ── Request Card
// const RequestCard = ({ req, onAccept, onReject, isProcessing }) => {
// const vInfo = VEHICLE_INFO[req.vehicleType || req.vehicle_type] || null;
// const pInfo = VEHICLE_INFO[req.vehiclePreference || req.vehicle_preference] || null;
// return (
// <View style={s.card}>
// <View style={[s.cardAccentBar, { backgroundColor: req.type === 'driver' ? C.primaryDark : C.primary }]} />
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
// <View style={s.reqAvatar}>
// <Icon name={req.type === 'driver' ? 'directions-car' : 'person'} size={24} color={C.primaryDark} />
// </View>
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle}>{req.name || req.fullName}</Text>
// <View style={[s.chip, { marginTop: 4 }]}>
// <Text style={s.chipTxt}>{req.type === 'driver' ? 'Driver Request' : 'Passenger Request'}</Text>
// </View>
// </View>
// </View>
// <View style={{ gap: 7, marginBottom: 12 }}>
// {req.email && <View style={s.detailRow}><Icon name="email"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.email}</Text></View>}
// {req.phone && <View style={s.detailRow}><Icon name="phone"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.phone}</Text></View>}
// {req.license && <View style={s.detailRow}><Icon name="credit-card" size={14} color={C.primaryDark} /><Text style={s.detailTxt}>License: {req.license}</Text></View>}
// {req.pickupPoint && <View style={s.detailRow}><Icon name="place"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.pickupPoint}</Text></View>}
// {req.destination && <View style={s.detailRow}><Icon name="flag"        size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.destination}</Text></View>}
// </View>
// {vInfo && (
// <View style={s.vBadge}>
// <Icon name={req.vehicleType === 'car' ? 'directions-car' : req.vehicleType === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={22} color={C.primaryDark} />
// <View style={{ marginLeft: 10 }}>
// <Text style={s.vBadgeLbl}>VEHICLE TYPE</Text>
// <Text style={s.vBadgeVal}>{vInfo.label} — {vInfo.desc}</Text>
// </View>
// </View>
// )}
// {pInfo && (
// <View style={[s.vBadge, { marginTop: 8, backgroundColor: C.successLight, borderColor: C.success }]}>
// <Icon name={pInfo.label === 'Car' ? 'directions-car' : pInfo.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'} size={22} color={C.success} />
// <View style={{ marginLeft: 10 }}>
// <Text style={[s.vBadgeLbl, { color: C.success }]}>
// {pInfo.label === 'Car' ? 'TRAVEL PREFERENCE — STRICT' : 'TRAVEL PREFERENCE — FLEXIBLE'}
// </Text>
// <Text style={[s.vBadgeVal, { color: C.success }]}>
// {pInfo.label === 'Car'
// ? 'Car only — never reassigned to van/bus'
// : `${pInfo.label} preferred — may flex to ${pInfo.label === 'Van' ? 'bus' : 'van'}`}
// </Text>
// </View>
// </View>
// )}
// <View style={s.twoBtn}>
// <TouchableOpacity style={s.rejectBtn} onPress={onReject} disabled={isProcessing}>
// <Icon name="close" size={16} color={C.white} />
// <Text style={s.btnTxt}>Reject</Text>
// </TouchableOpacity>
// <TouchableOpacity style={s.acceptBtn} onPress={onAccept} disabled={isProcessing}>
// {isProcessing
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="check" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Accept</Text></>
// }
// </TouchableOpacity>
// </View>
// </View>
// );
// };

// // ── Driver Card
// const DriverCard = ({ driver, compact = false }) => {
// const vi = VEHICLE_INFO[driver.vehicleType || driver.vehicle] || VEHICLE_INFO.van;
// const cap = vi.capacity || driver.capacity || 8;
// const fill = driver.passengers?.length || 0;
// const pct = Math.min((fill / cap) \* 100, 100);
// return (
// <View style={[s.driverCard, compact && { flex: 1, marginBottom: 0, borderWidth: 0, elevation: 0, shadowOpacity: 0, padding: 0, backgroundColor: 'transparent' }]}>
// <View style={s.driverAvatar}>
// <Text style={s.driverAvatarTxt}>{(driver.name || 'D').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</Text>
// <View style={[s.driverDot, { backgroundColor: driver.status === 'active' ? C.success : C.border }]} />
// </View>
// <View style={{ flex: 1 }}>
// <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
// <Text style={s.driverName} numberOfLines={1}>{driver.name}</Text>
// <Icon name={vi.label === 'Car' ? 'directions-car' : vi.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'} size={18} color={C.primaryDark} />
// </View>
// <Text style={s.driverSub}>{vi.label} · cap {cap}</Text>
// <View style={s.capRow}>
// <Text style={s.capTxt}>{fill}/{cap}</Text>
// <View style={s.capBg}><View style={[s.capFill, { width: `${pct}%`, backgroundColor: pct > 80 ? C.error : C.primary }]} /></View>
// </View>
// {driver.phone && (
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
// <Icon name="phone" size={11} color={C.textLight} />
// <Text style={{ fontSize: 11, color: C.textLight }}>{driver.phone}</Text>
// </View>
// )}
// </View>
// </View>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // MAIN DASHBOARD COMPONENT
// // ══════════════════════════════════════════════════════════════════════════════

// const TransporterDashboard = () => {
// const navigation = useNavigation();
// const [section, setSection] = useState('overview');
// const [sidebar, setSidebar] = useState(false);
// const [loading, setLoading] = useState(true);
// const [refreshing, setRefreshing] = useState(false);
// const slideAnim = useRef(new Animated.Value(-300)).current;

// const [profile, setProfile] = useState(null);
// const [editProfile, setEditProfile] = useState(null);
// const [isEditingPro, setIsEditingPro] = useState(false);
// const [stats, setStats] = useState({
// activeDrivers: 0, totalPassengers: 0, completedTrips: 0,
// ongoingTrips: 0, complaints: 0, paymentsReceived: 0, paymentsPending: 0,
// });
// const [polls, setPolls] = useState([]);
// const [drivers, setDrivers] = useState([]);
// const [routes, setRoutes] = useState([]);
// const [trips, setTrips] = useState([]);
// const [driverReqs, setDriverReqs] = useState([]);
// const [passReqs, setPassReqs] = useState([]);
// const [complaints, setComplaints] = useState([]);
// const [notifications, setNotifications] = useState([]);
// const [smartResults, setSmartResults] = useState([]);
// const [optimizing, setOptimizing] = useState(false);
// const [optimizeStatus, setOptimizeStatus] = useState('');
// const [confirmingIdx, setConfirmingIdx] = useState(null);
// const [activePoll, setActivePoll] = useState(null);
// const [selectedPoll, setSelectedPoll] = useState(null);
// const [lastUpdated, setLastUpdated] = useState(new Date());

// useEffect(() => { checkAuthAndLoad(); }, []);
// useEffect(() => {
// Animated.spring(slideAnim, { toValue: sidebar ? 0 : -300, useNativeDriver: true, tension: 80, friction: 12 }).start();
// }, [sidebar]);

// const checkAuthAndLoad = async () => {
// const { token, transporterId } = await api.getAuthData();
// if (!token || !transporterId) {
// navigation.reset({ index: 0, routes: [{ name: 'TransporterLogin' }] });
// return;
// }
// await loadAll();
// };

// const loadAll = async () => {
// try {
// setLoading(true);
// const [p, st, po, dr, req_d, req_p, rt, tr, co, no] = await Promise.allSettled([
// api.getProfile(), api.getStats(), api.getPolls(), api.getDrivers(),
// api.getDriverRequests(), api.getPassengerRequests(), api.getRoutes(),
// api.getTrips(), api.getComplaints(), api.getNotifications(),
// ]);
// if (p.status === 'fulfilled' && p.value) setProfile(p.value);
// if (st.status === 'fulfilled' && st.value) setStats(st.value);
// if (po.status === 'fulfilled' && po.value) setPolls(po.value);
// if (dr.status === 'fulfilled' && dr.value) setDrivers(dr.value);
// if (req_d.status === 'fulfilled') setDriverReqs(req_d.value || []);
// if (req_p.status === 'fulfilled') setPassReqs(req_p.value || []);
// if (rt.status === 'fulfilled') setRoutes(rt.value || []);
// if (tr.status === 'fulfilled') setTrips(tr.value || []);
// if (co.status === 'fulfilled') setComplaints(co.value || []);
// if (no.status === 'fulfilled') setNotifications(no.value || []);
// setLastUpdated(new Date());
// } catch (e) {
// if (e.message?.includes('Authentication'))
// Alert.alert('Session Expired', 'Please login again.', [{
// text: 'OK',
// onPress: () => navigation.reset({ index: 0, routes: [{ name: 'TransporterLogin' }] }),
// }]);
// } finally { setLoading(false); }
// };

// const onRefresh = useCallback(() => {
// setRefreshing(true);
// loadAll().finally(() => setRefreshing(false));
// }, []);

// const unread = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
// const totalBadge = driverReqs.length + passReqs.length + unread + smartResults.length;
// const nav = (sec) => { setSection(sec); setSidebar(false); };

// // ── OPTIMIZE ──────────────────────────────────────────────────────────────
// const handleOptimize = async (poll) => {
// if (!poll) { Alert.alert('No Poll', 'Select a poll first.'); return; }
// setOptimizing(true);
// setActivePoll(poll);
// setSmartResults([]);
// setOptimizeStatus('Preparing passenger data...');
// try {
// const yesResponses = (poll.responses || []).filter(r => r.response === 'yes');
// if (!yesResponses.length) { Alert.alert('No Passengers', 'No passengers responded "Yes".'); return; }

// const passengers = yesResponses.map((r, i) => normalizePassenger(r, i));
// let results = null;

// try {
// setOptimizeStatus('Requesting server optimization...');
// const apiRes = await api.call('/routes/optimize', {
// method: 'POST',
// body: JSON.stringify({ pollId: poll.\_id }),
// });
// if (apiRes?.success && apiRes.routes?.length) {
// results = apiRes.routes;
// setOptimizeStatus(`${results.length} route(s) ready from server`);
// }
// } catch (backendErr) {
// console.warn('[handleOptimize] Backend failed, using local engine:', backendErr.message);
// setOptimizeStatus('Running local optimization engine...');
// }

// if (!results || !results.length) {
// results = await optimizer.optimize(passengers, (msg) => setOptimizeStatus(msg));
// }

// if (!results || !results.length) {
// Alert.alert('No Routes', 'Could not generate routes. Ensure passengers have GPS coordinates.');
// return;
// }

// setSmartResults(results);
// nav('smart-route');

// const totalPax = results.reduce((s, r) => s + r.passengerCount, 0);
// const totalFuel = results.reduce((s, r) => s + (r.rawFuelCostPKR || 0), 0);
// const totalLitres = results.reduce((s, r) => s + (r.rawFuelLitres || 0), 0);
// const uniqueDests = [...new Set(results.map(r => r.destination).filter(Boolean))];

// Alert.alert(
// `${results.length} Route${results.length !== 1 ? 's' : ''} Ready`,
// `Passengers: ${totalPax}\nDestinations: ${uniqueDests.length}\nFuel: ${totalLitres.toFixed(1)} L · ${fmtPKR(totalFuel)}`,
// [
// { text: 'View Routes', onPress: () => nav('smart-route') },
// { text: 'OK', style: 'cancel' },
// ],
// );
// } catch (err) {
// Alert.alert('Error', `Could not build routes: ${err.message}`);
// console.error('handleOptimize error:', err);
// } finally { setOptimizing(false); setOptimizeStatus(''); }
// };

// const handleConfirmRoute = async (result, idx) => {
// setConfirmingIdx(idx);
// try {
// if (!activePoll) throw new Error('No active poll selected');
// const payload = {
// pollId: activePoll._id,
// routeName: `${VEHICLE_INFO[result.vehicleType]?.label || 'Vehicle'} Route — ${result.passengerCount} pax · ${result.areaLabel} → ${result.destination}`,
// timeSlot: result.passengers?.[0]?.timeSlot || '08:00 AM',
// vehicleType: result.vehicleType,
// startPoint: result.stops?.[0]?.address || 'Multiple Pickup Points',
// destination: result.destination,
// destinationLat: result.destinationLat,
// destinationLng: result.destinationLng,
// passengers: result.passengers,
// stops: result.stops,
// estimatedTime: result.estimatedTime,
// estimatedFuel: result.estimatedFuel,
// estimatedKm: result.estimatedKm,
// fuelCostPKR: result.fuelCostPKR,
// fuelType: result.fuelType,
// fuelRatePerKm: result.fuelRatePerKm,
// transporterId: (await api.getAuthData()).transporterId,
// };
// await api.saveUnassignedRoute(payload);
// setSmartResults(prev => prev.filter((_, i) => i !== idx));
// Alert.alert(
// 'Route Saved',
// `${VEHICLE_INFO[result.vehicleType]?.label} · ${result.passengerCount} pax\n${result.destination}\n${result.estimatedTime}  ${result.estimatedKm}\n${result.estimatedFuel} (${result.fuelCostPKR})`,
// [
// { text: 'Assign Driver', onPress: () => nav('assign') },
// { text: 'OK', style: 'cancel' },
// ],
// );
// await loadAll();
// } catch (err) { Alert.alert('Error', err.message || 'Could not save route.'); }
// finally { setConfirmingIdx(null); }
// };

// const handleDiscardRoute = (idx) =>
// Alert.alert('Discard Route?', 'This suggestion will be removed.', [
// { text: 'Cancel', style: 'cancel' },
// { text: 'Discard', style: 'destructive', onPress: () => setSmartResults(prev => prev.filter((_, i) => i !== idx)) },
// ]);

// const logout = () =>
// Alert.alert('Logout', 'Are you sure you want to logout?', [
// { text: 'Cancel', style: 'cancel' },
// { text: 'Logout', style: 'destructive', onPress: async () => {
// await AsyncStorage.multiRemove(['authToken', 'transporterId', 'userId', 'transporterData']);
// navigation.reset({ index: 0, routes: [{ name: 'TransporterLogin' }] });
// }},
// ]);

// // ── SIDEBAR ───────────────────────────────────────────────────────────────
// const SidebarView = () => (
// <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
// <View style={s.sidebarHdr}>
// <Avatar uri={profile?.profileImage} name={profile?.name} size={50} />
// <View style={{ marginLeft: 14, flex: 1 }}>
// <Text style={s.sidebarName} numberOfLines={1}>{profile?.name || 'Transporter'}</Text>
// <Text style={s.sidebarCo} numberOfLines={1}>{profile?.company || 'Transport Co.'}</Text>
// <View style={s.sidebarStatus}>
// <View style={s.sidebarDot} />
// <Text style={s.sidebarStatusTxt}>Active</Text>
// </View>
// </View>
// <TouchableOpacity onPress={() => setSidebar(false)} style={s.sidebarClose}>
// <Icon name="close" size={20} color={C.white} />
// </TouchableOpacity>
// </View>
// <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
// <View style={{ paddingVertical: 8 }}>
// {MENU_ITEMS.map(item => {
// const active = section === item.key;
// const badge = item.key === 'notifications' ? unread
// : item.key === 'driver-req' ? driverReqs.length
// : item.key === 'pass-req' ? passReqs.length
// : item.key === 'smart-route' ? smartResults.length : 0;
// return (
// <TouchableOpacity key={item.key} style={[s.menuItem, active && s.menuItemOn]} onPress={() => nav(item.key)}>
// {active && <View style={s.menuBar} />}
// <View style={[s.menuIconWrap, active && s.menuIconOn]}>
// <Icon name={item.icon} size={18} color={active ? C.black : C.textLight} />
// </View>
// <Text style={[s.menuTxt, active && s.menuTxtOn]}>{item.label}</Text>
// {badge > 0 && (
// <View style={s.menuBadge}>
// <Text style={s.menuBadgeTxt}>{badge > 9 ? '9+' : badge}</Text>
// </View>
// )}
// </TouchableOpacity>
// );
// })}
// </View>
// <View style={s.menuDivider} />
// <TouchableOpacity style={s.logoutItem} onPress={logout}>
// <View style={[s.menuIconWrap, { backgroundColor: C.errorLight }]}>
// <Icon name="logout" size={18} color={C.error} />
// </View>
// <Text style={[s.menuTxt, { color: C.error, fontWeight: '700' }]}>Logout</Text>
// </TouchableOpacity>
// <View style={{ height: 40 }} />
// </ScrollView>
// </Animated.View>
// );

// // ══════════════════════════════════════════════════════════════════════════
// // OVERVIEW SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const OverviewSection = () => (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 32 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
// showsVerticalScrollIndicator={false}
// >
// <View style={s.welcomeCard}>
// <View style={s.welcomeCardInner}>
// <View style={{ flex: 1 }}>
// <Text style={s.welcomeGreet}>Good {new Date().getHours() < 12 ? 'Morning' : 'Afternoon'}</Text>
// <Text style={s.welcomeName} numberOfLines={1}>{profile?.name || 'Transporter'}</Text>
// <Text style={s.welcomeTime}>Updated {lastUpdated.toLocaleTimeString()}</Text>
// </View>
// <Avatar uri={profile?.profileImage} name={profile?.name} size={56} />
// </View>
// <View style={s.welcomeStrip}>
// {[
// { v: stats.activeDrivers, l: 'Drivers' },
// { v: stats.ongoingTrips, l: 'Live Trips' },
// { v: stats.completedTrips, l: 'Completed' },
// ].map((item, i, arr) => (
// <React.Fragment key={i}>
// <View style={{ alignItems: 'center' }}>
// <Text style={s.stripVal}>{item.v}</Text>
// <Text style={s.stripLbl}>{item.l}</Text>
// </View>
// {i < arr.length - 1 && <View style={s.stripDiv} />}
// </React.Fragment>
// ))}
// </View>
// </View>
// {totalBadge > 0 && (
// <TouchableOpacity style={s.alertBanner} onPress={() => nav('notifications')}>
// <Icon name="notifications-active" size={16} color={C.white} />
// <Text style={s.alertBannerTxt}>{totalBadge} item{totalBadge !== 1 ? 's' : ''} need attention</Text>
// <Icon name="chevron-right" size={16} color={C.white} />
// </TouchableOpacity>
// )}
// <Text style={s.sectionLabel}>Fleet Overview</Text>
// <View style={s.statsGrid}>
// <StatCard label="Active Drivers" value={stats.activeDrivers} iconName="people" onPress={() => nav('assign')} />
// <StatCard label="Total Passengers" value={stats.totalPassengers} iconName="groups" onPress={() => nav('pass-req')} />
// <StatCard label="Completed Trips" value={stats.completedTrips} iconName="check-circle" onPress={() => nav('routes')} />
// <StatCard label="Ongoing Trips" value={stats.ongoingTrips} iconName="directions-bus" onPress={() => nav('tracking')} />
// <StatCard label="Complaints" value={stats.complaints} iconName="report-problem" onPress={() => nav('complaints')} />
// <StatCard label="Received (Rs)" value={stats.paymentsReceived}iconName="account-balance-wallet" onPress={() => nav('payments')} />
// </View>
// <Text style={s.sectionLabel}>Quick Actions</Text>
// <View style={s.quickGrid}>
// {[
// { icon: 'poll', label: 'New Poll', sec: 'poll' },
// { icon: 'auto-awesome', label: 'Smart Routes', sec: 'smart-route' },
// { icon: 'assignment-ind',label: 'Assign Driver',sec: 'assign' },
// { icon: 'my-location', label: 'Live Tracking',sec: 'tracking' },
// ].map(q => (
// <TouchableOpacity key={q.sec} style={s.quickBtn} onPress={() => nav(q.sec)} activeOpacity={0.75}>
// <View style={s.quickIconWrap}><Icon name={q.icon} size={24} color={C.primaryDark} /></View>
// <Text style={s.quickLabel}>{q.label}</Text>
// </TouchableOpacity>
// ))}
// </View>
// {driverReqs.length > 0 && (
// <TouchableOpacity style={s.pendingBanner} onPress={() => nav('driver-req')}>
// <View style={[s.pendingDot, { backgroundColor: C.warning }]} />
// <Text style={s.pendingBannerTxt}>{driverReqs.length} pending driver request{driverReqs.length !== 1 ? 's' : ''}</Text>
// <Icon name="chevron-right" size={16} color={C.primaryDark} />
// </TouchableOpacity>
// )}
// {passReqs.length > 0 && (
// <TouchableOpacity style={s.pendingBanner} onPress={() => nav('pass-req')}>
// <View style={[s.pendingDot, { backgroundColor: C.primary }]} />
// <Text style={s.pendingBannerTxt}>{passReqs.length} pending passenger request{passReqs.length !== 1 ? 's' : ''}</Text>
// <Icon name="chevron-right" size={16} color={C.primaryDark} />
// </TouchableOpacity>
// )}
// <Text style={s.sectionLabel}>Recent Drivers</Text>
// {drivers.length === 0
// ? <View style={s.emptyState}><Icon name="directions-car" size={40} color={C.border} /><Text style={s.emptyTxt}>No drivers registered yet.</Text></View>
// : drivers.slice(0, 4).map((d, i) => <DriverCard key={d.\_id || i} driver={d} />)
// }
// </ScrollView>
// );

// // ══════════════════════════════════════════════════════════════════════════
// // PROFILE SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const ProfileSection = () => (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <View style={s.card}>
// <View style={{ alignItems: 'center', paddingVertical: 12 }}>
// <Avatar uri={profile?.profileImage} name={profile?.name} size={88} />
// <Text style={[s.cardTitle, { marginTop: 14, fontSize: 20 }]}>{profile?.name}</Text>
// <Text style={{ color: C.textLight, fontSize: 13, marginTop: 3 }}>{profile?.company}</Text>
// <View style={[s.chip, { marginTop: 8, backgroundColor: C.successLight, borderColor: C.success }]}>
// <Text style={[s.chipTxt, { color: C.success }]}>{profile?.status || 'active'}</Text>
// </View>
// </View>
// <View style={s.profileDivider} />
// {[
// { icon: 'email', label: 'Email', val: profile?.email },
// { icon: 'phone', label: 'Phone', val: profile?.phone },
// { icon: 'place', label: 'Address', val: profile?.address },
// { icon: 'credit-card', label: 'License', val: profile?.license },
// { icon: 'business', label: 'Registered', val: profile?.registrationDate },
// { icon: 'location-on', label: 'Location', val: profile?.location },
// ].map((row, i) => row.val && row.val !== 'N/A' && (
// <View key={i} style={[s.detailRow, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.divider }]}>
// <View style={s.profileIconWrap}><Icon name={row.icon} size={15} color={C.primaryDark} /></View>
// <Text style={[s.detailTxt, { flex: 0, color: C.textLight, marginRight: 8, minWidth: 80 }]}>{row.label}</Text>
// <Text style={[s.detailTxt, { flex: 1, fontWeight: '600', color: C.textDark }]}>{row.val}</Text>
// </View>
// ))}
// {!isEditingPro
// ? (
// <TouchableOpacity style={[s.confirmBtnGreen, { marginTop: 18 }]} onPress={() => { setEditProfile({ ...profile }); setIsEditingPro(true); }}>
// <Icon name="edit" size={16} color={C.black} />
// <Text style={[s.btnTxt, { color: C.black }]}>Edit Profile</Text>
// </TouchableOpacity>
// ) : (
// <View style={{ marginTop: 18 }}>
// {['name', 'phone', 'company', 'address'].map(field => (
// <View key={field} style={{ marginBottom: 12 }}>
// <Text style={s.inputLabel}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
// <TextInput
// style={s.input}
// value={editProfile?.[field] || ''}
// onChangeText={v => setEditProfile(prev => ({ ...prev, [field]: v }))}
// placeholder={`Enter ${field}`}
// placeholderTextColor={C.textLight}
// />
// </View>
// ))}
// <View style={s.twoBtn}>
// <TouchableOpacity style={s.discardBtn} onPress={() => setIsEditingPro(false)}>
// <Icon name="close" size={16} color={C.white} />
// <Text style={s.btnTxt}>Cancel</Text>
// </TouchableOpacity>
// <TouchableOpacity style={s.confirmBtnGreen} onPress={async () => {
// try {
// await api.updateProfile(editProfile);
// setProfile(editProfile);
// setIsEditingPro(false);
// Alert.alert('Saved', 'Profile updated successfully.');
// } catch (e) { Alert.alert('Error', e.message); }
// }}>
// <Icon name="save" size={16} color={C.black} />
// <Text style={[s.btnTxt, { color: C.black }]}>Save</Text>
// </TouchableOpacity>
// </View>
// </View>
// )
// }
// </View>
// </ScrollView>
// );

// // ══════════════════════════════════════════════════════════════════════════
// // POLL SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const PollSection = () => {
// const [newPollTitle, setNewPollTitle] = useState('');
// const [newPollDate, setNewPollDate] = useState('');
// const [newPollTime, setNewPollTime] = useState('');
// const [timePickerOpen, setTimePickerOpen] = useState(false);
// const [creating, setCreating] = useState(false);
// const [expandedPoll, setExpandedPoll] = useState(null);

// const handleCreate = async () => {
// if (!newPollTitle.trim()) { Alert.alert('Required', 'Enter a poll title.'); return; }
// setCreating(true);
// try {
// await api.createPoll({ title: newPollTitle, date: newPollDate, timeSlot: newPollTime });
// setNewPollTitle(''); setNewPollDate(''); setNewPollTime('');
// await loadAll();
// Alert.alert('Poll Created', 'Passengers can now respond to this poll.');
// } catch (e) { Alert.alert('Error', e.message); }
// finally { setCreating(false); }
// };

// return (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <TimePicker visible={timePickerOpen} onClose={() => setTimePickerOpen(false)} onSelect={t => setNewPollTime(t)} />
// <View style={s.card}>
// <View style={[s.cardAccentBar, { backgroundColor: C.primary }]} />
// <Text style={[s.cardTitle, { marginBottom: 14 }]}>Create Availability Poll</Text>
// <Text style={s.inputLabel}>Poll Title</Text>
// <TextInput style={s.input} value={newPollTitle} onChangeText={setNewPollTitle} placeholder="e.g. Tomorrow Morning Commute" placeholderTextColor={C.textLight} />
// <Text style={s.inputLabel}>Date (optional)</Text>
// <TextInput style={s.input} value={newPollDate} onChangeText={setNewPollDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textLight} />
// <Text style={s.inputLabel}>Time Slot</Text>
// <TouchableOpacity style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setTimePickerOpen(true)}>
// <Text style={{ color: newPollTime ? C.textDark : C.textLight, fontWeight: newPollTime ? '600' : '400' }}>{newPollTime || 'Tap to set time'}</Text>
// <Icon name="alarm" size={20} color={C.primaryDark} />
// </TouchableOpacity>
// <TouchableOpacity style={[s.confirmBtnGreen, { marginTop: 14 }]} onPress={handleCreate} disabled={creating}>
// {creating
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="add" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Create Poll</Text></>
// }
// </TouchableOpacity>
// </View>

// <Text style={s.sectionLabel}>Active Polls ({polls.length})</Text>
// {polls.length === 0
// ? <View style={s.emptyState}><Icon name="poll" size={40} color={C.border} /><Text style={s.emptyTxt}>No polls yet.</Text></View>
// : polls.map((poll, i) => {
// const yesResps = (poll.responses || []).filter(r => r.response === 'yes');
// const noResps = (poll.responses || []).filter(r => r.response === 'no');
// const total = (poll.responses || []).length;
// const isSel = selectedPoll?.\_id === poll.\_id;
// const isExpanded = expandedPoll === (poll.\_id || i);
// const pct = total > 0 ? Math.round((yesResps.length / total) \* 100) : 0;

// const prefCounts = {};
// yesResps.forEach(r => {
// const p = r.vehiclePreference || 'auto';
// prefCounts[p] = (prefCounts[p] || 0) + 1;
// });

// return (
// <View key={poll.\_id || i} style={[s.card, isSel && { borderColor: C.primary, borderWidth: 2 }]}>
// <View style={[s.cardAccentBar, { backgroundColor: isSel ? C.primary : C.border }]} />
// <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle} numberOfLines={2}>{poll.title}</Text>
// <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
// {poll.date && <View style={s.detailRow}><Icon name="event" size={12} color={C.primaryDark} /><Text style={s.detailTxt}>{new Date(poll.date).toLocaleDateString()}</Text></View>}
// {poll.timeSlot && <View style={s.detailRow}><Icon name="alarm" size={12} color={C.primaryDark} /><Text style={s.detailTxt}>{poll.timeSlot}</Text></View>}
// </View>
// </View>
// <TouchableOpacity onPress={() => Alert.alert('Delete Poll?', '', [
// { text: 'Cancel', style: 'cancel' },
// { text: 'Delete', style: 'destructive', onPress: async () => {
// try { await api.deletePoll(poll._id); await loadAll(); }
// catch (e) { Alert.alert('Error', e.message); }
// }},
// ])} style={{ padding: 4 }}>
// <Icon name="delete-outline" size={22} color={C.error} />
// </TouchableOpacity>
// </View>

// <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 8, flexWrap: 'wrap' }}>
// <View style={[s.chip, { backgroundColor: C.successLight, borderColor: C.success }]}><Text style={[s.chipTxt, { color: C.success }]}>{yesResps.length} Available</Text></View>
// <View style={[s.chip, { backgroundColor: C.errorLight, borderColor: C.error }]}><Text style={[s.chipTxt, { color: C.error }]}>{noResps.length} Unavailable</Text></View>
// <View style={s.chip}><Text style={s.chipTxt}>{total} Total</Text></View>
// {total > 0 && <View style={[s.chip, { backgroundColor: C.primaryGhost }]}><Text style={[s.chipTxt, { color: C.primaryDark }]}>{pct}% Available</Text></View>}
// </View>

// {Object.keys(prefCounts).length > 0 && (
// <View style={s.prefBreakdown}>
// <Text style={s.prefBreakdownLabel}>VEHICLE PREFERENCES</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
// {Object.entries(prefCounts).map(([pref, cnt]) => (
// <View key={pref} style={[s.prefChip, {
// backgroundColor: pref === 'car' ? '#FFF3E0' : pref === 'auto' ? C.offWhite : C.primaryGhost,
// borderColor: pref === 'car' ? '#FF9800' : pref === 'auto' ? C.divider : C.border,
// }]}>
// <Icon name={pref === 'car' ? 'directions-car' : pref === 'auto' ? 'shuffle' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={11} color={pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark} />
// <Text style={[s.prefChipTxt, { color: pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark }]}>
// {prefLabel(pref, cnt)}
// </Text>
// </View>
// ))}
// </View>
// </View>
// )}

// {total > 0 && (
// <View style={{ height: 6, backgroundColor: C.divider, borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
// <View style={{ width: `${pct}%`, height: 6, backgroundColor: C.success, borderRadius: 3 }} />
// </View>
// )}

// {total > 0 && (
// <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider, marginBottom: 8 }} onPress={() => setExpandedPoll(isExpanded ? null : (poll.\_id || i))}>
// <Icon name="people" size={14} color={C.primaryDark} />
// <Text style={{ flex: 1, marginLeft: 6, fontSize: 12, fontWeight: '700', color: C.textMid }}>View Responses ({total})</Text>
// <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={C.primaryDark} />
// </TouchableOpacity>
// )}

// {isExpanded && (
// <View style={{ marginBottom: 10 }}>
// {yesResps.length > 0 && (
// <View>
// <Text style={{ fontSize: 11, fontWeight: '900', color: C.success, letterSpacing: 1, marginBottom: 6, marginTop: 2 }}>AVAILABLE ({yesResps.length})</Text>
// {yesResps.map((r, ri) => (
// <View key={ri} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.divider, gap: 10 }}>
// <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.successLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
// <Text style={{ fontSize: 11, fontWeight: '900', color: C.success }}>
// {(r.passengerName || r.name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
// </Text>
// </View>
// <View style={{ flex: 1 }}>
// <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{r.passengerName || r.name || 'Passenger'}</Text>
// {(r.pickupPoint || r.pickupAddress || r.address) && (
// <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }} numberOfLines={1}>{r.pickupPoint || r.pickupAddress || r.address}</Text>
// )}
// {(r.destination || r.dropAddress) && (
// <Text style={{ fontSize: 11, color: C.primaryDark, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>{r.destination || r.dropAddress}</Text>
// )}
// {r.vehiclePreference && (
// <View style={[s.chip, { marginTop: 3,
// backgroundColor: r.vehiclePreference === 'car' ? '#FFF3E0' : C.primaryGhost,
// borderColor: r.vehiclePreference === 'car' ? '#FF9800' : C.border,
// }]}>
// <Icon name={r.vehiclePreference === 'car' ? 'directions-car' : r.vehiclePreference === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={11} color={r.vehiclePreference === 'car' ? '#E65100' : C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 3, color: r.vehiclePreference === 'car' ? '#E65100' : C.primaryDark }]}>
// {r.vehiclePreference === 'car' ? 'Car only (strict)' : `${r.vehiclePreference} (flexible)`}
// </Text>
// </View>
// )}
// </View>
// </View>
// ))}
// </View>
// )}
// {noResps.length > 0 && (
// <View style={{ marginTop: yesResps.length > 0 ? 10 : 0 }}>
// <Text style={{ fontSize: 11, fontWeight: '900', color: C.error, letterSpacing: 1, marginBottom: 6 }}>NOT AVAILABLE ({noResps.length})</Text>
// {noResps.map((r, ri) => (
// <View key={ri} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.divider, gap: 10 }}>
// <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.errorLight, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
// <Text style={{ fontSize: 11, fontWeight: '900', color: C.error }}>
// {(r.passengerName || r.name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
// </Text>
// </View>
// <View style={{ flex: 1 }}>
// <Text style={{ fontSize: 13, fontWeight: '700', color: C.textMid }}>{r.passengerName || r.name || 'Passenger'}</Text>
// {(r.pickupPoint || r.address) && <Text style={{ fontSize: 11, color: C.textLight, marginTop: 1 }} numberOfLines={1}>{r.pickupPoint || r.address}</Text>}
// </View>
// </View>
// ))}
// </View>
// )}
// </View>
// )}

// <View style={s.twoBtn}>
// <TouchableOpacity style={[s.discardBtn, isSel && { backgroundColor: C.primaryDark }]} onPress={() => setSelectedPoll(isSel ? null : poll)}>
// <Icon name={isSel ? 'check' : 'check-box-outline-blank'} size={15} color={C.white} />
// <Text style={s.btnTxt}>{isSel ? 'Selected' : 'Select'}</Text>
// </TouchableOpacity>
// <TouchableOpacity style={[s.confirmBtnGreen, optimizing && { opacity: 0.6 }]} onPress={() => handleOptimize(poll)} disabled={optimizing}>
// {optimizing && activePoll?.\_id === poll.\_id
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="auto-awesome" size={15} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Optimize Routes</Text></>
// }
// </TouchableOpacity>
// </View>
// </View>
// );
// })
// }
// </ScrollView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // SMART ROUTE SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const SmartRouteSection = () => {
// const [showOverallMap, setShowOverallMap] = useState(false);

// const vehicleBreakdown = useMemo(() => {
// const map = {};
// smartResults.forEach(r => { const v = r.vehicleType || 'van'; map[v] = (map[v] || 0) + 1; });
// return map;
// }, [smartResults]);

// const prefBreakdown = useMemo(() => {
// const map = {};
// smartResults.forEach(r => {
// (r.passengers || []).forEach(p => {
// const pref = p.vehiclePreference || 'auto';
// map[pref] = (map[pref] || 0) + 1;
// });
// });
// return map;
// }, [smartResults]);

// return (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// {showOverallMap && smartResults.length > 0 && (
// <OverallMapView routes={smartResults} onClose={() => setShowOverallMap(false)} />
// )}
// {optimizing && (
// <View style={s.optimizingBanner}>
// <ActivityIndicator size="small" color={C.black} />
// <Text style={[s.optimizingTxt, { color: C.black }]}>{optimizeStatus || 'Optimizing routes...'}</Text>
// </View>
// )}
// {smartResults.length === 0 && !optimizing
// ? (
// <View style={[s.card, { alignItems: 'center', paddingVertical: 44 }]}>
// <Icon name="map" size={52} color={C.border} style={{ marginBottom: 14 }} />
// <Text style={[s.cardTitle, { textAlign: 'center', marginBottom: 8 }]}>No Smart Routes Yet</Text>
// <Text style={[s.emptyTxt, { textAlign: 'center' }]}>Go to Availability Polls and tap "Optimize Routes" to generate optimized routes based on passenger preferences.</Text>
// <TouchableOpacity style={[s.confirmBtnGreen, { marginTop: 18, alignSelf: 'center', flex: 0, paddingHorizontal: 24 }]} onPress={() => nav('poll')}>
// <Icon name="poll" size={16} color={C.black} />
// <Text style={[s.btnTxt, { color: C.black }]}>Go to Polls</Text>
// </TouchableOpacity>
// </View>
// ) : (
// <>
// <View style={[s.card, { backgroundColor: C.primaryGhost, borderColor: C.border }]}>
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
// <Icon name="auto-awesome" size={20} color={C.primaryDark} />
// <Text style={[s.cardTitle, { color: C.primaryDark }]}>{smartResults.length} Optimized Route{smartResults.length !== 1 ? 's' : ''}</Text>
// </View>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
// <View style={s.chip}>
// <Icon name="groups" size={12} color={C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 4 }]}>{smartResults.reduce((s, r) => s + r.passengerCount, 0)} Passengers</Text>
// </View>
// <View style={s.chip}>
// <Icon name="flag" size={12} color={C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 4 }]}>{[...new Set(smartResults.map(r => r.destination).filter(Boolean))].length} Destination(s)</Text>
// </View>
// <View style={s.chip}>
// <Icon name="local-gas-station" size={12} color={C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 4 }]}>{fmtPKR(smartResults.reduce((s, r) => s + (r.rawFuelCostPKR || 0), 0))}</Text>
// </View>
// </View>
// <View style={s.prefBreakdown}>
// <Text style={s.prefBreakdownLabel}>VEHICLE DISTRIBUTION</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
// {Object.entries(vehicleBreakdown).map(([vt, cnt]) => (
// <View key={vt} style={[s.prefChip, { backgroundColor: C.white }]}>
// <Icon name={vt === 'car' ? 'directions-car' : vt === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={12} color={C.primaryDark} />
// <Text style={[s.prefChipTxt, { marginLeft: 3 }]}>{cnt} {VEHICLE_INFO[vt]?.label || vt} route{cnt !== 1 ? 's' : ''}</Text>
// </View>
// ))}
// </View>
// </View>
// {Object.keys(prefBreakdown).length > 0 && (
// <View style={[s.prefBreakdown, { marginTop: 8 }]}>
// <Text style={s.prefBreakdownLabel}>PREFERENCE ENFORCEMENT</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
// {Object.entries(prefBreakdown).map(([pref, cnt]) => (
// <View key={pref} style={[s.prefChip, {
// backgroundColor: pref === 'car' ? '#FFF3E0' : pref === 'auto' ? C.offWhite : C.primaryGhost,
// borderColor: pref === 'car' ? '#FF9800' : pref === 'auto' ? C.divider : C.border,
// }]}>
// <Icon name={pref === 'car' ? 'directions-car' : pref === 'auto' ? 'shuffle' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={11} color={pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark} />
// <Text style={[s.prefChipTxt, { color: pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark }]}>
// {prefLabel(pref, cnt)}
// </Text>
// </View>
// ))}
// </View>
// </View>
// )}
// <TouchableOpacity style={[s.viewMapBtn, { marginTop: 10 }]} onPress={() => setShowOverallMap(true)} activeOpacity={0.85}>
// <Icon name="map" size={16} color={C.black} />
// <Text style={s.viewMapBtnTxt}>View all routes on map</Text>
// <Icon name="chevron-right" size={18} color={C.primaryDark} />
// </TouchableOpacity>
// </View>
// {smartResults.map((result, idx) => (
// <SmartRouteCard
// key={result.id || idx}
// result={result}
// onConfirm={() => handleConfirmRoute(result, idx)}
// onDiscard={() => handleDiscardRoute(idx)}
// isConfirming={confirmingIdx === idx}
// />
// ))}
// </>
// )
// }
// </ScrollView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // ROUTES SECTION ── FIXED: uses getAssignedDriverName() everywhere
// // ══════════════════════════════════════════════════════════════════════════
// const RoutesSection = () => {
// const [dateFilter, setDateFilter] = useState('today');
// const [expandedRoute, setExpandedRoute] = useState(null);

// const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// const filteredRoutes = useMemo(() => {
// if (dateFilter === 'today') {
// return routes.filter(r => {
// const d = r.date || r.createdAt || r.pickupDate;
// if (!d) return true;
// try { return isToday(d); } catch (\_) { return false; }
// });
// }
// return routes;
// }, [routes, dateFilter]);

// return (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <View style={s.dateTabsContainer}>
// <TouchableOpacity style={[s.dateTab, dateFilter === 'today' && s.dateTabActive]} onPress={() => setDateFilter('today')}>
// <Icon name="today" size={14} color={dateFilter === 'today' ? C.black : C.textLight} style={{ marginRight: 4 }} />
// <Text style={[s.dateTabText, dateFilter === 'today' && s.dateTabTextActive]}>Today ({todayLabel})</Text>
// </TouchableOpacity>
// <TouchableOpacity style={[s.dateTab, dateFilter === 'all' && s.dateTabActive]} onPress={() => setDateFilter('all')}>
// <Icon name="history" size={14} color={dateFilter === 'all' ? C.black : C.textLight} style={{ marginRight: 4 }} />
// <Text style={[s.dateTabText, dateFilter === 'all' && s.dateTabTextActive]}>All Routes</Text>
// </TouchableOpacity>
// </View>

// <Text style={s.sectionLabel}>
// {dateFilter === 'today' ? "Today's" : 'All'} Routes ({filteredRoutes.length})
// {dateFilter === 'today' && routes.length > filteredRoutes.length ? `  ·  ${routes.length - filteredRoutes.length} older` : ''}
// </Text>

// {filteredRoutes.length === 0
// ? (
// <View style={s.emptyState}>
// <Icon name={dateFilter === 'today' ? 'inbox' : 'map'} size={40} color={C.border} />
// <Text style={s.emptyTxt}>
// {dateFilter === 'today'
// ? 'No routes for today.\nSwitch to "All Routes" to see history.'
// : 'No routes found. Generate via Smart Routes.'}
// </Text>
// </View>
// ) : filteredRoutes.map((route, i) => {
// const vi = VEHICLE_INFO[route.vehicleType] || VEHICLE_INFO.van;
// const statusColor = route.status === 'active' ? C.success : route.status === 'unassigned' ? C.warning : C.textLight;
// const statusBg = route.status === 'active' ? C.successLight : route.status === 'unassigned' ? C.warningLight : C.primaryGhost;
// const routeDate = route.date || route.createdAt || route.pickupDate;
// const isExpanded = expandedRoute === (route.\_id || i);

// // ── FIX: safely extract driver name from populated or string field ──
// const driverDisplayName = getAssignedDriverName(route.assignedDriver, drivers);
// const hasDriver = !!route.assignedDriver;

// const passengerPrefs = (route.passengers || []).reduce((acc, p) => {
// if (!p) return acc;
// const pref = p.vehiclePreference || p.preference || 'auto';
// acc[pref] = (acc[pref] || 0) + 1;
// return acc;
// }, {});

// return (
// <View key={route.\_id || i} style={s.card}>
// <View style={[s.cardAccentBar, { backgroundColor: statusColor }]} />
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
// <Icon name={vi.label === 'Car' ? 'directions-car' : vi.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'} size={24} color={C.primaryDark} />
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle} numberOfLines={2}>{route.name || route.routeName || `Route ${i + 1}`}</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
// <View style={[s.chip, { backgroundColor: statusBg }]}>
// <Text style={[s.chipTxt, { color: statusColor }]}>{route.status || 'unassigned'}</Text>
// </View>
// {routeDate && (() => {
// const d = new Date(routeDate);
// const valid = !isNaN(d.getTime());
// const todayFlag = isToday(routeDate);
// return (
// <View style={[s.chip, todayFlag ? { backgroundColor: C.primaryGhost, borderColor: C.primary } : { backgroundColor: C.offWhite, borderColor: C.divider }]}>
// <Icon name="event" size={11} color={todayFlag ? C.primaryDark : C.textLight} />
// <Text style={[s.chipTxt, { marginLeft: 3, color: todayFlag ? C.primaryDark : C.textLight }]}>
// {todayFlag ? 'Today' : valid ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
// </Text>
// </View>
// );
// })()}
// </View>
// </View>
// </View>

// <View style={{ gap: 5 }}>
// {route.startPoint && <View style={s.detailRow}><Icon name="place"      size={14} color={C.primaryDark} /><Text style={s.detailTxt} numberOfLines={1}>{route.startPoint}</Text></View>}
// {route.destination && <View style={s.detailRow}><Icon name="flag"       size={14} color={C.primaryDark} /><Text style={s.detailTxt} numberOfLines={1}>{route.destination}</Text></View>}
// {route.pickupTime && <View style={s.detailRow}><Icon name="alarm"      size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{route.pickupTime}</Text></View>}
// {route.estimatedKm && <View style={s.detailRow}><Icon name="straighten" size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{route.estimatedKm} · {route.estimatedTime}</Text></View>}
// {/_ ── FIX: render string, not object ── _/}
// {hasDriver && driverDisplayName && (
// <View style={s.detailRow}>
// <Icon name="person" size={14} color={C.success} />
// <Text style={[s.detailTxt, { color: C.success, fontWeight: '700' }]}>
// Driver: {driverDisplayName}
// </Text>
// </View>
// )}
// </View>

// {Object.keys(passengerPrefs).length > 0 && (
// <View style={[s.prefBreakdown, { marginTop: 8 }]}>
// <Text style={s.prefBreakdownLabel}>PASSENGER PREFERENCES</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
// {Object.entries(passengerPrefs).map(([pref, cnt]) => (
// <View key={pref} style={[s.prefChip, {
// backgroundColor: pref === 'car' ? '#FFF3E0' : pref === 'auto' ? C.offWhite : C.primaryGhost,
// borderColor: pref === 'car' ? '#FF9800' : pref === 'auto' ? C.divider : C.border,
// }]}>
// <Icon name={pref === 'car' ? 'directions-car' : pref === 'auto' ? 'shuffle' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={11} color={pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark} />
// <Text style={[s.prefChipTxt, { color: pref === 'car' ? '#E65100' : pref === 'auto' ? C.textLight : C.primaryDark }]}>
// {prefLabel(pref, cnt)}
// </Text>
// </View>
// ))}
// </View>
// </View>
// )}

// {route.estimatedFuel && (
// <FuelBadge
// fuelType={route.fuelType || PK_FUEL.fuelType[route.vehicleType] || 'petrol'}
// fuelCostPKR={route.fuelCostPKR}
// estimatedFuel={route.estimatedFuel}
// estimatedKm={route.estimatedKm}
// vehicleType={route.vehicleType || 'van'}
// />
// )}

// {(route.passengers || []).length > 0 && (
// <TouchableOpacity
// style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.divider, marginTop: 6 }}
// onPress={() => setExpandedRoute(isExpanded ? null : (route.\_id || i))}
// >
// <Icon name="people" size={14} color={C.primaryDark} />
// <Text style={{ flex: 1, marginLeft: 6, fontSize: 12, fontWeight: '700', color: C.textMid }}>
// Passengers ({route.passengers.length})
// </Text>
// <Icon name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={C.primaryDark} />
// </TouchableOpacity>
// )}

// {isExpanded && (route.passengers || []).map((p, pi) => (
// <View key={pi} style={[s.paxRow, { paddingVertical: 7 }]}>
// <View style={s.paxAvatar}>
// <Text style={{ fontSize: 10, fontWeight: '900', color: C.primaryDark }}>
// {(p.passengerName || p.name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
// </Text>
// </View>
// <View style={{ flex: 1 }}>
// <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{p.passengerName || p.name || 'Passenger'}</Text>
// {(p.pickupPoint || p.pickupAddress) && <Text style={{ fontSize: 11, color: C.textLight }} numberOfLines={1}>{p.pickupPoint || p.pickupAddress}</Text>}
// {(p.vehiclePreference || p.preference) && (() => {
// const pref = p.vehiclePreference || p.preference;
// return (
// <View style={[s.chip, { marginTop: 3,
// backgroundColor: pref === 'car' ? '#FFF3E0' : C.primaryGhost,
// borderColor: pref === 'car' ? '#FF9800' : C.border,
// }]}>
// <Icon name={pref === 'car' ? 'directions-car' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'} size={11} color={pref === 'car' ? '#E65100' : C.primaryDark} />
// <Text style={[s.chipTxt, { marginLeft: 3, fontSize: 10, color: pref === 'car' ? '#E65100' : C.primaryDark }]}>
// {pref === 'car' ? 'Car only (strict)' : `${VEHICLE_INFO[pref]?.label || pref} (flexible)`}
// </Text>
// </View>
// );
// })()}
// </View>
// </View>
// ))}

// {route.status === 'unassigned' && (
// <TouchableOpacity style={[s.confirmBtnGreen, { marginTop: 10 }]} onPress={() => nav('assign')}>
// <Icon name="assignment-ind" size={15} color={C.black} />
// <Text style={[s.btnTxt, { color: C.black }]}>Assign Driver</Text>
// </TouchableOpacity>
// )}
// </View>
// );
// })
// }
// </ScrollView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // ASSIGN SECTION ── FIXED: uses getAssignedDriverId / getAssignedDriverName
// // ══════════════════════════════════════════════════════════════════════════
// const AssignSection = () => {
// const allUnassigned = routes.filter(r => r.status === 'unassigned' || !r.assignedDriver);
// const assignedRoutes = routes.filter(r => r.status !== 'unassigned' && r.assignedDriver);

// const [selectedRoute, setSelectedRoute] = useState(null);
// const [selectedDriver, setSelectedDriver] = useState(null);
// const [assigning, setAssigning] = useState(false);
// const [dateFilter, setDateFilter] = useState('today');
// const [editingRoute, setEditingRoute] = useState(null);
// const [editDriver, setEditDriver] = useState(null);
// const [editSaving, setEditSaving] = useState(false);

// const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// const unassigned = useMemo(() => {
// if (dateFilter === 'today') {
// return allUnassigned.filter(r => {
// const d = r.date || r.createdAt || r.pickupDate;
// if (!d) return true;
// try { return isToday(d); } catch (\_) { return false; }
// });
// }
// return allUnassigned;
// }, [allUnassigned, dateFilter]);

// const driverScores = useMemo(() => {
// if (!selectedRoute || !drivers.length) return [];
// return scoreDriversForRoute(selectedRoute, drivers);
// }, [selectedRoute, drivers]);

// const handleSelectRoute = (route) => {
// const alreadySel = selectedRoute?.\_id === route.\_id;
// setSelectedRoute(alreadySel ? null : route);
// if (!alreadySel) {
// const scored = scoreDriversForRoute(route, drivers);
// if (scored.length > 0) setSelectedDriver(scored[0].driver);
// } else {
// setSelectedDriver(null);
// }
// };

// const doAssign = async () => {
// if (!selectedRoute || !selectedDriver) { Alert.alert('Select Both', 'Please select a route and a driver.'); return; }
// setAssigning(true);
// try {
// await api.assignDriverToRoute(selectedRoute.\_id, selectedDriver.\_id);
// Alert.alert('Driver Assigned', `${selectedDriver.name} has been assigned to the route.`);
// setSelectedRoute(null);
// setSelectedDriver(null);
// await loadAll();
// } catch (e) { Alert.alert('Error', e.message); }
// finally { setAssigning(false); }
// };

// const doReassign = async () => {
// if (!editingRoute || !editDriver) { Alert.alert('Select Driver', 'Please select a new driver.'); return; }
// setEditSaving(true);
// try {
// await api.reassignDriverToRoute(editingRoute.\_id, editDriver.\_id);
// // ── FIX: get old driver name safely ──
// const oldName = getAssignedDriverName(editingRoute.assignedDriver, drivers) || 'previous driver';
// Alert.alert('Driver Changed', `Changed from ${oldName} to ${editDriver.name}.`);
// setEditingRoute(null);
// setEditDriver(null);
// await loadAll();
// } catch (e) { Alert.alert('Error', e.message); }
// finally { setEditSaving(false); }
// };

// return (
// <ScrollView style={s.section} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

// <View style={s.dateTabsContainer}>
// <TouchableOpacity style={[s.dateTab, dateFilter === 'today' && s.dateTabActive]} onPress={() => { setDateFilter('today'); setSelectedRoute(null); setSelectedDriver(null); }}>
// <Icon name="today" size={14} color={dateFilter === 'today' ? C.black : C.textLight} style={{ marginRight: 4 }} />
// <Text style={[s.dateTabText, dateFilter === 'today' && s.dateTabTextActive]}>Today ({todayLabel})</Text>
// </TouchableOpacity>
// <TouchableOpacity style={[s.dateTab, dateFilter === 'all' && s.dateTabActive]} onPress={() => { setDateFilter('all'); setSelectedRoute(null); setSelectedDriver(null); }}>
// <Icon name="history" size={14} color={dateFilter === 'all' ? C.black : C.textLight} style={{ marginRight: 4 }} />
// <Text style={[s.dateTabText, dateFilter === 'all' && s.dateTabTextActive]}>All History</Text>
// </TouchableOpacity>
// </View>

// <Text style={s.sectionLabel}>
// Unassigned Routes ({unassigned.length})
// {dateFilter === 'today' && allUnassigned.length > unassigned.length ? `  ·  ${allUnassigned.length - unassigned.length} older in history` : ''}
// </Text>

// {unassigned.length === 0
// ? (
// <View style={s.emptyState}>
// <Icon name={dateFilter === 'today' ? 'check-circle' : 'inbox'} size={40} color={C.border} />
// <Text style={s.emptyTxt}>
// {dateFilter === 'today'
// ? "All today's routes have drivers!\nSwitch to \"All History\" to see older routes."
// : 'All routes have drivers assigned.'}
// </Text>
// </View>
// ) : unassigned.map((route, i) => {
// const vi = VEHICLE_INFO[route.vehicleType] || VEHICLE_INFO.van;
// const sel = selectedRoute?.\_id === route.\_id;
// const routeDate = route.date || route.createdAt || route.pickupDate;
// const routePaxPrefs = (route.passengers || []).map(p => p.vehiclePreference).filter(Boolean);
// const hasCarPref = routePaxPrefs.some(p => p === 'car');
// const allCarPref = routePaxPrefs.length > 0 && routePaxPrefs.every(p => p === 'car');
// const suggestedDriver = sel && driverScores.length > 0 ? driverScores[0].driver : null;

// return (
// <TouchableOpacity key={route.\_id || i} style={[s.card, sel && { borderColor: C.primary, borderWidth: 2 }]} onPress={() => handleSelectRoute(route)}>
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
// <Icon name={vi.label === 'Car' ? 'directions-car' : vi.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'} size={22} color={C.primaryDark} />
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle} numberOfLines={1}>{route.name || route.routeName}</Text>
// <Text style={[s.detailTxt, { marginTop: 3 }]}>{route.passengers?.length || 0} pax · {route.estimatedKm || '—'} · {route.destination || 'No destination'}</Text>
// <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
// {routeDate && (() => {
// const d = new Date(routeDate);
// const valid = !isNaN(d.getTime());
// const todayFlag = isToday(routeDate);
// return (
// <View style={[s.chip, todayFlag ? { backgroundColor: C.primaryGhost, borderColor: C.primary } : { backgroundColor: C.offWhite, borderColor: C.divider }]}>
// <Icon name="event" size={11} color={todayFlag ? C.primaryDark : C.textLight} />
// <Text style={[s.chipTxt, { marginLeft: 4, color: todayFlag ? C.primaryDark : C.textLight }]}>
// {todayFlag ? 'Today' : valid ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
// {route.pickupTime ? `  ·  ${route.pickupTime}` : ''}
// </Text>
// </View>
// );
// })()}
// {hasCarPref && (
// <View style={[s.chip, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
// <Icon name="directions-car" size={11} color="#E65100" />
// <Text style={[s.chipTxt, { color: '#E65100' }]}>{allCarPref ? 'Car required' : 'Mixed preferences'}</Text>
// </View>
// )}
// </View>
// </View>
// <Icon name={sel ? 'check-circle' : 'radio-button-unchecked'} size={24} color={sel ? C.primary : C.border} />
// </View>
// {sel && suggestedDriver && (
// <View style={s.smartSuggestBox}>
// <Icon name="auto-awesome" size={14} color={C.primaryDark} />
// <Text style={s.smartSuggestTxt}>
// Best match: <Text style={{ fontWeight: '800' }}>{suggestedDriver.name}</Text>
// {' '}({VEHICLE_INFO[suggestedDriver.vehicleType || suggestedDriver.vehicle]?.label || ''}) — auto-selected
// </Text>
// </View>
// )}
// </TouchableOpacity>
// );
// })
// }

// <Text style={s.sectionLabel}>
// Available Drivers ({drivers.length}){selectedRoute ? ' · sorted by compatibility' : ''}
// </Text>

// {drivers.length === 0
// ? <View style={s.emptyState}><Text style={s.emptyTxt}>No drivers registered yet.</Text></View>
// : (selectedRoute ? driverScores : drivers.map(d => ({ driver: d, score: null, reasons: [] }))).map(({ driver, score, reasons }) => {
// const sel = selectedDriver?.\_id === driver.\_id;
// const isBest = selectedRoute && driverScores[0]?.driver.\_id === driver.\_id;
// return (
// <TouchableOpacity
// key={driver.\_id || driver.id}
// style={[s.card, sel && { borderColor: C.primary, borderWidth: 2 }, isBest && !sel && { borderColor: C.primaryDark, borderWidth: 1.5 }]}
// onPress={() => setSelectedDriver(sel ? null : driver)}
// >
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
// <View style={{ flex: 1 }}><DriverCard driver={driver} compact /></View>
// <View style={{ alignItems: 'center', gap: 4 }}>
// {score !== null && (
// <View style={[s.scoreBubble, { borderColor: score >= 70 ? C.success : score >= 40 ? C.primary : C.error }]}>
// <Text style={[s.scoreNum, { color: score >= 70 ? C.success : score >= 40 ? C.primaryDark : C.error }]}>{Math.max(0, score)}</Text>
// <Text style={s.scoreLbl}>score</Text>
// </View>
// )}
// {isBest && (
// <View style={[s.chip, { backgroundColor: C.primary, borderColor: C.primaryDark, paddingHorizontal: 5 }]}>
// <Text style={[s.chipTxt, { fontSize: 9 }]}>BEST</Text>
// </View>
// )}
// <Icon name={sel ? 'check-circle' : 'radio-button-unchecked'} size={22} color={sel ? C.primary : C.border} />
// </View>
// </View>
// {sel && reasons.length > 0 && (
// <View style={{ marginTop: 8, gap: 3 }}>
// {reasons.slice(0, 3).map((r, ri) => (
// <View key={ri} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
// <Icon
// name={['Vehicle match', 'Capacity', 'Matches', 'Driver is active', 'No current', 'Light'].some(k => r.startsWith(k)) ? 'check-circle' : r.startsWith('Different') ? 'info' : 'cancel'}
// size={12}
// color={['Vehicle match', 'Capacity', 'Matches', 'Driver is active', 'No current', 'Light'].some(k => r.startsWith(k)) ? C.success : r.startsWith('Different') ? C.warning : C.error}
// />
// <Text style={{ fontSize: 11, color: C.textMid, fontWeight: '600' }}>{r}</Text>
// </View>
// ))}
// </View>
// )}
// </TouchableOpacity>
// );
// })
// }

// {(selectedRoute || selectedDriver) && (
// <View style={[s.card, { backgroundColor: C.primaryGhost, borderColor: C.primary, borderWidth: 2, marginTop: 4 }]}>
// <Text style={[s.cardTitle, { color: C.primaryDark, marginBottom: 10 }]}>Assignment Preview</Text>
// <View style={s.detailRow}><Icon name="map"    size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{selectedRoute ? (selectedRoute.name || 'Selected Route') : '— Select a route —'}</Text></View>
// <View style={[s.detailRow, { marginTop: 4 }]}><Icon name="flag"   size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{selectedRoute ? (selectedRoute.destination || 'Unknown destination') : '—'}</Text></View>
// <View style={[s.detailRow, { marginTop: 6 }]}><Icon name="person" size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{selectedDriver ? selectedDriver.name : '— Select a driver —'}</Text></View>
// {selectedDriver && selectedRoute && (() => {
// const scored = driverScores.find(ds => ds.driver.\_id === selectedDriver.\_id);
// if (!scored) return null;
// const mq = scored.score >= 70 ? { label: 'Excellent Match', color: C.success }
// : scored.score >= 40 ? { label: 'Good Match', color: C.primaryDark }
// : { label: 'Poor Match', color: C.error };
// return (
// <View style={[s.chip, { marginTop: 8, backgroundColor: C.white, borderColor: mq.color, alignSelf: 'flex-start' }]}>
// <Text style={[s.chipTxt, { color: mq.color }]}>{mq.label} (score: {Math.max(0, scored.score)})</Text>
// </View>
// );
// })()}
// <TouchableOpacity
// style={[s.confirmBtnGreen, { marginTop: 14 }, (!selectedRoute || !selectedDriver || assigning) && { opacity: 0.5 }]}
// onPress={doAssign}
// disabled={!selectedRoute || !selectedDriver || assigning}
// >
// {assigning
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="assignment-ind" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Confirm Assignment</Text></>
// }
// </TouchableOpacity>
// </View>
// )}

// {assignedRoutes.length > 0 && (
// <>
// <View style={s.menuDivider} />
// <Text style={s.sectionLabel}>Assigned Routes ({assignedRoutes.length})</Text>
// {assignedRoutes.map((route, i) => {
// const vi = VEHICLE_INFO[route.vehicleType] || VEHICLE_INFO.van;

// // ── FIX: always use helper to get a plain string for display ──
// const assignedDrvId = getAssignedDriverId(route.assignedDriver);
// const assignedDrvName = getAssignedDriverName(route.assignedDriver, drivers);
// const assignedDrvVehicle = getAssignedDriverVehicle(route.assignedDriver, drivers);

// // For the "editing" state we also need the actual driver object
// const assignedDrvObj = drivers.find(d => String(d.\_id || d.id) === assignedDrvId) || null;

// const isEditing = editingRoute?.\_id === route.\_id;

// return (
// <View key={route.\_id || i} style={[s.card, isEditing && { borderColor: C.primaryDark, borderWidth: 2 }]}>
// <View style={[s.cardAccentBar, { backgroundColor: C.success }]} />
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
// <Icon name={vi.label === 'Car' ? 'directions-car' : vi.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'} size={22} color={C.primaryDark} />
// <View style={{ flex: 1 }}>
// <Text style={s.cardTitle} numberOfLines={1}>{route.name || route.routeName}</Text>
// <Text style={[s.detailTxt, { marginTop: 3 }]} numberOfLines={1}>{route.passengers?.length || 0} pax · {route.destination || '—'}</Text>
// </View>
// <TouchableOpacity
// style={[s.editDriverBtn, isEditing && { backgroundColor: C.primaryDark }]}
// onPress={() => {
// if (isEditing) { setEditingRoute(null); setEditDriver(null); }
// else { setEditingRoute(route); setEditDriver(assignedDrvObj); }
// }}
// >
// <Icon name={isEditing ? 'close' : 'edit'} size={14} color={C.black} />
// <Text style={s.editDriverBtnTxt}>{isEditing ? 'Cancel' : 'Change Driver'}</Text>
// </TouchableOpacity>
// </View>

// <View style={[s.vBadge, { backgroundColor: C.successLight, borderColor: C.success }]}>
// <Icon name="person" size={18} color={C.success} />
// <View style={{ marginLeft: 10, flex: 1 }}>
// <Text style={[s.vBadgeLbl, { color: C.success }]}>ASSIGNED DRIVER</Text>
// {/_ ── FIX: render plain strings only ── _/}
// <Text style={[s.vBadgeVal, { color: C.success }]}>
// {assignedDrvName || 'Unknown'}
// {assignedDrvVehicle ? ` · ${VEHICLE_INFO[assignedDrvVehicle]?.label || assignedDrvVehicle}` : ''}
// </Text>
// </View>
// </View>

// {isEditing && (
// <View style={{ marginTop: 10 }}>
// <Text style={[s.sectionLabel, { marginBottom: 8 }]}>Select Replacement Driver</Text>
// {drivers.length === 0
// ? <Text style={s.emptyTxt}>No drivers available.</Text>
// : scoreDriversForRoute(route, drivers).map(({ driver, score }) => {
// const dSel = editDriver?.\_id === driver.\_id;
// const isBest = scoreDriversForRoute(route, drivers)[0]?.driver.\_id === driver.\_id;
// return (
// <TouchableOpacity
// key={driver.\_id}
// style={[s.card, dSel && { borderColor: C.primary, borderWidth: 2 }, { marginBottom: 8 }]}
// onPress={() => setEditDriver(dSel ? null : driver)}
// >
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
// <View style={{ flex: 1 }}><DriverCard driver={driver} compact /></View>
// <View style={{ alignItems: 'center', gap: 3 }}>
// <View style={[s.scoreBubble, { borderColor: score >= 70 ? C.success : score >= 40 ? C.primary : C.error }]}>
// <Text style={[s.scoreNum, { color: score >= 70 ? C.success : score >= 40 ? C.primaryDark : C.error }]}>{Math.max(0, score)}</Text>
// <Text style={s.scoreLbl}>score</Text>
// </View>
// {isBest && (
// <View style={[s.chip, { backgroundColor: C.primary, borderColor: C.primaryDark, paddingHorizontal: 5 }]}>
// <Text style={[s.chipTxt, { fontSize: 9 }]}>BEST</Text>
// </View>
// )}
// <Icon name={dSel ? 'check-circle' : 'radio-button-unchecked'} size={22} color={dSel ? C.primary : C.border} />
// </View>
// </View>
// </TouchableOpacity>
// );
// })
// }
// <TouchableOpacity
// style={[s.confirmBtnGreen, { marginTop: 6 }, (!editDriver || editSaving) && { opacity: 0.5 }]}
// onPress={doReassign}
// disabled={!editDriver || editSaving}
// >
// {editSaving
// ? <ActivityIndicator size="small" color={C.black} />
// : <><Icon name="swap-horiz" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Confirm Driver Change</Text></>
// }
// </TouchableOpacity>
// </View>
// )}
// </View>
// );
// })}
// </>
// )}
// </ScrollView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // TRACKING SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const TrackingSection = () => {
// const activeTrips = trips.filter(t => t.status === 'ongoing' || t.status === 'active');
// return (
// <View style={{ flex: 1 }}>
// <MapView
// style={{ flex: 1 }}
// provider={PROVIDER_GOOGLE}
// initialRegion={{ latitude: 33.6135, longitude: 73.1998, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
// showsUserLocation
// showsMyLocationButton
// >
// {activeTrips.map((trip, i) => trip.currentLat && trip.currentLng && (
// <Marker
// key={i}
// coordinate={{ latitude: parseFloat(trip.currentLat), longitude: parseFloat(trip.currentLng) }}
// title={trip.driverName || 'Driver'}
// description={`${trip.passengerCount || 0} passengers`}
// pinColor={C.primary}
// />
// ))}
// </MapView>
// <View style={s.trackingOverlay}>
// <Icon name="my-location" size={16} color={C.white} />
// <Text style={s.trackingOverlayTxt}>
// {activeTrips.length === 0 ? 'No active trips right now' : `${activeTrips.length} active trip${activeTrips.length !== 1 ? 's' : ''} on map`}
// </Text>
// </View>
// </View>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // REQUEST SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const RequestSection = ({ type }) => {
// const list = type === 'driver' ? driverReqs : passReqs;
// const [processing, setProcessing] = useState(null);

// const accept = async (req) => {
// setProcessing(req.\_id);
// try {
// type === 'driver' ? await api.approveDriverRequest(req.\_id) : await api.approvePassengerRequest(req.\_id);
// await loadAll();
// Alert.alert('Accepted', `${req.name || req.fullName || 'Request'} has been approved.`);
// } catch (e) { Alert.alert('Error', e.message); }
// finally { setProcessing(null); }
// };

// const reject = (req) =>
// Alert.alert('Reject Request?', `Reject request from ${req.name || req.fullName}?`, [
// { text: 'Cancel', style: 'cancel' },
// { text: 'Reject', style: 'destructive', onPress: async () => {
// setProcessing(req._id);
// try {
// type === 'driver' ? await api.rejectDriverRequest(req._id) : await api.rejectPassengerRequest(req._id);
// await loadAll();
// } catch (e) { Alert.alert('Error', e.message); }
// finally { setProcessing(null); }
// }},
// ]);

// return (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <Text style={s.sectionLabel}>Pending {type === 'driver' ? 'Driver' : 'Passenger'} Requests ({list.length})</Text>
// {list.length === 0
// ? <View style={s.emptyState}><Icon name="check-circle" size={40} color={C.border} /><Text style={s.emptyTxt}>No pending {type} requests.</Text></View>
// : list.map((req, i) => (
// <RequestCard key={req.\_id || i} req={{ ...req, type }} onAccept={() => accept(req)} onReject={() => reject(req)} isProcessing={processing === req.\_id} />
// ))
// }
// </ScrollView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════
// // PAYMENTS SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const PaymentsSection = () => (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <View style={s.statsGrid}>
// <StatCard label="Received" value={`Rs. ${stats.paymentsReceived?.toLocaleString?.() || 0}`} iconName="account-balance-wallet" />
// <StatCard label="Pending" value={`Rs. ${stats.paymentsPending?.toLocaleString?.()  || 0}`} iconName="pending" />
// </View>
// <View style={s.emptyState}>
// <Icon name="account-balance-wallet" size={40} color={C.border} />
// <Text style={s.emptyTxt}>Detailed payment history coming soon.</Text>
// </View>
// </ScrollView>
// );

// // ══════════════════════════════════════════════════════════════════════════
// // COMPLAINTS SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const ComplaintsSection = () => (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <Text style={s.sectionLabel}>Complaints ({complaints.length})</Text>
// {complaints.length === 0
// ? <View style={s.emptyState}><Icon name="check-circle" size={40} color={C.border} /><Text style={s.emptyTxt}>No complaints filed.</Text></View>
// : complaints.map((c, i) => (
// <View key={c.\_id || i} style={s.card}>
// <View style={[s.cardAccentBar, { backgroundColor: c.status === 'resolved' ? C.success : C.error }]} />
// <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
// <Icon name="report-problem" size={18} color={C.error} />
// <Text style={s.cardTitle} numberOfLines={1}>{c.subject || c.title || 'Complaint'}</Text>
// </View>
// <Text style={{ fontSize: 13, color: C.textMid, marginBottom: 10 }}>{c.description || c.message}</Text>
// {c.passengerName && <View style={s.detailRow}><Icon name="person" size={13} color={C.primaryDark} /><Text style={s.detailTxt}>{c.passengerName}</Text></View>}
// {c.createdAt && <View style={[s.detailRow, { marginTop: 4 }]}><Icon name="event" size={13} color={C.primaryDark} /><Text style={s.detailTxt}>{new Date(c.createdAt).toLocaleString()}</Text></View>}
// <View style={[s.chip, { marginTop: 8, backgroundColor: c.status === 'resolved' ? C.successLight : C.warningLight }]}>
// <Text style={[s.chipTxt, { color: c.status === 'resolved' ? C.success : C.warning }]}>{c.status || 'open'}</Text>
// </View>
// </View>
// ))
// }
// </ScrollView>
// );

// // ══════════════════════════════════════════════════════════════════════════
// // NOTIFICATIONS SECTION
// // ══════════════════════════════════════════════════════════════════════════
// const NotificationsSection = () => (
// <ScrollView
// style={s.section}
// contentContainerStyle={{ paddingBottom: 24 }}
// refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
// showsVerticalScrollIndicator={false}
// >
// <Text style={s.sectionLabel}>Notifications ({notifications.length})</Text>
// {notifications.length === 0
// ? <View style={s.emptyState}><Icon name="notifications" size={40} color={C.border} /><Text style={s.emptyTxt}>No notifications yet.</Text></View>
// : notifications.map((n, i) => (
// <TouchableOpacity
// key={n.\_id || i}
// style={[s.card, !n.read && { borderLeftWidth: 4, borderLeftColor: C.primary }]}
// onPress={async () => { if (!n.read) { try { await api.markRead(n.\_id); await loadAll(); } catch {} } }}
// activeOpacity={0.8}
// >
// <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
// <View style={[s.menuIconWrap, { backgroundColor: n.read ? C.primaryGhost : C.primary, width: 38, height: 38, borderRadius: 10 }]}>
// <Icon name="notifications" size={18} color={n.read ? C.primaryDark : C.black} />
// </View>
// <View style={{ flex: 1 }}>
// <Text style={[s.cardTitle, { fontSize: 14, fontWeight: n.read ? '600' : '800' }]}>{n.title || 'Notification'}</Text>
// <Text style={{ fontSize: 13, color: C.textMid, marginTop: 4, lineHeight: 18 }}>{n.message || n.body || 'No message content'}</Text>
// {n.createdAt && <Text style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>{new Date(n.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</Text>}
// </View>
// {!n.read && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 6 }} />}
// </View>
// </TouchableOpacity>
// ))
// }
// </ScrollView>
// );

// // ── SECTION ROUTER ─────────────────────────────────────────────────────────
// const SECTION_TITLES = {
// 'overview': 'Dashboard',
// 'profile': 'My Profile',
// 'poll': 'Availability Polls',
// 'smart-route': 'Smart Routes',
// 'routes': 'Routes',
// 'assign': 'Assign Driver',
// 'tracking': 'Live Tracking',
// 'driver-req': 'Driver Requests',
// 'pass-req': 'Passenger Requests',
// 'payments': 'Payments',
// 'complaints': 'Complaints',
// 'notifications': 'Notifications',
// };

// const renderSection = () => {
// switch (section) {
// case 'overview': return <OverviewSection />;
// case 'profile': return <ProfileSection />;
// case 'poll': return <PollSection />;
// case 'smart-route': return <SmartRouteSection />;
// case 'routes': return <RoutesSection />;
// case 'assign': return <AssignSection />;
// case 'tracking': return <TrackingSection />;
// case 'driver-req': return <RequestSection type="driver" />;
// case 'pass-req': return <RequestSection type="passenger" />;
// case 'payments': return <PaymentsSection />;
// case 'complaints': return <ComplaintsSection />;
// case 'notifications': return <NotificationsSection />;
// default: return <OverviewSection />;
// }
// };

// if (loading) return (
// <SafeAreaView style={s.loaderScreen}>
// <View style={{ alignItems: 'center' }}>
// <View style={s.loaderLogo}><Icon name="directions-bus" size={36} color={C.primaryDark} /></View>
// <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 24 }} />
// <Text style={{ marginTop: 14, color: C.textLight, fontWeight: '600', fontSize: 14 }}>Loading dashboard...</Text>
// </View>
// </SafeAreaView>
// );

// return (
// <SafeAreaView style={s.root}>
// <StatusBar barStyle="light-content" backgroundColor={C.headerBg} />
// <View style={s.header}>
// <TouchableOpacity onPress={() => setSidebar(!sidebar)} style={s.headerBtn}>
// <Icon name="menu" size={26} color={C.headerText} />
// {totalBadge > 0 && (
// <View style={s.headerBadge}>
// <Text style={s.headerBadgeTxt}>{totalBadge > 9 ? '9+' : totalBadge}</Text>
// </View>
// )}
// </TouchableOpacity>
// <View style={{ flex: 1, alignItems: 'center' }}>
// <Text style={s.headerTitle}>{SECTION_TITLES[section] || 'Dashboard'}</Text>
// </View>
// <TouchableOpacity onPress={() => nav('notifications')} style={s.headerBtn}>
// <Icon name="notifications" size={24} color={C.headerText} />
// {unread > 0 && (
// <View style={s.headerBadge}>
// <Text style={s.headerBadgeTxt}>{unread > 9 ? '9+' : unread}</Text>
// </View>
// )}
// </TouchableOpacity>
// </View>
// <View style={{ flex: 1, backgroundColor: C.offWhite }}>{renderSection()}</View>
// {sidebar && <TouchableOpacity style={s.sidebarOverlay} activeOpacity={1} onPress={() => setSidebar(false)} />}
// <SidebarView />
// </SafeAreaView>
// );
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // STYLESHEET
// // ══════════════════════════════════════════════════════════════════════════════
// const s = StyleSheet.create({
// root: { flex: 1, backgroundColor: C.offWhite },
// loaderScreen: { flex: 1, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center' },
// loaderLogo: { width: 80, height: 80, borderRadius: 20, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.border },
// section: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
// header: { backgroundColor: C.headerBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
// headerTitle: { fontSize: 17, fontWeight: '900', color: C.white, letterSpacing: 0.2 },
// headerBtn: { padding: 6, position: 'relative' },
// headerBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: C.error, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: C.white },
// headerBadgeTxt: { fontSize: 9, color: C.white, fontWeight: '900' },
// sectionLabel: { fontSize: 12, fontWeight: '900', color: C.textLight, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
// sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 280, backgroundColor: C.white, elevation: 20, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8, zIndex: 100 },
// sidebarOverlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 99 },
// sidebarHdr: { backgroundColor: C.headerBg, padding: 20, paddingTop: 44, flexDirection: 'row', alignItems: 'center' },
// sidebarName: { fontSize: 15, fontWeight: '900', color: C.white },
// sidebarCo: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
// sidebarStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
// sidebarDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
// sidebarStatusTxt: { fontSize: 11, color: C.primaryLight, fontWeight: '700' },
// sidebarClose: { padding: 6, marginLeft: 'auto' },
// menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, position: 'relative' },
// menuItemOn: { backgroundColor: C.primaryGhost },
// menuBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, backgroundColor: C.primary, borderRadius: 2 },
// menuIconWrap: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.offWhite, justifyContent: 'center', alignItems: 'center' },
// menuIconOn: { backgroundColor: C.primary },
// menuTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: C.textMid },
// menuTxtOn: { color: C.black, fontWeight: '800' },
// menuBadge: { backgroundColor: C.error, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
// menuBadgeTxt: { fontSize: 9, color: C.white, fontWeight: '900' },
// menuDivider: { height: 1, backgroundColor: C.divider, marginHorizontal: 16, marginVertical: 8 },
// logoutItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
// welcomeCard: { backgroundColor: C.primary, borderRadius: 16, marginBottom: 14, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
// welcomeCardInner: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 12 },
// welcomeGreet: { fontSize: 13, color: C.primaryDark, fontWeight: '600' },
// welcomeName: { fontSize: 22, fontWeight: '900', color: C.black, marginTop: 2 },
// welcomeTime: { fontSize: 11, color: C.primaryDark, marginTop: 4 },
// welcomeStrip: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.08)', paddingVertical: 12, paddingHorizontal: 16 },
// stripVal: { fontSize: 22, fontWeight: '900', color: C.black, textAlign: 'center' },
// stripLbl: { fontSize: 11, color: C.primaryDark, fontWeight: '700', marginTop: 2, textAlign: 'center' },
// stripDiv: { width: 1, height: 32, backgroundColor: 'rgba(0,0,0,0.15)' },
// alertBanner: { backgroundColor: C.warning, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 10 },
// alertBannerTxt: { flex: 1, color: C.white, fontWeight: '700', fontSize: 13 },
// pendingBanner: { backgroundColor: C.primaryGhost, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
// pendingBannerTxt: { flex: 1, color: C.textDark, fontWeight: '600', fontSize: 13 },
// pendingDot: { width: 8, height: 8, borderRadius: 4 },
// statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
// statCard: { flex: 1, minWidth: (width - 48) / 2 - 5, backgroundColor: C.white, borderRadius: 12, padding: 14, alignItems: 'flex-start', borderWidth: 1, borderColor: C.divider, elevation: 1 },
// statIconWrap: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
// statValue: { fontSize: 22, fontWeight: '900', color: C.textDark },
// statLabel: { fontSize: 11, color: C.textLight, marginTop: 3, fontWeight: '600' },
// quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
// quickBtn: { flex: 1, minWidth: (width - 48) / 2 - 5, backgroundColor: C.white, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.divider, elevation: 1 },
// quickIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
// quickLabel: { fontSize: 12, fontWeight: '800', color: C.textDark, textAlign: 'center' },
// card: { backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.divider, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, overflow: 'hidden', position: 'relative' },
// cardAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
// cardTitle: { fontSize: 15, fontWeight: '800', color: C.textDark, flex: 1 },
// chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: C.primaryGhost, borderWidth: 1, borderColor: C.border, alignSelf: 'flex-start' },
// chipTxt: { fontSize: 11, fontWeight: '700', color: C.primaryDark },
// prefChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, borderWidth: 1, alignSelf: 'flex-start', gap: 4 },
// prefChipTxt: { fontSize: 11, fontWeight: '700' },
// prefBreakdown: { backgroundColor: C.offWhite, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.divider, marginBottom: 10 },
// prefBreakdownLabel: { fontSize: 10, fontWeight: '900', color: C.textLight, letterSpacing: 1 },
// detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
// detailTxt: { fontSize: 13, color: C.textMid, flex: 1, lineHeight: 18 },
// statsRow: { flexDirection: 'row', backgroundColor: C.primaryGhost, borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center' },
// statBox: { flex: 1, alignItems: 'center', gap: 3 },
// statBoxVal: { fontSize: 13, fontWeight: '800', color: C.textDark, textAlign: 'center' },
// statBoxLbl: { fontSize: 10, color: C.textLight, fontWeight: '600', textAlign: 'center' },
// statDiv: { width: 1, height: 32, backgroundColor: C.border },
// fuelBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryGhost, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
// fuelIconBox: { width: 36, height: 36, borderRadius: 9, backgroundColor: C.primaryPale, justifyContent: 'center', alignItems: 'center' },
// fuelBadgeType: { fontSize: 12, fontWeight: '800', color: C.textDark },
// fuelBadgeVal: { fontSize: 13, fontWeight: '700', color: C.primaryDark, marginTop: 2 },
// fuelBadgeNote: { fontSize: 10, color: C.textLight, marginTop: 1 },
// srcBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.offWhite, borderRadius: 7, padding: 7, borderWidth: 1, borderColor: C.divider },
// srcTxt: { fontSize: 11, color: C.textMid, flex: 1 },
// stopsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.divider, marginTop: 8 },
// stopsTitle: { fontSize: 13, fontWeight: '800', color: C.textDark },
// stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.divider },
// stopDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
// stopName: { fontSize: 13, fontWeight: '700', color: C.textDark },
// stopAddr: { fontSize: 11, color: C.textLight, marginTop: 2, lineHeight: 15 },
// paxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.divider },
// paxAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, flexShrink: 0 },
// scoreBubble: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', backgroundColor: C.white, flexShrink: 0 },
// scoreNum: { fontSize: 14, fontWeight: '900', lineHeight: 16 },
// scoreLbl: { fontSize: 9, fontWeight: '700', color: C.textLight, marginTop: -1 },
// vIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, flexShrink: 0 },
// vBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primaryGhost, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8 },
// vBadgeLbl: { fontSize: 9, fontWeight: '900', color: C.textLight, letterSpacing: 1.2 },
// vBadgeVal: { fontSize: 13, fontWeight: '700', color: C.textDark, marginTop: 2 },
// twoBtn: { flexDirection: 'row', gap: 10, marginTop: 14 },
// btnTxt: { fontSize: 14, fontWeight: '800', color: C.white },
// discardBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: C.error },
// confirmBtnGreen: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: C.primary },
// rejectBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: '#6B6B6B' },
// acceptBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12, borderRadius: 10, backgroundColor: C.primary },
// inputLabel: { fontSize: 12, fontWeight: '800', color: C.textLight, letterSpacing: 0.8, marginBottom: 5, marginTop: 2, textTransform: 'uppercase' },
// input: { backgroundColor: C.primaryGhost, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, padding: 12, fontSize: 14, color: C.textDark, marginBottom: 10 },
// profileDivider: { height: 1, backgroundColor: C.divider, marginVertical: 14 },
// profileIconWrap: { width: 28, height: 28, borderRadius: 7, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
// driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.divider, elevation: 1 },
// driverAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', position: 'relative', flexShrink: 0 },
// driverAvatarTxt: { fontSize: 14, fontWeight: '900', color: C.black },
// driverDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: C.white },
// driverName: { fontSize: 14, fontWeight: '800', color: C.textDark },
// driverSub: { fontSize: 11, color: C.textLight, marginTop: 2 },
// capRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
// capTxt: { fontSize: 11, fontWeight: '700', color: C.textMid, minWidth: 28 },
// capBg: { flex: 1, height: 5, backgroundColor: C.divider, borderRadius: 3, overflow: 'hidden' },
// capFill: { height: 5, borderRadius: 3 },
// reqAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.primaryGhost, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
// emptyState: { alignItems: 'center', paddingVertical: 32 },
// emptyTxt: { fontSize: 14, color: C.textLight, marginTop: 10, textAlign: 'center', fontWeight: '500', lineHeight: 20 },
// optimizingBanner: { backgroundColor: C.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 10 },
// optimizingTxt: { flex: 1, fontWeight: '700', fontSize: 13 },
// trackingOverlay: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
// trackingOverlayTxt: { color: C.white, fontWeight: '700', fontSize: 13, flex: 1 },
// viewMapBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, padding: 12 },
// viewMapBtnTxt: { flex: 1, fontSize: 13, fontWeight: '800', color: C.black },
// dateTabsContainer: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 },
// dateTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
// dateTabActive: { backgroundColor: C.primary },
// dateTabText: { fontSize: 12, color: C.textLight, fontWeight: '600' },
// dateTabTextActive: { color: C.black, fontWeight: '800' },
// smartSuggestBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primaryPale, borderRadius: 8, padding: 8, marginTop: 8, borderWidth: 1, borderColor: C.border },
// smartSuggestTxt: { flex: 1, fontSize: 12, color: C.primaryDark, fontWeight: '600' },
// editDriverBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
// editDriverBtnTxt: { fontSize: 12, fontWeight: '800', color: C.black },
// warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.warningLight, borderRadius: 7, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: C.warning },
// warnTxt: { fontSize: 11, color: C.warning, flex: 1, lineHeight: 15 },
// });

// export default TransporterDashboard;
