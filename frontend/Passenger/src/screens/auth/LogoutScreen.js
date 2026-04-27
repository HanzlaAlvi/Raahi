import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { clearSessionData } from '../../services/storageService';
import { SCREENS } from '../../constants';

export default function LogoutScreen({ navigation }) {
  const handleLogout = async () => {
    await clearSessionData();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Are you sure you want to log out?</Text>
      <TouchableOpacity style={styles.btn} onPress={handleLogout}>
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text:      { fontSize: 20, marginBottom: 20, color: '#333' },
  btn:       { backgroundColor: '#FFD60A', padding: 12, borderRadius: 8 },
  btnText:   { color: '#000', fontWeight: 'bold', fontSize: 15 },
});