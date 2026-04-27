/**
 * frontend/Driver/components/DriverChatModal.js
 *
 * CONVERTED TO PLAIN SCREEN — no <Modal> wrapper.
 * Rendered via currentView === "Messages" in DriverDashboardScreen.
 *
 * Props:
 *   personName    {string}   – name shown in header
 *   personRole    {string}   – 'passenger' | 'transporter'
 *   messages      {array}    – chat messages
 *   onSend        {function} – (text, messageType) => void
 *   isRideActive  {boolean}
 *   onClose       {function} – go back (sets currentView to Dashboard)
 *   onOpenSidebar {function} – opens the sidebar hamburger
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  TextInput,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ── Passenger quick replies (driver → passenger) ──────────────────────────────
const PASSENGER_QUICK_REPLIES = [
  { id: 'p1', text: '🚗 On my way' },
  { id: 'p2', text: '📍 I have arrived' },
  { id: 'p3', text: '⏱ 1 min away' },
  { id: 'p4', text: '🚪 Please come outside' },
  { id: 'p5', text: '🚦 Stuck in traffic' },
  { id: 'p6', text: '✅ Ride started' },
  { id: 'p7', text: '🏁 Almost there' },
];

// ── Transporter quick replies (driver → transporter) ─────────────────────────
const TRANSPORTER_QUICK_REPLIES = [
  { id: 't1', text: '✅ Got it' },
  { id: 't2', text: '🚗 On my way' },
  { id: 't3', text: "📍 I'm nearby" },
  { id: 't4', text: '⏱ 5 mins away' },
  { id: 't5', text: '🚦 In traffic' },
  { id: 't6', text: '✅ Route confirmed' },
  { id: 't7', text: '🏁 Ride completed' },
  { id: 't8', text: '🔔 Please confirm' },
];

const GREEN       = '#415844';
const GREEN_DARK  = '#2D3E2F';
const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export default function DriverChatModal({
  personName    = '',
  personRole    = 'passenger',
  messages      = [],
  onSend,
  isRideActive  = false,
  onClose,
  onOpenSidebar,
}) {
  const flatListRef = useRef(null);
  const inputRef    = useRef(null);
  const [typedText, setTypedText] = useState('');
  const [inputH,    setInputH]    = useState(42);

  const isTransporter   = personRole === 'transporter';
  const passengerClosed = !isTransporter && !isRideActive;
  const quickReplies    = isTransporter ? TRANSPORTER_QUICK_REPLIES : PASSENGER_QUICK_REPLIES;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages]);

  const handleQuickReply = (text) => {
    onSend?.(text, 'quick_reply');
  };

  const handleTypedSend = () => {
    if (!typedText.trim()) return;
    onSend?.(typedText.trim(), 'typed');
    setTypedText('');
    setInputH(42);
  };

  // ── Single message bubble ─────────────────────────────────────────────────
  const renderBubble = ({ item }) => {
    const fromMe = item.fromMe;
    return (
      <View style={[bs.row, fromMe ? bs.rowMe : bs.rowThem]}>
        {!fromMe && (
          <View style={bs.avatar}>
            <Text style={bs.avatarTxt}>
              {(personName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[bs.bubble, fromMe ? bs.bubbleMe : bs.bubbleThem]}>
          <Text style={[bs.txt, fromMe && bs.txtMe]}>{item.text}</Text>
          <Text style={[bs.time, fromMe && bs.timeMe]}>{item.time || ''}</Text>
        </View>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={s.root}>

        {/* ── Custom AppBar (replaces the dashboard AppBar which is hidden) ── */}
        <LinearGradient
          colors={[GREEN, GREEN_DARK]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.appBar}
        >
          {/* Hamburger — opens sidebar */}
          <TouchableOpacity
            style={s.appBarBtn}
            onPress={onOpenSidebar}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>

          

          {/* Avatar + name */}
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarTxt}>
              {(personName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.headerName} numberOfLines={1}>{personName || 'Chat'}</Text>
            <Text style={s.headerSub}>
              {isTransporter ? '🚌 Your Transporter' : '👤 Passenger'}
            </Text>
          </View>

          {isTransporter && (
            <View style={s.alwaysBadge}>
              <Ionicons name="wifi" size={10} color="#69F0AE" />
              <Text style={s.alwaysTxt}> Always On</Text>
            </View>
          )}
        </LinearGradient>

        {/* ── Info banners ──────────────────────────────────────────────────── */}
        {isTransporter && (
          <View style={s.bannerGreen}>
            <Ionicons name="chatbubbles-outline" size={13} color={GREEN} />
            <Text style={s.bannerGreenTxt}>
              {'  '}Message your transporter any time — no ride needed
            </Text>
          </View>
        )}

        {passengerClosed && (
          <View style={s.bannerRed}>
            <Ionicons name="lock-closed-outline" size={13} color="#c0392b" />
            <Text style={s.bannerRedTxt}>
              {'  '}Passenger chat is only available during an active ride
            </Text>
          </View>
        )}

        {!isTransporter && isRideActive && (
          <View style={s.bannerGreenLight}>
            <Ionicons name="shield-checkmark" size={13} color={GREEN} />
            <Text style={s.bannerGreenLightTxt}>
              {'  '}Quick replies only — tap below to respond
            </Text>
          </View>
        )}

        {/* ── Messages list ──────────────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, i) => item._id?.toString() || String(i)}
          renderItem={renderBubble}
          contentContainerStyle={{ padding: 14, paddingBottom: 10 }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color="#D0D8D0" />
              <Text style={s.emptyTxt}>No messages yet</Text>
              <Text style={s.emptySub}>
                {isTransporter
                  ? 'Type a message or tap a quick reply below'
                  : isRideActive
                  ? 'Tap a quick reply below'
                  : 'Start an active ride to chat with passenger'}
              </Text>
            </View>
          }
        />

        {/* ── Quick replies grid ─────────────────────────────────────────────── */}
        {!passengerClosed && (
          <View style={s.quickWrap}>
            <Text style={s.quickLabel}>QUICK REPLIES</Text>
            <View style={s.quickGrid}>
              {quickReplies.map(qr => (
                <TouchableOpacity
                  key={qr.id}
                  style={s.quickChip}
                  onPress={() => handleQuickReply(qr.text)}
                  activeOpacity={0.7}
                >
                  <Text style={s.quickChipTxt}>{qr.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Text input — TRANSPORTER ONLY ─────────────────────────────────── */}
        {isTransporter && (
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={[s.input, { height: Math.max(42, inputH) }]}
              placeholder="Type a message..."
              placeholderTextColor="#9aaa9a"
              value={typedText}
              onChangeText={setTypedText}
              multiline
              maxLength={500}
              onContentSizeChange={e =>
                setInputH(Math.min(e.nativeEvent.contentSize.height + 4, 100))
              }
              returnKeyType="default"
            />
            <TouchableOpacity
              onPress={handleTypedSend}
              disabled={!typedText.trim()}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={typedText.trim() ? [GREEN, GREEN_DARK] : ['#C5D0C5', '#aaa']}
                style={s.sendBtn}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Passenger locked state bottom bar ─────────────────────────────── */}
        {passengerClosed && (
          <View style={s.lockedBar}>
            <Ionicons name="lock-closed" size={14} color="#aaa" />
            <Text style={s.lockedTxt}>  Chat locked — no active ride</Text>
          </View>
        )}

      </View>
    </KeyboardAvoidingView>
  );
}

// ── Bubble styles ─────────────────────────────────────────────────────────────
const bs = StyleSheet.create({
  row:        { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 6 },
  rowMe:      { justifyContent: 'flex-end' },
  rowThem:    { justifyContent: 'flex-start' },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  bubble:     { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe:   { backgroundColor: GREEN, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E8E0', borderBottomLeftRadius: 4 },
  txt:        { fontSize: 14, color: '#111', lineHeight: 20 },
  txtMe:      { color: '#fff' },
  time:       { fontSize: 10, color: '#999', marginTop: 3, alignSelf: 'flex-end' },
  timeMe:     { color: 'rgba(255,255,255,0.55)' },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7F5' },

  // AppBar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: STATUS_BAR_H + 10,
    paddingBottom: 10,
    gap: 8,
    elevation: 6,
    shadowColor: GREEN_DARK,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerName:      { color: '#fff', fontWeight: '800', fontSize: 16 },
  headerSub:       { color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 1 },
  alwaysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(105,240,174,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alwaysTxt: { color: '#69F0AE', fontSize: 10, fontWeight: '800' },

  // Banners
  bannerGreen: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDF7EE', paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#C8DEC5',
  },
  bannerGreenTxt:      { color: GREEN, fontSize: 12, fontWeight: '600', flex: 1 },
  bannerRed:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDE8E8', paddingHorizontal: 14, paddingVertical: 8 },
  bannerRedTxt:        { color: '#c0392b', fontSize: 12, flex: 1 },
  bannerGreenLight:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDF1ED', paddingHorizontal: 14, paddingVertical: 8 },
  bannerGreenLightTxt: { color: GREEN, fontSize: 12, flex: 1 },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10, paddingHorizontal: 30 },
  emptyTxt:  { fontSize: 16, fontWeight: '700', color: '#B0BCB0' },
  emptySub:  { fontSize: 13, color: '#C5D0C5', textAlign: 'center', lineHeight: 18 },

  // Quick replies
  quickWrap:  { backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, borderTopWidth: 1, borderTopColor: '#E8EEE8' },
  quickLabel: { fontSize: 10, fontWeight: '700', color: '#9aaa9a', marginBottom: 8, letterSpacing: 0.8 },
  quickGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickChip:  { backgroundColor: '#EDF1ED', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#C5D0C5' },
  quickChipTxt: { color: GREEN, fontSize: 13, fontWeight: '500' },

  // Text input row (transporter only)
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8EEE8',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#1A2218',
    borderWidth: 1,
    borderColor: '#C5D0C5',
    maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },

  // Locked bar
  lockedBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 14, backgroundColor: '#fafafa',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  lockedTxt: { fontSize: 13, color: '#aaa' },
});