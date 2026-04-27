/**
 * ChatModal — Passenger ↔ Driver chat with enforced rules:
 *   - Passenger: unlimited quick replies + max 3 typed messages
 *   - Driver: quick replies only (no free typing)
 *   - Chat window: only open when ride is active
 */
import React, { useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { getInitials } from '../../services/helpers';
import { PASSENGER_QUICK_REPLIES } from '../../constants/quickReplies';

const MAX_TYPED_MESSAGES = 3;

export default function ChatModal({
  visible,
  onClose,
  personName = 'Driver',
  personSubtitle = 'Driver',
  messages = [],
  inputText,
  onInputChange,
  onSend,           // (text, messageType) => void
  typedCount = 0,   // how many typed msgs passenger has already sent
  userRole = 'passenger', // 'passenger' | 'driver' | 'transporter'
  isRideActive = true,    // chat only available during ride
}) {
  const flatListRef = useRef(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const remainingTyped = MAX_TYPED_MESSAGES - typedCount;
  const canType = userRole === 'passenger'
    ? remainingTyped > 0
    : userRole === 'transporter';  // drivers cannot type at all

  const handleSendTyped = () => {
    if (!inputText?.trim()) return;
    if (userRole === 'driver') {
      Alert.alert('Not Allowed', 'Drivers can only send quick replies for safety.');
      return;
    }
    if (userRole === 'passenger' && remainingTyped <= 0) {
      Alert.alert('Limit Reached', 'You have used all 3 typed messages. Use quick replies.');
      return;
    }
    onSend(inputText.trim(), 'typed');
  };

  const handleQuickReply = (text) => {
    onSend(text, 'quick_reply');
    setShowQuickReplies(false);
  };

  const quickReplies = PASSENGER_QUICK_REPLIES;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        {/* ── Header ── */}
        <LinearGradient
          colors={['#A1D826', '#8BC220']}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose}>
            <Icon name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(personName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{personName}</Text>
            <Text style={styles.sub}>{personSubtitle}</Text>
          </View>
        </LinearGradient>

        {/* ── Chat Closed Banner ── */}
        {!isRideActive && (
          <View style={styles.closedBanner}>
            <Icon name="lock-closed" size={16} color="#666" />
            <Text style={styles.closedText}>
              Chat is only available during an active ride
            </Text>
          </View>
        )}

        {/* ── Typed Message Limit Banner ── */}
        {isRideActive && userRole === 'passenger' && (
          <View style={[
            styles.limitBanner,
            remainingTyped === 0 && styles.limitBannerDanger,
          ]}>
            <Icon
              name={remainingTyped > 0 ? 'create-outline' : 'ban-outline'}
              size={14}
              color={remainingTyped > 0 ? '#555' : '#c0392b'}
            />
            <Text style={[
              styles.limitText,
              remainingTyped === 0 && styles.limitTextDanger,
            ]}>
              {remainingTyped > 0
                ? `Typed messages remaining: ${remainingTyped}/3`
                : 'No typed messages left — use quick replies below'}
            </Text>
          </View>
        )}

        {isRideActive && userRole === 'driver' && (
          <View style={styles.limitBanner}>
            <Icon name="chatbubble-ellipses-outline" size={14} color="#555" />
            <Text style={styles.limitText}>
              Safety mode: Quick replies only
            </Text>
          </View>
        )}

        {/* ── Messages List ── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, i) => item._id?.toString() || i.toString()}
          renderItem={({ item }) => {
            const fromMe = item.fromMe ?? item.fromDriver ?? false;
            return (
              <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                {item.isQuickReply && (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>Quick Reply</Text>
                  </View>
                )}
                <Text style={styles.bubbleText}>{item.text}</Text>
                <Text style={styles.bubbleTime}>{item.time || ''}</Text>
              </View>
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* ── Quick Replies Panel ── */}
        {isRideActive && showQuickReplies && (
          <View style={styles.quickPanel}>
            <Text style={styles.quickTitle}>Quick Replies</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {quickReplies.map((qr) => (
                <TouchableOpacity
                  key={qr.id}
                  style={styles.quickChip}
                  onPress={() => handleQuickReply(qr.text)}
                >
                  <Text style={styles.quickChipText}>{qr.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Input Row ── */}
        {isRideActive && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
          >
            <View style={styles.inputRow}>
              {/* Quick Reply toggle button — always visible */}
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => setShowQuickReplies(!showQuickReplies)}
              >
                <Icon
                  name="flash"
                  size={22}
                  color={showQuickReplies ? '#A1D826' : '#888'}
                />
              </TouchableOpacity>

              {/* Text input — only for passenger (with limit) and transporter */}
              {userRole !== 'driver' ? (
                <TextInput
                  style={[styles.input, !canType && styles.inputDisabled]}
                  placeholder={
                    canType
                      ? `Type a message... (${remainingTyped} left)`
                      : 'Typed limit reached — use quick replies'
                  }
                  placeholderTextColor={canType ? '#999' : '#c0392b'}
                  value={inputText}
                  onChangeText={onInputChange}
                  multiline
                  maxLength={500}
                  editable={canType}
                />
              ) : (
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={{ color: '#999', fontSize: 13 }}>
                    Use ⚡ quick replies to message
                  </Text>
                </View>
              )}

              {/* Send typed message */}
              {userRole !== 'driver' && (
                <TouchableOpacity
                  onPress={handleSendTyped}
                  disabled={!inputText?.trim() || !canType}
                  style={styles.sendBtn}
                >
                  <LinearGradient
                    colors={inputText?.trim() && canType ? ['#A1D826', '#8BC220'] : ['#ccc', '#bbb']}
                    style={styles.sendGradient}
                  >
                    <Icon name="send" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#f5f5f5' },
  header:           { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 10 },
  avatar:           { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  avatarText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  name:             { color: '#fff', fontWeight: '700', fontSize: 16 },
  sub:              { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  closedBanner:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  closedText:       { color: '#666', fontSize: 13 },
  limitBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffde7', padding: 8, paddingHorizontal: 14, gap: 8 },
  limitBannerDanger:{ backgroundColor: '#fdecea' },
  limitText:        { color: '#555', fontSize: 12 },
  limitTextDanger:  { color: '#c0392b' },
  bubble:           { maxWidth: '78%', borderRadius: 16, padding: 10, marginVertical: 4 },
  bubbleMe:         { alignSelf: 'flex-end', backgroundColor: '#A1D826' },
  bubbleThem:       { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  bubbleText:       { fontSize: 14, color: '#222' },
  bubbleTime:       { fontSize: 10, color: '#888', marginTop: 4, alignSelf: 'flex-end' },
  quickBadge:       { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  quickBadgeText:   { fontSize: 9, color: '#555' },
  quickPanel:       { backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  quickTitle:       { fontSize: 12, color: '#666', marginBottom: 8, fontWeight: '600' },
  quickChip:        { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#A1D826' },
  quickChipText:    { color: '#2e7d32', fontSize: 13 },
  inputRow:         { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', gap: 8 },
  quickBtn:         { padding: 6 },
  input:            { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  inputDisabled:    { backgroundColor: '#fafafa', color: '#bbb' },
  sendBtn:          { padding: 2 },
  sendGradient:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});