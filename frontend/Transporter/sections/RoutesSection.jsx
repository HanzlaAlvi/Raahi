// frontend/Transporter/sections/RoutesSection.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VEHICLE_INFO } from '../constants/vehicles';
import { prefLabel } from '../utils/formatters';
import { isToday } from '../utils/geo';
import { getAssignedDriverName } from '../utils/driverHelpers';
import FuelBadge from '../components/FuelBadge';
import { PK_FUEL } from '../constants/fuels';

const P = {
  main: '#415844',
  dark: '#2D3E2F',
  white: '#FFFFFF',
  bg: '#F5F7F5',
  cardBg: '#FFFFFF',
  light: '#EDF1ED',
  border: '#C5D0C5',
  divider: '#E5EBE5',
  textDark: '#1A2218',
  textMid: '#374151',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  success: '#2E7D32',
  successBg: '#E8F5E9',
  error: '#C62828',
  errorBg: '#FFEBEE',
  warn: '#E65100',
  warnBg: '#FFF3E0',
  auto: '#415844',
  autoBg: '#EDF1ED',
  autoBorder: '#C5D0C5',
};

const statusStyle = (status) => {
  if (status === 'active' || status === 'in_progress')
    return { color: P.success, bg: P.successBg, accent: P.success };
  if (status === 'unassigned' || status === 'pending')
    return { color: P.warn, bg: P.warnBg, accent: P.warn };
  if (status === 'assigned')
    return { color: P.main, bg: P.light, accent: P.main };
  if (status === 'missed')
    return { color: P.error, bg: P.errorBg, accent: P.error };
  return { color: P.textMuted, bg: '#F3F4F6', accent: P.textMuted };
};

const initials = (name = '') =>
  (name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

/* ── Auto-assign top banner ─────────────────────────────── */
const AutoAssignBanner = ({ count }) => (
  <View style={s.autoBanner}>
    <View style={s.autoBannerIcon}>
      <Ionicons name="hardware-chip-outline" size={18} color={P.main} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.autoBannerTitle}>System Auto-Assigned</Text>
      <Text style={s.autoBannerSub}>
        {count} route{count !== 1 ? 's were' : ' was'} automatically assigned by the system
        because no manual assignment was made before midnight.
      </Text>
    </View>
  </View>
);

/* ── Small inline chip ──────────────────────────────────── */
const AutoBadge = () => (
  <View style={s.autoBadge}>
    <Ionicons name="hardware-chip-outline" size={10} color={P.main} />
    <Text style={s.autoBadgeTxt}>System Assigned</Text>
  </View>
);

