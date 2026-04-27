// frontend/Passenger/src/screens/support/ContactSupportScreen.js
// Complaint submission and tracking — same system as Driver SupportScreen
// Passengers submit complaints to transporter; transporter notes/status shown inline.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Modal, ActivityIndicator, Platform,
  Alert, StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';

const API = 'https://raahi-q2ur.onrender.com/api';

const C = {
  main:    '#415844',
  dark:    '#2D3E2F',
  light:   '#EDF1ED',
  white:   '#FFFFFF',
  bg:      '#F6FAF5',
  border:  '#C8DEC5',
  sage:    '#ACC5A8',
  textDk:  '#1A2218',
  textMd:  '#4A6B4C',
  textLt:  '#7A9E76',
  error:   '#C62828',
  success: '#2E7D32',
  successBg: '#E8F5E9',
  warnBg:  '#FFF3E0',
  warn:    '#E65100',
};

const SB_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const STATUS_CONFIG = {
  open:     { color: C.error,   bg: '#FFEBEE', icon: 'alert-circle',     label: 'Open'     },
  pending:  { color: C.warn,    bg: C.warnBg,  icon: 'time',             label: 'Pending'  },
  resolved: { color: C.success, bg: C.successBg,icon: 'checkmark-circle', label: 'Resolved' },
  closed:   { color: '#6B7280', bg: '#F7F8FA', icon: 'close-circle',     label: 'Closed'   },
};
const getSC = (s) => STATUS_CONFIG[(s || 'open').toLowerCase()] || STATUS_CONFIG.open;

const fmtDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
};

