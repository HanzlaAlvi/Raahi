// frontend/Transporter/sections/AssignSection.jsx
// CHANGES FROM ORIGINAL:
//   1. Added isAutoProcessed badge — routes auto-processed at midnight show a
//      purple "Auto-Processed" banner with robot icon, replacing the generic
//      "Assigned" status badge with a combined "Auto ✓ Assigned" display.
//   2. Stats bar now shows an "Auto" counter tile for isAutoProcessed routes.
//   3. RouteCard header: if route.isAutoProcessed, the icon gradient is purple
//      (instead of green/orange) and the status badge says "Auto-Assigned".
//   4. All original logic (manual assign, AI suggestion, driver scoring,
//      availability check, capacity check) is 100% preserved.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api }            from '../services/ApiService';

// ── Driver type label helper ─────────────────────────────────────
function getDriverTypeLabel(d) {
  const v = (d.vehicleType || d.vehicle || '').toLowerCase();
  if (v.includes('bus')) return 'Bus Driver';
  if (v.includes('van') || v.includes('hiace')) return 'Van Driver';
  if (v.includes('car')) return 'Car Driver';
  return 'Driver';
}

// ── Palette ──────────────────────────────────────────────────────
const P = {
  main:       '#415844',
  dark:       '#2D3E2F',
  deep:       '#1A2B1C',
  white:      '#FFFFFF',
  bg:         '#F2F5F2',
  cardBg:     '#FFFFFF',
  light:      '#EDF1ED',
  border:     '#D4DDD4',
  divider:    '#EBF0EB',
  textDark:   '#1A2218',
  textMid:    '#374151',
  textLight:  '#6B7B6C',
  textMuted:  '#9CAF9C',
  success:    '#2A7A2E',
  successBg:  '#E6F4E7',
  successMid: '#4CAF50',
  warn:       '#8B5E1A',
  warnBg:     '#FDF3E3',
  warnMid:    '#E59A2A',
  error:      '#8B2020',
  errorBg:    '#FDEAEA',
  errorMid:   '#E53935',
  // ── AI: soft indigo-blue that complements the green theme ─────
  ai:         '#5b5e75',
  aiBg:       '#E8EAF6',
  aiBorder:   '#C5CAE9',
  // ── auto-processed: distinct purple (reserved for system auto) ─
  auto:       '#064f49', 
  autoBg:     '#eaf1f0', 
  autoBorder: '#1e7771', 
  ink:        '#0F1A10',
};

