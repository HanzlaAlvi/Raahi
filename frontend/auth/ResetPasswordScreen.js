// frontend/auth/ResetPasswordScreen.js
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
  error:      '#e53935',
};

function PasswordField({ icon, placeholder, value, onChangeText }) {
  const [show, setShow]     = useState(false);
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
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={() => setShow(!show)}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ResetPasswordScreen({ navigation, route }) {
  const { email, otp } = route.params || {};

  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]             = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Required', 'Please fill in both password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Too Short', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();
      console.log('[ResetPassword] Response:', response.status, data);

      if (!response.ok || !data.success) {
        Alert.alert('Error', data.message || 'Password reset failed. Please try again.');
        return;
      }

      Alert.alert(
        'Password Reset ✅',
        'Your password has been reset successfully. Please log in with your new password.',
        [{
          text: 'Go to Login',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
        }]
      );

    } catch (err) {
      console.error('[ResetPassword] Error:', err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={s.topBand}>
          <View style={s.iconCircle}>
            <Ionicons name="lock-closed-outline" size={48} color={C.green} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.notch} />
          <Text style={s.title}>New Password</Text>
          <Text style={s.desc}>
            Create a strong new password for your account.
          </Text>

          <View style={s.fields}>
            <PasswordField
              icon="lock-closed-outline"
              placeholder="New password (min 6 characters)"
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <PasswordField
              icon="lock-closed-outline"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={s.hintError}>Passwords do not match</Text>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length >= 6 && (
              <Text style={s.hintSuccess}>✓ Passwords match</Text>
            )}
          </View>

          <TouchableOpacity
            style={[s.btn, (loading || newPassword.length < 6 || newPassword !== confirmPassword) && { opacity: 0.6 }]}
            onPress={handleReset}
            disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.btnTxt}>RESET PASSWORD</Text>
            }
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
  notch:       { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 24 },
  title:       { fontSize: 28, fontWeight: '900', color: C.textMain, letterSpacing: -0.5, marginBottom: 10 },
  desc:        { fontSize: 14, color: C.textMuted, marginBottom: 28, fontWeight: '500', lineHeight: 22 },
  fields:      { gap: 12, marginBottom: 8 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, height: 58 },
  input:       { flex: 1, fontSize: 16, color: C.textMain, fontWeight: '500' },
  hintError:   { color: C.error, fontSize: 12, marginLeft: 4, fontWeight: '500' },
  hintSuccess: { color: C.green, fontSize: 12, marginLeft: 4, fontWeight: '600' },
  btn: {
    backgroundColor: C.green, height: 58, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24, marginBottom: 20, elevation: 6,
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  btnTxt: { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
});