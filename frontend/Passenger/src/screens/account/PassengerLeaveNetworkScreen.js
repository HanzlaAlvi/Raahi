// frontend/Passenger/src/screens/account/PassengerLeaveNetworkScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Platform,
  StatusBar, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const C = {
  main:  '#415844',
  dark:  '#2D3E2F',
  white: '#FFFFFF',
  bg:    '#F5F7F5',
  border:'#C5D0C5',
  textDk:'#1A2218',
  textMd:'#374151',
  textLt:'#6B7280',
  error: '#C62828',
  warn:  '#E65100',
};

const SB_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

export default function PassengerLeaveNetworkScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleLeave = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email to confirm.');
      return;
    }
    Alert.alert(
      'Leave Transporter Network',
      'This will permanently delete your account and all associated data. You will need to re-register to join again. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Leave Network',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await AsyncStorage.getItem('authToken')
                         || await AsyncStorage.getItem('userToken')
                         || await AsyncStorage.getItem('token');
              const res = await fetch(`${API_BASE}/account/leave-network`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: email.trim() }),
              });
              const data = await res.json();
              if (data.success) {
                await AsyncStorage.multiRemove([
                  'authToken', 'userToken', 'token', 'userId', 'userData', 'userRole'
                ]);
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              } else {
                Alert.alert('Error', data.message || 'Could not process your request.');
              }
            } catch {
              Alert.alert('Error', 'Could not connect to server. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />

      {/* Header */}
      <LinearGradient colors={[C.main, C.dark]} style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Leave Transporter Network</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Warning Card */}
        <View style={s.warningCard}>
          <Ionicons name="warning" size={32} color={C.warn} />
          <Text style={s.warningTitle}>This action is permanent</Text>
          <Text style={s.warningBody}>
            Leaving the network will permanently delete your account and all associated data including
            ride history, payments, and messages. You will need to re-register to join the service again.
          </Text>
        </View>

        <Text style={s.label}>Confirm your email address</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your registered email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[s.leaveBtn, loading && { opacity: 0.6 }]}
          onPress={handleLeave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="exit-outline" size={18} color="#fff" /><Text style={s.leaveBtnTxt}>Leave Network & Delete Account</Text></>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.75}>
          <Text style={s.cancelBtnTxt}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: SB_H + 10, paddingBottom: 14, gap: 10 },
  headerBtn:   { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },
  warningCard: { backgroundColor: '#FFF3E0', borderRadius: 16, padding: 18, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2', gap: 10 },
  warningTitle:{ fontSize: 16, fontWeight: '800', color: '#E65100', textAlign: 'center' },
  warningBody: { fontSize: 13, color: '#BF360C', textAlign: 'center', lineHeight: 20 },
  label:       { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input:       { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C5D0C5', borderRadius: 12, padding: 14, fontSize: 14, color: '#1A2218', marginBottom: 20 },
  leaveBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#C62828', borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  leaveBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelBtn:   { alignItems: 'center', paddingVertical: 14 },
  cancelBtnTxt:{ fontSize: 14, fontWeight: '600', color: '#6B7280' },
});

