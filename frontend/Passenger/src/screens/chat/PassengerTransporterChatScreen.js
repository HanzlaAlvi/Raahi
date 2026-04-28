// frontend/Passenger/src/screens/chat/PassengerTransporterChatScreen.js
// Passenger ↔ Transporter chat screen (standalone, accessible from sidebar)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, FlatList, KeyboardAvoidingView,
  Platform, Alert, ActivityIndicator, StatusBar,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';

const C = {
  main:  '#415844',
  dark:  '#2D3E2F',
  light: '#EDF1ED',
  white: '#FFFFFF',
  bg:    '#F2F5F2',
  border:'#C5D4C5',
  textDk:'#1A2218',
  textMd:'#4A6B4C',
  textLt:'#7A9E76',
  success:'#2E7D32',
};

const SB_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const getInitials = (name = '') => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

export default function PassengerTransporterChatScreen({ navigation }) {
  const [messages,    setMessages]    = useState([]);
  const [inputText,   setInputText]   = useState('');
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState(false);
  const [transporter, setTransporter] = useState(null); // { _id, name }
  const [token,       setToken]       = useState(null);
  const [myId,        setMyId]        = useState(null);

  const flatListRef = useRef(null);
  const pollRef     = useRef(null);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    init();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll for new messages every 4s when transporter is known
  useEffect(() => {
    if (!transporter?._id || !token) return;
    loadMessages();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [transporter?._id, token]);

  const init = async () => {
    try {
      const tok = await AsyncStorage.getItem('authToken')
               || await AsyncStorage.getItem('userToken')
               || await AsyncStorage.getItem('token');
      const uid = await AsyncStorage.getItem('userId');
      const raw = await AsyncStorage.getItem('userData');
      const userData = raw ? JSON.parse(raw) : null;

      setToken(tok);
      setMyId(uid);

      // Get transporter ID from user profile
      const transporterId = userData?.transporterId || userData?.transporter?._id || userData?.transporter;
      if (!transporterId) {
        setLoading(false);
        return;
      }

      // Fetch transporter profile for name
      try {
        const res = await fetch(`${API_BASE_URL}/profile/${transporterId}`, {
          headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data._id || data.id) {
          setTransporter({
            _id: data._id || data.id,
            name: data.name || data.fullName || 'Transporter',
          });
        } else {
          setTransporter({ _id: transporterId, name: 'Transporter' });
        }
      } catch {
        setTransporter({ _id: transporterId, name: 'Transporter' });
      }
    } catch (e) {
      console.error('[PassengerChat] init:', e.message);
      setLoading(false);
    }
  };

  const getHeaders = useCallback((tok) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tok || token}`,
  }), [token]);

  const loadMessages = useCallback(async () => {
    if (!transporter?._id || !token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/messages/${transporter._id}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        const msgs = (data.messages || []).map(m => ({
          _id:          m._id,
          text:         m.text,
          fromMe:       m.senderId?.toString() === myId?.toString(),
          isQuickReply: m.isQuickReply || false,
          time: new Date(m.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(msgs);
        // mark read
        fetch(`${API_BASE_URL}/messages/${transporter._id}/read`, {
          method: 'PUT', headers: getHeaders(),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[PassengerChat] loadMessages:', e.message);
    } finally {
      setLoading(false);
    }
  }, [transporter, token, myId, getHeaders]);

  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !transporter?._id || sending) return;

    const tempId = `tmp_${Date.now()}`;
    const tempMsg = {
      _id: tempId, text, fromMe: true, isQuickReply: false,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setSending(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          receiverId: transporter._id,
          text,
          messageType: 'typed',
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        const real = data.message;
        setMessages(prev => prev.map(m => m._id === tempId ? {
          _id: real._id, text: real.text, fromMe: true,
          isQuickReply: real.isQuickReply || false,
          time: new Date(real.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        } : m));
      } else {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        Alert.alert('Error', data.message || 'Could not send message.');
      }
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Error', 'Network error. Could not send.');
    } finally {
      setSending(false);
    }
  };

  const sendQuickReply = (text) => {
    setInputText(text);
    setTimeout(() => sendMessage(), 50);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />

      {/* Header */}
      <LinearGradient colors={[C.main, C.dark]} style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => navigation?.goBack?.() || navigation?.closeDrawer?.()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarTxt}>{getInitials(transporter?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{transporter?.name || 'Transporter'}</Text>
          <Text style={s.headerSub}>Direct Message</Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.main} />
          <Text style={{ marginTop: 12, color: C.textLt, fontSize: 13 }}>Loading messages…</Text>
        </View>
      ) : !transporter?._id ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
          <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '800', color: C.textDk }}>No Transporter</Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: C.textLt, textAlign: 'center', lineHeight: 18 }}>
            You are not connected to a transporter yet. Join a network first.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, i) => item._id?.toString() || String(i)}
            renderItem={({ item }) => (
              <View style={[s.bubble, item.fromMe ? s.bubbleMe : s.bubbleThem]}>
                {item.isQuickReply && (
                  <View style={s.quickBadge}>
                    <Text style={s.quickBadgeTxt}>⚡ Quick Reply</Text>
                  </View>
                )}
                <Text style={[s.bubbleTxt, item.fromMe && { color: '#fff' }]}>{item.text}</Text>
                <Text style={[s.bubbleTime, item.fromMe && { color: 'rgba(255,255,255,0.7)' }]}>{item.time}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 80 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={52} color="#ccc" />
                <Text style={{ color: '#bbb', marginTop: 14, fontSize: 15, fontWeight: '700' }}>No messages yet</Text>
                <Text style={{ color: '#ccc', fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 }}>
                  Start the conversation with your transporter below
                </Text>
              </View>
            }
          />

          {/* Quick replies */}
          <View style={s.quickRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {[
                'Hi, I have a question.',
                'Can you update my pickup time?',
                'I will be late today.',
                'Please confirm my route.',
                'Thank you!',
              ].map((qr, idx) => (
                <TouchableOpacity key={idx} style={s.quickChip} onPress={() => sendQuickReply(qr)}>
                  <Text style={s.quickChipTxt}>{qr}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="Type a message…"
                placeholderTextColor="#999"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={inputText.trim() ? [C.main, C.dark] : ['#ccc', '#bbb']}
                  style={s.sendBtn}
                >
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={17} color="#fff" />
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingTop: SB_H + 10, paddingBottom: 14,
    elevation: 6, shadowColor: C.dark, shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  headerName: { fontSize: 15, fontWeight: '800', color: '#fff' },
  headerSub:  { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  bubble:    { maxWidth: '78%', borderRadius: 16, padding: 12, marginBottom: 10 },
  bubbleMe:  { backgroundColor: C.main, alignSelf: 'flex-end', elevation: 2 },
  bubbleThem:{ backgroundColor: '#fff', alignSelf: 'flex-start', elevation: 2 },
  bubbleTxt: { fontSize: 14, color: C.textDk, lineHeight: 20 },
  bubbleTime:{ fontSize: 11, color: '#999', marginTop: 5, textAlign: 'right' },

  quickBadge:    { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 5 },
  quickBadgeTxt: { fontSize: 9, color: '#666', fontWeight: '700' },

  quickRow:  { backgroundColor: '#fff', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  quickChip: { backgroundColor: '#e8f5e9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: C.border },
  quickChipTxt:{ color: C.success, fontSize: 12, fontWeight: '600' },

  inputRow:  { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', gap: 8, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  input:     { flex: 1, backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.textDk, maxHeight: 100 },
  sendBtn:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});

