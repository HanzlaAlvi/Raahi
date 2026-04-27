// src/screens/notifications/AlertScreen.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, FlatList,
  RefreshControl, Alert as RNAlert, ActivityIndicator,
  Modal, TextInput, StyleSheet, Platform, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

// ── Brand palette ────────────────────────────────────────────────
const brandGreen   = '#415844';
const appBarDark   = '#2D3E2F';
const darkSage     = '#2D3E2F';
const lightGreenBg = '#EEF4ED';
const borderColor  = '#C8DEC5';
const bgColor      = '#F6FAF5';

// ── Notification type colors — all tinted from brand green ───────
const TYPE_COLORS = {
  poll:         { bg: '#E8F0E9', border: '#7A9E76', icon: '#415844', gradient: ['#415844','#2D3E2F'] },
  route:        { bg: '#DDE8DD', border: '#415844', icon: '#2D3E2F', gradient: ['#2D3E2F','#1A2B1C'] },
  confirmation: { bg: '#EBF4E8', border: '#5C8C5A', icon: '#3A7038', gradient: ['#4A7A47','#2D5C2A'] },
  alert:        { bg: '#F5EFE6', border: '#A0845A', icon: '#7A5C30', gradient: ['#8B6A3A','#5C4220'] },
  complaint:    { bg: '#F0E9E9', border: '#9E6A6A', icon: '#7A3A3A', gradient: ['#7A3A3A','#4C2020'] },
  feedback:     { bg: '#F0EDDF', border: '#9E9050', icon: '#7A7020', gradient: ['#7A7030','#4C4C18'] },
  default:      { bg: '#EEF4ED', border: '#415844', icon: '#415844', gradient: ['#415844','#2D3E2F'] },
};

const categories = [
  { id: 'all',          label: 'All',           icon: 'apps'             },
  { id: 'poll',         label: 'Polls',          icon: 'bar-chart'        },
  { id: 'route',        label: 'Routes',         icon: 'map'              },
  { id: 'confirmation', label: 'Confirmations',  icon: 'checkmark-circle' },
  { id: 'alert',        label: 'Alerts',         icon: 'warning'          },
];

