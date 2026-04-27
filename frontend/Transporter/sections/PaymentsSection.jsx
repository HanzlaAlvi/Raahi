// Transporter/sections/PaymentsSection.jsx
//
// CHANGES:
//  - Passengers tab: transporter first sees ALL passengers list,
//    can set amount per passenger manually, optionally attaches a
//    proof screenshot (base64 from image picker), then saves.
//    Passenger is notified and their Payment screen shows ONLY their amount.
//  - Requests / Drivers tabs: unchanged from previous version.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  RefreshControl, StyleSheet, Platform, ActivityIndicator,
  Alert, TextInput, Modal, Image,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as ImagePicker   from 'expo-image-picker';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const C = {
  main:        '#415844',
  dark:        '#2D3E2F',
  white:       '#FFFFFF',
  bg:          '#F5F7F5',
  cardBg:      '#FFFFFF',
  light:       '#EDF1ED',
  border:      '#C5D0C5',
  divider:     '#E5EBE5',
  textDark:    '#1A2218',
  textMid:     '#374151',
  textLight:   '#6B7280',
  textMuted:   '#9CA3AF',
  success:     '#415844',
  successBg:   '#E8F5E9',
  warn:        '#6B7280',
  warnBg:      '#FFF3E0',
  danger:      '#C62828',
  dangerBg:    '#FFEBEE',
  info:        '#2D3E2F',
  infoBg:      '#E3F2FD',
  purple:      '#6A1B9A',
  purpleBg:    '#F3E5F5',
};

const PAYMENT_METHODS = ['EasyPaisa', 'JazzCash', 'Bank Transfer', 'Cash', 'Other'];

const fmtPKR  = (v) => `Rs. ${(+v || 0).toLocaleString('en-PK')}`;
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return String(d); }
};
const todayISO = () => new Date().toISOString().split('T')[0];
const initials = (name = '') =>
  (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const statusConfig = {
  paid:      { color: C.success,  bg: C.successBg, icon: 'checkmark-circle',    label: 'Paid'      },
  active:    { color: C.success,  bg: C.successBg, icon: 'checkmark-circle',    label: 'Active'    },
  approved:  { color: C.success,  bg: C.successBg, icon: 'checkmark-circle',    label: 'Approved'  },
  pending:   { color: C.warn,     bg: C.warnBg,    icon: 'time-outline',        label: 'Pending'   },
  unpaid:    { color: C.warn,     bg: C.warnBg,    icon: 'time-outline',        label: 'Unpaid'    },
  rejected:  { color: C.danger,   bg: C.dangerBg,  icon: 'close-circle',        label: 'Rejected'  },
  completed: { color: C.info,     bg: C.infoBg,    icon: 'checkmark-done',      label: 'Completed' },
  partial:   { color: C.purple,   bg: C.purpleBg,  icon: 'ellipsis-horizontal', label: 'Partial'   },
};
const getSC = (s) => statusConfig[(s || '').toLowerCase()] || statusConfig.pending;
const isPaidStatus = (s) => ['paid', 'active', 'approved', 'completed'].includes((s || '').toLowerCase());

const getAuth = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken')
               || await AsyncStorage.getItem('userToken')
               || await AsyncStorage.getItem('token');
    const tid   = await AsyncStorage.getItem('transporterId')
               || await AsyncStorage.getItem('userId');
    return { token, transporterId: tid };
  } catch { return { token: null, transporterId: null }; }
};

// ── Stat tile (unchanged UI) ───────────────────────────────────────────────
const StatTile = ({ icon, label, value, color, bg }) => (
  <View style={[s.statTile, { borderColor: color + '30' }]}>
    <View style={[s.statIconBox, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const MAIN_TABS = [
  { key: 'requests',   label: 'Requests',   icon: 'mail-outline'   },
  { key: 'passengers', label: 'Passengers', icon: 'person-outline' },
  { key: 'drivers',    label: 'Drivers',    icon: 'car-outline'    },
];

// ══════════════════════════════════════════════════════════════════
// SUBSCRIPTION REQUEST CARD  (pending → approve / reject)
// ══════════════════════════════════════════════════════════════════
const RequestCard = ({ item, onApprove, onReject, processing }) => (
  <View style={[s.card, { borderLeftColor: C.warn }]}>
    <View style={s.cardHeader}>
      <View style={s.avatarBox}>
        <Text style={s.avatarTxt}>{initials(item.passengerName)}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.cardName}>{item.passengerName || '—'}</Text>
        {item.passengerPhone ? <Text style={s.cardSub}>{item.passengerPhone}</Text> : null}
        {item.passengerEmail ? <Text style={s.cardSub}>{item.passengerEmail}</Text> : null}
      </View>
      <View style={[s.badge, { backgroundColor: C.warnBg }]}>
        <Text style={[s.badgeTxt, { color: C.warn }]}>Pending</Text>
      </View>
    </View>

    {(item.pickupPoint || item.destination) ? (
      <View style={{ marginBottom: 8, gap: 4 }}>
        {item.pickupPoint ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="location-outline" size={13} color={C.main} />
            <Text style={{ fontSize: 12, color: C.textMid }}>{item.pickupPoint}</Text>
          </View>
        ) : null}
        {item.destination ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flag-outline" size={13} color={C.success} />
            <Text style={{ fontSize: 12, color: C.textMid }}>{item.destination}</Text>
          </View>
        ) : null}
      </View>
    ) : null}

    <View style={s.infoGrid}>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>Plan</Text>
        <Text style={s.infoCellValue}>{item.planName || 'Monthly Subscription'}</Text>
      </View>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>Amount</Text>
        <Text style={[s.infoCellValue, { color: C.main }]}>{item.amount}</Text>
      </View>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>Requested</Text>
        <Text style={s.infoCellValue}>{fmtDate(item.requestDate)}</Text>
      </View>
      <View style={s.infoCell}>
        <Text style={s.infoCellLabel}>Period</Text>
        <Text style={s.infoCellValue}>{item.startDate} → {item.endDate}</Text>
      </View>
    </View>

    <View style={s.actionRow}>
      <TouchableOpacity
        style={[s.rejectBtn, processing && { opacity: 0.5 }]}
        onPress={() => onReject(item)}
        disabled={!!processing}
      >
        {processing === 'reject'
          ? <ActivityIndicator size="small" color={C.danger} />
          : <><Ionicons name="close-circle-outline" size={15} color={C.danger} /><Text style={[s.actionBtnTxt, { color: C.danger }]}>Reject</Text></>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.approveBtn, processing && { opacity: 0.5 }]}
        onPress={() => onApprove(item)}
        disabled={!!processing}
      >
        {processing === 'approve'
          ? <ActivityIndicator size="small" color={C.white} />
          : <><Ionicons name="checkmark-circle-outline" size={15} color={C.white} /><Text style={s.approveBtnTxt}>Approve</Text></>}
      </TouchableOpacity>
    </View>
  </View>
);