// ── Individual complaint card ─────────────────────────────────────────────────
function ComplaintCard({ ticket }) {
  const [expanded, setExpanded] = useState(false);
  const sc = getSC(ticket.status);

  const transporterReplies = (ticket.replies || []).filter(
    (r) => (r.byRole || '').toLowerCase() === 'transporter'
  );
  const standaloneNote = ticket.note && ticket.note.trim();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setExpanded((p) => !p)}
      style={{
        backgroundColor: C.white,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        ...Platform.select({
          ios:     { shadowColor: '#1A2B1C', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
          android: { elevation: 2 },
        }),
      }}
    >
      {/* Coloured top strip */}
      <View style={{ height: 3, backgroundColor: sc.color }} />

      <View style={{ padding: 14 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: sc.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ionicons name={sc.icon} size={18} color={sc.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.textDk }} numberOfLines={expanded ? undefined : 1}>
              {ticket.title || ticket.subject || 'Complaint'}
            </Text>
            <Text style={{ fontSize: 11, color: C.textLt, marginTop: 2 }}>{fmtDate(ticket.createdAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: sc.bg, flexShrink: 0, marginLeft: 8 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: sc.color }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: sc.color }}>{sc.label}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={{ backgroundColor: C.bg, padding: 11, borderRadius: 11, marginBottom: expanded ? 10 : 0 }}>
          <Text style={{ fontSize: 13, color: C.textMd, lineHeight: 18 }} numberOfLines={expanded ? undefined : 2}>
            {ticket.description || ticket.message || 'No description.'}
          </Text>
        </View>

        {/* Expanded: transporter updates */}
        {expanded && (
          <>
            {/* Standalone note */}
            {standaloneNote && transporterReplies.length === 0 && (
              <View style={{ backgroundColor: C.successBg, borderRadius: 11, padding: 11, marginTop: 6, borderLeftWidth: 3, borderLeftColor: C.main }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color={C.main} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.main, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    Transporter Note
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: '#2D4A30', lineHeight: 18 }}>{standaloneNote}</Text>
              </View>
            )}

            {/* Reply history */}
            {transporterReplies.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: C.border }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.textLt, marginHorizontal: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Transporter Updates
                  </Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: C.border }} />
                </View>
                {transporterReplies.map((reply, idx) => (
                  <View key={idx} style={{ backgroundColor: C.successBg, borderRadius: 11, padding: 11, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.main }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="person-circle-outline" size={13} color={C.main} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: C.main }}>{reply.by || 'Transporter'}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: C.textLt }}>{fmtDate(reply.date)}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#2D4A30', lineHeight: 18 }}>{reply.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* No updates yet */}
            {transporterReplies.length === 0 && !standaloneNote && (
              <View style={{ alignItems: 'center', paddingVertical: 10, opacity: 0.5 }}>
                <Ionicons name="hourglass-outline" size={18} color={C.textLt} />
                <Text style={{ fontSize: 12, color: C.textLt, marginTop: 4 }}>Awaiting transporter response</Text>
              </View>
            )}
          </>
        )}

        {/* Expand chevron */}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.textLt}
          style={{ alignSelf: 'flex-end', marginTop: 6 }}
        />
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ContactSupportScreen({ navigation }) {
  const [tickets,       setTickets]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [subject,       setSubject]       = useState('');
  const [description,   setDescription]  = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [token,         setToken]         = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const tok = await AsyncStorage.getItem('authToken')
               || await AsyncStorage.getItem('userToken')
               || await AsyncStorage.getItem('token');
      setToken(tok);
      await loadTickets(tok);
    } catch (e) {
      console.error('[ContactSupport] init:', e.message);
    }
  };

  const loadTickets = useCallback(async (tok) => {
    setLoading(true);
    try {
      const t = tok || token;
      if (!t) return;
      const res  = await fetch(`${API}/complaints`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) setTickets(data.complaints || data.data || []);
    } catch (e) {
      console.error('[ContactSupport] loadTickets:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTickets(token);
  };

  const submitTicket = async () => {
    if (!subject.trim()) {
      Alert.alert('Validation', 'Please enter a subject for your complaint.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Validation', 'Please describe your issue.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/complaints`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:       subject.trim(),
          description: description.trim(),
          status:      'open',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubject('');
        setDescription('');
        setModalVisible(false);
        Alert.alert('Submitted ✅', 'Your complaint has been sent to your transporter.');
        loadTickets(token);
      } else {
        Alert.alert('Error', data.message || 'Could not submit complaint.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const FILTERS = ['all', 'open', 'pending', 'resolved', 'closed'];
  const displayed = filterStatus === 'all'
    ? tickets
    : tickets.filter((t) => (t.status || 'open').toLowerCase() === filterStatus);

  const countOf = (f) => f === 'all'
    ? tickets.length
    : tickets.filter((t) => (t.status || 'open').toLowerCase() === f).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />

      {/* Stats bar */}
      <LinearGradient colors={[C.main, C.dark]} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        {[
          { label: 'Total',    value: tickets.length,    color: '#C8DEC5' },
          { label: 'Open',     value: countOf('open'),    color: '#EF9A9A' },
          { label: 'Pending',  value: countOf('pending'), color: '#FFD54F' },
          { label: 'Resolved', value: countOf('resolved'),color: '#69F0AE' },
        ].map((item, i, arr) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 4 }} />}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: item.color }}>{item.value}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 }}>{item.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </LinearGradient>

      {/* Filter chips */}
      <View style={{ backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: '#E5EBE5' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' }}>
          {FILTERS.map((f) => {
            const active = filterStatus === f;
            const cnt    = countOf(f);
            return (
              <TouchableOpacity
                key={f}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: active ? C.main : '#D4DDD4', backgroundColor: active ? C.main : C.white }}
                onPress={() => setFilterStatus(f)}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? C.white : '#6B7280' }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}{cnt > 0 ? ` (${cnt})` : ''}
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[C.main]} tintColor={C.main} />}
      >
        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
          <LinearGradient colors={[C.main, C.dark]} style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="headset-outline" size={13} color={C.white} />
          </LinearGradient>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '900', color: '#0F1A10', letterSpacing: -0.3 }}>
            {filterStatus === 'all' ? 'My Complaints' : `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Complaints`}
          </Text>
          {displayed.length > 0 && (
            <View style={{ backgroundColor: C.main, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 12 }}>{displayed.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <ActivityIndicator size="large" color={C.main} />
          </View>
        ) : displayed.length > 0 ? (
          displayed.map((t, i) => <ComplaintCard key={t._id || i} ticket={t} />)
        ) : (
          <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: 40 }}>
            <LinearGradient colors={[C.light, C.white]} style={{ width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: '#D4DDD4' }}>
              <Ionicons name="headset-outline" size={44} color={C.main} />
            </LinearGradient>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.dark, marginBottom: 6 }}>
              {filterStatus === 'all' ? 'No Complaints Yet' : `No ${filterStatus} complaints`}
            </Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 }}>
              {filterStatus === 'all'
                ? 'Tap the button below to submit a complaint to your transporter.'
                : `No complaints with "${filterStatus}" status found.`}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', bottom: 24, alignSelf: 'center' }}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.88}
      >
        <LinearGradient colors={[C.main, C.dark]} style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 22, paddingVertical: 13, borderRadius: 30,
          ...Platform.select({
            ios:     { shadowColor: C.dark, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 8 },
          }),
        }}>
          <Ionicons name="add-circle-outline" size={18} color={C.white} />
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 14 }}>New Complaint</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* New Complaint Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#F5F7F5' }}>
          <LinearGradient colors={[C.main, C.dark]} style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14, gap: 10,
          }}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={22} color={C.white} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.white }}>New Complaint</Text>
            <View style={{ width: 38 }} />
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 }}>Subject *</Text>
            <TextInput
              style={{ backgroundColor: C.white, borderWidth: 1.5, borderColor: '#D4DDD4', borderRadius: 14, padding: 14, fontSize: 14, color: '#1A2218', lineHeight: 21 }}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of your complaint"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 14 }}>Description *</Text>
            <TextInput
              style={{ backgroundColor: C.white, borderWidth: 1.5, borderColor: '#D4DDD4', borderRadius: 14, padding: 14, fontSize: 14, color: '#1A2218', lineHeight: 21, height: 140, textAlignVertical: 'top' }}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your issue in detail..."
              placeholderTextColor="#9CA3AF"
              multiline
            />

            <TouchableOpacity
              style={{ borderRadius: 14, overflow: 'hidden', marginTop: 24, marginBottom: 30, opacity: submitting ? 0.6 : 1 }}
              onPress={submitTicket}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[C.main, C.dark]} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 }}>
                {submitting
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <><Ionicons name="send-outline" size={16} color={C.white} /><Text style={{ fontSize: 15, fontWeight: '800', color: C.white }}>Submit Complaint</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}