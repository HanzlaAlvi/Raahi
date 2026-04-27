import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Animated, FlatList, Alert, ActivityIndicator,
  RefreshControl, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../../../style/RideHistoryStyle';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

const C = {
  primary:     '#415844',
  primaryDark: '#2D3E2F',
  white:       '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return 'N/A';
    return dt.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return 'N/A'; }
};

const fmtTime = (d) => {
  if (!d) return 'N/A';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return 'N/A';
    return dt.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return 'N/A'; }
};

const calcDelay = (start, end) => {
  if (!start || !end) return null;
  try {
    const mins = Math.round((new Date(end) - new Date(start)) / 60000);
    if (isNaN(mins)) return null;
    if (Math.abs(mins) < 2) return 'On time';
    return mins > 0 ? `${mins} min late` : `${Math.abs(mins)} min early`;
  } catch { return null; }
};

const getDelayColor = (delay) => {
  if (!delay || delay === 'On time') return '#415844';
  if (delay.includes('late'))        return '#F57C00';
  if (delay.includes('early'))       return '#1976D2';
  return '#9E9E9E';
};

const getStatusConfig = (status, missed) => {
  if (missed || status === 'missed' || status === 'cancelled')
    return { colors: ['#E53935', '#B71C1C'], icon: 'close-circle', label: 'Missed' };
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return { colors: ['#415844', '#2D3E2F'], icon: 'checkmark-circle', label: 'Completed' };
    case 'ongoing':
    case 'active':
    case 'en route':
      return { colors: ['#1565C0', '#0D47A1'], icon: 'navigate',          label: 'In Progress' };
    case 'delayed':
      return { colors: ['#E65100', '#BF360C'], icon: 'alert-circle',      label: 'Delayed' };
    default:
      return { colors: ['#546E7A', '#37474F'], icon: 'time-outline',       label: 'Pending' };
  }
};

// ─────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────
const StatsBar = ({ stats }) => (
  <View style={{
    flexDirection: 'row', backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  }}>
    {[
      { label: 'Total',     value: stats.total,     color: '#415844' },
      { label: 'Completed', value: stats.completed, color: '#2E7D32' },
      { label: 'Missed',    value: stats.missed,    color: '#C62828' },
      { label: 'Delayed',   value: stats.delayed,   color: '#E65100' },
    ].map((item, i) => (
      <React.Fragment key={item.label}>
        {i > 0 && <View style={{ width: 1, backgroundColor: '#E5EBE5', marginVertical: 6 }} />}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: item.color }}>{item.value}</Text>
          <Text style={{ fontSize: 11, color: '#7A8E7A', marginTop: 2, fontWeight: '500' }}>{item.label}</Text>
        </View>
      </React.Fragment>
    ))}
  </View>
);