// ══════════════════════════════════════════════════════════════════
// PASSENGER AMOUNT CARD
// Shows each passenger and lets transporter set / update amount.
// ══════════════════════════════════════════════════════════════════
const PassengerAmountCard = ({ passenger, onSetAmount }) => {
  const hasAmount = !!passenger.assignedAmount;
  const sc = hasAmount ? getSC(passenger.lastPaymentStatus) : getSC('pending');

  return (
    <View style={[s.card, { borderLeftColor: hasAmount ? C.success : C.warn }]}>
      <View style={s.cardHeader}>
        <View style={s.avatarBox}>
          <Text style={s.avatarTxt}>{initials(passenger.name)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.cardName}>{passenger.name || '—'}</Text>
          {passenger.phone ? <Text style={s.cardSub}>{passenger.phone}</Text> : null}
          {passenger.pickupPoint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="location-outline" size={11} color={C.main} />
              <Text style={{ fontSize: 11, color: C.textLight }}>{passenger.pickupPoint}</Text>
            </View>
          ) : null}
        </View>
        {hasAmount ? (
          <View style={[s.badge, { backgroundColor: C.successBg }]}>
            <Text style={[s.badgeTxt, { color: C.success }]}>{fmtPKR(passenger.assignedAmount)}</Text>
          </View>
        ) : (
          <View style={[s.badge, { backgroundColor: C.warnBg }]}>
            <Text style={[s.badgeTxt, { color: C.warn }]}>No Amount</Text>
          </View>
        )}
      </View>

      {passenger.proofImage ? (
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: '600', marginBottom: 4 }}>PROOF ATTACHED</Text>
          <Image
            source={{ uri: passenger.proofImage }}
            style={{ width: '100%', height: 100, borderRadius: 8, resizeMode: 'cover' }}
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={[s.markPaidBtn, { backgroundColor: hasAmount ? C.dark : C.main }]}
        onPress={() => onSetAmount(passenger)}
        activeOpacity={0.85}
      >
        <Ionicons name={hasAmount ? 'pencil-outline' : 'add-circle-outline'} size={15} color={C.white} />
        <Text style={s.markPaidTxt}>{hasAmount ? 'Update Amount' : 'Set Amount'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════
// SET PASSENGER AMOUNT MODAL
// Transporter enters amount + optionally picks a screenshot as proof.
// ══════════════════════════════════════════════════════════════════
const SetPassengerAmountModal = ({ visible, passenger, onClose, onSaved }) => {
  const [amount,      setAmount]      = useState('');
  const [description, setDescription] = useState('');
  const [proofImage,  setProofImage]  = useState(null);   // base64 URI
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    if (passenger) {
      setAmount(passenger.assignedAmount ? String(passenger.assignedAmount) : '');
      setDescription('');
      setProofImage(passenger.proofImage || null);
    }
  }, [passenger]);

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to attach a proof screenshot.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:  ImagePicker.MediaTypeOptions.Images,
        quality:     0.6,
        base64:      true,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri   = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setProofImage(uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open image picker. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(+amount) || +amount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      const { token } = await getAuth();
      const res = await fetch(`${API_BASE}/payments/set-passenger-amount`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          passengerId: passenger._id,
          amount:      +amount,
          amountLabel: `Rs. ${(+amount).toLocaleString('en-PK')}`,
          proofImage:  proofImage || null,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Saved ✅', data.message || 'Amount set. Passenger has been notified.');
        onSaved?.();
        onClose();
      } else {
        Alert.alert('Error', data.message || 'Could not save amount.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!passenger) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Set Amount — {passenger?.name || 'Passenger'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textMid} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: C.light, borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle-outline" size={16} color={C.main} />
              <Text style={{ flex: 1, fontSize: 12, color: C.info, fontWeight: '600', lineHeight: 18 }}>
                Set this passenger's monthly subscription amount. They will be notified and will see only this amount when activating their plan.
              </Text>
            </View>

            <Text style={s.inputLabel}>Monthly Amount (Rs.) *</Text>
            <TextInput
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              placeholderTextColor={C.textMuted}
            />

            <Text style={s.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[s.input, { height: 70, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Distance-based rate, agreed amount…"
              placeholderTextColor={C.textMuted}
              multiline
            />

            {/* Proof screenshot */}
            <Text style={s.inputLabel}>Proof Screenshot (optional)</Text>
            <TouchableOpacity
              style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.light }]}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="image-outline" size={18} color={C.main} />
                <Text style={{ fontSize: 13, color: proofImage ? C.main : C.textMuted, fontWeight: proofImage ? '700' : '400' }}>
                  {proofImage ? 'Screenshot attached ✓' : 'Tap to select screenshot'}
                </Text>
              </View>
              {proofImage ? (
                <TouchableOpacity onPress={() => setProofImage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={C.danger} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
              )}
            </TouchableOpacity>

            {proofImage ? (
              <Image
                source={{ uri: proofImage }}
                style={{ width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover', marginTop: 8, marginBottom: 4 }}
              />
            ) : null}

            <TouchableOpacity
              style={[s.markPaidBtn, { marginTop: 18 }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={C.white} />
                : <><Ionicons name="checkmark-circle-outline" size={15} color={C.white} /><Text style={s.markPaidTxt}>Save & Notify Passenger</Text></>}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════
// DRIVER PAYMENT CARD  (unchanged from previous version)
// ══════════════════════════════════════════════════════════════════
const DriverPayCard = ({ driverData, onAddPayment, onMarkPaid, expandedId, setExpandedId }) => {
  const { driver, paymentStats, payments } = driverData;
  const expanded = expandedId === driver._id?.toString();

  return (
    <View style={[s.card, { borderLeftColor: C.info }]}>
      <TouchableOpacity
        style={s.cardHeader}
        onPress={() => setExpandedId(expanded ? null : driver._id?.toString())}
        activeOpacity={0.8}
      >
        <View style={[s.avatarBox, { backgroundColor: C.infoBg }]}>
          <Text style={[s.avatarTxt, { color: C.info }]}>{initials(driver.name)}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.cardName}>{driver.name || '—'}</Text>
          <Text style={s.cardSub}>{driver.vehicleType || ''} {driver.vehicleNo ? `· ${driver.vehicleNo}` : ''}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.textMuted} />
      </TouchableOpacity>

      <View style={s.driverStatsRow}>
        <View style={[s.driverStatChip, { backgroundColor: C.successBg }]}>
          <Text style={[s.driverStatLabel, { color: C.success }]}>Paid</Text>
          <Text style={[s.driverStatValue, { color: C.success }]}>{fmtPKR(paymentStats.totalPaid)}</Text>
        </View>
        <View style={[s.driverStatChip, { backgroundColor: C.warnBg }]}>
          <Text style={[s.driverStatLabel, { color: C.warn }]}>Pending</Text>
          <Text style={[s.driverStatValue, { color: C.warn }]}>{fmtPKR(paymentStats.totalPending)}</Text>
        </View>
        <View style={[s.driverStatChip, { backgroundColor: C.light }]}>
          <Text style={[s.driverStatLabel, { color: C.main }]}>Records</Text>
          <Text style={[s.driverStatValue, { color: C.main }]}>{paymentStats.totalRecords}</Text>
        </View>
      </View>

      <TouchableOpacity style={s.addPayBtn} onPress={() => onAddPayment(driver)} activeOpacity={0.85}>
        <Ionicons name="send-outline" size={15} color={C.main} />
        <Text style={s.addPayBtnTxt}>Send Money to Driver</Text>
      </TouchableOpacity>

      {expanded && payments.length > 0 ? (
        <View style={s.payHistoryBox}>
          <Text style={s.payHistoryTitle}>Payment History</Text>
          {payments.map(pay => {
            const sc        = getSC(pay.status);
            const paid      = isPaidStatus(pay.status);
            const remaining = (pay.remainingAmount !== null && pay.remainingAmount !== undefined)
              ? pay.remainingAmount
              : Math.max(0, (pay.amount || 0) - (pay.paidAmount || 0));
            return (
              <View key={pay._id?.toString()} style={s.payHistoryItem}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <View style={[s.tinyBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[s.tinyBadgeTxt, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                    <Text style={s.payHistDate}>{fmtDate(pay.date)}</Text>
                  </View>
                  <Text style={s.payHistAmount}>{fmtPKR(pay.amount)}</Text>
                  {pay.paymentMethod ? (
                    <Text style={{ fontSize: 11, color: C.info, marginTop: 1 }}>via {pay.paymentMethod}</Text>
                  ) : null}
                  {pay.description ? <Text style={s.payHistDesc}>{pay.description}</Text> : null}
                  {(pay.paidAmount > 0 || remaining > 0) ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                      {pay.paidAmount > 0 ? (
                        <Text style={{ fontSize: 11, color: C.success }}>Paid: {fmtPKR(pay.paidAmount)}</Text>
                      ) : null}
                      {remaining > 0 ? (
                        <Text style={{ fontSize: 11, color: C.warn }}>Remaining: {fmtPKR(remaining)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {!paid ? (
                  <TouchableOpacity
                    style={s.miniMarkPaid}
                    onPress={() => onMarkPaid(pay, driver)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={13} color={C.white} />
                    <Text style={s.miniMarkPaidTxt}>Pay</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {expanded && payments.length === 0 ? (
        <View style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: C.textMuted, fontSize: 12 }}>No payment records yet</Text>
        </View>
      ) : null}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════════
// SEND MONEY TO DRIVER MODAL (unchanged)
// ══════════════════════════════════════════════════════════════════
const AddDriverPaymentModal = ({ visible, driver, onClose, onSave }) => {
  const [amount,        setAmount]        = useState('');
  const [paidAmount,    setPaidAmount]    = useState('');
  const [description,   setDescription]   = useState('');
  const [paymentDate,   setPaymentDate]   = useState(todayISO());
  const [paymentMethod, setPaymentMethod] = useState('EasyPaisa');
  const [showCalendar,  setShowCalendar]  = useState(false);
  const [saving,        setSaving]        = useState(false);

  const remaining  = Math.max(0, (+amount || 0) - (+paidAmount || 0));
  const autoStatus = remaining === 0 && +amount > 0 ? 'paid'
                   : +paidAmount > 0 ? 'partial' : 'pending';

  const MONTHS      = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentYear = new Date().getFullYear();
  const years       = [currentYear - 1, currentYear, currentYear + 1];
  const pd          = new Date(paymentDate);
  const selMonth    = pd.getMonth();
  const selYear     = pd.getFullYear();
  const selDay      = pd.getDate();
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();

  const pickMonth = (idx) => {
    const maxDay = new Date(selYear, idx + 1, 0).getDate();
    setPaymentDate(new Date(selYear, idx, Math.min(selDay, maxDay)).toISOString().split('T')[0]);
  };
  const pickYear  = (y) => {
    const maxDay = new Date(y, selMonth + 1, 0).getDate();
    setPaymentDate(new Date(y, selMonth, Math.min(selDay, maxDay)).toISOString().split('T')[0]);
  };
  const pickDay   = (day) => {
    setPaymentDate(new Date(selYear, selMonth, day).toISOString().split('T')[0]);
    setShowCalendar(false);
  };
  const setPreset = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setPaymentDate(d.toISOString().split('T')[0]);
    setShowCalendar(false);
  };
  const reset = () => {
    setAmount(''); setPaidAmount(''); setDescription('');
    setPaymentDate(todayISO()); setPaymentMethod('EasyPaisa');
    setShowCalendar(false);
  };
  const handleSave = async () => {
    if (!amount || isNaN(+amount) || +amount <= 0) {
      Alert.alert('Validation', 'Please enter a valid amount.');
      return;
    }
    setSaving(true);
    await onSave({
      amount:          +amount,
      paidAmount:      +paidAmount || 0,
      remainingAmount: remaining,
      description,
      paymentMethod,
      date:   new Date(paymentDate).toISOString(),
      month:  new Date(paymentDate).toLocaleString('default', { month: 'long', year: 'numeric' }),
      status: autoStatus,
    });
    setSaving(false);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Send Money — {driver?.name || 'Driver'}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={22} color={C.textMid} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.inputLabel}>Payment Date *</Text>
            <TouchableOpacity
              style={[s.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowCalendar(!showCalendar)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar-outline" size={16} color={C.main} />
                <Text style={{ fontSize: 14, color: C.textDark, fontWeight: '600' }}>{fmtDate(paymentDate)}</Text>
              </View>
              <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={16} color={C.textMuted} />
            </TouchableOpacity>

            {showCalendar ? (
              <View style={s.calendarBox}>
                <Text style={s.calLabel}>Quick Select</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {[
                    { label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 },
                    { label: '3 days ago', days: 3 }, { label: '1 week ago', days: 7 },
                    { label: '2 weeks ago', days: 14 }, { label: '1 month ago', days: 30 },
                  ].map(p => (
                    <TouchableOpacity key={p.label} style={s.presetBtn} onPress={() => setPreset(p.days)}>
                      <Text style={s.presetTxt}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.calLabel}>Month</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {MONTHS.map((m, idx) => (
                    <TouchableOpacity key={m} style={[s.calChip, idx === selMonth && s.calChipActive]} onPress={() => pickMonth(idx)}>
                      <Text style={[s.calChipTxt, idx === selMonth && { color: C.white }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={s.calLabel}>Year</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                  {years.map(y => (
                    <TouchableOpacity key={y} style={[s.calChip, { flex: 1, alignItems: 'center' }, y === selYear && s.calChipActive]} onPress={() => pickYear(y)}>
                      <Text style={[s.calChipTxt, y === selYear && { color: C.white }]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.calLabel}>Day</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                    <TouchableOpacity key={day} style={[s.dayBtn, day === selDay && s.dayBtnActive]} onPress={() => pickDay(day)}>
                      <Text style={[s.dayBtnTxt, day === selDay && { color: C.white }]}>{day}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={s.inputLabel}>Payment Method *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {PAYMENT_METHODS.map(m => (
                <TouchableOpacity key={m} style={[s.methodBtn, paymentMethod === m && s.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
                  <Text style={[s.methodBtnTxt, paymentMethod === m && { color: C.white }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>Total Amount (Rs.) *</Text>
            <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="e.g. 50000" placeholderTextColor={C.textMuted} />

            <Text style={s.inputLabel}>Amount Paid Now (Rs.)</Text>
            <TextInput style={s.input} value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" placeholder="e.g. 25000 (leave 0 if not yet paid)" placeholderTextColor={C.textMuted} />

            {+amount > 0 ? (
              <View style={s.remainingInfo}>
                <Ionicons name="information-circle-outline" size={14} color={remaining > 0 ? C.warn : C.success} />
                <View style={{ marginLeft: 6 }}>
                  <Text style={{ fontSize: 12, color: remaining > 0 ? C.warn : C.success }}>
                    Remaining: {fmtPKR(remaining)}{remaining === 0 && +amount > 0 ? '  ✅ Fully paid' : ''}
                  </Text>
                  <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    Status will be: <Text style={{ fontWeight: '700', color: getSC(autoStatus).color }}>{getSC(autoStatus).label}</Text>
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={s.inputLabel}>Description / Notes</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Monthly salary, advance, bonus…"
              placeholderTextColor={C.textMuted}
              multiline
            />

            <TouchableOpacity
              style={[s.markPaidBtn, { marginTop: 16 }, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={C.white} />
                : <><Ionicons name="send-outline" size={15} color={C.white} /><Text style={s.markPaidTxt}>Send Payment Record</Text></>}
            </TouchableOpacity>
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════
// MARK PAID MODAL (for existing driver payment records)
// ══════════════════════════════════════════════════════════════════
const MarkPaidModal = ({ visible, payment, driver, onClose, onConfirm }) => {
  const totalAmt    = payment?.amount || 0;
  const alreadyPaid = payment?.paidAmount || 0;
  const [nowPaying, setNowPaying] = useState(String(Math.max(0, totalAmt - alreadyPaid)));
  const [saving,    setSaving]    = useState(false);
  const newTotal  = Math.min(totalAmt, alreadyPaid + (+nowPaying || 0));
  const remaining = Math.max(0, totalAmt - newTotal);

  const handleConfirm = async () => {
    setSaving(true);
    await onConfirm(payment, +nowPaying || 0);
    setSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { maxHeight: '65%' }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Mark Payment as Paid</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.textMid} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>
            {driver?.name || 'Driver'} · Total: {fmtPKR(totalAmt)}
            {alreadyPaid > 0 ? `  · Already paid: ${fmtPKR(alreadyPaid)}` : ''}
          </Text>
          <Text style={s.inputLabel}>Amount Being Paid Now (Rs.) *</Text>
          <TextInput
            style={s.input}
            value={nowPaying}
            onChangeText={setNowPaying}
            keyboardType="numeric"
            placeholder={String(Math.max(0, totalAmt - alreadyPaid))}
            placeholderTextColor={C.textMuted}
          />
          <View style={s.remainingInfo}>
            <Ionicons name="information-circle-outline" size={14} color={remaining > 0 ? C.warn : C.success} />
            <Text style={{ fontSize: 12, color: remaining > 0 ? C.warn : C.success, marginLeft: 5 }}>
              {remaining > 0
                ? `After this payment, remaining: ${fmtPKR(remaining)}`
                : 'This will fully complete the payment ✅'}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.markPaidBtn, { marginTop: 14 }, saving && { opacity: 0.6 }]}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.white} />
              : <><Ionicons name="checkmark-circle-outline" size={15} color={C.white} /><Text style={s.markPaidTxt}>Confirm Payment</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const PaymentsSection = ({ stats = {}, refreshing: parentRefreshing, onRefresh: parentOnRefresh }) => {
  const [mainTab,        setMainTab]        = useState('requests');

  // Requests state
  const [requests,       setRequests]       = useState([]);
  const [reqLoading,     setReqLoading]     = useState(true);
  const [processingMap,  setProcessingMap]  = useState({});

  // Passengers state — list of ALL passengers with their assigned amounts
  const [passengers,     setPassengers]     = useState([]);
  const [pasLoading,     setPasLoading]     = useState(true);
  const [setAmountFor,   setSetAmountFor]   = useState(null);   // passenger being edited

  // Drivers state
  const [driverData,     setDriverData]     = useState([]);
  const [drvLoading,     setDrvLoading]     = useState(true);
  const [expandedDriver, setExpandedDriver] = useState(null);
  const [addPayDriver,   setAddPayDriver]   = useState(null);
  const [markPayment,    setMarkPayment]    = useState(null);

  const [refreshing,     setRefreshing]     = useState(false);

  const authRef  = useRef({ token: null, transporterId: null });
  const loadAuth = async () => {
    const a = await getAuth();
    authRef.current = a;
    return a;
  };

  // ── Fetch: pending subscription requests ──────────────────────
  const fetchRequests = useCallback(async () => {
    try {
      const { token, transporterId } = await loadAuth();
      if (!token || !transporterId) return;
      const res  = await fetch(`${API_BASE}/subscriptions/pending?transporterId=${transporterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRequests(data.requests || []);
    } catch (err) {
      console.error('[PaymentsSection] fetchRequests:', err?.message);
    } finally {
      setReqLoading(false);
    }
  }, []);

  // ── Fetch: all passengers with assigned amounts ───────────────
  const fetchPassengers = useCallback(async () => {
    try {
      const { token, transporterId } = await loadAuth();
      if (!token || !transporterId) return;
      const res  = await fetch(`${API_BASE}/payments/passengers?transporterId=${transporterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPassengers(data.passengers || []);
    } catch (err) {
      console.error('[PaymentsSection] fetchPassengers:', err?.message);
    } finally {
      setPasLoading(false);
    }
  }, []);

  // ── Fetch: driver list + payment records ──────────────────────
  const fetchDriverPayments = useCallback(async () => {
    try {
      const { token, transporterId } = await loadAuth();
      if (!token || !transporterId) return;
      const res  = await fetch(`${API_BASE}/payments/drivers?transporterId=${transporterId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setDriverData(data.drivers || []);
    } catch (err) {
      console.error('[PaymentsSection] fetchDriverPayments:', err?.message);
    } finally {
      setDrvLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRequests(), fetchPassengers(), fetchDriverPayments()]);
    setRefreshing(false);
    if (parentOnRefresh) parentOnRefresh();
  }, [fetchRequests, fetchPassengers, fetchDriverPayments]);

  useEffect(() => { loadAll(); }, []);

  // ── Approve subscription ──────────────────────────────────────
  const handleApprove = useCallback(async (item) => {
    Alert.alert(
      'Approve Subscription',
      `Approve ${item.passengerName || 'passenger'}'s ${item.planName} request?\n\nPassenger will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessingMap(prev => ({ ...prev, [item.id]: 'approve' }));
            try {
              const { token } = authRef.current;
              const res  = await fetch(`${API_BASE}/subscriptions/${item.id}/approve`, {
                method:  'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ approvedBy: 'Transporter' }),
              });
              const data = await res.json();
              if (data.success) {
                setRequests(prev => prev.filter(r => r.id !== item.id));
                Alert.alert('Approved ✅', `${item.passengerName || 'Passenger'}'s subscription approved. They have been notified.`);
              } else {
                Alert.alert('Error', data.message || 'Failed to approve.');
              }
            } catch {
              Alert.alert('Error', 'Could not connect to server.');
            } finally {
              setProcessingMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
            }
          },
        },
      ]
    );
  }, []);

  // ── Reject subscription ───────────────────────────────────────
  const handleReject = useCallback(async (item) => {
    Alert.alert(
      'Reject Subscription',
      `Reject ${item.passengerName || 'passenger'}'s renewal request?\n\nPassenger will be notified.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive',
          onPress: async () => {
            setProcessingMap(prev => ({ ...prev, [item.id]: 'reject' }));
            try {
              const { token } = authRef.current;
              const res  = await fetch(`${API_BASE}/subscriptions/${item.id}/reject`, {
                method:  'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ approvedBy: 'Transporter' }),
              });
              const data = await res.json();
              if (data.success) {
                setRequests(prev => prev.filter(r => r.id !== item.id));
                Alert.alert('Rejected', 'Passenger has been notified of the rejection.');
              } else {
                Alert.alert('Error', data.message || 'Failed to reject.');
              }
            } catch {
              Alert.alert('Error', 'Could not connect to server.');
            } finally {
              setProcessingMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
            }
          },
        },
      ]
    );
  }, []);

  // ── Add driver payment record ─────────────────────────────────
  const handleAddDriverPayment = useCallback(async (payData) => {
    const { token, transporterId } = authRef.current;
    const driver = addPayDriver;
    try {
      const res = await fetch(`${API_BASE}/payments`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          type:            'driver_payment',
          driverId:        driver._id,
          driverName:      driver.name,
          transporterId,
          amount:          payData.amount,
          amountLabel:     `Rs. ${payData.amount.toLocaleString()}`,
          paidAmount:      payData.paidAmount,
          remainingAmount: payData.remainingAmount,
          description:     payData.description,
          paymentMethod:   payData.paymentMethod,
          month:           payData.month,
          status:          payData.status,
          date:            payData.date || new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddPayDriver(null);
        Alert.alert('Saved ✅', 'Payment record saved. Driver has been notified.');
        fetchDriverPayments();
      } else {
        Alert.alert('Error', data.message || 'Failed to save payment.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    }
  }, [addPayDriver, fetchDriverPayments]);

  // ── Mark driver payment as paid ───────────────────────────────
  const handleMarkDriverPaid = useCallback(async (payment, paidNow) => {
    const { token } = authRef.current;
    const newPaidTotal = (payment.paidAmount || 0) + paidNow;
    try {
      const res = await fetch(`${API_BASE}/payments/${payment._id?.toString()}/mark-paid`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ paidAmount: newPaidTotal, approvedBy: 'Transporter' }),
      });
      const data = await res.json();
      if (data.success) {
        setMarkPayment(null);
        Alert.alert('Updated ✅', 'Driver payment updated and driver notified.');
        fetchDriverPayments();
      } else {
        Alert.alert('Error', data.message || 'Failed to update.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect to server.');
    }
  }, [fetchDriverPayments]);

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* Summary gradient */}
      <LinearGradient colors={[C.main, C.dark]} style={s.summaryCard}>
        <Text style={s.summaryLabel}>Payment Management</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryChip}>
            <Ionicons name="mail-outline" size={13} color="#FFD54F" />
            <Text style={s.summaryChipTxt}>{requests.length} Pending</Text>
          </View>
          <View style={s.summaryChip}>
            <Ionicons name="people-outline" size={13} color="#69F0AE" />
            <Text style={s.summaryChipTxt}>{passengers.length} Passengers</Text>
          </View>
          <View style={s.summaryChip}>
            <Ionicons name="car-outline" size={13} color="#80DEEA" />
            <Text style={s.summaryChipTxt}>{driverData.length} Drivers</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main tab bar */}
      <View style={s.tabBar}>
        {MAIN_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabBtn, mainTab === tab.key && s.tabBtnActive]}
            onPress={() => setMainTab(tab.key)}
            activeOpacity={0.8}
          >
            <Ionicons name={tab.icon} size={14} color={mainTab === tab.key ? C.white : C.textLight} />
            <Text style={[s.tabBtnTxt, mainTab === tab.key && s.tabBtnTxtActive]}>
              {tab.label}
            </Text>
            {tab.key === 'requests' && requests.length > 0 ? (
              <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{requests.length}</Text></View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* TAB: SUBSCRIPTION REQUESTS */}
      {mainTab === 'requests' ? (
        reqLoading
          ? <View style={s.centered}><ActivityIndicator size="large" color={C.main} /></View>
          : <FlatList
              data={requests}
              keyExtractor={item => item.id}
              contentContainerStyle={s.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} colors={[C.main]} tintColor={C.main} />}
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <Ionicons name="mail-open-outline" size={52} color={C.border} />
                  <Text style={s.emptyTitle}>No Pending Requests</Text>
                  <Text style={s.emptySubtitle}>All subscription requests have been processed.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <RequestCard
                  item={item}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  processing={processingMap[item.id] || null}
                />
              )}
            />
      ) : null}

      {/* TAB: PASSENGERS — set amount per passenger */}
      {mainTab === 'passengers' ? (
        pasLoading
          ? <View style={s.centered}><ActivityIndicator size="large" color={C.main} /></View>
          : <FlatList
              data={passengers}
              keyExtractor={item => item._id?.toString()}
              contentContainerStyle={s.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} colors={[C.main]} tintColor={C.main} />}
              ListHeaderComponent={
                <View style={{ backgroundColor: C.light, borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Ionicons name="information-circle-outline" size={16} color={C.main} />
                  <Text style={{ flex: 1, fontSize: 12, color: C.info, lineHeight: 18, fontWeight: '600' }}>
                    Set a monthly subscription amount for each passenger. They will be notified and can then send you an activation request.
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <Ionicons name="people-outline" size={52} color={C.border} />
                  <Text style={s.emptyTitle}>No Passengers Found</Text>
                  <Text style={s.emptySubtitle}>No passengers are linked to your account yet.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <PassengerAmountCard
                  passenger={item}
                  onSetAmount={(p) => setSetAmountFor(p)}
                />
              )}
            />
      ) : null}

      {/* TAB: DRIVER PAYMENTS */}
      {mainTab === 'drivers' ? (
        drvLoading
          ? <View style={s.centered}><ActivityIndicator size="large" color={C.main} /></View>
          : <FlatList
              data={driverData}
              keyExtractor={item => item.driver._id?.toString()}
              contentContainerStyle={s.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} colors={[C.main]} tintColor={C.main} />}
              ListEmptyComponent={
                <View style={s.emptyBox}>
                  <Ionicons name="car-outline" size={52} color={C.border} />
                  <Text style={s.emptyTitle}>No Drivers Found</Text>
                  <Text style={s.emptySubtitle}>No drivers are associated with your account.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <DriverPayCard
                  driverData={item}
                  onAddPayment={(driver) => setAddPayDriver(driver)}
                  onMarkPaid={(payment, driver) => setMarkPayment({ payment, driver })}
                  expandedId={expandedDriver}
                  setExpandedId={setExpandedDriver}
                />
              )}
            />
      ) : null}

      {/* Modals */}
      <SetPassengerAmountModal
        visible={!!setAmountFor}
        passenger={setAmountFor}
        onClose={() => setSetAmountFor(null)}
        onSaved={() => fetchPassengers()}
      />
      <AddDriverPaymentModal
        visible={!!addPayDriver}
        driver={addPayDriver}
        onClose={() => setAddPayDriver(null)}
        onSave={handleAddDriverPayment}
      />
      {markPayment ? (
        <MarkPaidModal
          visible={!!markPayment}
          payment={markPayment?.payment}
          driver={markPayment?.driver}
          onClose={() => setMarkPayment(null)}
          onConfirm={handleMarkDriverPaid}
        />
      ) : null}
    </View>
  );
};

export default PaymentsSection;

const s = StyleSheet.create({
  summaryCard: {
    marginHorizontal: 14, marginTop: 14, borderRadius: 18, padding: 18, marginBottom: 10,
    ...Platform.select({
      ios:     { shadowColor: '#2D3E2F', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 5 },
    }),
  },
  summaryLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '700', marginBottom: 10 },
  summaryRow:      { flexDirection: 'row', gap: 6 },
  summaryChip:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 7 },
  summaryChipTxt:  { fontSize: 10, color: '#fff', fontWeight: '600', flex: 1 },

  tabBar:          { flexDirection: 'row', marginHorizontal: 14, marginBottom: 10, backgroundColor: C.light, borderRadius: 14, padding: 4, gap: 3 },
  tabBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  tabBtnActive:    { backgroundColor: C.main },
  tabBtnTxt:       { fontSize: 12, fontWeight: '600', color: C.textLight },
  tabBtnTxtActive: { color: C.white },
  tabBadge:        { backgroundColor: C.warn, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeTxt:     { fontSize: 9, color: C.white, fontWeight: '800' },

  statGrid:        { flexDirection: 'row', gap: 10, marginHorizontal: 14, marginBottom: 10 },
  statTile: {
    flex: 1, backgroundColor: C.cardBg, borderRadius: 14, padding: 12, alignItems: 'flex-start', borderWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  statIconBox:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue:       { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statLabel:       { fontSize: 10, color: C.textMuted, fontWeight: '600' },

  listContent:     { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 40 },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },

  card: {
    backgroundColor: C.cardBg, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarBox:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.main, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:       { fontSize: 14, fontWeight: '800', color: C.white },
  cardName:        { fontSize: 15, fontWeight: '700', color: C.textDark },
  cardSub:         { fontSize: 12, color: C.textLight, marginTop: 1 },
  badge:           { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt:        { fontSize: 11, fontWeight: '700' },

  infoGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  infoCell:        { minWidth: '45%', flex: 1 },
  infoCellLabel:   { fontSize: 10, color: C.textMuted, fontWeight: '600', marginBottom: 2 },
  infoCellValue:   { fontSize: 13, color: C.textDark, fontWeight: '600' },

  actionRow:       { flexDirection: 'row', gap: 8, marginTop: 4 },
  rejectBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: C.danger, borderRadius: 10, paddingVertical: 10 },
  actionBtnTxt:    { fontSize: 13, fontWeight: '700' },
  approveBtn:      { flex: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.success, borderRadius: 10, paddingVertical: 10 },
  approveBtnTxt:   { fontSize: 13, fontWeight: '800', color: C.white },

  markPaidBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.main, borderRadius: 10, paddingVertical: 10, marginTop: 4 },
  markPaidTxt:     { fontSize: 13, fontWeight: '800', color: C.white },

  driverStatsRow:  { flexDirection: 'row', gap: 6, marginBottom: 10 },
  driverStatChip:  { flex: 1, borderRadius: 10, padding: 8, alignItems: 'center' },
  driverStatLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  driverStatValue: { fontSize: 13, fontWeight: '800' },

  addPayBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: C.main, borderRadius: 10, paddingVertical: 9, marginBottom: 2 },
  addPayBtnTxt:    { fontSize: 12, fontWeight: '700', color: C.main },

  payHistoryBox:   { marginTop: 10, backgroundColor: C.bg, borderRadius: 10, padding: 10, gap: 8 },
  payHistoryTitle: { fontSize: 11, fontWeight: '700', color: C.textMuted, marginBottom: 4 },
  payHistoryItem:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardBg, borderRadius: 8, padding: 10 },
  payHistDate:     { fontSize: 11, color: C.textMuted },
  payHistAmount:   { fontSize: 14, fontWeight: '800', color: C.textDark, marginBottom: 2 },
  payHistDesc:     { fontSize: 11, color: C.textLight },
  tinyBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tinyBadgeTxt:    { fontSize: 10, fontWeight: '700' },
  miniMarkPaid:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.main, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, marginLeft: 10 },
  miniMarkPaidTxt: { fontSize: 11, fontWeight: '800', color: C.white },

  emptyBox:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle:      { fontSize: 16, fontWeight: '800', color: C.textDark, marginTop: 14, marginBottom: 6 },
  emptySubtitle:   { fontSize: 13, color: C.textMuted, textAlign: 'center' },

  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '92%' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle:      { fontSize: 17, fontWeight: '800', color: C.textDark },
  inputLabel:      { fontSize: 12, fontWeight: '700', color: C.textMid, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: C.textDark, backgroundColor: C.bg,
  },
  remainingInfo:   { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.bg, borderRadius: 10, padding: 10, marginTop: 8 },

  calendarBox:     { backgroundColor: C.bg, borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  calLabel:        { fontSize: 11, fontWeight: '700', color: C.textMuted, marginBottom: 8 },
  presetBtn:       { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  presetTxt:       { fontSize: 11, fontWeight: '600', color: C.main },
  calChip:         { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginRight: 6 },
  calChipActive:   { backgroundColor: C.main, borderColor: C.main },
  calChipTxt:      { fontSize: 12, fontWeight: '600', color: C.textMid },
  dayBtn:          { width: 38, height: 38, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  dayBtnActive:    { backgroundColor: C.main, borderColor: C.main },
  dayBtnTxt:       { fontSize: 13, fontWeight: '600', color: C.textMid },
  methodBtn:       { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.white, borderRadius: 10, borderWidth: 1.5, borderColor: C.border },
  methodBtnActive: { backgroundColor: C.main, borderColor: C.main },
  methodBtnTxt:    { fontSize: 12, fontWeight: '600', color: C.textMid },
});