/* ════════════════════════════════════════════════════════
   Main Section
════════════════════════════════════════════════════════ */
const RoutesSection = ({ routes, drivers, refreshing, onRefresh, nav }) => {
  const [dateFilter, setDateFilter] = useState('today');
  const [expandedRoute, setExpandedRoute] = useState(null);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const filtered = useMemo(() => {
    if (dateFilter === 'today') {
      return routes.filter(r => {
        const d = r.date || r.createdAt || r.pickupDate;
        if (!d) return true;
        try { return isToday(d); } catch { return false; }
      });
    }
    if (dateFilter === 'auto') return routes.filter(r => r.autoAssigned === true);
    return routes;
  }, [routes, dateFilter]);

  const autoAssignedCount = filtered.filter(r => r.autoAssigned).length;

  /* ── Navigate to assign screen, optionally pre-selecting a route ── */
  const goToAssign = (route) => {
    nav('assign', { routeId: route?._id, routeName: route?.name || route?.routeName });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={s.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          colors={[P.main]} tintColor={P.main} />
      }
      showsVerticalScrollIndicator={false}
    >

      {/* ── Filter tabs ─────────────────────────────────── */}
      <View style={s.tabs}>
        {[
          { id: 'today', label: `Today (${todayLabel})`, icon: 'today-outline' },
          { id: 'all', label: 'All Routes', icon: 'time-outline' },
          { id: 'auto', label: 'Auto-Assigned', icon: 'hardware-chip-outline' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, dateFilter === t.id && s.tabActive]}
            onPress={() => setDateFilter(t.id)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={t.icon}
              size={13}
              color={dateFilter === t.id ? P.white : P.textLight}
            />
            <Text
              style={[s.tabTxt, dateFilter === t.id && s.tabTxtActive]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Auto banner ─────────────────────────────────── */}
      {autoAssignedCount > 0 && dateFilter !== 'auto' && (
        <AutoAssignBanner count={autoAssignedCount} />
      )}

      {/* ── Section heading ─────────────────────────────── */}
      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>
          {dateFilter === 'today' ? "Today's" : dateFilter === 'auto' ? 'Auto-Assigned' : 'All'}
          {' '}Routes ({filtered.length})
        </Text>
        {dateFilter === 'today' && routes.length > filtered.length && (
          <Text style={s.olderNote}>{routes.length - filtered.length} older</Text>
        )}
      </View>

      {/* ── Empty state ─────────────────────────────────── */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIconBox}>
            <Ionicons
              name={dateFilter === 'today' ? 'calendar-outline' : dateFilter === 'auto' ? 'hardware-chip-outline' : 'map-outline'}
              size={40} color={P.main}
            />
          </View>
          <Text style={s.emptyTitle}>
            {dateFilter === 'auto' ? 'No Auto-Assigned Routes' : 'No routes found'}
          </Text>
          <Text style={s.emptySub}>
            {dateFilter === 'today'
              ? 'No routes for today. Switch to "All Routes" to see history.'
              : dateFilter === 'auto'
                ? 'All routes were manually assigned. Great job!'
                : 'Generate routes via Smart Routes.'}
          </Text>
        </View>
      ) : filtered.map((route, i) => {

        const vi = VEHICLE_INFO[route.vehicleType] || VEHICLE_INFO.van;
        const sc = statusStyle(route.status);
        const routeDate = route.date || route.createdAt || route.pickupDate;
        const isExp = expandedRoute === (route._id || i);
        const driverName = getAssignedDriverName(route.assignedDriver, drivers);
        const hasDriver = !!route.assignedDriver;
        const isAuto = !!route.autoAssigned;

        const passengerPrefs = (route.passengers || []).reduce((acc, p) => {
          const pref = p?.vehiclePreference || p?.preference || 'auto';
          acc[pref] = (acc[pref] || 0) + 1;
          return acc;
        }, {});

        return (
          <View
            key={route._id || i}
            style={[s.card, { borderLeftColor: sc.accent }, isAuto && s.cardAuto]}
          >

            {/* ── Auto strip ── */}
            {isAuto && (
              <View style={s.autoStrip}>
                <Ionicons name="hardware-chip-outline" size={12} color={P.main} />
                <Text style={s.autoStripTxt}>
                  System Auto-Assigned
                  {route.autoAssignedAt
                    ? ` · ${new Date(route.autoAssignedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Text>
              </View>
            )}

            {/* ── Card header ── */}
            <View style={s.cardHeader}>
              <View style={[s.vehicleIconBox, { backgroundColor: sc.bg }]}>
                <Ionicons name={vi.icon} size={20} color={sc.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.routeName} numberOfLines={2}>
                  {route.name || route.routeName || `Route ${i + 1}`}
                </Text>
                <View style={s.badgeRow}>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusBadgeTxt, { color: sc.color }]}>
                      {route.status || 'unassigned'}
                    </Text>
                  </View>
                  {isAuto && <AutoBadge />}
                  {routeDate && (() => {
                    const d = new Date(routeDate);
                    const today = isToday(routeDate);
                    return (
                      <View style={[s.dateBadge, { backgroundColor: today ? P.light : '#F3F4F6' }]}>
                        <Ionicons name="calendar-outline" size={11} color={today ? P.main : P.textMuted} />
                        <Text style={[s.dateBadgeTxt, { color: today ? P.main : P.textMuted }]}>
                          {today ? 'Today' : !isNaN(d) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>

            {/* ── Info rows ── */}
            <View style={s.infoRows}>
              {route.startPoint && <InfoRow icon="location-outline" value={route.startPoint} />}
              {route.destination && <InfoRow icon="flag-outline" value={route.destination} />}
              {route.pickupTime && <InfoRow icon="time-outline" value={route.pickupTime} />}
              {route.estimatedKm && (
                <InfoRow icon="speedometer-outline"
                  value={`${route.estimatedKm}  ·  ${route.estimatedTime || ''}`} />
              )}

              {/* ── Assigned driver row — tappable to go to assign screen ── */}
              {hasDriver && driverName && (
                <TouchableOpacity
                  onPress={() => goToAssign(route)}
                  activeOpacity={0.7}
                  style={s.driverRow}
                >
                  <Ionicons
                    name={isAuto ? 'hardware-chip-outline' : 'person-outline'}
                    size={14}
                    color={P.success}
                  />
                  <Text style={s.driverRowTxt} numberOfLines={1}>
                    {isAuto ? `Auto-Assigned: ${driverName}` : `Driver: ${driverName}`}
                  </Text>
                  <View style={s.driverChangePill}>
                    <Ionicons name="swap-horizontal-outline" size={11} color={P.main} />
                    <Text style={s.driverChangePillTxt}>Change</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Passenger preferences ── */}
            {Object.keys(passengerPrefs).length > 0 && (
              <View style={s.prefBox}>
                <Text style={s.prefBoxLabel}>PASSENGER PREFERENCES</Text>
                <View style={s.prefChips}>
                  {Object.entries(passengerPrefs).map(([pref, cnt]) => (
                    <View key={pref} style={s.prefChip}>
                      <Ionicons
                        name={pref === 'car' ? 'car-outline' : pref === 'bus' ? 'bus-outline' : 'shuffle-outline'}
                        size={11} color={P.main}
                      />
                      <Text style={s.prefChipTxt}>{prefLabel(pref, cnt)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Fuel badge ── */}
            {route.estimatedFuel && (
              <FuelBadge
                fuelType={route.fuelType || PK_FUEL.fuelType[route.vehicleType] || 'petrol'}
                fuelCostPKR={route.fuelCostPKR}
                estimatedFuel={route.estimatedFuel}
                estimatedKm={route.estimatedKm}
                vehicleType={route.vehicleType || 'van'}
              />
            )}

            {/* ── Passengers toggle ── */}
            {(route.passengers || []).length > 0 && (
              <TouchableOpacity
                style={s.toggleRow}
                onPress={() => setExpandedRoute(isExp ? null : (route._id || i))}
                activeOpacity={0.75}
              >
                <Ionicons name="people-outline" size={14} color={P.main} />
                <Text style={s.toggleTxt}>Passengers ({route.passengers.length})</Text>
                <Ionicons
                  name={isExp ? 'chevron-up' : 'chevron-down'}
                  size={18} color={P.main}
                  style={{ marginLeft: 'auto' }}
                />
              </TouchableOpacity>
            )}

            {/* ── Expanded passengers ── */}
            {isExp && (route.passengers || []).map((p, pi) => (
              <View key={pi}
                style={[s.paxRow, pi === route.passengers.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={s.paxAvatar}>
                  <Text style={s.paxAvatarTxt}>{initials(p.passengerName || p.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.paxName}>{p.passengerName || p.name || 'Passenger'}</Text>
                  {(p.pickupPoint || p.pickupAddress) && (
                    <Text style={s.paxAddr} numberOfLines={1}>
                      {p.pickupPoint || p.pickupAddress}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            {/* ── Assign CTA — shown when unassigned and not auto ── */}
            {route.status === 'unassigned' && !isAuto && (
              <TouchableOpacity
                style={s.assignBtn}
                onPress={() => goToAssign(route)}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={15} color={P.white} />
                <Text style={s.assignBtnTxt}>Assign Driver</Text>
              </TouchableOpacity>
            )}

            {/* ── Change driver CTA (auto-assigned) ── */}
            {isAuto && (
              <TouchableOpacity
                style={s.reassignBtn}
                onPress={() => goToAssign(route)}
                activeOpacity={0.85}
              >
                <Ionicons name="swap-horizontal-outline" size={15} color={P.main} />
                <Text style={s.reassignBtnTxt}>Change Driver</Text>
              </TouchableOpacity>
            )}

          </View>
        );
      })}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const InfoRow = ({ icon, value, color, bold }) => (
  <View style={s.infoRow}>
    <Ionicons name={icon} size={14} color={color || P.main} />
    <Text style={[s.infoRowTxt, color && { color }, bold && { fontWeight: '700' }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default RoutesSection;

/* ════════════════════════════════════════════════════════
   Styles
════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: P.border,
    backgroundColor: P.white,
  },
  tabActive: { backgroundColor: P.main, borderColor: P.main },
  tabTxt: {
    fontSize: 10,
    fontWeight: '600',
    color: P.textLight,
    textAlign: 'center',
    lineHeight: 13,
  },
  tabTxtActive: { color: P.white },

  /* ── Auto banner ── */
  autoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: P.autoBg,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: P.autoBorder,
  },
  autoBannerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: P.white,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  autoBannerTitle: { fontSize: 13, fontWeight: '800', color: P.main, marginBottom: 2 },
  autoBannerSub: { fontSize: 11, color: P.dark, lineHeight: 16 },

  /* ── Section header ── */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16, marginBottom: 12,
  },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: P.main, marginRight: 10 },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: P.dark },
  olderNote: { fontSize: 12, color: P.textMuted },

  /* ── Empty ── */
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: P.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: P.border, marginBottom: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: P.dark, marginBottom: 5 },
  emptySub: { fontSize: 13, color: P.textMuted, textAlign: 'center', lineHeight: 19 },

  /* ── Card ── */
  card: {
    backgroundColor: P.cardBg, marginHorizontal: 16, borderRadius: 16,
    padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: P.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  cardAuto: {
    borderColor: P.autoBorder,
    ...Platform.select({
      ios: { shadowColor: P.main, shadowOpacity: 0.1 },
      android: { elevation: 4 },
    }),
  },

  /* ── Auto strip (top of auto card) ── */
  autoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.autoBg,
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
    marginBottom: 10, alignSelf: 'flex-start',
  },
  autoStripTxt: { fontSize: 10, fontWeight: '700', color: P.main, letterSpacing: 0.3 },

  /* ── Auto badge ── */
  autoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: P.autoBg,
    borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: P.autoBorder,
  },
  autoBadgeTxt: { fontSize: 10, fontWeight: '700', color: P.main },

  /* ── Card header ── */
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  vehicleIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  routeName: { fontSize: 14, fontWeight: '700', color: P.textDark, marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dateBadgeTxt: { fontSize: 11, fontWeight: '600' },

  /* ── Info rows ── */
  infoRows: { gap: 7, marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoRowTxt: { fontSize: 13, color: P.textMid, flex: 1 },

  /* ── Driver row (tappable) ── */
  driverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: P.successBg,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#A5D6A7',
  },
  driverRowTxt: {
    flex: 1, fontSize: 13, fontWeight: '700', color: P.success,
  },
  driverChangePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: P.light,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: P.autoBorder,
  },
  driverChangePillTxt: { fontSize: 10, fontWeight: '700', color: P.main },

  /* ── Prefs ── */
  prefBox: { backgroundColor: P.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: P.border, marginBottom: 10 },
  prefBoxLabel: { fontSize: 9, fontWeight: '800', color: P.textMuted, letterSpacing: 1.2, marginBottom: 6 },
  prefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  prefChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.light, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  prefChipTxt: { fontSize: 11, fontWeight: '600', color: P.main },

  /* ── Toggle ── */
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: P.divider, marginTop: 4,
  },
  toggleTxt: { fontSize: 13, fontWeight: '700', color: P.main },

  /* ── Passengers ── */
  paxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.divider },
  paxAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.light, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  paxAvatarTxt: { fontSize: 11, fontWeight: '800', color: P.main },
  paxName: { fontSize: 13, fontWeight: '700', color: P.textDark },
  paxAddr: { fontSize: 11, color: P.textLight, marginTop: 2 },

  /* ── Buttons ── */
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: P.main, borderRadius: 11, paddingVertical: 11, marginTop: 10,
  },
  assignBtnTxt: { color: P.white, fontSize: 13, fontWeight: '700' },

  reassignBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: P.autoBg, borderRadius: 11, paddingVertical: 10, marginTop: 10,
    borderWidth: 1.5, borderColor: P.autoBorder,
  },
  reassignBtnTxt: { color: P.main, fontSize: 13, fontWeight: '700' },
});