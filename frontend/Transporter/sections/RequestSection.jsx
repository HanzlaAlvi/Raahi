// frontend/Transporter/sections/RequestSection.js
//
// FIX SUMMARY:
// 1. `type` prop → replaced with `tab` + `setTab` (matches TransporterDashboard props)
// 2. Driver / Passenger toggle rendered INSIDE this component (with badge counts)
// 3. 2-layer card structure: cardOuter (border+shadow) + cardInner (overflow:hidden)
//    → fixes right-side content clipping on Android
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, Alert, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { api }           from '../services/ApiService';
import { VEHICLE_INFO }  from '../constants/vehicles';

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  white:     '#FFFFFF',
  bg:        '#F5F7F5',
  cardBg:    '#FFFFFF',
  light:     '#EDF1ED',
  border:    '#C5D0C5',
  textDark:  '#1A2218',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  success:   '#2E7D32',
  successBg: '#E8F5E9',
};

const initials = (name = '') =>
  (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

// ── Detail row ────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value }) => (
  <View style={s.detailRow}>
    <View style={s.detailIconBox}>
      <Ionicons name={icon} size={13} color={P.main} />
    </View>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={s.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ── Single request card ───────────────────────────────────────────
const RequestCard = ({ req, isDriver, onAccept, onReject, isProcessing }) => {
  const name        = req.name || req.fullName || (isDriver ? 'Driver' : 'Passenger');
  const vehicleInfo = VEHICLE_INFO[req.vehicleType || req.vehicle_type] || null;
  const prefInfo    = VEHICLE_INFO[req.vehiclePreference || req.vehicle_preference] || null;
  const accentColor = isDriver ? P.dark : P.main;

  return (
    // 2-layer card:
    // cardOuter → border + shadow  (NO overflow:hidden — avoids Android border-clip bug)
    // cardInner → overflow:hidden  (clips accent bar to rounded corners)
    <View style={s.cardOuter}>
      <View style={s.cardInner}>

        {/* Left accent bar — flex child, NOT position:absolute */}
        <View style={[s.cardAccent, { backgroundColor: accentColor }]} />

        {/* Content */}
        <View style={s.cardBody}>

          {/* Header */}
          <View style={s.cardHeader}>
            <View style={[s.avatar, { backgroundColor: accentColor }]}>
              <Text style={s.avatarTxt}>{initials(name)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.name}>{name}</Text>
              <View style={[s.typeBadge, { backgroundColor: isDriver ? '#E8EAF6' : P.light }]}>
                <Ionicons
                  name={isDriver ? 'car-sport-outline' : 'person-outline'}
                  size={11}
                  color={isDriver ? '#3949AB' : P.main}
                />
                <Text style={[s.typeBadgeTxt, { color: isDriver ? '#3949AB' : P.main }]}>
                  {isDriver ? 'Driver Request' : 'Passenger Request'}
                </Text>
              </View>
            </View>
          </View>

          {/* Detail rows */}
          <View style={s.details}>
            {req.email       && <DetailRow icon="mail-outline"     label="Email"        value={req.email}       />}
            {req.phone       && <DetailRow icon="call-outline"     label="Phone"        value={req.phone}       />}
            {req.license     && <DetailRow icon="id-card-outline"  label="License"      value={req.license}     />}
            {req.pickupPoint && <DetailRow icon="location-outline" label="Pickup Point" value={req.pickupPoint} />}
            {req.destination && <DetailRow icon="flag-outline"     label="Destination"  value={req.destination} />}
          </View>

          {/* Vehicle type — driver */}
          {vehicleInfo && (
            <View style={s.vehicleBox}>
              <View style={s.vehicleIconBox}>
                <Ionicons name={vehicleInfo.icon} size={22} color={P.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.vehicleLabel}>VEHICLE TYPE</Text>
                <Text style={s.vehicleValue}>{vehicleInfo.label} — {vehicleInfo.desc}</Text>
              </View>
              <View style={s.vehicleCapBadge}>
                <Text style={s.vehicleCapTxt}>{vehicleInfo.capacity} seats</Text>
              </View>
            </View>
          )}

          {/* Vehicle preference — passenger */}
          {prefInfo && (
            <View style={[s.vehicleBox, { backgroundColor: P.successBg, borderColor: P.success + '40' }]}>
              <View style={[s.vehicleIconBox, { backgroundColor: P.successBg }]}>
                <Ionicons name={prefInfo.icon} size={22} color={P.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.vehicleLabel, { color: P.success }]}>
                  {prefInfo.label === 'Car' ? 'PREFERENCE — STRICT' : 'PREFERENCE — FLEXIBLE'}
                </Text>
                <Text style={[s.vehicleValue, { color: P.success }]}>
                  {prefInfo.label === 'Car'
                    ? 'Car only — never reassigned'
                    : `${prefInfo.label} preferred — may flex`}
                </Text>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.rejectBtn}
              onPress={onReject}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={16} color={P.white} />
              <Text style={s.rejectTxt}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.acceptBtn, isProcessing && { opacity: 0.6 }]}
              onPress={onAccept}
              disabled={isProcessing}
              activeOpacity={0.85}
            >
              {isProcessing
                ? <ActivityIndicator size="small" color={P.white} />
                : <>
                    <Ionicons name="checkmark" size={16} color={P.white} />
                    <Text style={s.acceptTxt}>Accept</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </View>
  );
};

// ── MAIN SECTION ──────────────────────────────────────────────────
// Props from TransporterDashboard:
//   driverReqs, passReqs  — arrays from api.getDriverRequests / getPassengerRequests
//   tab, setTab           — 'driver' | 'passenger'  (controlled by parent)
//   refreshing, onRefresh, loadAll
// ─────────────────────────────────────────────────────────────────
const RequestSection = ({ driverReqs = [], passReqs = [], tab, setTab, refreshing, onRefresh, loadAll }) => {
  const [processing, setProcessing] = useState(null);

  const isDriver = tab === 'driver';
  const list     = isDriver ? driverReqs : passReqs;

  // ── Accept ────────────────────────────────────────────────────
  const accept = async (req) => {
    setProcessing(req._id);
    try {
      isDriver
        ? await api.approveDriverRequest(req._id)
        : await api.approvePassengerRequest(req._id);
      await loadAll();
      Alert.alert('Accepted ✅', `${req.name || req.fullName || 'Request'} has been approved.`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Something went wrong');
    } finally {
      setProcessing(null);
    }
  };

  // ── Reject ────────────────────────────────────────────────────
  const reject = (req) =>
    Alert.alert(
      'Reject Request?',
      `Reject request from ${req.name || req.fullName || 'this person'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive',
          onPress: async () => {
            setProcessing(req._id);
            try {
              isDriver
                ? await api.rejectDriverRequest(req._id)
                : await api.rejectPassengerRequest(req._id);
              await loadAll();
            } catch (e) {
              Alert.alert('Error', e.message || 'Something went wrong');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>

      {/* ── Driver / Passenger Toggle ── */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'driver' && s.tabBtnActive]}
          onPress={() => setTab('driver')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="car-sport-outline"
            size={15}
            color={tab === 'driver' ? P.white : P.main}
          />
          <Text style={[s.tabTxt, tab === 'driver' && s.tabTxtActive]}>
            Driver
          </Text>
          {driverReqs.length > 0 && (
            <View style={[s.tabBadge, tab === 'driver' ? s.tabBadgeActive : s.tabBadgeInactive]}>
              <Text style={[s.tabBadgeTxt, tab === 'driver' && { color: P.main }]}>
                {driverReqs.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.tabBtn, tab === 'passenger' && s.tabBtnActive]}
          onPress={() => setTab('passenger')}
          activeOpacity={0.85}
        >
          <Ionicons
            name="people-outline"
            size={15}
            color={tab === 'passenger' ? P.white : P.main}
          />
          <Text style={[s.tabTxt, tab === 'passenger' && s.tabTxtActive]}>
            Passenger
          </Text>
          {passReqs.length > 0 && (
            <View style={[s.tabBadge, tab === 'passenger' ? s.tabBadgeActive : s.tabBadgeInactive]}>
              <Text style={[s.tabBadgeTxt, tab === 'passenger' && { color: P.main }]}>
                {passReqs.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[P.main]}
            tintColor={P.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Section heading */}
        <View style={s.sectionHeader}>
          <View style={s.sectionAccent} />
          <Text style={s.sectionTitle}>
            Pending {isDriver ? 'Driver' : 'Passenger'} Requests
          </Text>
          {list.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeTxt}>{list.length}</Text>
            </View>
          )}
        </View>

        {list.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconBox}>
              <Ionicons
                name={isDriver ? 'car-outline' : 'person-outline'}
                size={40}
                color={P.main}
              />
            </View>
            <Text style={s.emptyTitle}>No pending requests</Text>
            <Text style={s.emptySub}>
              {isDriver
                ? 'No drivers waiting to join.'
                : 'No passengers waiting to join.'}
            </Text>
          </View>
        ) : (
          list.map((req, i) => (
            <RequestCard
              key={req._id || i}
              req={req}
              isDriver={isDriver}
              onAccept={() => accept(req)}
              onReject={() => reject(req)}
              isProcessing={processing === req._id}
            />
          ))
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default RequestSection;

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // ── Tab toggle ──────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 4,
    backgroundColor: P.white,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: P.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabBtnActive: {
    backgroundColor: P.main,
  },
  tabTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: P.main,
  },
  tabTxtActive: {
    color: P.white,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive:   { backgroundColor: P.white },
  tabBadgeInactive: { backgroundColor: P.main },
  tabBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: P.white,
  },

  // ── Section header ──────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14 },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: P.main, marginRight: 10 },
  sectionTitle:  { flex: 1, fontSize: 16, fontWeight: '900', color: P.dark },
  countBadge:    { backgroundColor: P.main, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeTxt: { color: P.white, fontSize: 12, fontWeight: '800' },

  // ── 2-layer card ────────────────────────────────────────────────
  // cardOuter: border + shadow, NO overflow:hidden
  cardOuter: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.cardBg,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
    }),
  },
  // cardInner: clips accent bar flush to rounded corners
  cardInner: {
    borderRadius: 15,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: P.cardBg,
  },
  // Accent bar: 4px wide, full height via flexDirection:'row' parent
  cardAccent: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },

  // Header
  cardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:    { color: P.white, fontSize: 16, fontWeight: '800' },
  name:         { fontSize: 16, fontWeight: '800', color: P.textDark, marginBottom: 5 },
  typeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '700' },

  // Detail rows
  details:       { gap: 8, marginBottom: 12 },
  detailRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIconBox: { width: 28, height: 28, borderRadius: 8, backgroundColor: P.light, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailLabel:   { fontSize: 12, color: P.textLight, fontWeight: '600', width: 90 },
  detailValue:   { fontSize: 13, color: P.textDark, fontWeight: '500', flex: 1 },

  // Vehicle box
  vehicleBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: P.light, borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: P.border,
  },
  vehicleIconBox:  { width: 42, height: 42, borderRadius: 11, backgroundColor: P.white, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vehicleLabel:    { fontSize: 9, fontWeight: '800', color: P.textMuted, letterSpacing: 1.2, marginBottom: 3 },
  vehicleValue:    { fontSize: 13, fontWeight: '600', color: P.textDark },
  vehicleCapBadge: { backgroundColor: P.white, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: P.border },
  vehicleCapTxt:   { fontSize: 11, fontWeight: '700', color: P.main },

  // Actions
  actions:   { flexDirection: 'row', gap: 10, marginTop: 4 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 11, backgroundColor: '#6B7280',
  },
  rejectTxt: { color: P.white, fontSize: 14, fontWeight: '700' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 11, backgroundColor: P.main,
  },
  acceptTxt: { color: P.white, fontSize: 14, fontWeight: '700' },

  // Empty state
  empty:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: P.cardBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: P.border, marginBottom: 14,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: P.dark, marginBottom: 5 },
  emptySub:   { fontSize: 13, color: P.textMuted, textAlign: 'center' },
});