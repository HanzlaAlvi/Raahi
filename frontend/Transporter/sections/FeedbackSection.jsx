// frontend/Transporter/sections/FeedbackSection.jsx
// Displays all passenger & driver feedbacks for the transporter
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api }            from '../services/ApiService';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  white:     '#FFFFFF',
  bg:        '#F2F5F2',
  card:      '#FFFFFF',
  light:     '#EDF4ED',
  border:    '#D4DDD4',
  ink:       '#0F1A10',
  textDark:  '#1A2218',
  textMid:   '#4A5E4C',
  textLight: '#6B7B6C',
  textMuted: '#9CAF9C',
  star:      '#F59E0B',
  passBg:    '#E8F5E9',
  passColor: '#2E7D32',
  drivBg:    '#E3F2FD',
  drivColor: '#0D47A1',
};

const FILTERS = [
  { id: 'all',       label: 'All',       icon: 'layers-outline'     },
  { id: 'passenger', label: 'Passenger', icon: 'person-outline'     },
  { id: 'driver',    label: 'Driver',    icon: 'car-outline'        },
  { id: 'monthly',   label: 'Monthly',   icon: 'calendar-outline'   },
];

const RATING_COLORS = {
  5: '#16A34A', 4: '#65A30D', 3: '#D97706', 2: '#DC2626', 1: '#9B1C1C',
};

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-PK', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

const StarRow = ({ rating }) => {
  const r = Math.round(rating || 0);
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= r ? 'star' : 'star-outline'} size={12} color={P.star} />
      ))}
      {rating ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: RATING_COLORS[r] || P.textLight, marginLeft: 4 }}>
          {Number(rating).toFixed(1)}
        </Text>
      ) : null}
    </View>
  );
};

