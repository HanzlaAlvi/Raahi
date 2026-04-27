// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: EmptyState
// Reusable empty list / no-data state
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function EmptyState({
  icon = 'alert-circle-outline',
  title = 'Nothing here',
  subtitle = '',
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={72} color="#ddd" />
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {!!actionLabel && (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#555',
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 6,
    textAlign: 'center',
  },
  btn: {
    marginTop: 20,
    backgroundColor: '#A1D826',
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 22,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