export default function AlertScreen({ navigation, route }) {
  const {
    notifications:   initialNotifications,
    onMarkAsRead,
    onMarkAllAsRead,
  } = route?.params || {};

  const [notifications,   setNotifications]   = useState(initialNotifications || []);
  const [loading,         setLoading]         = useState(!initialNotifications);
  const [refreshing,      setRefreshing]       = useState(false);
  const [selectedCategory,setSelectedCategory]= useState('all');
  const [counts,          setCounts]          = useState({ total: 0, unread: 0 });

  const [showPollModal,    setShowPollModal]    = useState(false);
  const [selectedPoll,     setSelectedPoll]     = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [pickupPoint,      setPickupPoint]      = useState('');
  const [travelResponse,   setTravelResponse]   = useState('');
  const [submitting,       setSubmitting]       = useState(false);

  const tokenRef  = useRef(null);
  const userIdRef = useRef(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadAuthAndFetch();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadAuthAndFetch = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken') || await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('token');
      const uid   = await AsyncStorage.getItem('userId');
      const udStr = await AsyncStorage.getItem('userData');
      tokenRef.current  = token;
      userIdRef.current = uid;
      if (udStr) { try { setPickupPoint(JSON.parse(udStr)?.pickupPoint || ''); } catch {} }
      if (token) await fetchNotifications('all', token, uid);
      else       setLoading(false);
    } catch { setLoading(false); }
  };

  const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` });

  const fetchNotifications = async (category = selectedCategory, token, uid) => {
    const t = token || tokenRef.current;
    if (!t) { setLoading(false); setRefreshing(false); return; }
    try {
      const url = category !== 'all' ? `${API_BASE_URL}/notifications?type=${category}` : `${API_BASE_URL}/notifications`;
      const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } });
      if (res.status === 401) { RNAlert.alert('Session Expired', 'Please login again.'); navigation.replace?.('Login'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        const notifs = data.notifications || data.data || [];
        setNotifications(notifs);
        setCounts({ total: notifs.length, unread: notifs.filter(n => !n.read).length });
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => {
    if (tokenRef.current && !loading) fetchNotifications(selectedCategory);
  }, [selectedCategory]);

  const markAsRead = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PUT', headers: getHeaders() });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setCounts(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      if (onMarkAsRead) onMarkAsRead(id);
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/read-all`, { method: 'PUT', headers: getHeaders() });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setCounts(prev => ({ ...prev, unread: 0 }));
        if (onMarkAllAsRead) onMarkAllAsRead();
      }
    } catch {}
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.read) await markAsRead(notification._id);
    if (notification.type === 'poll') {
      const pollId = notification.pollId || notification.relatedId;
      if (pollId) await openPollModal(pollId);
      else RNAlert.alert(notification.title, notification.message);
      return;
    }
    if (notification.type === 'feedback' || notification.actionType === 'submit_feedback') {
      RNAlert.alert(notification.title, notification.message, [{ text: 'Rate Now', onPress: () => navigation.navigate?.('FeedbackScreen') }, { text: 'Later' }]);
      return;
    }
    RNAlert.alert(notification.title || 'Notification', notification.message || '');
  };

  const openPollModal = async (pollId) => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE_URL}/polls/${pollId}`, { headers: getHeaders() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.success && data.poll) {
        const poll = data.poll; const uid = userIdRef.current;
        const userResp = poll.responses?.find(r => (r.passengerId?._id?.toString() || r.passengerId?.toString()) === uid);
        if (userResp) { RNAlert.alert('Already Responded', `You responded: ${userResp.response === 'yes' ? '✅ Will Travel' : "❌ Won't Travel"}`); return; }
        setSelectedPoll(poll); setTravelResponse(''); setSelectedTimeSlot(''); setShowPollModal(true);
      }
    } catch { RNAlert.alert('Error', 'Could not load poll.'); }
    finally { setLoading(false); }
  };

  const submitPollResponse = async () => {
    if (!selectedPoll) return;
    if (travelResponse === 'yes' && (!selectedTimeSlot || !pickupPoint)) { RNAlert.alert('Missing Info', 'Select a time slot and enter pickup point.'); return; }
    if (!travelResponse) { RNAlert.alert('Please Choose', 'Select Yes or No.'); return; }
    try {
      setSubmitting(true);
      const res  = await fetch(`${API_BASE_URL}/polls/${selectedPoll._id}/respond`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ response: travelResponse, selectedTimeSlot: travelResponse === 'yes' ? selectedTimeSlot : null, pickupPoint: travelResponse === 'yes' ? pickupPoint : null }) });
      const data = await res.json();
      if (data.success) RNAlert.alert('Submitted ✅', travelResponse === 'yes' ? `Confirmed travel at ${selectedTimeSlot}.` : "Confirmed you won't be traveling.", [{ text: 'OK', onPress: () => { setShowPollModal(false); setSelectedPoll(null); setTravelResponse(''); setSelectedTimeSlot(''); fetchNotifications(selectedCategory); } }]);
      else RNAlert.alert('Error', data.message || 'Failed.');
    } catch { RNAlert.alert('Error', 'Failed. Try again.'); }
    finally { setSubmitting(false); }
  };

  // ── Theme-matched color helper ───────────────────────────────
  const getTypeStyle = (type) => TYPE_COLORS[type] || TYPE_COLORS.default;

  const getNotifIcon = (type) => {
    switch (type) {
      case 'poll':         return 'bar-chart';
      case 'route':        return 'map';
      case 'confirmation': return 'checkmark-circle';
      case 'alert':        return 'warning';
      case 'complaint':    return 'alert-circle';
      case 'feedback':     return 'star';
      default:             return 'notifications';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString); const now = new Date(); const diffMs = now - date;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1)  return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24)   return `${diffH}h ago`;
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7)    return `${diffD}d ago`;
      return date.toLocaleDateString('en-PK');
    } catch { return ''; }
  };

  const displayed = selectedCategory === 'all' ? notifications : notifications.filter(n => n.type === selectedCategory);

  const renderNotification = ({ item }) => {
    const typeStyle = getTypeStyle(item.type);

    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.8}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={{
            backgroundColor: item.read ? '#ffffff' : typeStyle.bg,
            borderRadius: 24, padding: 18, marginBottom: 14,
            borderWidth: item.read ? 1 : 1.5,
            borderColor: item.read ? borderColor : typeStyle.border,
            flexDirection: 'row',
            ...Platform.select({
              ios:     { shadowColor: typeStyle.icon, shadowOffset: { width: 0, height: 4 }, shadowOpacity: item.read ? 0.03 : 0.08, shadowRadius: 10 },
              android: { elevation: item.read ? 1 : 3 },
            }),
          }}>
            {/* Icon — left color accent bar */}
            <View style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: item.read ? '#F3F4F6' : typeStyle.border + '25', // 25 = ~15% opacity hex
              alignItems: 'center', justifyContent: 'center', marginRight: 15, flexShrink: 0,
            }}>
              <Ionicons
                name={item.read ? 'mail-open-outline' : (item.icon || getNotifIcon(item.type))}
                size={22}
                color={item.read ? '#9CA3AF' : typeStyle.icon}
              />
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 15, fontWeight: item.read ? '700' : '800', color: darkSage, flex: 1 }} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: typeStyle.icon, marginLeft: 8, marginTop: 5 }} />}
              </View>

              <Text style={{ color: '#4A6B4C', fontSize: 13, marginTop: 4, lineHeight: 18, fontWeight: item.read ? '500' : '600' }} numberOfLines={3}>
                {item.message}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4 }}>
                <Ionicons name="time-outline" size={12} color="#7A9E76" />
                <Text style={{ color: '#7A9E76', fontSize: 11, fontWeight: '600' }}>{formatTime(item.createdAt)}</Text>
              </View>

              {/* Action chips — use type color */}
              {item.type === 'poll' && !item.read && (
                <View style={[s.actionChip, { borderColor: typeStyle.border }]}>
                  <Ionicons name="bar-chart-outline" size={13} color={typeStyle.icon} />
                  <Text style={[s.actionChipTxt, { color: typeStyle.icon }]}> Tap to respond →</Text>
                </View>
              )}
              {item.actionType === 'submit_feedback' && !item.read && (
                <View style={[s.actionChip, { borderColor: TYPE_COLORS.feedback.border }]}>
                  <Ionicons name="star-outline" size={13} color={TYPE_COLORS.feedback.icon} />
                  <Text style={[s.actionChipTxt, { color: TYPE_COLORS.feedback.icon }]}> Rate your trip →</Text>
                </View>
              )}
              {item.type === 'route' && !item.read && (
                <View style={[s.actionChip, { borderColor: TYPE_COLORS.route.border }]}>
                  <Ionicons name="map-outline" size={13} color={TYPE_COLORS.route.icon} />
                  <Text style={[s.actionChipTxt, { color: TYPE_COLORS.route.icon }]}> View route →</Text>
                </View>
              )}
            </View>

            {/* Mark read button */}
            {!item.read && (
              <TouchableOpacity onPress={() => markAsRead(item._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                <Ionicons name="checkmark-circle" size={22} color={typeStyle.icon} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) return (
    <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={brandGreen} />
      <Text style={{ color: '#9DB89A', marginTop: 10 }}>Loading notifications…</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={appBarDark} />

      {/* ── AppBar ─────────────────────────────────────────────── */}
      <LinearGradient colors={[brandGreen, appBarDark]} style={s.appBar}>
        <TouchableOpacity style={s.appBarBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={s.appBarCenter}>
          <Text style={s.appBarTitle}>Notifications</Text>
          {counts.unread > 0 && <Text style={s.appBarSub}>{counts.unread} unread</Text>}
        </View>

        {counts.unread > 0 ? (
          <TouchableOpacity style={s.appBarBtn} onPress={markAllAsRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="checkmark-done" size={22} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 38 }} />}
      </LinearGradient>

      {/* ── Category Tabs ─────────────────────────────────────── */}
      <View style={s.categoryBar}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}
          renderItem={({ item }) => {
            const count = item.id === 'all' ? notifications.length : notifications.filter(n => n.type === item.id).length;
            const active = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[s.catTab, active && s.catTabActive]}
                onPress={() => setSelectedCategory(item.id)}
              >
                <Ionicons name={item.icon} size={14} color={active ? '#fff' : '#7A9E76'} />
                <Text style={[s.catTabTxt, active && s.catTabTxtActive]}>
                  {' '}{item.label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Notification List ─────────────────────────────────── */}
      <FlatList
        data={displayed}
        renderItem={renderNotification}
        keyExtractor={item => item._id?.toString() || Math.random().toString()}
        contentContainerStyle={displayed.length === 0 ? { flex: 1, justifyContent: 'center' } : { paddingHorizontal: 16, paddingTop: 14, paddingBottom: counts.unread > 0 ? 90 : 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNotifications(selectedCategory); }}
            colors={[brandGreen]} tintColor={brandGreen}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingHorizontal: 40, opacity: 0.6 }}>
            <View style={{ backgroundColor: '#fff', padding: 30, borderRadius: 40, borderWidth: 1, borderColor: borderColor }}>
              <Ionicons name="notifications-off-outline" size={50} color={brandGreen} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: darkSage, marginTop: 20 }}>All caught up!</Text>
            <Text style={{ fontSize: 14, color: '#7A9E76', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              {selectedCategory === 'all' ? "No notifications yet!" : `No ${categories.find(c => c.id === selectedCategory)?.label} notifications`}
            </Text>
          </View>
        }
      />

      {/* ── Mark All FAB ─────────────────────────────────────── */}
      {counts.unread > 0 && (
        <TouchableOpacity style={s.fab} onPress={markAllAsRead} activeOpacity={0.85}>
          <LinearGradient colors={[brandGreen, appBarDark]} style={s.fabGrad}>
            <Ionicons name="checkmark-done" size={16} color="#fff" />
            <Text style={s.fabTxt}>  Mark All Read</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── Poll Modal ───────────────────────────────────────── */}
      <Modal visible={showPollModal} animationType="slide" transparent onRequestClose={() => { setShowPollModal(false); setSelectedPoll(null); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {/* Poll modal header — brand green instead of blue */}
            <LinearGradient colors={[brandGreen, appBarDark]} style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>{selectedPoll?.title || 'Travel Poll'}</Text>
              <TouchableOpacity onPress={() => { setShowPollModal(false); setSelectedPoll(null); }}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </LinearGradient>

            <View style={s.modalBody}>
              <Text style={s.pollQuestion}>{selectedPoll?.question || 'Will you travel tomorrow?'}</Text>
              {selectedPoll?.closesAt && <Text style={s.pollClosing}>⏰ Closes at: {selectedPoll.closesAt}</Text>}

              <View style={s.responseRow}>
                <TouchableOpacity style={[s.responseBtn, s.yesBtn, travelResponse === 'yes' && s.selectedBtn]} onPress={() => setTravelResponse('yes')}>
                  <Ionicons name="checkmark-circle" size={20} color={travelResponse === 'yes' ? '#fff' : brandGreen} />
                  <Text style={[s.responseTxt, travelResponse === 'yes' && s.selectedTxt]}> Yes, I'll Travel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.responseBtn, s.noBtn, travelResponse === 'no' && s.selectedNoBtn]} onPress={() => setTravelResponse('no')}>
                  <Ionicons name="close-circle" size={20} color={travelResponse === 'no' ? '#fff' : '#7A4040'} />
                  <Text style={[s.responseTxt, travelResponse === 'no' && s.selectedTxt]}> No</Text>
                </TouchableOpacity>
              </View>

              {travelResponse === 'no' && (
                <TouchableOpacity style={[s.submitBtn, { marginTop: 12 }]} onPress={submitPollResponse} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.submitTxt}>Confirm — Won't Travel</Text>}
                </TouchableOpacity>
              )}

              {travelResponse === 'yes' && (
                <View style={{ marginTop: 12 }}>
                  <Text style={s.sectionLabel}>Select Time Slot:</Text>
                  {selectedPoll?.timeSlots?.length > 0
                    ? selectedPoll.timeSlots.map((slot, i) => (
                        <TouchableOpacity key={i} style={[s.slotBtn, selectedTimeSlot === slot && s.slotBtnActive]} onPress={() => setSelectedTimeSlot(slot)}>
                          <Ionicons name={selectedTimeSlot === slot ? 'radio-button-on' : 'radio-button-off'} size={18} color={selectedTimeSlot === slot ? brandGreen : '#999'} />
                          <Text style={[s.slotTxt, selectedTimeSlot === slot && s.slotTxtActive]}> {slot}</Text>
                        </TouchableOpacity>
                      ))
                    : <Text style={{ color: '#999', marginBottom: 12 }}>No time slots defined.</Text>
                  }
                  <Text style={[s.sectionLabel, { marginTop: 12 }]}>Pickup Point:</Text>
                  <TextInput style={s.pickupInput} placeholder="Enter your pickup point" placeholderTextColor="#999" value={pickupPoint} onChangeText={setPickupPoint} />
                  <TouchableOpacity style={[s.submitBtn, { marginTop: 14, opacity: (!selectedTimeSlot || !pickupPoint || submitting) ? 0.5 : 1 }]} onPress={submitPollResponse} disabled={!selectedTimeSlot || !pickupPoint || submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark-done" size={18} color="#fff" /><Text style={s.submitTxt}>  Confirm Response</Text></>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: bgColor },
  appBar:   { flexDirection: 'row', alignItems: 'center', paddingTop: 46, paddingBottom: 10, paddingHorizontal: 14, gap: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  appBarBtn:{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(172,197,168,0.14)', alignItems: 'center', justifyContent: 'center' },
  appBarCenter:{ flex: 1 },
  appBarTitle:{ fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  appBarSub:  { fontSize: 11, color: 'rgba(172,197,168,0.8)', marginTop: 1 },

  categoryBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: borderColor },
  catTab:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F6FAF5', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: borderColor },
  catTabActive:{ backgroundColor: brandGreen, borderColor: brandGreen },
  catTabTxt:   { fontSize: 12, fontWeight: '600', color: '#bbd4b8' },
  catTabTxtActive:{ color: '#fff' },

  actionChip:   { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  actionChipTxt:{ fontSize: 12, fontWeight: '600' },

  fab:     { position: 'absolute', bottom: 24, alignSelf: 'center' },
  fabGrad: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24, elevation: 6, shadowColor: brandGreen, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fabTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent:{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle:  { color: '#fff', fontSize: 17, fontWeight: '800', flex: 1, marginRight: 12 },
  modalBody:   { padding: 20 },
  pollQuestion:{ fontSize: 16, fontWeight: '700', color: '#1A2E1C', marginBottom: 8, lineHeight: 22 },
  pollClosing: { fontSize: 12, color: '#7A5C30', marginBottom: 16 },  // was #FF9800
  responseRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  responseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 2 },
  yesBtn:      { borderColor: brandGreen, backgroundColor: lightGreenBg },
  noBtn:       { borderColor: '#9E6A6A', backgroundColor: '#F9EDED' },
  selectedBtn: { backgroundColor: brandGreen, borderColor: brandGreen },
  selectedNoBtn:{ backgroundColor: '#7A3A3A', borderColor: '#7A3A3A' },
  responseTxt: { fontSize: 14, fontWeight: '700', color: '#333' },
  selectedTxt: { color: '#fff' },
  sectionLabel:{ fontSize: 14, fontWeight: '700', color: '#1A2E1C', marginBottom: 10 },
  slotBtn:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: borderColor, backgroundColor: bgColor, marginBottom: 8 },
  slotBtnActive:{ borderColor: brandGreen, backgroundColor: lightGreenBg },
  slotTxt:     { fontSize: 14, color: '#555' },
  slotTxtActive:{ color: brandGreen, fontWeight: '700' },
  pickupInput: { borderWidth: 1, borderColor: borderColor, borderRadius: 12, padding: 12, fontSize: 14, color: '#1A2E1C', backgroundColor: bgColor },
  submitBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: brandGreen, borderRadius: 14, paddingVertical: 14 },
  submitTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },
});