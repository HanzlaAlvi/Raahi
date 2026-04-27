// frontend/Transporter/sections/ComplaintsSection.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, StyleSheet, Platform, Modal, Alert,
  ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api }            from '../services/ApiService';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  deeper:    '#1A2B1C',
  white:     '#FFFFFF',
  bg:        '#F2F5F2',
  card:      '#FFFFFF',
  light:     '#EDF4ED',
  border:    '#D4DDD4',
  divider:   '#EBF0EB',
  ink:       '#0F1A10',
  textDark:  '#1A2218',
  textMid:   '#4A5E4C',
  textLight: '#6B7B6C',
  textMuted: '#9CAF9C',

  resolvedFg:  '#2A6B2E', resolvedBg: '#E6F4E7', resolvedMid: '#4CAF50',
  openFg:      '#8B2020', openBg:     '#FDEAEA', openMid:     '#E53935',
  pendingFg:   '#7A5C00', pendingBg:  '#FDF6E3', pendingMid:  '#E59A2A',
  closedFg:    '#4A5568', closedBg:   '#F7F8FA', closedMid:   '#9CA3AF',
};

const STATUS_CONFIG = {
  resolved: { fg: P.resolvedFg, bg: P.resolvedBg, mid: P.resolvedMid, icon: 'checkmark-circle', label: 'Resolved' },
  open:     { fg: P.openFg,     bg: P.openBg,     mid: P.openMid,     icon: 'alert-circle',     label: 'Open'     },
  pending:  { fg: P.pendingFg,  bg: P.pendingBg,  mid: P.pendingMid,  icon: 'time',             label: 'Pending'  },
  closed:   { fg: P.closedFg,   bg: P.closedBg,   mid: P.closedMid,   icon: 'close-circle',     label: 'Closed'   },
};
const getStatus = (s) => STATUS_CONFIG[s?.toLowerCase()] || STATUS_CONFIG.open;

const formatDate = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · ' + new Date(d).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const FILTERS = [
  { id: 'all',      label: 'All',      icon: 'layers-outline'           },
  { id: 'open',     label: 'Open',     icon: 'alert-circle-outline'     },
  { id: 'pending',  label: 'Pending',  icon: 'time-outline'             },
  { id: 'resolved', label: 'Resolved', icon: 'checkmark-circle-outline' },
  { id: 'closed',   label: 'Closed',   icon: 'close-circle-outline'     },
];