// ── Haversine (real formula, km) ─────────────────────────────────
function distKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Driver scoring ────────────────────────────────────────────────
function scoreDriver(driver, route, alreadyAssignedIds = []) {
  let score = 0;
  const routeVehicle  = route.vehicleType?.toLowerCase();
  const driverVehicle = (driver.vehicleType || driver.vehicle || '').toLowerCase();
  const passengerPrefs = (route.passengers || [])
    .map(p => (p.vehiclePreference || '').toLowerCase())
    .filter(Boolean);
  const prefCounts = {};
  passengerPrefs.forEach(v => { prefCounts[v] = (prefCounts[v] || 0) + 1; });
  const dominantPref = Object.entries(prefCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (dominantPref && driverVehicle.includes(dominantPref)) score += 40;
  else if (routeVehicle && driverVehicle.includes(routeVehicle)) score += 25;
  else if (!dominantPref && !routeVehicle) score += 10;

  const vehicleCapacities = { car: 4, van: 8, bus: 40 };
  let dtype = 'car';
  if (driverVehicle.includes('bus')) dtype = 'bus';
  else if (driverVehicle.includes('van')) dtype = 'van';
  const cap = vehicleCapacities[dtype] || 4;
  if ((route.passengers?.length || 0) <= cap) score += 30;

  if (driver.isAvailable) score += 20;

  const firstPax = route.passengers?.[0];
  const paxLat = firstPax?.pickupLat || firstPax?.latitude;
  const paxLng = firstPax?.pickupLng || firstPax?.longitude;
  if (paxLat && paxLng && driver.latitude && driver.longitude) {
    const km = distKm(driver.latitude, driver.longitude, paxLat, paxLng);
    score += Math.max(0, 30 - km * 3);
  }

  if (!alreadyAssignedIds.includes(driver._id?.toString())) score += 10;
  return Math.round(score);
}

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function AssignSection({ routes: propRoutes, onRefresh }) {
  const [routes,            setRoutes]            = useState([]);
  const [drivers,           setDrivers]           = useState([]);
  const [loadingRoutes,     setLoadingRoutes]      = useState(false);
  const [loadingDrivers,    setLoadingDrivers]     = useState(false);
  const [assigning,         setAssigning]          = useState({});
  const [showActiveDrivers, setShowActiveDrivers]  = useState(false);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const loadRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const data = await api.getRoutes();
      console.log('[AssignSection] Routes from API:', data.length);

      // ✅ FIX: isAutoProcessed routes bhi include karo chahe status kuch bhi ho
      const filtered = data.filter(r =>
        r.status === 'unassigned' ||
        r.status === 'assigned'   ||
        r.status === 'pending'    ||
        r.isAutoProcessed === true
      );

      console.log('[AssignSection] Routes to display:', filtered.length,
        filtered.map(r => ({ name: r.routeName, status: r.status, auto: r.isAutoProcessed }))
      );
      setRoutes(filtered);
    } catch (e) { console.error('[AssignSection] loadRoutes error:', e.message); }
    finally { setLoadingRoutes(false); }
  }, []);

  const loadDrivers = useCallback(async () => {
    setLoadingDrivers(true);
    try {
      const data = await api.getDriversWithAvailability(tomorrowStr);
      setDrivers(data);
    } catch (e) { console.error('loadDrivers:', e); }
    finally { setLoadingDrivers(false); }
  }, [tomorrowStr]);

  useEffect(() => { loadRoutes(); loadDrivers(); }, []);

  // Driver IDs already on an assigned route
  const assignedDriverIds = useMemo(() =>
    routes
      .filter(r => r.status === 'assigned')
      .map(r => (r.assignedDriver?._id || r.assignedDriver)?.toString())
      .filter(Boolean),
    [routes]
  );

  // ── Assign driver (manual flow — unchanged) ──────────────────────
  const assignDriver = async (routeId, driverId, driverName) => {
    const driver = drivers.find(d => d._id === driverId);
    const route  = routes.find(r => r._id === routeId);

    if (!driver?.isAvailable) {
      Alert.alert(
        'Driver Not Available',
        `${driverName} has NOT marked available for tomorrow.\n\nOnly drivers who have marked next-day availability can be assigned.`,
        [{ text: 'OK', style: 'destructive' }]
      );
      return;
    }

    let capacity = driver.capacity;
    if (!capacity) {
      const v = (driver.vehicleType || driver.vehicle || '').toLowerCase();
      if (v.includes('bus')) capacity = 30;
      else if (v.includes('hiace') || v.includes('van')) capacity = 14;
      else if (v.includes('car')) capacity = 4;
      else capacity = 4;
    }
    const paxCount = route.passengers?.length || 0;
    if (capacity < paxCount) {
      Alert.alert(
        'Capacity Mismatch',
        `Driver capacity (${capacity}) is less than passenger count (${paxCount}). Cannot assign.`,
        [{ text: 'OK', style: 'destructive' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Assignment',
      `Assign "${driverName}" to "${route?.routeName || 'this route'}"?\n\nAvailability: ${driver.availableFrom || 'N/A'} – ${driver.availableTill || 'N/A'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setAssigning(prev => ({ ...prev, [routeId]: true }));
            try {
              await api.assignDriverToRoute(routeId, driverId);
              Alert.alert('Assigned ✅', `${driverName} has been assigned. Driver notified.`);
              await loadRoutes();
              if (onRefresh) onRefresh();
            } catch (e) { Alert.alert('Error', e.message || 'Assignment failed'); }
            finally { setAssigning(prev => ({ ...prev, [routeId]: false })); }
          },
        },
      ]
    );
  };

  // ── Stat Tile ──────────────────────────────────────────────────
  const StatTile = ({ val, label, icon, gradColors, textColor }) => (
    <LinearGradient colors={gradColors} style={s.statTile} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={s.statIconWrap}>
        <Ionicons name={icon} size={16} color={textColor} />
      </View>
      <Text style={[s.statVal, { color: textColor }]}>{val}</Text>
      <Text style={[s.statLbl, { color: textColor + 'BB' }]}>{label}</Text>
    </LinearGradient>
  );

  // ═══════════════════════════════════════════════════════════════
  // ROUTE CARD
  // ═══════════════════════════════════════════════════════════════
  const RouteCard = ({ route }) => {
    const [expanded,          setExpanded]          = useState(false);
    const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);

    const assigned        = route.assignedDriver;
    const isAssigned      = route.status === 'assigned';
    // ── NEW: detect auto-processed routes ─────────────────────────
    const isAutoProcessed = !!route.isAutoProcessed;
    const isAutoAssigned  = !!route.autoAssigned;

    const routeVehicleType   = (route.vehicleType || '').toLowerCase();
    const vehicleCapacities  = { car: 4, van: 8, bus: 40 };

    function getDriverType(d) {
      const v = (d.vehicleType || d.vehicle || '').toLowerCase();
      if (v.includes('bus')) return 'bus';
      if (v.includes('van')) return 'van';
      if (v.includes('car')) return 'car';
      return v;
    }

    const filteredDrivers = useMemo(() =>
      drivers.filter(d => {
        const dtype = getDriverType(d);
        if (routeVehicleType.includes('car')) return dtype === 'car';
        if (routeVehicleType.includes('van')) return dtype === 'van' || dtype === 'bus';
        if (routeVehicleType.includes('bus')) return dtype === 'bus';
        return true;
      }),
      [drivers, routeVehicleType]
    );

    const availableDrivers = useMemo(() =>
      filteredDrivers.filter(d => d.isAvailable),
      [filteredDrivers]
    );

    function getVanCombos(passengerCount, vans) {
      if (!vans.length) return [];
      const combos = [];
      for (let i = 0; i < vans.length; ++i) {
        if (vehicleCapacities['van'] >= passengerCount) combos.push([vans[i]]);
        for (let j = i + 1; j < vans.length; ++j) {
          if (vehicleCapacities['van'] * 2 >= passengerCount) combos.push([vans[i], vans[j]]);
          for (let k = j + 1; k < vans.length; ++k) {
            if (vehicleCapacities['van'] * 3 >= passengerCount) combos.push([vans[i], vans[j], vans[k]]);
          }
        }
      }
      return combos;
    }

    const displayedDrivers = showOnlyAvailable ? availableDrivers : filteredDrivers;

    // AI Recommendation logic (unchanged)
    let bestDriver = null;
    if (routeVehicleType.includes('bus')) {
      bestDriver = availableDrivers
        .filter(d => getDriverType(d) === 'bus')
        .map(d => ({ ...d, _score: scoreDriver(d, route, assignedDriverIds) }))
        .sort((a, b) => b._score - a._score)[0] || null;
    } else if (routeVehicleType.includes('van')) {
      const vans = availableDrivers.filter(d => getDriverType(d) === 'van');
      if ((route.passengers?.length || 0) > vehicleCapacities['van'] && vans.length > 1) {
        const combos = getVanCombos(route.passengers.length, vans);
        if (combos.length) {
          combos.sort((a, b) => {
            const sA = a.reduce((s, d) => s + scoreDriver(d, route, assignedDriverIds), 0);
            const sB = b.reduce((s, d) => s + scoreDriver(d, route, assignedDriverIds), 0);
            return sB - sA;
          });
          bestDriver = combos[0];
        }
      } else {
        bestDriver = vans
          .map(d => ({ ...d, _score: scoreDriver(d, route, assignedDriverIds) }))
          .sort((a, b) => b._score - a._score)[0] || null;
      }
    } else if (routeVehicleType.includes('car')) {
      bestDriver = availableDrivers
        .filter(d => getDriverType(d) === 'car')
        .map(d => ({ ...d, _score: scoreDriver(d, route, assignedDriverIds) }))
        .sort((a, b) => b._score - a._score)[0] || null;
    }

    const scoredDrivers = useMemo(() =>
      displayedDrivers
        .map(d => ({ ...d, _score: scoreDriver(d, route, assignedDriverIds) }))
        .sort((a, b) => b._score - a._score),
      [displayedDrivers, route, assignedDriverIds]
    );

    const dominantVehicle = useMemo(() => {
      const prefs = (route.passengers || []).map(p => p.vehiclePreference).filter(Boolean);
      if (!prefs.length) return null;
      const counts = {};
      prefs.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    }, [route]);

    // ── Header gradient colours based on route state ──────────────
    const headerGradient = isAutoProcessed
      ? [P.success, P.dark]          // green   — auto-processed (card looks assigned)
      : isAssigned
        ? [P.success, P.dark]        // green   — manually assigned
        : [P.warnMid, P.warn];       // amber   — pending

    return (
      <View style={[
        s.routeCard,
        isAssigned      && s.routeCardAssigned,
        isAutoProcessed && s.routeCardAuto,   // NEW: purple border
      ]}>

        {/* ── NEW: Auto-Processed Banner ─────────────────────────── */}
        {isAutoProcessed && (
          <View style={s.autoBanner}>
            <Ionicons name="hardware-chip-outline" size={13} color={P.auto} style={{ marginRight: 5 }} />
            <Text style={s.autoBannerTxt}>
              Auto-Processed at Midnight — System assigned this route automatically
            </Text>
          </View>
        )}

        {/* Header */}
        <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.82} style={s.routeHeader}>
          <LinearGradient colors={headerGradient} style={s.routeIconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
           <Ionicons name={isAutoProcessed ? 'hardware-chip' : 'map'} size={17} color={P.white} />
          </LinearGradient>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.routeName} numberOfLines={1}>
              {route.routeName || route.name || 'Route'}
            </Text>
            <View style={s.routeMetaRow}>
              <Ionicons name="time-outline" size={11} color={P.textMuted} />
              <Text style={s.routeMetaTxt}>{route.timeSlot || route.pickupTime || 'N/A'}</Text>
              <View style={s.dot} />
              <Ionicons name="people-outline" size={11} color={P.textMuted} />
              <Text style={s.routeMetaTxt}>{route.passengers?.length || 0} pax</Text>
              {dominantVehicle && (
                <>
                  <View style={s.dot} />
                  <Ionicons name="car-outline" size={11} color={P.textMuted} />
                  <Text style={s.routeMetaTxt}>{dominantVehicle}</Text>
                </>
              )}
            </View>

            {/* Assigned driver pill */}
            {assigned && (
              <View style={[s.assignedPill, isAutoProcessed && s.assignedPillAuto]}>
                <Ionicons name={isAutoProcessed ? 'hardware-chip' : 'person'} size={10} color={P.white} />
                <Text style={s.assignedPillTxt}>{assigned.name || route.driverName || 'Driver'}</Text>
              </View>
            )}
          </View>

          {/* ── Status Badge (NEW: auto-assigned variant) ─────────── */}
          {isAutoProcessed ? (
            <View style={[s.statusBadge, s.statusBadgeAuto]}>
              <Ionicons name="hardware-chip" size={10} color={P.auto} style={{ marginRight: 2 }} />
              <Text style={[s.statusTxt, { color: P.auto }]}>Auto ✓</Text>
            </View>
          ) : (
            <View style={[s.statusBadge,
              isAssigned
                ? { backgroundColor: P.successBg, borderColor: P.success + '40' }
                : { backgroundColor: P.warnBg,    borderColor: P.warnMid  + '40' }
            ]}>
              <View style={[s.statusDot, { backgroundColor: isAssigned ? P.successMid : P.warnMid }]} />
              <Text style={[s.statusTxt, { color: isAssigned ? P.success : P.warn }]}>
                {isAssigned ? 'Assigned' : 'Pending'}
              </Text>
            </View>
          )}

          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16} color={P.textMuted}
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>

        {/* Expanded body */}
        {expanded && (
          <View style={s.routeBody}>

            {/* ── NEW: Auto-process detail card ─────────────────── */}
            {isAutoProcessed && (
              <View style={s.autoDetailCard}>
                <LinearGradient colors={[P.auto, '#6D28D9']} style={s.autoDetailIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name="hardware-chip" size={16} color={P.white} />
                </LinearGradient>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.autoDetailTitle}>System Auto-Assigned</Text>
                  <Text style={s.autoDetailBody}>
                    {'This route was created and assigned automatically at 12:00 AM because the manual pipeline was not completed.\n\n'}
                  </Text>
                  {route.autoProcessedAt && (
                    <Text style={s.autoDetailTime}>
                      Processed: {new Date(route.autoProcessedAt).toLocaleString('en-PK')}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* AI Best Driver Suggestion — only shown when NOT auto-processed + NOT assigned */}
            {bestDriver && !isAssigned && !isAutoProcessed && (() => {
              let capacity = bestDriver.capacity;
              const drvVehicle = (bestDriver.vehicleType || bestDriver.vehicle || '').toLowerCase();
              if (!capacity) {
                if (drvVehicle.includes('bus')) capacity = 30;
                else if (drvVehicle.includes('hiace') || drvVehicle.includes('van')) capacity = 14;
                else if (drvVehicle.includes('car')) capacity = 4;
                else capacity = 4;
              }
              const paxCount    = route.passengers?.length || 0;
              const capacityFail = capacity < paxCount;
              const isAvailable  = bestDriver.isAvailable;
              const stops = (route.passengers || [])
                .map(p => [p.pickupLat || p.latitude, p.pickupLng || p.longitude])
                .filter(([lat, lng]) => lat && lng);
              let avgKm = 0;
              if (stops.length && bestDriver.latitude && bestDriver.longitude) {
                avgKm = stops.reduce(
                  (sum, [lat, lng]) => sum + distKm(bestDriver.latitude, bestDriver.longitude, lat, lng), 0
                ) / stops.length;
              }
              const eta      = avgKm ? Math.round((avgKm / 35) * 60) : 0;
              const fuelCost = avgKm ? Math.round(avgKm * 18) : 0;

              const checkBadge = (pass, label) => (
                <View style={{
                  backgroundColor: pass ? P.successBg : P.errorBg,
                  borderColor: pass ? P.success : P.error,
                  borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
                  marginRight: 6, marginBottom: 4, flexDirection: 'row', alignItems: 'center',
                }}>
                  <Ionicons name={pass ? 'checkmark-circle' : 'close-circle'} size={13} color={pass ? P.success : P.error} style={{ marginRight: 3 }} />
                  <Text style={{ color: pass ? P.success : P.error, fontWeight: '700', fontSize: 12 }}>{label}</Text>
                </View>
              );

              return (
                <View style={s.aiCard}>
                  <LinearGradient colors={[P.ai, '#3949AB']} style={s.aiIconBox} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="sparkles" size={14} color={P.white} />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.aiTitle}>AI Recommendation</Text>
                    <Text style={s.aiName}>{bestDriver.name}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginVertical: 4 }}>
                      {checkBadge(isAvailable, 'Available')}
                      {checkBadge(!capacityFail, `Capacity ${capacity}≥${paxCount}`)}
                      {checkBadge(avgKm > 0, `Proximity ${avgKm ? avgKm.toFixed(1) + ' km' : 'N/A'}`)}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
                      <View style={{ backgroundColor: P.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 4 }}>
                        <Text style={{ color: P.success, fontWeight: '700', fontSize: 12 }}>ETA: {eta} min</Text>
                      </View>
                      <View style={{ backgroundColor: P.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 4 }}>
                        <Text style={{ color: P.success, fontWeight: '700', fontSize: 12 }}>Fuel: Rs {fuelCost}</Text>
                      </View>
                    </View>
                    <Text style={s.aiReason}>
                      {[
                        isAvailable ? '✓ Marked available for tomorrow' : '✗ Not marked available',
                        !capacityFail ? `✓ Capacity OK (${capacity} seats for ${paxCount} pax)` : `✗ Capacity too low`,
                        dominantVehicle && (bestDriver.vehicleType || '').toLowerCase().includes(dominantVehicle)
                          ? `✓ Vehicle matches passenger preference (${dominantVehicle})` : null,
                        avgKm ? `✓ Avg distance to stops: ${avgKm.toFixed(1)} km` : '✗ No location data',
                        `✓ ETA: ${eta} min`,
                        `✓ Fuel cost: Rs ${fuelCost}`,
                        `✓ Best route-fit score: ${bestDriver._score}`,
                      ].filter(Boolean).join('\n')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.aiAssignBtn}
                    onPress={() => assignDriver(route._id, bestDriver._id, bestDriver.name)}
                    disabled={!!assigning[route._id]}
                  >
                    {assigning[route._id]
                      ? <ActivityIndicator size="small" color={P.white} />
                      : <>
                          <Ionicons name="checkmark" size={13} color={P.white} />
                          <Text style={s.aiAssignBtnTxt}>Use</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Passengers */}
            <View style={s.sectionRow}>
              <Text style={s.bodySectionTitle}>PASSENGERS</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{route.passengers?.length || 0}</Text>
              </View>
            </View>

            <View style={s.passengerGrid}>
              {(route.passengers || []).map((p, i) => (
                <View key={i} style={s.passengerChip}>
                  <View style={s.passengerIdx}>
                    <Text style={s.passengerIdxTxt}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.passengerName} numberOfLines={1}>
                      {p.passengerName || p.name || 'Passenger'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={11} color={P.textMuted} />
                      <Text style={s.passengerAddr} numberOfLines={1}>
                        {p.pickupPoint || p.address || 'N/A'}
                      </Text>
                    </View>
                    {p.vehiclePreference && (
                      <View style={s.vehiclePrefBadge}>
                        <Ionicons name="car-outline" size={10} color={P.ai} />
                        <Text style={s.vehiclePrefTxt}>{p.vehiclePreference}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={s.bodyDivider} />

            {/* Driver picker — hidden for auto-processed+assigned routes */}
            {!isAutoProcessed && (
              <>
                <View style={[s.sectionRow, { marginTop: 0 }]}>
                  <Text style={s.bodySectionTitle}>SELECT DRIVER</Text>
                  <View style={s.togglePills}>
                    <TouchableOpacity style={[s.pill, showOnlyAvailable && s.pillActive]} onPress={() => setShowOnlyAvailable(true)}>
                      <Text style={[s.pillTxt, showOnlyAvailable && s.pillTxtActive]}>Available ({availableDrivers.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.pill, !showOnlyAvailable && s.pillActive]} onPress={() => setShowOnlyAvailable(false)}>
                      <Text style={[s.pillTxt, !showOnlyAvailable && s.pillTxtActive]}>All ({drivers.length})</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {loadingDrivers ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator color={P.main} />
                  </View>
                ) : scoredDrivers.length === 0 ? (
                  <View style={s.emptyDrivers}>
                    <View style={s.emptyDriversIcon}>
                      <Ionicons name="person-outline" size={28} color={P.textMuted} />
                    </View>
                    <Text style={s.emptyDriversTxt}>
                      {showOnlyAvailable
                        ? 'No drivers have marked availability for tomorrow'
                        : 'No drivers found in your network'}
                    </Text>
                    <TouchableOpacity style={s.refreshBtn} onPress={loadDrivers}>
                      <Ionicons name="refresh-outline" size={13} color={P.main} />
                      <Text style={s.refreshBtnTxt}>Refresh</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {scoredDrivers.map(driver => {
                      const isCurrent = (assigned?._id || assigned)?.toString() === driver._id?.toString();
                      const isBusy    = assigning[route._id];
                      const isBest    = bestDriver?._id === driver._id && !isAssigned;
                      const drvVehicle = (driver.vehicleType || driver.vehicle || '').toLowerCase();
                      const vehicleMatch = dominantVehicle ? drvVehicle.includes(dominantVehicle) : true;
                      const isAvailable  = driver.isAvailable;

                      let capacity = driver.capacity;
                      if (!capacity) {
                        if (drvVehicle.includes('bus')) capacity = 30;
                        else if (drvVehicle.includes('hiace') || drvVehicle.includes('van')) capacity = 14;
                        else if (drvVehicle.includes('car')) capacity = 4;
                        else capacity = 4;
                      }
                      const paxCount    = route.passengers?.length || 0;
                      const capacityFail = capacity < paxCount;

                      return (
                        <TouchableOpacity
                          key={driver._id}
                          style={[
                            s.driverCard,
                            isCurrent  && s.driverCardActive,
                            isBest     && s.driverCardBest,
                            (!isAvailable || capacityFail) && { opacity: 0.45 },
                          ]}
                          onPress={() => assignDriver(route._id, driver._id, driver.name)}
                          disabled={isBusy}
                          activeOpacity={0.78}
                        >
                          <LinearGradient
                            colors={
                              isBest    ? [P.ai,    '#3949AB'] :
                              isCurrent ? [P.main,  P.dark]   :
                              isAvailable ? ['#4A6C4E', '#2D3E2F'] : ['#9E9E9E', '#757575']
                            }
                            style={s.driverAvatar}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          >
                            <Text style={s.driverAvatarTxt}>
                              {(driver.name || '?')[0].toUpperCase()}
                            </Text>
                          </LinearGradient>

                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={s.driverName}>{driver.name}</Text>
                              {isBest && (
                                <View style={s.aiBestBadge}>
                                  <Ionicons name="sparkles" size={9} color={P.white} />
                                  <Text style={s.aiBestTxt}>BEST</Text>
                                </View>
                              )}
                              {isCurrent && (
                                <View style={s.currentBadge}>
                                  <Ionicons name="checkmark" size={9} color={P.white} />
                                  <Text style={s.currentBadgeTxt}>CURRENT</Text>
                                </View>
                              )}
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                              <Text style={s.driverVehicle}>{getDriverTypeLabel(driver)}</Text>
                              {dominantVehicle && (
                                <View style={[s.vehicleMatchBadge, {
                                  backgroundColor: vehicleMatch ? P.successBg : P.errorBg,
                                  borderColor:     vehicleMatch ? P.success   : P.error,
                                }]}>
                                  <Text style={[s.vehicleMatchTxt, { color: vehicleMatch ? P.success : P.error }]}>
                                    {vehicleMatch ? '✓ Match' : '✗ No match'}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={s.availRow}>
                              <View style={[s.availDot, { backgroundColor: isAvailable ? P.successMid : P.errorMid }]} />
                              <Text style={[s.availTxt, { color: isAvailable ? P.success : P.error }]}>
                                {isAvailable
                                  ? `Available  ${driver.availableFrom || ''} – ${driver.availableTill || ''}`
                                  : 'Not available tomorrow'}
                              </Text>
                            </View>

                            <View style={s.scoreRow}>
                              <Text style={s.scoreLbl}>Fit Score</Text>
                              <View style={s.scoreBarBg}>
                                <View style={[s.scoreBarFill, {
                                  width:           `${Math.min(100, driver._score || 0)}%`,
                                  backgroundColor: isBest ? P.ai : P.main,
                                }]} />
                              </View>
                              <Text style={s.scoreVal}>{driver._score || 0}</Text>
                            </View>
                          </View>

                          {!isCurrent && (
                            <TouchableOpacity
                              style={[
                                s.assignBtn,
                                isBest    && s.assignBtnBest,
                                isCurrent && s.assignBtnCurrent,
                                !driver.isAvailable && s.assignBtnDim,
                              ]}
                              onPress={() => assignDriver(route._id, driver._id, driver.name)}
                              disabled={isBusy || !driver.isAvailable}
                            >
                              <Ionicons name="person-add-outline" size={13} color={P.white} />
                              <Text style={s.assignBtnTxt}>Assign</Text>
                            </TouchableOpacity>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            {/* Auto-processed: allow manual re-assign if needed */}
            {isAutoProcessed && isAssigned && (
              <TouchableOpacity
                style={s.reAssignBtn}
                onPress={() => {
                  Alert.alert(
                    'Re-assign Driver?',
                    'This route was auto-assigned by the system. You can manually re-assign a different driver below.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Re-assign', onPress: () => setExpanded(true) },
                    ]
                  );
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={13} color={P.auto} />
                <Text style={s.reAssignBtnTxt}>Override — Manually Re-assign Driver</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Main render ──────────────────────────────────────────────────
  const autoProcessedCount = routes.filter(r => r.isAutoProcessed).length;

  return (
    <View style={s.root}>

      {/* Stats bar */}
      <View style={[s.statsBar, { backgroundColor: P.deep }]}>
        <StatTile
          val={routes.length}
          label="Routes"
          icon="map-outline"
          gradColors={['#3A5040', '#2D3E2F']}
          textColor="#C8DEC5"
        />
        <TouchableOpacity activeOpacity={0.8} onPress={() => setShowActiveDrivers(true)}>
          <StatTile
            val={drivers.filter(d => d.isAvailable).length}
            label="Available"
            icon="checkmark-circle-outline"
            gradColors={['#2A5C2E', '#1A3C1E']}
            textColor="#A8DCA8"
          />
        </TouchableOpacity>
        <StatTile
          val={routes.filter(r => r.status === 'assigned' && !r.isAutoProcessed).length}
          label="Assigned"
          icon="person-outline"
          gradColors={['#3E5540', '#2A3C2C']}
          textColor="#B8D4B0"
        />
        {/* ── NEW: Auto-Processed stat tile ── */}
        <StatTile
          val={autoProcessedCount}
          label="Auto"
          icon="hardware-chip-outline"
          gradColors={['#20a347', '#20570e']}
          textColor="#EDE9FE"
        />
      </View>

      {/* Drivers status popup */}
      {showActiveDrivers && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <View style={{ backgroundColor: P.cardBg, borderRadius: 20, padding: 0, width: '92%', maxHeight: '85%', elevation: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: P.divider }}>
              <LinearGradient colors={[P.main, P.dark]} style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="people" size={18} color={P.white} />
              </LinearGradient>
              <Text style={{ fontWeight: '900', fontSize: 18, color: P.ink }}>Drivers Status ({drivers.length})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 8 }}>
                <TouchableOpacity style={{ padding: 8 }} onPress={loadDrivers}>
                  <Ionicons name="refresh-outline" size={18} color={P.main} />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 8 }} onPress={() => setShowActiveDrivers(false)}>
                  <Ionicons name="close" size={20} color={P.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={{ color: P.textMuted, fontSize: 13, marginBottom: 12 }}>
                Live availability status.
              </Text>
              <Text style={{ fontWeight: '800', color: P.success, fontSize: 15, marginBottom: 8 }}>
                Available ({drivers.filter(d => d.isAvailable).length})
              </Text>
              {drivers.filter(d => d.isAvailable).map((d, idx) => (
                <View key={d._id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: P.successBg, padding: 12, marginBottom: 8, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: P.success }}>
                  <Text style={{ fontWeight: '700', color: P.success, width: 24, fontSize: 14 }}>{idx + 1}.</Text>
                  <Text style={{ flex: 1, fontWeight: '800', color: P.textDark, fontSize: 15 }}>{d.name}</Text>
                  <Ionicons name="checkmark-circle" size={20} color={P.success} style={{ marginRight: 8 }} />
                  <Text style={{ color: P.textMuted }}>{getDriverTypeLabel(d)}</Text>
                </View>
              ))}
              <Text style={{ fontWeight: '800', color: P.error, fontSize: 15, marginTop: 16, marginBottom: 8 }}>
                Unavailable ({drivers.filter(d => !d.isAvailable).length})
              </Text>
              {drivers.filter(d => !d.isAvailable).map((d, idx) => (
                <View key={d._id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: P.errorBg, padding: 12, marginBottom: 8, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: P.error }}>
                  <Text style={{ fontWeight: '700', color: P.errorMid, width: 24, fontSize: 14 }}>{idx + 1}.</Text>
                  <Text style={{ flex: 1, fontWeight: '700', color: P.textDark, fontSize: 15 }}>{d.name}</Text>
                  <Text style={{ color: P.textMuted }}>{getDriverTypeLabel(d)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Content */}
      {loadingRoutes ? (
        <View style={s.loaderBox}>
          <View style={s.loaderRing}>
            <ActivityIndicator size="large" color={P.main} />
          </View>
          <Text style={s.loaderTxt}>Loading routes…</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={s.empty}>
          <LinearGradient colors={[P.light, P.white]} style={s.emptyIconBox}>
            <Ionicons name="map-outline" size={42} color={P.main} />
          </LinearGradient>
          <Text style={s.emptyTitle}>No routes yet</Text>
          <Text style={s.emptySub}>Create routes first using Smart Routes, or wait for the system to auto-create them at 12 AM.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.sectionHeader}>
            <LinearGradient colors={[P.main, P.dark]} style={s.sectionAccentPill}>
              <Ionicons name="git-merge-outline" size={13} color={P.white} />
            </LinearGradient>
            <Text style={s.sectionTitle}>Driver Assignment</Text>
            {autoProcessedCount > 0 && (
              <View style={s.autoCountPill}>
                <Ionicons name="hardware-chip-outline" size={11} color={P.auto} />
                <Text style={s.autoCountTxt}>{autoProcessedCount} Auto</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => { loadRoutes(); loadDrivers(); }} style={s.headerRefreshBtn}>
              <Ionicons name="refresh-outline" size={16} color={P.main} />
            </TouchableOpacity>
          </View>

          {routes.map(route => <RouteCard key={route._id} route={route} />)}
          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  statsBar: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12,
  },
  statTile: {
    flex: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', gap: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
    }),
  },
  statIconWrap: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  statVal: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  scroll:            { paddingHorizontal: 14, paddingTop: 16 },
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  sectionAccentPill: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:      { flex: 1, fontSize: 17, fontWeight: '900', color: P.ink, letterSpacing: -0.3 },
  headerRefreshBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: P.light, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },

  // NEW: auto count pill in section header
  autoCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.autoBg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: P.autoBorder },
  autoCountTxt:  { fontSize: 11, fontWeight: '800', color: P.auto },

  loaderBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loaderRing: { width: 60, height: 60, borderRadius: 30, backgroundColor: P.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },
  loaderTxt:  { fontSize: 13, color: P.textMuted, fontWeight: '500' },

  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconBox:{ width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: P.border },
  emptyTitle:  { fontSize: 17, fontWeight: '800', color: P.textDark, marginBottom: 6 },
  emptySub:    { fontSize: 13, color: P.textMuted, textAlign: 'center', lineHeight: 20 },

  // AI suggestion card
  aiCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: P.aiBg, borderRadius: 14, padding: 12, marginBottom: 14,
    borderWidth: 1.5, borderColor: P.aiBorder,
    ...Platform.select({
      ios:     { shadowColor: P.ai, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  aiIconBox:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  aiTitle:        { fontSize: 10, fontWeight: '800', color: P.ai, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  aiName:         { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 4 },
  aiReason:       { fontSize: 11, color: P.textLight, lineHeight: 17 },
  aiAssignBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.ai, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', marginLeft: 8 },
  aiAssignBtnTxt: { color: P.white, fontWeight: '800', fontSize: 12 },
  aiBestBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: P.ai, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  aiBestTxt:      { color: P.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  // ── NEW: Auto-processed styles ──────────────────────────────────
  autoBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: P.autoBg, paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: P.autoBorder,
  },
  autoBannerTxt: { fontSize: 11, color: P.auto, fontWeight: '600', flex: 1, lineHeight: 16 },

  autoDetailCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: P.autoBg, borderRadius: 14, padding: 12, marginBottom: 14,
    borderWidth: 1.5, borderColor: P.autoBorder,
    ...Platform.select({
      ios:     { shadowColor: P.auto, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  autoDetailIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  autoDetailTitle: { fontSize: 12, fontWeight: '800', color: P.auto, marginBottom: 6, letterSpacing: 0.3 },
  autoDetailBody:  { fontSize: 11, color: P.textLight, lineHeight: 17 },
  autoDetailTime:  { fontSize: 10, color: P.textMuted, marginTop: 6, fontStyle: 'italic' },

  reAssignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: P.autoBg, borderRadius: 10, padding: 10, marginTop: 6,
    borderWidth: 1, borderColor: P.autoBorder,
  },
  reAssignBtnTxt: { fontSize: 12, color: P.auto, fontWeight: '700' },
  // ────────────────────────────────────────────────────────────────

  // Route card
  routeCard: {
    backgroundColor: P.cardBg, borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#1A2B1C', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  routeCardAssigned: { borderColor: P.success + '55' },
  routeCardAuto:     { borderColor: P.success + '55' },   // subtle green border

  routeHeader:   { flexDirection: 'row', alignItems: 'center', padding: 14 },
  routeIconBox:  { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  routeName:     { fontSize: 14, fontWeight: '800', color: P.ink, marginBottom: 5, letterSpacing: -0.2 },
  routeMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeMetaTxt:  { fontSize: 11, color: P.textMuted, fontWeight: '500' },
  dot:           { width: 3, height: 3, borderRadius: 1.5, backgroundColor: P.border },

  assignedPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.main, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 6 },
  assignedPillAuto: { backgroundColor: P.auto },   // NEW
  assignedPillTxt:  { color: P.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  statusBadgeAuto: { backgroundColor: P.autoBg, borderColor: P.autoBorder },   // NEW
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  statusTxt:       { fontSize: 11, fontWeight: '700' },

  routeBody:       { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: P.divider },
  sectionRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginBottom: 10 },
  bodySectionTitle:{ fontSize: 10, fontWeight: '800', color: P.textMuted, letterSpacing: 1.2 },
  countBadge:      { backgroundColor: P.main, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeTxt:   { color: P.white, fontWeight: '800', fontSize: 11 },
  bodyDivider:     { height: 1, backgroundColor: P.divider, marginVertical: 14 },

  passengerGrid:   { gap: 8 },
  passengerChip:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: P.bg, borderRadius: 11, padding: 10, borderWidth: 1, borderColor: P.border },
  passengerIdx:    { width: 24, height: 24, borderRadius: 7, backgroundColor: P.main, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  passengerIdxTxt: { color: P.white, fontWeight: '800', fontSize: 11 },
  passengerName:   { fontSize: 13, fontWeight: '700', color: P.textDark },
  passengerAddr:   { fontSize: 11, color: P.textMuted },
  vehiclePrefBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: P.aiBg, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3, borderWidth: 1, borderColor: P.aiBorder },
  vehiclePrefTxt:  { fontSize: 10, color: P.ai, fontWeight: '700' },

  togglePills:  { flexDirection: 'row', gap: 6 },
  pill:         { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: P.bg, borderWidth: 1, borderColor: P.border },
  pillActive:   { backgroundColor: P.main, borderColor: P.main },
  pillTxt:      { fontSize: 11, fontWeight: '600', color: P.textLight },
  pillTxtActive:{ color: P.white },

  emptyDrivers:    { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyDriversIcon:{ width: 54, height: 54, borderRadius: 27, backgroundColor: P.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: P.border },
  emptyDriversTxt: { fontSize: 13, color: P.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  refreshBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: P.border, backgroundColor: P.white },
  refreshBtnTxt:   { fontSize: 12, color: P.main, fontWeight: '700' },

  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: P.bg, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1.5, borderColor: P.border,
  },
  driverCardActive: { borderColor: P.main, backgroundColor: '#EDF2ED' },
  driverCardBest:   { borderColor: P.ai,   backgroundColor: '#E8EAF6' },

  driverAvatar:    { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  driverAvatarTxt: { fontWeight: '900', fontSize: 17, color: P.white },

  driverName:    { fontSize: 14, fontWeight: '800', color: P.ink, letterSpacing: -0.2 },
  driverVehicle: { fontSize: 11, color: P.textMuted, fontWeight: '500' },

  vehicleMatchBadge:{ borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, marginLeft: 4 },
  vehicleMatchTxt:  { fontSize: 9, fontWeight: '800' },

  availRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availTxt: { fontSize: 11, fontWeight: '600' },

  scoreRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  scoreLbl:    { fontSize: 10, color: P.textMuted, fontWeight: '600', width: 55 },
  scoreBarBg:  { flex: 1, height: 5, backgroundColor: P.border, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:{ height: '100%', borderRadius: 3 },
  scoreVal:    { fontSize: 10, fontWeight: '800', color: P.textDark, width: 22, textAlign: 'right' },

  currentBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: P.main, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  currentBadgeTxt: { color: P.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.main, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    ...Platform.select({
      ios:     { shadowColor: P.main, shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
    }),
  },
  assignBtnBest:   { backgroundColor: P.ai },
  assignBtnCurrent:{ backgroundColor: P.dark },
  assignBtnDim:    { backgroundColor: P.textMuted },
  assignBtnTxt:    { color: P.white, fontWeight: '800', fontSize: 12, letterSpacing: 0.2 },
});