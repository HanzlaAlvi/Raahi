
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated,
  FlatList, Modal, TextInput, Alert, RefreshControl,
  Platform, StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

// ── Theme ─────────────────────────────────────────────────────────
const C = {
  primary:      '#415844',
  primaryDark:  '#2D3E2F',
  primaryLight: '#EDF1ED',
  primaryMid:   '#C5D0C5',
  white:        '#FFFFFF',
  bg:           '#F5F7F5',
  cardBg:       '#FFFFFF',
  textDark:     '#1A2218',
  textSub:      '#3D4D3D',
  textMuted:    '#7A8E7A',
  textLight:    '#9EAD9E',
  border:       '#E5EBE5',
  danger:       '#C62828',
  dangerLight:  '#FFEBEE',
  warning:      '#E65100',
  warningLight: '#FFF3E0',
  info:         '#1565C0',
  infoLight:    '#E3F2FD',
  teal:         '#00695C',
  tealLight:    '#E0F2F1',
};

// ── Status config ─────────────────────────────────────────────────
const STATUS = {
  active:    { colors: [C.primary, C.primaryDark], icon: 'checkmark-circle', label: 'Active'    },
  completed: { colors: [C.teal, '#004D40'],         icon: 'checkmark-done',  label: 'Completed' },
  rejected:  { colors: [C.danger, '#B71C1C'],       icon: 'close-circle',    label: 'Rejected'  },
  pending:   { colors: [C.warning, '#BF360C'],      icon: 'time',            label: 'Pending'   },
};
const getStatus = (s) => STATUS[s] || STATUS.pending;

// ── Auth helper ───────────────────────────────────────────────────
const getToken = async () => {
  try {
    return await AsyncStorage.getItem('authToken')
        || await AsyncStorage.getItem('userToken')
        || await AsyncStorage.getItem('token');
  } catch { return null; }
};

// ── Divider ───────────────────────────────────────────────────────
const Divider = () => <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />;

