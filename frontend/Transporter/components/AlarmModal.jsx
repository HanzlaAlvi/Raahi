import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { P } from '../constants/colors';

const AlarmModal = ({ visible, onDismiss, title, message, unassignedCount = 0 }) => {
  if (!visible) return null;


  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <Ionicons name="alarm" size={28} color={P.error} />
            <Text style={s.title}>{title}</Text>
          </View>
          <Text style={s.message}>{message}</Text>
          {unassignedCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unassignedCount} pending routes</Text>
            </View>
          )}
          <TouchableOpacity style={s.okBtn} onPress={handleOK}>
            <Text style={s.okBtnText}>OK - Assign Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(139, 32, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  container: {
    backgroundColor: P.white,
    borderRadius: 20,
    padding: 24,
    minWidth: 320,
    maxWidth: '90%',
    shadowColor: P.error,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: P.error,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: P.textDark,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: P.errorBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: P.error + '40',
  },
  badgeText: {
    color: P.error,
    fontWeight: '700',
    fontSize: 14,
  },
  okBtn: {
    backgroundColor: P.main,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  okBtnText: {
    color: P.white,
    fontWeight: '800',
    fontSize: 16,
  },
});

export default AlarmModal;