// ── Status Update Modal ───────────────────────────────────────────
const StatusModal = ({ visible, complaint, onClose, onUpdated }) => {
  const [newStatus, setNewStatus] = useState('open');
  const [note,      setNote]      = useState('');
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (complaint) {
      setNewStatus((complaint.status || 'open').toLowerCase());
      setNote('');
    }
  }, [complaint]);

  const STATUS_OPTIONS = [
    { id: 'open',     label: 'Open',     icon: 'alert-circle',     color: P.openMid     },
    { id: 'pending',  label: 'Pending',  icon: 'time',             color: P.pendingMid  },
    { id: 'resolved', label: 'Resolved', icon: 'checkmark-circle', color: P.resolvedMid },
    { id: 'closed',   label: 'Closed',   icon: 'close-circle',     color: P.closedMid   },
  ];

  const handleSave = async () => {
    if (!note.trim()) {
      Alert.alert('Note Required', 'Please add a note before updating the status.');
      return;
    }
    setSaving(true);
    try {
      const { token } = await api.getAuthData();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const body    = JSON.stringify({ status: newStatus, note: note.trim() });

      let res = await fetch(`${API_BASE}/complaints/${complaint._id}`, {
        method: 'PATCH', headers, body,
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/complaints/${complaint._id}`, {
          method: 'PUT', headers, body,
        });
      }
      const data = await res.json();
      if (data.success !== false) {
        Alert.alert('Updated ✅', `Complaint status changed to ${newStatus}. The complainant has been notified.`);
        onUpdated?.();
        onClose();
      } else {
        Alert.alert('Error', data.message || 'Could not update status.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setSaving(false);
    }
  };

  if (!complaint) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={ms.root}>
          <LinearGradient colors={[P.main, P.dark]} style={ms.header}>
            <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
              <Ionicons name="close" size={22} color={P.white} />
            </TouchableOpacity>
            <Text style={ms.headerTitle}>Update Complaint</Text>
            <View style={{ width: 38 }} />
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18 }} showsVerticalScrollIndicator={false}>
            {/* Complaint summary */}
            <View style={ms.summaryCard}>
              <Text style={ms.summaryLabel}>Complaint</Text>
              <Text style={ms.summaryTitle}>{complaint.subject || complaint.title || 'Complaint'}</Text>
              {(complaint.description || complaint.message) ? (
                <Text style={ms.summaryBody}>{complaint.description || complaint.message}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {complaint.byName ? (
                  <View style={ms.chip}>
                    <Ionicons name="person-outline" size={11} color={P.textLight} />
                    <Text style={ms.chipTxt}>{complaint.byName}</Text>
                    {complaint.byRole ? (
                      <Text style={[ms.chipTxt, { color: P.main, fontWeight: '700' }]}>
                        ({complaint.byRole})
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {(complaint.passengerName || complaint.byName) ? (
                  <View style={ms.chip}>
                    <Ionicons name="person-outline" size={11} color={P.textLight} />
                    <Text style={ms.chipTxt}>{complaint.passengerName || complaint.byName}</Text>
                  </View>
                ) : null}
                {complaint.category ? (
                  <View style={ms.chip}>
                    <Ionicons name="pricetag-outline" size={11} color={P.textLight} />
                    <Text style={ms.chipTxt}>{complaint.category}</Text>
                  </View>
                ) : null}
                {complaint.createdAt ? (
                  <View style={ms.chip}>
                    <Ionicons name="time-outline" size={11} color={P.textLight} />
                    <Text style={ms.chipTxt}>{formatDate(complaint.createdAt)}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Current status */}
            <Text style={ms.sectionLabel}>CURRENT STATUS</Text>
            <View style={[ms.currentStatus, { backgroundColor: getStatus(complaint.status).bg }]}>
              <Ionicons name={getStatus(complaint.status).icon} size={16} color={getStatus(complaint.status).fg} />
              <Text style={[ms.currentStatusTxt, { color: getStatus(complaint.status).fg }]}>
                {getStatus(complaint.status).label}
              </Text>
            </View>

            {/* New status selector */}
            <Text style={ms.sectionLabel}>CHANGE STATUS TO</Text>
            <View style={ms.statusGrid}>
              {STATUS_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[ms.statusOption, newStatus === opt.id && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                  onPress={() => setNewStatus(opt.id)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={opt.icon} size={20} color={newStatus === opt.id ? opt.color : P.textLight} />
                  <Text style={[ms.statusOptionTxt, newStatus === opt.id && { color: opt.color, fontWeight: '800' }]}>
                    {opt.label}
                  </Text>
                  {newStatus === opt.id ? (
                    <View style={[ms.selectedDot, { backgroundColor: opt.color }]} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Note */}
            <Text style={ms.sectionLabel}>
              {newStatus === 'resolved' ? 'RESOLUTION NOTE' :
               newStatus === 'pending'  ? 'PENDING NOTE'    :
               newStatus === 'closed'   ? 'CLOSING NOTE'    : 'ADD NOTE'}
              <Text style={{ color: P.openMid }}> *</Text>
            </Text>
            <TextInput
              style={ms.noteInput}
              placeholder={
                newStatus === 'resolved' ? 'Describe how this was resolved…' :
                newStatus === 'pending'  ? 'Explain why this is pending…' :
                newStatus === 'closed'   ? 'Reason for closing…' :
                'Add a note about this update…'
              }
              placeholderTextColor={P.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={ms.notifyInfo}>
              <Ionicons name="notifications-outline" size={14} color={P.main} />
              <Text style={ms.notifyInfoTxt}>The complainant will be notified of this update.</Text>
            </View>

            <TouchableOpacity
              style={[ms.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[P.main, P.dark]} style={ms.saveBtnInner}>
                {saving
                  ? <ActivityIndicator size="small" color={P.white} />
                  : <>
                      <Ionicons name="checkmark-circle-outline" size={18} color={P.white} />
                      <Text style={ms.saveBtnTxt}>Update Status & Notify</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Stat Pill ─────────────────────────────────────────────────────
const StatPill = ({ label, value, color, bg }) => (
  <View style={[s.statPill, { backgroundColor: bg, borderColor: color + '30' }]}>
    <Text style={[s.statVal, { color }]}>{value}</Text>
    <Text style={[s.statLbl, { color: color + 'BB' }]}>{label}</Text>
  </View>
);

// ── Complaint Card ────────────────────────────────────────────────
const ComplaintCard = ({ item, onManage }) => {
  const [expanded, setExpanded] = useState(false);
  const sc = getStatus(item.status);

  // Determine complainant type label
  const roleLabel = (item.byRole || '').toLowerCase() === 'driver' ? 'Driver' : 'Passenger';
  const roleBg    = roleLabel === 'Driver' ? '#E3F2FD' : '#E8F5E9';
  const roleColor = roleLabel === 'Driver' ? '#0D47A1' : '#2E7D32';

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.88}
      style={s.card}
    >
      <View style={[s.cardTopLine, { backgroundColor: sc.mid }]} />
      <View style={s.cardInner}>
        <View style={[s.cardIconBox, { backgroundColor: sc.bg, borderColor: sc.mid + '30' }]}>
          <Ionicons name={sc.icon} size={20} color={sc.fg} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle} numberOfLines={expanded ? undefined : 1}>
              {item.subject || item.title || 'Complaint'}
            </Text>
            <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.mid + '40' }]}>
              <View style={[s.statusDot, { backgroundColor: sc.mid }]} />
              <Text style={[s.statusBadgeTxt, { color: sc.fg }]}>{sc.label}</Text>
            </View>
          </View>

          {/* Role badge — shows whether this is a driver or passenger complaint */}
          <View style={[s.roleBadge, { backgroundColor: roleBg }]}>
            <Ionicons
              name={roleLabel === 'Driver' ? 'car-outline' : 'person-outline'}
              size={10}
              color={roleColor}
            />
            <Text style={[s.roleBadgeTxt, { color: roleColor }]}>
              {roleLabel} Complaint
            </Text>
          </View>

          {(item.description || item.message) ? (
            <Text style={s.cardBody} numberOfLines={expanded ? undefined : 2}>
              {item.description || item.message}
            </Text>
          ) : null}

          <View style={s.metaChips}>
            {(item.byName || item.passengerName) ? (
              <View style={s.metaChip}>
                <Ionicons name="person-outline" size={11} color={P.textLight} />
                <Text style={s.metaChipTxt}>{item.byName || item.passengerName}</Text>
              </View>
            ) : null}
            {item.category ? (
              <View style={s.metaChip}>
                <Ionicons name="pricetag-outline" size={11} color={P.textLight} />
                <Text style={s.metaChipTxt}>{item.category}</Text>
              </View>
            ) : null}
            {item.createdAt ? (
              <View style={s.metaChip}>
                <Ionicons name="time-outline" size={11} color={P.textLight} />
                <Text style={s.metaChipTxt}>{formatDate(item.createdAt)}</Text>
              </View>
            ) : null}
          </View>

          {/* Latest transporter note */}
          {item.note ? (
            <View style={s.noteBox}>
              <Ionicons name="document-text-outline" size={12} color={P.textLight} />
              <Text style={s.noteTxt}>{item.note}</Text>
            </View>
          ) : null}

          {/* All replies when expanded */}
          {expanded && item.replies && item.replies.length > 0 ? (
            <View style={s.repliesBox}>
              <Text style={s.repliesLabel}>Notes History</Text>
              {item.replies.map((r, i) => (
                <View key={i} style={s.replyRow}>
                  <Ionicons name="chatbubble-outline" size={11} color={P.textLight} />
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={s.replyBy}>{r.by} · {formatDate(r.date)}</Text>
                    <Text style={s.replyTxt}>{r.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={s.manageBtn}
            onPress={() => onManage(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={13} color={P.main} />
            <Text style={s.manageBtnTxt}>Manage Status</Text>
          </TouchableOpacity>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={15} color={P.textMuted}
          style={{ alignSelf: 'flex-start', marginTop: 2, marginLeft: 6 }}
        />
      </View>
    </TouchableOpacity>
  );
};

// ── Main Component ────────────────────────────────────────────────
const ComplaintsSection = ({ complaints = [], refreshing, onRefresh }) => {
  const [filter,          setFilter]          = useState('all');
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [modalVisible,    setModalVisible]    = useState(false);
  const [localComplaints, setLocalComplaints] = useState(complaints);

  useEffect(() => { setLocalComplaints(complaints); }, [complaints]);

  const displayed = filter === 'all'
    ? localComplaints
    : localComplaints.filter(c => (c.status || 'open').toLowerCase() === filter);

  const countOf = (id) => id === 'all'
    ? localComplaints.length
    : localComplaints.filter(c => (c.status || 'open').toLowerCase() === id).length;

  const handleManage = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleUpdated = () => {
    onRefresh?.();
  };

  return (
    <View style={s.root}>
      {/* Stats bar */}
      <LinearGradient colors={[P.main, P.dark]} style={s.statsBar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <StatPill label="Total"    value={localComplaints.length}            color="#C8DEC5" bg="rgba(255,255,255,0.10)" />
        <View style={s.statDivider} />
        <StatPill label="Open"     value={countOf('open')}     color={P.openMid}     bg="rgba(229,57,53,0.12)"  />
        <View style={s.statDivider} />
        <StatPill label="Pending"  value={countOf('pending')}  color={P.pendingMid}  bg="rgba(229,154,42,0.12)" />
        <View style={s.statDivider} />
        <StatPill label="Resolved" value={countOf('resolved')} color={P.resolvedMid} bg="rgba(76,175,80,0.12)"  />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.main]} tintColor={P.main} />
        }
      >
        <View style={s.sectionHeader}>
          <LinearGradient colors={[P.main, P.dark]} style={s.sectionIconPill}>
            <Ionicons name="warning-outline" size={13} color={P.white} />
          </LinearGradient>
          <Text style={s.sectionTitle}>
            {filter === 'all' ? 'All Complaints' : FILTERS.find(f => f.id === filter)?.label}
          </Text>
          {displayed.length > 0 ? (
            <View style={s.countBadge}>
              <Text style={s.countBadgeTxt}>{displayed.length}</Text>
            </View>
          ) : null}
        </View>

        {displayed.length > 0 ? (
          displayed.map((c, i) => (
            <ComplaintCard key={c._id || i} item={c} onManage={handleManage} />
          ))
        ) : (
          <View style={s.empty}>
            <LinearGradient colors={[P.light, P.white]} style={s.emptyIconBox}>
              <Ionicons name="checkmark-circle-outline" size={44} color={P.main} />
            </LinearGradient>
            <Text style={s.emptyTitle}>
              {filter === 'all' ? 'No complaints!' : `No ${filter} complaints`}
            </Text>
            <Text style={s.emptySub}>
              {filter === 'all'
                ? 'Everything is running smoothly.'
                : `No complaints with "${filter}" status found.`}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Status Update Modal */}
      <StatusModal
        visible={modalVisible}
        complaint={selectedItem}
        onClose={() => { setModalVisible(false); setSelectedItem(null); }}
        onUpdated={handleUpdated}
      />
    </View>
  );
};

export default ComplaintsSection;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.bg },

  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  statPill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 10, borderWidth: 1 },
  statVal:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statLbl:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },

  filterBar:     { backgroundColor: P.card, borderBottomWidth: 1, borderBottomColor: P.border },
  filterContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: P.border, backgroundColor: P.card, gap: 4 },
  chipActive:    { backgroundColor: P.main, borderColor: P.main },
  chipTxt:       { fontSize: 12, fontWeight: '600', color: P.textLight },
  chipTxtActive: { color: P.white },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 14, gap: 10 },
  sectionIconPill: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { flex: 1, fontSize: 17, fontWeight: '900', color: P.ink, letterSpacing: -0.3 },
  countBadge:    { backgroundColor: P.main, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeTxt: { color: P.white, fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: P.card, borderRadius: 18, marginBottom: 12,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#1A2B1C', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  cardTopLine:  { height: 3, width: '100%' },
  cardInner:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
  cardIconBox:  { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  cardTitle:    { fontSize: 14, fontWeight: '800', color: P.ink, flex: 1, letterSpacing: -0.2 },

  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, flexShrink: 0 },
  statusDot:     { width: 5, height: 5, borderRadius: 2.5 },
  statusBadgeTxt:{ fontSize: 10, fontWeight: '800' },

  roleBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginBottom: 6 },
  roleBadgeTxt: { fontSize: 10, fontWeight: '700' },

  cardBody:  { fontSize: 13, color: P.textMid, lineHeight: 19, marginBottom: 10 },

  metaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  metaChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: P.border },
  metaChipTxt: { fontSize: 11, color: P.textLight, fontWeight: '500' },

  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: P.bg, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: P.border },
  noteTxt: { fontSize: 12, color: P.textMid, flex: 1, lineHeight: 17 },

  repliesBox:   { backgroundColor: '#F9FBF9', borderRadius: 10, padding: 10, marginTop: 8, gap: 6 },
  repliesLabel: { fontSize: 10, fontWeight: '800', color: P.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  replyRow:     { flexDirection: 'row', alignItems: 'flex-start' },
  replyBy:      { fontSize: 10, fontWeight: '700', color: P.textLight, marginBottom: 2 },
  replyTxt:     { fontSize: 12, color: P.textMid, lineHeight: 17 },

  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', backgroundColor: P.light, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: P.border },
  manageBtnTxt: { fontSize: 12, fontWeight: '700', color: P.main },

  empty:       { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBox:{ width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 18, borderWidth: 1, borderColor: P.border },
  emptyTitle:  { fontSize: 18, fontWeight: '900', color: P.dark, marginBottom: 6 },
  emptySub:    { fontSize: 14, color: P.textMuted, textAlign: 'center', lineHeight: 20 },
});

const ms = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F5F7F5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14, gap: 10,
  },
  closeBtn:     { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#fff' },

  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#D4DDD4' },
  summaryLabel:{ fontSize: 10, fontWeight: '800', color: '#9CAF9C', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  summaryTitle:{ fontSize: 15, fontWeight: '800', color: '#0F1A10', marginBottom: 5 },
  summaryBody: { fontSize: 13, color: '#4A5E4C', lineHeight: 19 },
  chip:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2F5F2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#D4DDD4' },
  chipTxt:     { fontSize: 11, color: '#6B7B6C' },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#9CAF9C', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },

  currentStatus:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginBottom: 20 },
  currentStatusTxt: { fontSize: 14, fontWeight: '800' },

  statusGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: '45%', borderWidth: 1.5, borderColor: '#D4DDD4', borderRadius: 12, padding: 13, backgroundColor: '#fff', position: 'relative' },
  statusOptionTxt: { fontSize: 13, fontWeight: '600', color: '#6B7B6C' },
  selectedDot:  { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 8, right: 8 },

  noteInput: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D4DDD4', borderRadius: 14, padding: 14, fontSize: 14, color: '#1A2218', minHeight: 120, marginBottom: 12, lineHeight: 21 },

  notifyInfo:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EDF4ED', borderRadius: 10, padding: 10, marginBottom: 16 },
  notifyInfoTxt: { flex: 1, fontSize: 12, color: '#415844', fontWeight: '600' },

  saveBtn:      { borderRadius: 14, overflow: 'hidden', marginBottom: 30 },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  saveBtnTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },
});