// frontend/Transporter/sections/MessageSection.js
//
// Changes in this version:
// - Added "New Chat" button so transporter can initiate contact with any
//   passenger or driver (not just those who messaged first).
// - New Chat modal fetches all network drivers and passengers and lets
//   transporter select one to start a conversation.
// - All existing functionality (existing conversations, quick replies,
//   typing, message bubbles, read receipts) is unchanged.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, StyleSheet, RefreshControl, StatusBar, ScrollView,
  Modal,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api }            from '../services/ApiService';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const C = {
  primary:'#415844', dark:'#2D3E2F', light:'#EDF1ED', mid:'#C5D0C5',
  white:'#FFFFFF', bg:'#F5F7F5', chatBg:'#ECE5DD',
  tDark:'#1A2218', tLight:'#6B7280', tMuted:'#9CA3AF',
  border:'#E5EBE5', accent:'#69F0AE', red:'#C62828',
};

const ROLE_META = {
  passenger:  { bg:'#E8F5E9', color:'#256029', label:'Passenger'             },
  driver:     { bg:'#E3F2FD', color:'#0D47A1', label:'Driver (Your Network)' },
  transporter:{ bg:'#FFF3E0', color:'#BF360C', label:'Transporter'           },
  unknown:    { bg:'#F3E5F5', color:'#6A1B9A', label:'User'                  },
};
const roleMeta = r => ROLE_META[(r||'').toLowerCase()] || ROLE_META.unknown;

const TRANSPORTER_QUICK_REPLIES = [
  { id: 'tqr1', text: 'Please confirm your availability' },
  { id: 'tqr2', text: 'Route starts at 7:00 AM tomorrow' },
  { id: 'tqr3', text: 'Check the updated route in your app' },
  { id: 'tqr4', text: 'All passengers confirmed ✅' },
  { id: 'tqr5', text: 'Please be on time' },
  { id: 'tqr6', text: 'Contact me if there is any issue' },
];

