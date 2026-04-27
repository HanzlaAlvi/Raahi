// frontend/auth/ForgetPasswordScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';
const { height: SH } = Dimensions.get('window');

const C = {
  green:      '#415844',
  greenLight: '#EAF4EB',
  greenFaint: '#F0F9F1',
  white:      '#FFFFFF',
  bg:         '#EEF7EF',
  textMain:   '#1A2E1C',
  textMuted:  '#9DB89A',
  border:     '#D4E8D5',
};

function InputField({ icon, placeholder, value, onChangeText, keyboardType }) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const focus = () => { setFocused(true);  Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }).start(); };
  const blur  = () => { setFocused(false); Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start(); };
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.green] });
  const bgColor     = anim.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', C.greenFaint] });

  return (
    <Animated.View style={[s.inputWrap, { borderColor, backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={18} color={focused ? C.green : C.textMuted} style={{ marginRight: 12 }} />
      <TextInput
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={focus}
        onBlur={blur}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </Animated.View>
  );
}

export default function ForgetPasswordScreen({ navigation }) {
  const [email, setEmail]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSendOTP = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 65000);

    try {
      setLoading(true);
      setStatusMsg('Sending OTP to your email...');

      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed }),
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);
      setStatusMsg('');

      let data;
      try { data = await response.json(); }
      catch { throw new Error(`Server returned an invalid response (HTTP ${response.status})`); }

      console.log('[ForgotPassword] Response:', response.status, JSON.stringify(data));

      if (response.status === 404) {
        Alert.alert('Not Found', data.message || 'No account found with this email address.');
        return;
      }
      if (response.status === 400) {
        Alert.alert('Invalid Input', data.message || 'Please check your email and try again.');
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || `Server error (${response.status})`);
      }
      if (!data.success) {
        Alert.alert('Error', data.message || 'Failed to send OTP. Please try again.');
        return;
      }

      Alert.alert(
        'OTP Sent ✅',
        `A 6-digit OTP has been sent to:\n\n${data.maskedEmail}\n\nPlease check your inbox (and spam folder).`,
        [{
          text: 'Continue',
          onPress: () => navigation.navigate('OTPVerification', {
            email:       trimmed,
            maskedEmail: data.maskedEmail,
          }),
        }]
      );

    } catch (err) {
      clearTimeout(timeoutId);
      setStatusMsg('');
      console.error('[ForgotPassword] Error:', err.message);

      if (err.name === 'AbortError') {
        Alert.alert(
          'Server Taking Too Long',
          'The server may be waking up. Please wait a moment and try again.',
          [{ text: 'OK' }]
        );
      } else if (err.message?.includes('Network request failed')) {
        Alert.alert('No Connection', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.topBand}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={C.green} />
          </TouchableOpacity>
          <View style={s.iconCircle}>
            <Ionicons name="mail-outline" size={48} color={C.green} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.notch} />
          <Text style={s.title}>Forgot Password?</Text>
          <Text style={s.desc}>
            Enter your registered email address.{'\n'}We will send a 6-digit OTP to your inbox.
          </Text>

          <View style={s.fields}>
            <InputField
              icon="mail-outline"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            {email.length > 0 && !isValidEmail(email) && (
              <Text style={s.hintError}>Please enter a valid email address</Text>
            )}
          </View>

          {loading && statusMsg ? (
            <Text style={s.statusMsg}>{statusMsg}</Text>
          ) : null}

          <TouchableOpacity
            style={[s.btn, (loading || !isValidEmail(email)) && { opacity: 0.6 }]}
            onPress={handleSendOTP}
            disabled={loading || !isValidEmail(email)}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.btnTxt}>SEND OTP</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.backLink} onPress={() => navigation.navigate('Login')}>
            <Ionicons name="arrow-back-outline" size={16} color={C.green} />
            <Text style={s.backLinkTxt}>  Back to Login</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flexGrow: 1 },
  topBand: {
    backgroundColor: C.bg, paddingTop: SH * 0.08, paddingBottom: 20,
    minHeight: SH * 0.32, justifyContent: 'center', alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', top: SH * 0.06, left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.white, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.greenLight, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: C.border,
  },
  card: {
    flex: 1, minHeight: SH * 0.68, backgroundColor: C.white,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    paddingHorizontal: 28, paddingTop: 18,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  notch:     { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 24 },
  title:     { fontSize: 28, fontWeight: '900', color: C.textMain, letterSpacing: -0.5, marginBottom: 10 },
  desc:      { fontSize: 14, color: C.textMuted, marginBottom: 28, fontWeight: '500', lineHeight: 22 },
  fields:    { gap: 10, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, height: 58 },
  input:     { flex: 1, fontSize: 16, color: C.textMain, fontWeight: '500' },
  hintError: { color: '#e53935', fontSize: 12, marginLeft: 4, fontWeight: '500' },
  statusMsg: { color: C.green, fontSize: 13, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  btn: {
    backgroundColor: C.green, height: 58, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24, marginBottom: 20, elevation: 6,
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  btnTxt:      { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  backLink:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  backLinkTxt: { color: C.green, fontWeight: '700', fontSize: 14 },
});