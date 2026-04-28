import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = "https://raahi-q2ur.onrender.com/api";

const P = {
  main:      "#415844",
  dark:      "#2D3E2F",
  white:     "#FFFFFF",
  bg:        "#F5F7F5",
  light:     "#EDF1ED",
  border:    "#C5D0C5",
  textDark:  "#1A2218",
  textMid:   "#374151",
  textLight: "#6B7280",
  error:     "#C62828",
};

export default function LeaveNetworkScreen({ driverProfile, authTokenRef, getHeaders, navigateTo, navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLeave = () => {
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
              const tok = authTokenRef.current;
              const res = await fetch(`${API_BASE_URL}/account/leave-network`, {
                method: 'DELETE',
                headers: { ...getHeaders(tok), 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
              });
              const data = await res.json();
              if (data.success) {
                await AsyncStorage.multiRemove(['authToken', 'userId', 'driverId', 'userData']);
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <View style={st.warningBox}>
            <Ionicons name="warning" size={32} color="#E65100" />
            <Text style={st.warningTitle}>This action is permanent</Text>
            <Text style={st.warningBody}>
              Leaving the network will permanently delete your account and all associated data including trip history, payments, and messages. You will need to re-register to join the service again.
            </Text>
          </View>

          <Text style={st.label}>Confirm your email address</Text>
          <TextInput
            style={st.input}
            placeholder="Enter your registered email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[st.actionBtn, loading && { opacity: 0.6 }]}
            onPress={handleLeave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Ionicons name="exit-outline" size={18} color="#fff" /><Text style={st.actionBtnTxt}>Leave Network & Delete Account</Text></>
            }
          </TouchableOpacity>

          <TouchableOpacity style={st.cancelBtn} onPress={() => navigateTo('Dashboard')} activeOpacity={0.75}>
            <Text style={st.cancelBtnTxt}>Cancel & Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14,
  },
  headerBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1, textAlign: 'center' },

  scroll: { padding: 20, paddingBottom: 40 },
  warningBox: { backgroundColor: '#FFF3E0', borderRadius: 16, padding: 18, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2', gap: 10 },
  warningTitle: { fontSize: 16, fontWeight: '800', color: '#E65100', textAlign: 'center' },
  warningBody: { fontSize: 13, color: '#BF360C', textAlign: 'center', lineHeight: 20 },

  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#C5D0C5', borderRadius: 12, padding: 14, fontSize: 14, color: '#1A2218', marginBottom: 20 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#C62828', borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  actionBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelBtnTxt: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});