// ── Stat tile ─────────────────────────────────────────────────────
const StatTile = ({ value, label, color }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={{ fontSize: 22, fontWeight: '800', color }}>{value}</Text>
    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: '500' }}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function PaymentsScreen({ navigation }) {
  const [tab,            setTab]            = useState('current');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loading,        setLoading]        = useState(true);

  const [plans,          setPlans]          = useState([]);
  const [history,        setHistory]        = useState([]);
  const [current,        setCurrent]        = useState(null);
  const [stats,          setStats]          = useState({ total: 0, active: 0, completed: 0, rejected: 0 });
  const [selectedPlan,   setSelectedPlan]   = useState(null);
  const [renewing,       setRenewing]       = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ── Animate in ───────────────────────────────────────────────
  const animateIn = () => {
    fadeAnim.setValue(0); slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  // ── Fetch helpers ─────────────────────────────────────────────
  const fetchCurrent = useCallback(async () => {
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE_URL}/subscriptions/current`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) setCurrent(data.subscription);
    } catch (err) {
      console.error('Fetch current subscription error:', err);
    }
  }, []);

  const fetchHistory = useCallback(async (filter = statusFilter) => {
    try {
      const token = await getToken();
      const url   = filter !== 'all'
        ? `${API_BASE_URL}/subscriptions/history?status=${filter}`
        : `${API_BASE_URL}/subscriptions/history`;
      const res   = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data  = await res.json();
      if (data.success) {
        setHistory(data.subscriptions || []);
        setStats(data.stats || { total: 0, active: 0, completed: 0, rejected: 0 });
      }
    } catch (err) {
      console.error('Fetch subscription history error:', err);
    }
  }, [statusFilter]);

  const fetchPlans = useCallback(async () => {
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE_URL}/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data  = await res.json();
      if (data.success && data.plans?.length) {
        setPlans(data.plans);
        setSelectedPlan(data.plans[0]);
      }
    } catch (err) {
      console.error('Fetch plans error:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchCurrent(), fetchHistory(), fetchPlans()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      animateIn();
    }
  }, [fetchCurrent, fetchHistory, fetchPlans]);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (tab === 'history') fetchHistory(statusFilter); }, [statusFilter]);
  useEffect(() => {
    if (tab === 'current') fetchCurrent();
    else if (tab === 'history') fetchHistory(statusFilter);
  }, [tab]);

  // ── Renew ─────────────────────────────────────────────────────
  const handleRenew = async () => {
    if (!selectedPlan) return;
    setRenewing(true);
    try {
      const token = await getToken();
      const res   = await fetch(`${API_BASE_URL}/subscriptions/renew`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planId: selectedPlan.id }),
      });
      const data  = await res.json();
      if (data.success) {
        setShowRenewModal(false);
        await fetchAll();
        Alert.alert(
          'Request Sent',
          'Your renewal request has been sent to your transporter. They will approve it within 24 hours.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', data.message || 'Failed to send renewal request.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server. Please try again.');
    } finally {
      setRenewing(false);
    }
  };

  // ── Filtered history ──────────────────────────────────────────
  const filteredHistory = history.filter(sub => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (sub.planName     || '').toLowerCase().includes(q) ||
      (sub.transactionId|| '').toLowerCase().includes(q)
    );
  });

  // ─────────────────────────────────────────────────────────────
  // RENDER: Current Plan tab
  // ─────────────────────────────────────────────────────────────
  const renderCurrentTab = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAll} colors={[C.primary]} tintColor={C.primary} />}
    >
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

        {/* ── Active plan card ── */}
        {current ? (
          <LinearGradient colors={[C.primary, C.primaryDark]} style={planCard}>
            {/* Plan name + status badge */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 }}>
                  {current.planName}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff' }}>
                  {current.amount}
                </Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  Monthly Van Pooling Service
                </Text>
              </View>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name={getStatus(current.status).icon} size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>
                  {getStatus(current.status).label}
                </Text>
              </View>
            </View>

            {/* Date range */}
            <View style={infoRow}>
              <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.8)" />
              <Text style={infoTxt}>{current.startDate} — {current.endDate}</Text>
            </View>

            {/* Days remaining */}
            {current.status === 'active' && (
              <View style={infoRow}>
                <Ionicons name="hourglass-outline" size={15} color="rgba(255,255,255,0.8)" />
                <Text style={infoTxt}>{current.daysRemaining} days remaining</Text>
              </View>
            )}

            {/* Payment method */}
            <View style={infoRow}>
              <Ionicons name="card-outline" size={15} color="rgba(255,255,255,0.8)" />
              <Text style={infoTxt}>{current.paymentMethod}</Text>
            </View>

            {/* Transaction ID */}
            <View style={infoRow}>
              <Ionicons name="receipt-outline" size={15} color="rgba(255,255,255,0.8)" />
              <Text style={infoTxt}>{current.transactionId}</Text>
            </View>

            {/* Approved by */}
            {current.approvedBy && (
              <View style={infoRow}>
                <Ionicons name="checkmark-circle-outline" size={15} color="rgba(255,255,255,0.8)" />
                <Text style={infoTxt}>Approved by {current.approvedBy}</Text>
              </View>
            )}

            {/* Renew button */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24, paddingVertical: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
              onPress={() => setShowRenewModal(true)}
            >
              <Ionicons name="refresh" size={17} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Renew Plan</Text>
            </TouchableOpacity>
          </LinearGradient>
        ) : (
          /* No subscription */
          <LinearGradient colors={[C.danger, '#B71C1C']} style={planCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>No Active Subscription</Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                  Your subscription has expired or was not found.
                </Text>
              </View>
              <Ionicons name="warning" size={32} color="rgba(255,255,255,0.8)" />
            </View>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 24, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
              onPress={() => setShowRenewModal(true)}
            >
              <Ionicons name="refresh" size={17} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Subscribe Now</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* ── Stats overview ── */}
        <View style={[sectionCard, { flexDirection: 'row', paddingVertical: 14 }]}>
          <StatTile value={stats.total}     label="Total"     color={C.primary}  />
          <View style={{ width: 1, backgroundColor: C.border }} />
          <StatTile value={stats.active}    label="Active"    color={C.teal}     />
          <View style={{ width: 1, backgroundColor: C.border }} />
          <StatTile value={stats.completed} label="Completed" color={C.textMuted}/>
          <View style={{ width: 1, backgroundColor: C.border }} />
          <StatTile value={stats.rejected}  label="Rejected"  color={C.danger}   />
        </View>

      </Animated.View>
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER: History tab
  // ─────────────────────────────────────────────────────────────
  const renderHistoryCard = ({ item }) => {
    const sc = getStatus(item.status);
    return (
      <Animated.View style={[histCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.textDark }}>{item.planName}</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.primary, marginTop: 2 }}>{item.amount}</Text>
          </View>
          <LinearGradient colors={sc.colors} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
            <Ionicons name={sc.icon} size={12} color="#fff" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{sc.label}</Text>
          </LinearGradient>
        </View>

        <Divider />

        {/* Details */}
        <View style={{ gap: 7 }}>
          <DetailRow icon="calendar-outline"  label="Period"      value={`${item.startDate} — ${item.endDate}`} />
          <DetailRow icon="card-outline"      label="Payment"     value={item.paymentMethod} />
          <DetailRow icon="receipt-outline"   label="Transaction" value={item.transactionId} />
          {item.approvedBy && <DetailRow icon="person-outline" label="Approved by" value={item.approvedBy} />}
          {item.approvedDate && <DetailRow icon="checkmark-done-outline" label="Approved on" value={item.approvedDate} />}
        </View>
      </Animated.View>
    );
  };

  const renderHistoryTab = () => (
    <>
      {/* Search bar */}
      <View style={{ backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1.5, borderColor: C.border, gap: 8 }}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.textDark }}
            placeholder="Search by plan or transaction ID…"
            placeholderTextColor={C.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={C.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filter chips */}
      <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['all','active','completed','rejected','pending'].map(f => {
          const active = statusFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: active ? C.primary : C.white, borderWidth: 1.5, borderColor: active ? C.primary : C.primaryMid }}
              onPress={() => setStatusFilter(f)}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: active ? C.white : C.primary, textTransform: 'capitalize' }}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active filter label */}
      {statusFilter !== 'all' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.warningLight, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: C.warning }}>
          <Text style={{ fontSize: 13, color: C.textDark, fontWeight: '500', textTransform: 'capitalize' }}>
            Filter: {statusFilter}
          </Text>
          <TouchableOpacity onPress={() => setStatusFilter('all')}>
            <Ionicons name="close" size={16} color={C.danger} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredHistory}
        renderItem={renderHistoryCard}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 36 },
          filteredHistory.length === 0 && { flex: 1, justifyContent: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHistory(statusFilter)} colors={[C.primary]} tintColor={C.primary} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Ionicons name="receipt-outline" size={60} color={C.primaryMid} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.textSub, marginTop: 14 }}>No records found</Text>
            <Text style={{ fontSize: 13, color: C.textLight, marginTop: 6, textAlign: 'center' }}>
              {searchQuery ? 'Try a different search term.' : 'No subscription history available.'}
            </Text>
          </View>
        }
      />
    </>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER: Renew tab
  // ─────────────────────────────────────────────────────────────
  const renderRenewTab = () => {
    // Only show plan if transporter has set a custom amount (amountRaw != null).
    // If no amount set yet, show a friendly waiting message instead.
    const activePlan = plans.find(p => p.amountRaw != null) || null;

    if (!activePlan) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 40, alignItems: 'center' }}>
          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 16 }}>
              <Ionicons name="time-outline" size={38} color={C.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.textDark, textAlign: 'center', marginBottom: 10 }}>
              No Plan Assigned Yet
            </Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 24 }}>
              Your transporter has not set a subscription amount for you yet.
              {'Once they assign your monthly plan, it will appear here and you can send a renewal request.'}
            </Text>
            <View style={{ backgroundColor: C.primaryLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.primaryMid, width: '100%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="information-circle-outline" size={18} color={C.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.primary, flex: 1, lineHeight: 18 }}>
                  Contact your transporter to confirm your monthly subscription amount.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
            Your transporter has set the following plan for you.
          </Text>

          {plans.filter(plan => plan.amountRaw != null).map(plan => {
            const selected = selectedPlan?.id === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[sectionCard, { borderWidth: 1.5, borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primaryLight : C.white, marginBottom: 12 }]}
                onPress={() => setSelectedPlan(plan)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.textDark }}>{plan.name}</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: C.primary, marginTop: 2 }}>{plan.amountLabel}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{plan.description}</Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: selected ? C.primary : C.primaryMid, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                    {selected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary }} />}
                  </View>
                </View>

                <Divider />

                {plan.features.map((f, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
                    <Ionicons name="checkmark-circle" size={15} color={C.primary} />
                    <Text style={{ fontSize: 13, color: C.textSub }}>{f}</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
                  <Ionicons name="calendar-outline" size={14} color={C.textMuted} />
                  <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: '500' }}>
                    Valid for {plan.duration} days
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}
            onPress={() => setShowRenewModal(true)}
            disabled={!selectedPlan}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[C.primary, C.primaryDark]} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 }}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>
                Request Renewal — {selectedPlan?.amountLabel}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
        <LinearGradient colors={[C.primary, C.primaryDark]} style={headerStyle}>
          <TouchableOpacity style={iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={headerTitle}>Subscription</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={{ fontSize: 13, color: C.textMuted }}>Loading subscription data…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

      {/* ── AppBar ── */}
      <LinearGradient colors={[C.primary, C.primaryDark]} style={headerStyle}>
        <TouchableOpacity style={iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={headerTitle}>Subscription</Text>
        <TouchableOpacity style={iconBtn} onPress={fetchAll}>
          <Ionicons name="refresh-outline" size={21} color={C.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Tabs ── */}
      <View style={{ flexDirection: 'row', backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, gap: 8 }}>
        {[
          { id: 'current', label: 'Current Plan', icon: 'card-outline'    },
          { id: 'history', label: 'History',      icon: 'time-outline'    },
          { id: 'renew',   label: 'Renew',        icon: 'refresh-outline' },
        ].map(t => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: active ? C.primary : C.bg }}
              onPress={() => setTab(t.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={t.icon} size={14} color={active ? C.white : C.textMuted} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? C.white : C.textMuted }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tab content ── */}
      <View style={{ flex: 1 }}>
        {tab === 'current' && renderCurrentTab()}
        {tab === 'history' && renderHistoryTab()}
        {tab === 'renew'   && renderRenewTab()}
      </View>

      {/* ── Renew Confirmation Modal ── */}
      <Modal visible={showRenewModal} transparent animationType="slide" onRequestClose={() => setShowRenewModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingTop: 12 }}>

            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 }} />

            {/* Title */}
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.textDark, marginBottom: 6 }}>
              Confirm Renewal
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 19 }}>
              Your renewal request will be sent to your transporter for approval.
            </Text>

            {/* Plan details */}
            {selectedPlan && (
              <View style={{ backgroundColor: C.bg, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
                {[
                  { label: 'Plan',     value: selectedPlan.name        },
                  { label: 'Amount',   value: selectedPlan.amountLabel },
                  { label: 'Duration', value: `${selectedPlan.duration} days` },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: C.border }}>
                    <Text style={{ fontSize: 13, color: C.textMuted, fontWeight: '500' }}>{row.label}</Text>
                    <Text style={{ fontSize: 13, color: C.textDark, fontWeight: '700' }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: C.border }}
                onPress={() => setShowRenewModal(false)}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: C.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, borderRadius: 12, overflow: 'hidden' }}
                onPress={handleRenew}
                disabled={renewing}
              >
                <LinearGradient colors={[C.primary, C.primaryDark]} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
                  {renewing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>Confirm Request</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Shared inline styles ──────────────────────────────────────────
const headerStyle = {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: Platform.OS === 'ios' ? 54 : 46,
  paddingBottom: 14,
  elevation: 6,
  shadowColor: '#2D3E2F', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
};
const headerTitle = { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 };
const iconBtn = { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' };
const planCard = { borderRadius: 20, padding: 20, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#2D3E2F', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 5 } }) };
const sectionCard = { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 2 } }) };
const histCard = { ...sectionCard, borderLeftWidth: 4, borderLeftColor: '#415844' };
const infoRow = { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 };
const infoTxt = { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500', flex: 1 };

// ── Detail row sub-component ──────────────────────────────────────
function DetailRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name={icon} size={13} color="#7A8E7A" />
      <Text style={{ fontSize: 12, color: '#7A8E7A', width: 90 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: '#1A2218', fontWeight: '600', flex: 1 }} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}