// ─────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function RideHistoryScreen({ navigation }) {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [rides,          setRides]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [stats,          setStats]          = useState({ total: 0, completed: 0, missed: 0, delayed: 0 });

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ── Auth ──────────────────────────────────────────────────────
  const getToken = async () => {
    try {
      return await AsyncStorage.getItem('authToken')
          || await AsyncStorage.getItem('userToken')
          || await AsyncStorage.getItem('token');
    } catch { return null; }
  };

  // ── Transform raw trip → display object ──────────────────────
  const transformTrip = (trip, userId) => {
    const pEntry = (trip.passengers || []).find(
      p => p._id?.toString() === userId || p._id === userId
    );
    const isMissed    = ['missed', 'cancelled'].includes((trip.status || '').toLowerCase());
    const isCompleted = ['completed'].includes((trip.status || '').toLowerCase());
    const delay       = calcDelay(trip.startTime, trip.endTime);
    const pickup      = pEntry?.pickupPoint  || trip.stops?.[0]                   || 'Pickup';
    const drop        = pEntry?.destination  || trip.stops?.[trip.stops?.length - 1] || 'Destination';
    return {
      id:            trip._id?.toString() || Math.random().toString(),
      date:          fmtDate(trip.startTime || trip.createdAt),
      time:          fmtTime(trip.startTime || trip.createdAt),
      route:         `${pickup} → ${drop}`,
      driver:        trip.driverName || 'N/A',
      vehicle:       trip.vehicleType
                      ? `${trip.vehicleType.charAt(0).toUpperCase() + trip.vehicleType.slice(1)}${trip.vehicleNumber ? ' · ' + trip.vehicleNumber : ''}`
                      : 'N/A',
      scheduledTime: fmtTime(trip.startTime || trip.createdAt),
      actualTime:    fmtTime(trip.endTime   || trip.updatedAt),
      delay:         delay || 'On time',
      status:        isCompleted ? 'completed' : isMissed ? 'cancelled' : trip.status?.toLowerCase() || 'pending',
      missed:        isMissed,
      isDelayed:     delay && delay !== 'On time' && delay.includes('late'),
      timeSlot:      trip.timeSlot || '',
      rating:        null,
    };
  };

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchRides = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true); else setRefreshing(true);

      const token = await getToken();
      if (!token) {
        Alert.alert('Session Expired', 'Please log in again.');
        navigation.replace('PassengerLoginScreen');
        return;
      }

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      let userId = null;
      try { userId = JSON.parse(atob(token.split('.')[1])).userId; } catch {}

      let formatted = [];

      // Strategy 1 — dedicated endpoint
      try {
        const res  = await fetch(`${API_BASE_URL}/passenger/ride-history`, { headers });
        if (res.ok) {
          const data = await res.json();
          const list = data.rides || data.data || [];
          if (Array.isArray(list)) {
            formatted = list.map((r, i) => ({
              id:            r._id?.toString() || `r_${i}`,
              date:          fmtDate(r.bookingDate || r.startTime || r.createdAt),
              time:          fmtTime(r.bookingDate || r.startTime || r.createdAt),
              route:         r.route || `${r.pickupLocation || r.pickupPoint || 'Pickup'} → ${r.dropoffLocation || r.destination || 'Destination'}`,
              driver:        r.driverName || r.driver?.name || 'N/A',
              vehicle:       r.vehicleType || r.driver?.vehicle || 'N/A',
              scheduledTime: fmtTime(r.scheduledTime || r.startTime),
              actualTime:    fmtTime(r.actualPickupTime || r.endTime),
              delay:         calcDelay(r.scheduledTime || r.startTime, r.actualPickupTime || r.endTime) || 'On time',
              status:        r.status?.toLowerCase() || 'completed',
              missed:        ['missed', 'cancelled'].includes(r.status?.toLowerCase()),
              isDelayed:     false,
              timeSlot:      r.timeSlot || '',
              rating:        r.rating   || null,
            }));
          }
        }
      } catch {}

      // Strategy 2 — fallback from /trips
      if (!formatted.length) {
        const res = await fetch(`${API_BASE_URL}/trips`, { headers });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data     = await res.json();
        const allTrips = data.trips || data.data || [];
        const mine     = allTrips.filter(t =>
          (t.passengers || []).some(p => p._id?.toString() === userId || p._id === userId)
        );
        formatted = mine.map(t => transformTrip(t, userId));
      }

      // Sort newest first
      formatted.sort((a, b) => {
        const da = new Date(`${a.date} ${a.time}`);
        const db = new Date(`${b.date} ${b.time}`);
        return isNaN(db - da) ? 0 : db - da;
      });

      setRides(formatted);
      setStats({
        total:     formatted.length,
        completed: formatted.filter(r => r.status === 'completed' && !r.missed).length,
        missed:    formatted.filter(r => r.missed).length,
        delayed:   formatted.filter(r => r.isDelayed && !r.missed).length,
      });

      // Entrance animation
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();

    } catch (err) {
      Alert.alert('Error', 'Could not load ride history. Please check your connection and try again.',
        [{ text: 'Retry', onPress: () => fetchRides() }, { text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { fetchRides(); }, []);

  // ── Filters ───────────────────────────────────────────────────
  const FILTERS = [
    { id: 'all',       label: 'All',       icon: 'list-outline',             count: stats.total     },
    { id: 'completed', label: 'Completed', icon: 'checkmark-circle-outline', count: stats.completed },
    { id: 'cancelled', label: 'Missed',    icon: 'close-circle-outline',     count: stats.missed    },
    { id: 'delayed',   label: 'Delayed',   icon: 'time-outline',             count: stats.delayed   },
  ];

  const displayed =
    selectedFilter === 'all'       ? rides :
    selectedFilter === 'completed' ? rides.filter(r => r.status === 'completed' && !r.missed) :
    selectedFilter === 'cancelled' ? rides.filter(r => r.missed) :
                                     rides.filter(r => r.isDelayed && !r.missed);

  // ── Render card ───────────────────────────────────────────────
  const renderCard = ({ item }) => {
    const sc       = getStatusConfig(item.status, item.missed);
    const delColor = getDelayColor(item.delay);

    return (
      <Animated.View style={[
        styles.rideCard,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        item.missed && { borderLeftColor: '#E53935' },
      ]}>

        {/* ── Header row ── */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.routeText} numberOfLines={2}>{item.route}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <LinearGradient colors={sc.colors} style={styles.statusBadge}>
              <Ionicons name={sc.icon} size={11} color="#fff" />
              <Text style={styles.statusText}>{sc.label}</Text>
            </LinearGradient>
            <Text style={styles.dateText}>{item.date}</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.cardContent}>

          {/* Times */}
          <View style={styles.timeInfo}>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={13} color="#7A8E7A" />
              <Text style={styles.timeLabel}>Scheduled</Text>
              <Text style={styles.timeValue}>{item.scheduledTime}</Text>
            </View>
            <View style={styles.timeRow}>
              <Ionicons name="checkmark-done-outline" size={13} color="#7A8E7A" />
              <Text style={styles.timeLabel}>Actual</Text>
              <Text style={styles.timeValue}>{item.actualTime}</Text>
            </View>
          </View>

          {/* Delay badge */}
          {!item.missed && (
            <View style={[styles.delayInfo, { borderLeftColor: delColor }]}>
              <Ionicons
                name={item.delay === 'On time' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={14}
                color={delColor}
              />
              <Text style={[styles.delayText, { color: delColor }]}>{item.delay}</Text>
            </View>
          )}

          {/* Driver & vehicle */}
          <View style={styles.driverInfo}>
            <View style={styles.driverDetail}>
              <Ionicons name="person-circle-outline" size={14} color={C.primary} />
              <Text style={styles.driverText} numberOfLines={1}>{item.driver}</Text>
            </View>
            <View style={styles.driverDetail}>
              <Ionicons name="car-sport-outline" size={14} color={C.primary} />
              <Text style={styles.driverText} numberOfLines={1}>{item.vehicle}</Text>
            </View>
          </View>

          {/* Time slot */}
          {!!item.timeSlot && (
            <View style={[styles.driverDetail, { marginBottom: 4 }]}>
              <Ionicons name="alarm-outline" size={13} color="#9EAD9E" />
              <Text style={[styles.driverText, { color: '#9EAD9E', marginLeft: 4 }]}>
                {item.timeSlot}
              </Text>
            </View>
          )}

          {/* Rating */}
          {item.rating != null && !item.missed && (
            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map(s => (
                <Ionicons
                  key={s}
                  name={s <= item.rating ? 'star' : 'star-outline'}
                  size={14}
                  color="#F9A825"
                />
              ))}
              <Text style={styles.ratingLabel}>  Your Rating</Text>
            </View>
          )}
        </View>

        {/* Missed strip */}
        {item.missed && (
          <View style={styles.missedOverlay}>
            <Ionicons name="warning-outline" size={14} color="#E53935" />
            <Text style={styles.missedMessage}>This ride was missed</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  // ── Loading state ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />
        <LinearGradient colors={[C.primary, C.primaryDark]} style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride History</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Loading ride history…</Text>
        </View>
      </View>
    );
  }

  // ── Main render ───────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primaryDark} />

      {/* ── AppBar ── */}
      <LinearGradient colors={[C.primary, C.primaryDark]} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride History</Text>
        <TouchableOpacity style={styles.downloadButton} onPress={() => fetchRides(true)}>
          <Ionicons name="refresh-outline" size={21} color={C.white} />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Stats bar ── */}
      <StatsBar stats={stats} />

      {/* ── Filter tabs ── */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContentContainer}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterTab, selectedFilter === f.id && styles.filterTabActive]}
              onPress={() => setSelectedFilter(f.id)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={selectedFilter === f.id ? C.white : C.primary}
              />
              <Text style={[styles.filterText, selectedFilter === f.id && styles.filterTextActive]}>
                {f.label}{f.count > 0 ? ` (${f.count})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Ride list ── */}
      <FlatList
        data={displayed}
        renderItem={renderCard}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContainer,
          displayed.length === 0 && { flex: 1, justifyContent: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchRides(true)}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={64} color="#C5D0C5" />
            <Text style={styles.emptyStateText}>No rides found</Text>
            <Text style={styles.emptyStateSubtext}>
              {selectedFilter === 'all'
                ? 'You have not taken any rides yet.'
                : `No ${FILTERS.find(f => f.id === selectedFilter)?.label} rides found.`}
            </Text>
            <TouchableOpacity
              onPress={() => fetchRides()}
              style={{
                marginTop: 20, paddingHorizontal: 28, paddingVertical: 11,
                backgroundColor: C.primary, borderRadius: 22,
              }}
            >
              <Text style={{ color: C.white, fontWeight: '700', fontSize: 13 }}>Refresh</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}