const FeedbackCard = ({ item }) => {
  const [expanded, setExpanded] = useState(false);
  const isMonthly  = !!item.isMonthly;
  const givenBy    = (item.givenBy || item.role || '').toLowerCase();
  const isDriver   = givenBy === 'driver';
  const roleBg     = isDriver ? P.drivBg   : P.passBg;
  const roleColor  = isDriver ? P.drivColor : P.passColor;
  const roleLabel  = isDriver ? 'Driver'    : 'Passenger';
  const roleIcon   = isDriver ? 'car-outline' : 'person-outline';

  const name      = item.passengerName || item.name || 'Unknown';
  const comment   = item.comment || item.feedback || '';
  const questions = item.questions || [];

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.88}
      style={s.card}
    >
      <View style={[s.cardTopLine, { backgroundColor: isMonthly ? P.main : (isDriver ? P.drivColor : P.passColor) }]} />
      <View style={s.cardInner}>
        <View style={[s.cardIcon, { backgroundColor: roleBg }]}>
          <Ionicons name={isMonthly ? 'calendar' : roleIcon} size={18} color={roleColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={s.cardName} numberOfLines={1}>{name}</Text>
            <View style={[s.rolePill, { backgroundColor: roleBg }]}>
              <Text style={[s.rolePillTxt, { color: roleColor }]}>{roleLabel}</Text>
            </View>
          </View>

          {isMonthly && (
            <View style={s.monthlyBadge}>
              <Ionicons name="document-text-outline" size={10} color={P.main} />
              <Text style={s.monthlyBadgeTxt}>Monthly Feedback</Text>
              {item.month ? <Text style={[s.monthlyBadgeTxt, { color: P.textMuted }]}>— {item.month}</Text> : null}
            </View>
          )}

          {item.subject ? (
            <Text style={s.subject} numberOfLines={expanded ? undefined : 1}>{item.subject}</Text>
          ) : null}

          {item.rating ? <StarRow rating={item.rating} /> : null}

          {comment && !isMonthly ? (
            <Text style={s.comment} numberOfLines={expanded ? undefined : 2}>{comment}</Text>
          ) : null}

          {/* Monthly Q&A (expanded) */}
          {expanded && isMonthly && questions.length > 0 && (
            <View style={s.qaBox}>
              {questions.map((q, i) => (
                <View key={i} style={s.qaRow}>
                  <Text style={s.qaQ}>{i + 1}. {q.question}</Text>
                  <Text style={s.qaA}>{q.answer}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.date}>{fmtDate(item.createdAt || item.feedbackDate)}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14} color={P.textMuted}
          style={{ alignSelf: 'flex-start', marginTop: 2, marginLeft: 6 }}
        />
      </View>
    </TouchableOpacity>
  );
};

const StatPill = ({ label, value, color, bg }) => (
  <View style={[s.statPill, { backgroundColor: bg, borderColor: color + '30' }]}>
    <Text style={[s.statVal, { color }]}>{value}</Text>
    <Text style={[s.statLbl, { color: color + 'BB' }]}>{label}</Text>
  </View>
);

// ── Main Component ────────────────────────────────────────────────
const FeedbackSection = ({ refreshing: extRefreshing, onRefresh: extRefresh }) => {
  const [feedbacks,   setFeedbacks]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [avgRating,   setAvgRating]   = useState(0);

  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const { token } = await api.getAuthData();
      const res  = await fetch(`${API_BASE}/feedback`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setFeedbacks(data.feedbacks || data.data || []);
        setAvgRating(data.averageRating || 0);
      }
    } catch (e) {
      console.warn('[FeedbackSection] load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeedbacks(); }, []);

  const handleRefresh = () => {
    extRefresh?.();
    loadFeedbacks();
  };

  const displayed = feedbacks.filter(f => {
    if (filter === 'all') return true;
    if (filter === 'monthly') return !!f.isMonthly;
    const role = (f.givenBy || f.role || '').toLowerCase();
    return role === filter;
  });

  const countOf = id => {
    if (id === 'all') return feedbacks.length;
    if (id === 'monthly') return feedbacks.filter(f => !!f.isMonthly).length;
    return feedbacks.filter(f => (f.givenBy || f.role || '').toLowerCase() === id).length;
  };

  const passengerCount = countOf('passenger');
  const driverCount    = countOf('driver');
  const monthlyCount   = countOf('monthly');

  return (
    <View style={s.root}>
      {/* Stats bar */}
      <LinearGradient colors={[P.main, P.dark]} style={s.statsBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <StatPill label="Total"     value={feedbacks.length} color="#C8DEC5" bg="rgba(255,255,255,0.10)" />
        <View style={s.statDiv} />
        <StatPill label="Passenger" value={passengerCount}   color="#A5D6A7" bg="rgba(76,175,80,0.12)"  />
        <View style={s.statDiv} />
        <StatPill label="Driver"    value={driverCount}      color="#90CAF9" bg="rgba(33,150,243,0.12)" />
        <View style={s.statDiv} />
        <StatPill label="Avg ★"     value={avgRating ? avgRating.toFixed(1) : '—'} color="#FCD34D" bg="rgba(245,158,11,0.12)" />
      </LinearGradient>

      {/* Filter chips */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            const cnt    = countOf(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.75}
              >
                <Ionicons name={f.icon} size={13} color={active ? P.white : P.textLight} />
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                  {f.label}{cnt > 0 ? ` (${cnt})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={extRefreshing || false}
            onRefresh={handleRefresh}
            colors={[P.main]} tintColor={P.main}
          />
        }
      >
        <View style={s.sectionHeader}>
          <LinearGradient colors={[P.main, P.dark]} style={s.sectionIconPill}>
            <Ionicons name="star-outline" size={13} color={P.white} />
          </LinearGradient>
          <Text style={s.sectionTitle}>
            {filter === 'all' ? 'All Feedback' : FILTERS.find(f => f.id === filter)?.label + ' Feedback'}
          </Text>
          {displayed.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeTxt}>{displayed.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <ActivityIndicator size="large" color={P.main} />
          </View>
        ) : displayed.length > 0 ? (
          displayed.map((f, i) => <FeedbackCard key={f._id || i} item={f} />)
        ) : (
          <View style={s.empty}>
            <LinearGradient colors={[P.light, P.white]} style={s.emptyIconBox}>
              <Ionicons name="star-outline" size={44} color={P.main} />
            </LinearGradient>
            <Text style={s.emptyTitle}>No Feedback Yet</Text>
            <Text style={s.emptySub}>
              {filter === 'all'
                ? 'Passenger and driver feedback will appear here.'
                : `No ${filter} feedback found.`}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default FeedbackSection;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  statPill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, borderWidth: 1 },
  statVal:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statLbl:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  statDiv:  { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },

  filterBar:     { backgroundColor: P.card, borderBottomWidth: 1, borderBottomColor: P.border },
  filterContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: P.border, backgroundColor: P.card, gap: 4 },
  chipActive:    { backgroundColor: P.main, borderColor: P.main },
  chipTxt:       { fontSize: 12, fontWeight: '600', color: P.textLight },
  chipTxtActive: { color: P.white },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionHeader:   { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14, gap: 10 },
  sectionIconPill: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:    { flex: 1, fontSize: 17, fontWeight: '900', color: P.ink, letterSpacing: -0.3 },
  countBadge:      { backgroundColor: P.main, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeTxt:   { color: P.white, fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: P.card, borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#1A2B1C', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  cardTopLine: { height: 3, width: '100%' },
  cardInner:   { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  cardIcon:    { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName:    { flex: 1, fontSize: 14, fontWeight: '800', color: P.ink, marginRight: 8 },

  rolePill:    { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  rolePillTxt: { fontSize: 10, fontWeight: '700' },

  monthlyBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  monthlyBadgeTxt: { fontSize: 10, fontWeight: '700', color: P.main },

  subject: { fontSize: 13, fontWeight: '700', color: P.textDark, marginBottom: 4 },
  comment: { fontSize: 13, color: P.textMid, lineHeight: 19, marginTop: 4, marginBottom: 4 },
  date:    { fontSize: 11, color: P.textMuted, marginTop: 6 },

  qaBox: { backgroundColor: '#F9FBF9', borderRadius: 10, padding: 10, marginTop: 8, gap: 8 },
  qaRow: { gap: 2 },
  qaQ:   { fontSize: 12, fontWeight: '700', color: P.textMid },
  qaA:   { fontSize: 12, color: P.textLight, marginLeft: 8 },

  empty:       { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBox:{ width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: P.border },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: P.dark, marginBottom: 6 },
  emptySub:    { fontSize: 14, color: P.textMuted, textAlign: 'center', lineHeight: 20 },
});