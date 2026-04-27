// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: ChatModal
// Reusable chat modal used in Dashboard & ContactSupportScreen
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { getInitials } from '../../services/helpers';

export default function ChatModal({
  visible,
  onClose,
  personName = 'Driver',
  personSubtitle = 'Driver',
  messages = [],
  inputText,
  onInputChange,
  onSend,
}) {
  const flatListRef = useRef(null);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.chatContainer}>
        {/* Header */}
        <LinearGradient
          colors={['#439b4e', '#2e6b37']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.chatHeader}
        >
          <TouchableOpacity onPress={onClose}>
            <Icon name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.chatAvatar}>
            <Text style={styles.chatAvatarText}>{getInitials(personName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatName}>{personName}</Text>
            <Text style={styles.chatSub}>{personSubtitle}</Text>
          </View>
          <TouchableOpacity>
            <Icon name="videocam" size={24} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.fromDriver || item.fromSupport ? styles.bubbleDriver : styles.bubbleUser,
              ]}
            >
              <Text style={styles.bubbleText}>{item.text}</Text>
              <Text style={styles.bubbleTime}>{item.time}</Text>
            </View>
          )}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={80}
        >
          <View style={styles.chatInputRow}>
            <TouchableOpacity style={styles.attachBtn}>
              <Icon name="add" size={28} color="#439b4e" />
            </TouchableOpacity>
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={onInputChange}
              multiline
              maxLength={500}
              onSubmitEditing={onSend}
            />
            <TouchableOpacity onPress={onSend} disabled={!inputText?.trim()}>
              <LinearGradient
                colors={inputText?.trim() ? ['#439b4e', '#2e6b37'] : ['#ccc', '#bbb']}
                style={styles.sendBtn}
              >
                <Icon name="send" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chatContainer: { flex: 1, backgroundColor: '#EEF7EF' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 14,
    gap: 12,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  chatName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  chatSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  bubbleDriver: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  bubbleUser: { backgroundColor: '#439b4e', alignSelf: 'flex-end' },
  bubbleText: { fontSize: 14, color: '#222' },
  bubbleTime: { fontSize: 11, color: '#999', marginTop: 4, textAlign: 'right' },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  attachBtn: { padding: 4 },
  chatInput: {
    flex: 1,
    backgroundColor: '#EEF7EF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});