const ini = (n='') => (n||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const fmtTime = d => new Date(d).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
const fmtListDate = d => {
  const dt=new Date(d),now=new Date();
  if(dt.toDateString()===now.toDateString()) return fmtTime(d);
  const yd=new Date(now); yd.setDate(yd.getDate()-1);
  if(dt.toDateString()===yd.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
};
const fmtChatDate = d => {
  const dt=new Date(d),now=new Date();
  if(dt.toDateString()===now.toDateString()) return 'Today';
  const yd=new Date(now); yd.setDate(yd.getDate()-1);
  if(dt.toDateString()===yd.toDateString()) return 'Yesterday';
  return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
};

// ── New Chat Modal ────────────────────────────────────────────────────────────
// Loads all network drivers + passengers so transporter can initiate contact.
const NewChatModal = ({ visible, onClose, onSelectUser, transporterId }) => {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [roleTab,  setRoleTab]  = useState('all'); // 'all' | 'driver' | 'passenger'

  useEffect(() => {
    if (visible) { setSearch(''); loadUsers(); }
  }, [visible]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { token } = await api.getAuthData();
      const headers   = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const [drRes, paRes] = await Promise.all([
        fetch(`${API_BASE}/users?role=driver&transporterId=${transporterId}`, { headers }),
        fetch(`${API_BASE}/passengers?transporterId=${transporterId}`, { headers }),
      ]);
      const drData = await drRes.json();
      const paData = await paRes.json();

      const drivers    = (drData.users || drData.data || drData.drivers || []).map(u => ({ ...u, role: 'driver' }));
      const passengers = (paData.passengers || paData.data || paData.users || []).map(u => ({ ...u, role: 'passenger' }));

      setUsers([...drivers, ...passengers]);
    } catch (e) {
      console.warn('NewChatModal loadUsers:', e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchRole = roleTab === 'all' || u.role === roleTab;
    const matchText = !search ||
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').includes(search) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
    return matchRole && matchText;
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={nc.root}>
        <LinearGradient colors={[C.primary, C.dark]} style={nc.header}>
          <TouchableOpacity style={nc.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color={C.white} />
          </TouchableOpacity>
          <Text style={nc.headerTitle}>New Message</Text>
          <View style={{ width: 38 }} />
        </LinearGradient>

        {/* Search bar */}
        <View style={nc.searchRow}>
          <Ionicons name="search-outline" size={16} color={C.tMuted} />
          <TextInput
            style={nc.searchInput}
            placeholder="Search by name, phone or email…"
            placeholderTextColor={C.tMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={C.tMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Role tabs */}
        <View style={nc.tabs}>
          {['all', 'driver', 'passenger'].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[nc.tab, roleTab === tab && nc.tabActive]}
              onPress={() => setRoleTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[nc.tabTxt, roleTab === tab && nc.tabTxtActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab !== 'all' ? `s` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={nc.center}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={nc.loadingTxt}>Loading network…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={nc.center}>
            <Ionicons name="people-outline" size={48} color={C.tMuted} />
            <Text style={nc.emptyTxt}>No users found</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={item => item._id?.toString()}
            renderItem={({ item }) => {
              const rm = roleMeta(item.role);
              return (
                <TouchableOpacity
                  style={nc.userRow}
                  onPress={() => { onSelectUser(item); onClose(); }}
                  activeOpacity={0.75}
                >
                  <LinearGradient colors={[C.primary, C.dark]} style={nc.userAv}>
                    <Text style={nc.userAvTxt}>{ini(item.name)}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={nc.userName}>{item.name || '—'}</Text>
                    <Text style={nc.userSub}>{item.phone || item.email || ''}</Text>
                    {item.pickupPoint ? (
                      <Text style={nc.userMeta}>{item.pickupPoint}</Text>
                    ) : null}
                  </View>
                  <View style={[nc.roleTag, { backgroundColor: rm.bg }]}>
                    <Text style={[nc.roleTagTxt, { color: rm.color }]}>{rm.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 74 }} />}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function MessageSection({ refreshing, onRefresh }) {
  const [view,           setView]           = useState('list');
  const [conversations,  setConversations]  = useState([]);
  const [activeConv,     setActiveConv]     = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [inputText,      setInputText]      = useState('');
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [myId,           setMyId]           = useState(null);
  const [transporterId,  setTransporterId]  = useState(null);
  const [showQuickPanel, setShowQuickPanel] = useState(false);
  const [showNewChat,    setShowNewChat]    = useState(false);
  const flatRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const getHeaders = async () => {
    const { token } = await api.getAuthData();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const loadConversations = async () => {
    setLoading(true);
    try {
      const { token, transporterId: tid } = await api.getAuthData();
      setMyId(tid);
      setTransporterId(tid);
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const r = await fetch(`${API_BASE}/messages/conversations`, { headers: h });
      const d = await r.json();
      if (d.success) setConversations(d.conversations || []);
    } catch (e) { console.error('loadConversations:', e); }
    finally { setLoading(false); }
  };

  const openChat = async (conv) => {
    setActiveConv(conv);
    setView('chat');
    setShowQuickPanel(false);
    await loadMessages(conv.otherUser._id);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(conv.otherUser._id), 4000);
  };

  /**
   * openChatWithUser: called when transporter selects a user from New Chat modal.
   * Creates a synthetic conversation object to open the chat view immediately.
   */
  const openChatWithUser = async (user) => {
    const syntheticConv = {
      conversationId: `new_${user._id}`,
      otherUser: {
        _id:  user._id,
        name: user.name || '—',
        role: user.role || 'unknown',
      },
      lastMessage: { text: '', createdAt: new Date().toISOString(), fromMe: false, read: true },
      unreadCount: 0,
    };
    setActiveConv(syntheticConv);
    setView('chat');
    setShowQuickPanel(false);
    await loadMessages(user._id);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(user._id), 4000);
  };

  const closeChat = () => {
    setView('list');
    setActiveConv(null);
    setMessages([]);
    setInputText('');
    setShowQuickPanel(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    loadConversations();
  };

  const loadMessages = useCallback(async (otherId) => {
    try {
      const h = await getHeaders();
      const r = await fetch(`${API_BASE}/messages/${otherId}`, { headers: h });
      const d = await r.json();
      if (d.success) {
        setMessages(d.messages || []);
        fetch(`${API_BASE}/messages/${otherId}/read`, { method: 'PUT', headers: h }).catch(() => {});
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {}
  }, []);

  const sendMessage = async () => {
    const msg = inputText.trim();
    if (!msg || !activeConv?.otherUser?._id) return;
    await doSend(msg, 'typed');
    setInputText('');
  };

  const sendQuickReply = async (text) => {
    if (!text || !activeConv?.otherUser?._id) return;
    setShowQuickPanel(false);
    await doSend(text, 'quick_reply');
  };

  const doSend = async (text, messageType = 'typed') => {
    const tempId = `tmp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId,
      senderId: myId,
      text,
      createdAt: new Date().toISOString(),
      read: false,
      isQuickReply: messageType === 'quick_reply',
    }]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);
    setSending(true);
    try {
      const h = await getHeaders();
      const r = await fetch(`${API_BASE}/messages`, {
        method: 'POST', headers: h,
        body: JSON.stringify({ receiverId: activeConv.otherUser._id, text, messageType }),
      });
      const d = await r.json();
      if (d.success && d.message) {
        setMessages(prev => prev.map(m => m._id === tempId ? d.message : m));
        // After first message to a new user, reload conversations
        if (activeConv.conversationId?.startsWith('new_')) {
          loadConversations();
        }
      } else {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        if (d.code === 'DRIVER_NO_TYPING') {
          Alert.alert('Not Allowed', 'This driver can only receive quick replies from their transporter.');
        } else if (d.code === 'TYPED_LIMIT_REACHED') {
          Alert.alert('Limit Reached', 'This passenger has reached their typed message limit.');
        } else {
          Alert.alert('Error', d.message || 'Could not send.');
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => m._id !== tempId));
      Alert.alert('Error', 'Could not send message.');
    } finally { setSending(false); }
  };

  // ── Conversation item ─────────────────────────────────────────────────────
  const renderConvItem = ({ item }) => {
    const unread = item.unreadCount > 0;
    const rm = roleMeta(item.otherUser.role);
    return (
      <TouchableOpacity
        style={[s.convRow, unread && s.convRowUnread]}
        onPress={() => openChat(item)}
        activeOpacity={0.72}
      >
        <View style={s.avWrap}>
          <LinearGradient colors={[C.primary, C.dark]} style={s.av}>
            <Text style={s.avTxt}>{ini(item.otherUser.name)}</Text>
          </LinearGradient>
          {unread && <View style={s.onlineDot} />}
        </View>

        <View style={s.convBody}>
          <View style={s.convR1}>
            <Text style={[s.convName, unread && { fontWeight: '800' }]} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={[s.convTime, unread && { color: C.primary, fontWeight: '700' }]}>
              {fmtListDate(item.lastMessage.createdAt)}
            </Text>
          </View>
          <View style={s.convR2}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {item.lastMessage.fromMe && (
                <Ionicons
                  name={item.lastMessage.read ? 'checkmark-done' : 'checkmark'}
                  size={13}
                  color={item.lastMessage.read ? C.primary : C.tMuted}
                />
              )}
              <Text style={[s.convPreview, unread && { color: C.tDark, fontWeight: '600' }]} numberOfLines={1}>
                {item.lastMessage.fromMe ? 'You: ' : ''}{item.lastMessage.text}
              </Text>
            </View>
            {unread && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={[s.roleTag, { backgroundColor: rm.bg }]}>
            <Text style={[s.roleTagTxt, { color: rm.color }]}>{rm.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Message bubble ────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }) => {
    const fromMe   = item.senderId?.toString() === myId?.toString();
    const prev     = messages[index - 1];
    const showDate = !prev || new Date(prev.createdAt).toDateString() !== new Date(item.createdAt).toDateString();
    const isTemp   = item._id?.toString().startsWith('tmp_');
    const isQuick  = item.isQuickReply || false;
    return (
      <>
        {showDate && (
          <View style={s.datePill}>
            <Text style={s.datePillTxt}>{fmtChatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[s.msgRow, fromMe ? s.msgRowMe : s.msgRowThem]}>
          {!fromMe && (
            <View style={s.msgAv}>
              <Text style={s.msgAvTxt}>{ini(item.senderName || activeConv?.otherUser?.name)}</Text>
            </View>
          )}
          <View style={[s.bubble, fromMe ? s.bMe : s.bThem]}>
            {isQuick && (
              <View style={s.quickBadge}>
                <Ionicons name="flash" size={9} color={fromMe ? 'rgba(255,255,255,0.7)' : '#888'} />
                <Text style={[s.quickBadgeTxt, fromMe && { color: 'rgba(255,255,255,0.7)' }]}>Quick Reply</Text>
              </View>
            )}
            <Text style={[s.bTxt, fromMe && { color: C.white }]}>{item.text}</Text>
            <View style={s.bMeta}>
              <Text style={[s.bTime, fromMe && { color: 'rgba(255,255,255,0.6)' }]}>{fmtTime(item.createdAt)}</Text>
              {fromMe && (
                <Ionicons
                  name={isTemp ? 'time-outline' : item.read ? 'checkmark-done' : 'checkmark'}
                  size={12}
                  color={item.read ? C.accent : 'rgba(255,255,255,0.6)'}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CHAT VIEW
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'chat' && activeConv) {
    const otherRole = activeConv.otherUser?.role || 'unknown';
    const isDriver  = otherRole === 'driver';

    return (
      <View style={{ flex: 1, backgroundColor: C.chatBg }}>
        <LinearGradient colors={[C.primary, C.dark]} style={s.chatBar}>
          <TouchableOpacity style={s.iconBtn} onPress={closeChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={s.chatBarAv}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.white }}>{ini(activeConv.otherUser.name)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.white }} numberOfLines={1}>
              {activeConv.otherUser.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {roleMeta(otherRole).label}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.iconBtn, showQuickPanel && { backgroundColor: 'rgba(255,255,255,0.3)' }]}
            onPress={() => setShowQuickPanel(!showQuickPanel)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="flash" size={20} color={C.white} />
          </TouchableOpacity>
        </LinearGradient>

        {isDriver && (
          <View style={s.networkBanner}>
            <Ionicons name="shield-checkmark" size={14} color="#27ae60" />
            <Text style={s.networkBannerTxt}>Network Chat — Only drivers assigned to your routes</Text>
          </View>
        )}

        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item._id?.toString() || String(Math.random())}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <LinearGradient colors={[C.primary, C.dark]} style={s.emptyChatAv}>
                <Ionicons name="chatbubble-outline" size={28} color={C.white} />
              </LinearGradient>
              <Text style={s.emptyChatTitle}>No messages yet</Text>
              <Text style={s.emptyChatSub}>Say hello to {activeConv.otherUser.name}!</Text>
            </View>
          }
        />

        {showQuickPanel && (
          <View style={s.quickPanel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="flash" size={14} color={C.primary} />
              <Text style={s.quickPanelTitle}>Quick Replies</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TRANSPORTER_QUICK_REPLIES.map(qr => (
                <TouchableOpacity key={qr.id} style={s.quickChip} onPress={() => sendQuickReply(qr.text)}>
                  <Text style={s.quickChipTxt}>{qr.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={s.inputBar}>
            <View style={s.inputWrap}>
              <TextInput
                style={s.input}
                placeholder="Type a message…"
                placeholderTextColor={C.tMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity onPress={sendMessage} disabled={!inputText.trim() || sending} activeOpacity={0.85}>
              <LinearGradient
                colors={inputText.trim() && !sending ? [C.primary, C.dark] : ['#C5D0C5', '#C5D0C5']}
                style={s.sendBtn}
              >
                {sending
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <Ionicons name="send" size={17} color={C.white} style={{ marginLeft: 2 }} />}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CONVERSATIONS LIST
  // ════════════════════════════════════════════════════════════════════════════
  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Info banner */}
      <View style={s.topInfoBanner}>
        <Ionicons name="information-circle-outline" size={15} color={C.primary} />
        <Text style={s.topInfoTxt}>
          You can message drivers in your network and your passengers
        </Text>
      </View>

      <View style={s.listBar}>
        <Text style={s.listBarTitle}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          {totalUnread > 0 ? `  ·  ${totalUnread} unread` : ''}
        </Text>
        <TouchableOpacity
          style={s.newChatBtn}
          onPress={() => setShowNewChat(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={16} color={C.white} />
          <Text style={s.newChatBtnTxt}>New Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.listRefreshBtn} onPress={loadConversations} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh" size={18} color={C.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={s.loadingTxt}>Loading messages…</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.emptyList}>
          <View style={s.emptyListIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color={C.primary} />
          </View>
          <Text style={s.emptyListTitle}>No Messages Yet</Text>
          <Text style={s.emptyListSub}>
            Tap "New Chat" to start a conversation with your drivers or passengers.
          </Text>
          <TouchableOpacity style={s.refreshBtn} onPress={() => setShowNewChat(true)}>
            <Ionicons name="create-outline" size={16} color={C.white} />
            <Text style={s.refreshBtnTxt}>New Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.conversationId}
          renderItem={renderConvItem}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.border, marginLeft: 83 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { onRefresh?.(); loadConversations(); }}
              colors={[C.primary]}
              tintColor={C.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      {/* New Chat Modal */}
      <NewChatModal
        visible={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={openChatWithUser}
        transporterId={transporterId}
      />
    </View>
  );
}

// ── New Chat Modal Styles ─────────────────────────────────────────
const nc = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14, gap: 10 },
  closeBtn:    { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.white },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, borderColor: C.mid, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 13, color: C.tDark },

  tabs:         { flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, backgroundColor: C.light, borderRadius: 12, padding: 4, gap: 4 },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
  tabActive:    { backgroundColor: C.primary },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: C.tLight },
  tabTxtActive: { color: C.white },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  loadingTxt: { fontSize: 13, color: C.tMuted },
  emptyTxt:   { fontSize: 14, color: C.tMuted },

  userRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, gap: 0 },
  userAv:     { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  userAvTxt:  { fontSize: 16, fontWeight: '800', color: C.white },
  userName:   { fontSize: 14, fontWeight: '700', color: C.tDark },
  userSub:    { fontSize: 12, color: C.tLight, marginTop: 2 },
  userMeta:   { fontSize: 11, color: C.tMuted, marginTop: 1 },
  roleTag:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 12 },
  roleTagTxt: { fontSize: 10, fontWeight: '700' },
});

const s = StyleSheet.create({
  topInfoBanner:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#EDF1ED', borderBottomWidth: 1, borderBottomColor: '#C5D0C5', gap: 8 },
  topInfoTxt:     { flex: 1, fontSize: 12, color: '#415844', fontWeight: '600' },

  listBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5EBE5', gap: 8 },
  listBarTitle:    { flex: 1, fontSize: 13, color: '#6B7280', fontWeight: '600' },
  newChatBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#415844', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  newChatBtnTxt:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  listRefreshBtn:  { width: 34, height: 34, borderRadius: 10, backgroundColor: '#EDF1ED', alignItems: 'center', justifyContent: 'center' },

  convRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', gap: 13 },
  convRowUnread: { backgroundColor: '#F6FAF6' },
  avWrap:        { position: 'relative', flexShrink: 0 },
  av:            { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avTxt:         { fontSize: 18, fontWeight: '800', color: '#fff' },
  onlineDot:     { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: '#4CAF50', borderWidth: 2.5, borderColor: '#fff' },
  convBody:      { flex: 1, minWidth: 0 },
  convR1:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  convName:      { fontSize: 14, fontWeight: '600', color: '#1A2218', flex: 1, marginRight: 8 },
  convTime:      { fontSize: 11, color: '#9CA3AF', flexShrink: 0 },
  convR2:        { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  convPreview:   { flex: 1, fontSize: 13, color: '#6B7280' },
  badge:         { backgroundColor: '#415844', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 },
  badgeTxt:      { fontSize: 10, color: '#fff', fontWeight: '900' },
  roleTag:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  roleTagTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  chatBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, backgroundColor: '#415844', gap: 8 },
  chatBarAv:  { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  iconBtn:    { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  networkBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f8f0', paddingHorizontal: 14, paddingVertical: 7, gap: 7, borderBottomWidth: 1, borderBottomColor: '#c8edd8' },
  networkBannerTxt: { fontSize: 12, color: '#27ae60', fontWeight: '600', flex: 1 },

  datePill:    { alignSelf: 'center', backgroundColor: 'rgba(65,88,68,0.13)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 12, marginVertical: 10 },
  datePillTxt: { fontSize: 11, color: '#415844', fontWeight: '700' },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMe:    { justifyContent: 'flex-end' },
  msgRowThem:  { justifyContent: 'flex-start' },
  msgAv:       { width: 30, height: 30, borderRadius: 15, backgroundColor: '#415844', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 },
  msgAvTxt:    { fontSize: 10, fontWeight: '800', color: '#fff' },
  bubble:      { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  bMe:         { backgroundColor: '#415844', borderBottomRightRadius: 4 },
  bThem:       { backgroundColor: '#fff', borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  bTxt:        { fontSize: 14, color: '#1A2218', lineHeight: 21 },
  bMeta:       { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: 4 },
  bTime:       { fontSize: 10, color: '#9CA3AF' },

  quickBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  quickBadgeTxt: { fontSize: 9, color: '#888' },

  quickPanel:      { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  quickPanelTitle: { fontSize: 12, fontWeight: '700', color: '#415844', marginLeft: 6 },
  quickChip:       { backgroundColor: '#EDF1ED', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#415844' },
  quickChipTxt:    { color: '#415844', fontSize: 12, fontWeight: '600' },

  inputBar:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#F0F2F0', borderTopWidth: 1, borderTopColor: '#E5EBE5' },
  inputWrap: { flex: 1, backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 11 : 7, minHeight: 46, maxHeight: 120, elevation: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  input:     { fontSize: 14, color: '#1A2218', maxHeight: 100, padding: 0 },
  sendBtn:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', elevation: 2 },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingTxt:     { marginTop: 10, fontSize: 13, color: '#9CA3AF' },
  emptyList:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyListIcon:  { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EDF1ED', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyListTitle: { fontSize: 17, fontWeight: '800', color: '#1A2218', textAlign: 'center', marginBottom: 8 },
  emptyListSub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  refreshBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 22, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, backgroundColor: '#415844' },
  refreshBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyChat:      { alignItems: 'center', paddingTop: 70, gap: 12 },
  emptyChatAv:    { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyChatTitle: { fontSize: 15, fontWeight: '800', color: '#1A2218' },
  emptyChatSub:   { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});