// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: AppHeader
// Reusable gradient header for all screens
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AppHeader({
  title,
  onBack,
  rightIcon,
  rightAction,
  colors = ['#439b4e', '#2e6b37'],
}) {
  return (
    <LinearGradient colors={colors} style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="arrow-back" size={28} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      {rightIcon ? (
        <TouchableOpacity onPress={rightAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name={rightIcon} size={24} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 28 }} />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
});