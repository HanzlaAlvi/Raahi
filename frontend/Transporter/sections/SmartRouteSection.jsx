// frontend/Transporter/sections/SmartRouteSection.js
import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { Ionicons }  from '@expo/vector-icons';
import { VEHICLE_INFO } from '../constants/vehicles';
import { prefLabel, fmtPKR } from '../utils/formatters';
import SmartRouteCard  from '../components/SmartRouteCard';
import OverallMapView  from '../components/OverallMapView';

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  white:     '#FFFFFF',
  bg:        '#F5F7F5',
  cardBg:    '#FFFFFF',
  light:     '#EDF1ED',
  border:    '#C5D0C5',
  divider:   '#E5EBE5',
  textDark:  '#1A2218',
  textMid:   '#374151',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  warn:      '#E65100',
};

const SmartRouteSection = ({
  smartResults = [],          // ✅ Dashboard ab yeh naam se pass karta hai
  optimizing,
  optimizeStatus,
  confirmingIdx,
  refreshing,                 // ✅ Pull-to-refresh ke liye
  onRefresh,
  nav,                        // ✅ Poll tab pe jaane ke liye
  handleConfirmRoute,         // ✅ Route save karne ke liye
  handleDiscardRoute,         // ✅ Route hatane ke liye
}) => {
  const [showMap, setShowMap] = useState(false);

  const vehicleBreakdown = useMemo(() => {
    const map = {};
    smartResults.forEach(r => { const v = r.vehicleType || 'van'; map[v] = (map[v] || 0) + 1; });
    return map;
  }, [smartResults]);

  const prefBreakdown = useMemo(() => {
    const map = {};
    smartResults.forEach(r => {
      (r.passengers || []).forEach(p => {
        const pref = p.vehiclePreference || 'auto';
        map[pref] = (map[pref] || 0) + 1;
      });
    });
    return map;
  }, [smartResults]);

  const totalPax  = smartResults.reduce((s, r) => s + (r.passengerCount || 0), 0);
  const totalFuel = smartResults.reduce((s, r) => s + (r.rawFuelCostPKR  || 0), 0);
  const uniqueDests = [...new Set(smartResults.map(r => r.destination).filter(Boolean))].length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: P.bg }}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.main]} tintColor={P.main} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Map overlay ─────────────────────────────────── */}
      {showMap && smartResults.length > 0 && (
        <OverallMapView routes={smartResults} onClose={() => setShowMap(false)} />
      )}

      {/* ── Optimizing banner ─────────────────────────── */}
      {optimizing && (
        <View style={s.optimizingBanner}>
          <ActivityIndicator size="small" color={P.white} />
          <Text style={s.optimizingTxt}>{optimizeStatus || 'Optimizing routes…'}</Text>
        </View>
      )}

      {/* ── Empty state ─────────────────────────────────── */}
      {smartResults.length === 0 && !optimizing && (
        <View style={s.emptyCard}>
          <View style={s.emptyIconBox}>
            <Ionicons name="flash-outline" size={40} color={P.main} />
          </View>
          <Text style={s.emptyTitle}>No Smart Routes Yet</Text>
          <Text style={s.emptySub}>
            Go to Availability Polls and tap "Optimize Routes" to generate routes from passenger responses.
          </Text>
          <TouchableOpacity style={s.goBtn} onPress={() => nav('poll')} activeOpacity={0.85}>
            <Ionicons name="bar-chart-outline" size={16} color={P.white} />
            <Text style={s.goBtnTxt}>Go to Polls</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary card ─────────────────────────────────── */}
      {smartResults.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <View style={s.sectionAccent} />
            <Text style={s.sectionTitle}>{smartResults.length} Optimized Route{smartResults.length !== 1 ? 's' : ''}</Text>
          </View>

          <View style={s.summaryCard}>
            {/* Stat row */}
            <View style={s.statRow}>
              <View style={s.statTile}>
                <Ionicons name="people-outline" size={16} color={P.main} />
                <Text style={s.statVal}>{totalPax}</Text>
                <Text style={s.statLbl}>Passengers</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statTile}>
                <Ionicons name="flag-outline" size={16} color={P.main} />
                <Text style={s.statVal}>{uniqueDests}</Text>
                <Text style={s.statLbl}>Destination{uniqueDests !== 1 ? 's' : ''}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statTile}>
                <Ionicons name="car-outline" size={16} color={P.main} />
                <Text style={s.statVal}>{smartResults.length}</Text>
                <Text style={s.statLbl}>Routes</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statTile}>
                <Ionicons name="flame-outline" size={16} color={P.warn} />
                <Text style={[s.statVal, { color: P.warn }]}>{fmtPKR(totalFuel)}</Text>
                <Text style={s.statLbl}>Fuel Cost</Text>
              </View>
            </View>

            {/* Vehicle distribution */}
            <View style={s.breakdownBox}>
              <Text style={s.breakdownLabel}>VEHICLE DISTRIBUTION</Text>
              <View style={s.chips}>
                {Object.entries(vehicleBreakdown).map(([vt, cnt]) => (
                  <View key={vt} style={s.chip}>
                    <Ionicons name={VEHICLE_INFO[vt]?.icon || 'bus-outline'} size={12} color={P.main} />
                    <Text style={s.chipTxt}>{cnt} {VEHICLE_INFO[vt]?.label || vt} route{cnt !== 1 ? 's' : ''}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Preference enforcement */}
            {Object.keys(prefBreakdown).length > 0 && (
              <View style={[s.breakdownBox, { marginTop: 8 }]}>
                <Text style={s.breakdownLabel}>PREFERENCE ENFORCEMENT</Text>
                <View style={s.chips}>
                  {Object.entries(prefBreakdown).map(([pref, cnt]) => (
                    <View key={pref} style={s.chip}>
                      <Ionicons
                        name={pref === 'car' ? 'car-outline' : pref === 'bus' ? 'bus-outline' : 'shuffle-outline'}
                        size={12} color={P.main}
                      />
                      <Text style={s.chipTxt}>{prefLabel(pref, cnt)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* View on map */}
            <TouchableOpacity style={s.mapBtn} onPress={() => setShowMap(true)} activeOpacity={0.85}>
              <Ionicons name="map-outline" size={16} color={P.main} />
              <Text style={s.mapBtnTxt}>View all routes on map</Text>
              <Ionicons name="chevron-forward" size={16} color={P.main} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>

          {/* ── Individual route cards ─────────────────── */}
          {smartResults.map((result, idx) => (
            <SmartRouteCard
              key={result.id || idx}
              result={result}
              onConfirm={() => handleConfirmRoute(result, idx)}
              onDiscard={() => handleDiscardRoute(idx)}
              isConfirming={confirmingIdx === idx}
            />
          ))}
        </>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

export default SmartRouteSection;

const s = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

  optimizingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, padding: 14, borderRadius: 14,
    backgroundColor: P.main,
  },
  optimizingTxt: { flex: 1, color: P.white, fontWeight: '700', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, backgroundColor: P.main, marginRight: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '900', color: P.dark },

  emptyCard: {
    backgroundColor: P.cardBg, margin: 16, borderRadius: 20,
    alignItems: 'center', padding: 36,
    borderWidth: 1, borderColor: P.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 2 } }),
  },
  emptyIconBox: { width: 76, height: 76, borderRadius: 38, backgroundColor: P.light, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:   { fontSize: 17, fontWeight: '800', color: P.dark, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 13, color: P.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  goBtn:        { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: P.main, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  goBtnTxt:     { color: P.white, fontWeight: '700', fontSize: 14 },

  summaryCard: {
    backgroundColor: P.cardBg, marginHorizontal: 16, borderRadius: 16,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: P.border,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, android: { elevation: 3 } }),
  },
  statRow:     { flexDirection: 'row', marginBottom: 14 },
  statTile:    { flex: 1, alignItems: 'center', gap: 4 },
  statVal:     { fontSize: 18, fontWeight: '900', color: P.main, marginTop: 3 },
  statLbl:     { fontSize: 10, color: P.textMuted, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, backgroundColor: P.divider, marginVertical: 4 },

  breakdownBox:   { backgroundColor: P.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: P.border, marginBottom: 4 },
  breakdownLabel: { fontSize: 9, fontWeight: '800', color: P.textMuted, letterSpacing: 1.2, marginBottom: 6 },
  chips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.light, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  chipTxt:        { fontSize: 11, fontWeight: '600', color: P.main },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: P.divider,
  },
  mapBtnTxt: { fontSize: 13, fontWeight: '700', color: P.main, flex: 1 },
});