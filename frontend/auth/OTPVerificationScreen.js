// frontend/auth/OTPVerificationScreen.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL  = 'https://raahi-q2ur.onrender.com/api';
const COOLDOWN_SECS = 60;
const { height: SH } = Dimensions.get('window');

const C = {
  green:      '#415844',
  greenLight: '#EAF4EB',
  white:      '#FFFFFF',
  bg:         '#EEF7EF',
  textMain:   '#1A2E1C',
  textMuted:  '#9DB89A',
  border:     '#D4E8D5',
  error:      '#C62828',
  success:    '#2E7D32',
  successBg:  '#E8F5E9',
};

export default function OTPVerificationScreen({ navigation, route }) {
  const { email, maskedEmail } = route.params || {};

  const [otp,          setOtp]          = useState(['', '', '', '', '', '']);
  const [loading,      setLoading]      = useState(false);
  const [resending,    setResending]    = useState(false);
  const [timer,        setTimer]        = useState(COOLDOWN_SECS);
  const [otpError,     setOtpError]     = useState('');
  const [resendMsg,    setResendMsg]    = useState('');   // success message
  const [resendError,  setResendError]  = useState('');   // error message
  const inputs    = useRef([]);
  const resendRef = useRef(false);   // debounce flag

  // ── Countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // ── OTP input handlers ──────────────────────────────────────────
  const handleChange = (text, index) => {
    setOtpError('');
    const cleaned = text.replace(/[^0-9]/g, '').slice(-1);
    const next    = [...otp];
    next[index]   = cleaned;
    setOtp(next);
    if (cleaned && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const otpValue = otp.join('');

  // ── Verify ───────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (otpValue.length !== 6) {
      setOtpError('Please enter the full 6-digit code.');
      return;
    }
    try {
      setLoading(true);
      setOtpError('');
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp: otpValue }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setOtpError(data.message || 'Incorrect OTP. Please try again.');
        return;
      }
      navigation.navigate('ResetPassword', { email, otp: otpValue });
    } catch {
      setOtpError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend with debounce ─────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (timer > 0 || resending || resendRef.current) return;
    resendRef.current = true;   // debounce — block rapid re-clicks
    setResendMsg('');
    setResendError('');
    try {
      setResending(true);
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setResendError(data.message || 'Could not resend code. Please try again.');
        return;
      }
      // Reset OTP boxes and restart cooldown
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      setTimer(COOLDOWN_SECS);
      inputs.current[0]?.focus();
      setResendMsg(`Code resent successfully to ${data.maskedEmail || maskedEmail || email}.`);
    } catch {
      setResendError('Network error. Could not resend code.');
    } finally {
      setResending(false);
      // Release debounce lock after 1 second
      setTimeout(() => { resendRef.current = false; }, 1000);
    }
  }, [timer, resending, email, maskedEmail]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.root}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top band */}
        <View style={s.topBand}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={C.green} />
          </TouchableOpacity>
          <View style={s.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={48} color={C.green} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.notch} />
          <Text style={s.title}>Verify Code</Text>
          <Text style={s.desc}>
            Enter the 6-digit code sent to:{'\n'}
            <Text style={s.emailHighlight}>{maskedEmail || email}</Text>
          </Text>

          {/* OTP boxes */}
          <View style={s.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={r => inputs.current[i] = r}
                style={[
                  s.otpBox,
                  digit       && s.otpBoxFilled,
                  otpError    && s.otpBoxError,
                ]}
                value={digit}
                onChangeText={t => handleChange(t, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* OTP inline error */}
          {!!otpError && (
            <View style={s.errBox}>
              <Ionicons name="alert-circle-outline" size={14} color={C.error} />
              <Text style={s.errTxt}>{otpError}</Text>
            </View>
          )}

          {/* Verify button */}
          <TouchableOpacity
            style={[s.btn, (loading || otpValue.length !== 6) && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={loading || otpValue.length !== 6}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.btnTxt}>VERIFY CODE</Text>
            }
          </TouchableOpacity>

          {/* Resend row */}
          <View style={s.resendRow}>
            <Text style={s.resendLabel}>Didn't receive it?{'  '}</Text>
            {timer > 0 ? (
              <Text style={s.resendTimer}>Resend available in {timer}s</Text>
            ) : (
              <TouchableOpacity
                onPress={handleResend}
                disabled={resending}
                activeOpacity={0.7}
              >
                {resending
                  ? <ActivityIndicator size="small" color={C.green} />
                  : <Text style={s.resendBtn}>Resend Code</Text>
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Resend success message */}
          {!!resendMsg && (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
              <Text style={s.successTxt}>{resendMsg}</Text>
            </View>
          )}

          {/* Resend error message */}
          {!!resendError && (
            <View style={s.errBox}>
              <Ionicons name="alert-circle-outline" size={14} color={C.error} />
              <Text style={s.errTxt}>{resendError}</Text>
            </View>
          )}

          <View style={{ height: 24 }} />
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
  notch:          { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 24 },
  title:          { fontSize: 28, fontWeight: '900', color: C.textMain, letterSpacing: -0.5, marginBottom: 10 },
  desc:           { fontSize: 14, color: C.textMuted, marginBottom: 32, fontWeight: '500', lineHeight: 22 },
  emailHighlight: { color: C.green, fontWeight: '700' },
  otpRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  otpBox: {
    width: 48, height: 58, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border,
    textAlign: 'center', fontSize: 24, fontWeight: '900', color: C.textMain,
    backgroundColor: '#FAFAFA',
  },
  otpBoxFilled: { borderColor: C.green,  backgroundColor: C.greenLight },
  otpBoxError:  { borderColor: C.error,  backgroundColor: '#FFF5F5'    },
  errBox:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12, marginTop: 4 },
  errTxt:   { fontSize: 12, color: C.error, flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: C.successBg, padding: 10, borderRadius: 10 },
  successTxt: { fontSize: 12, color: C.success, flex: 1, fontWeight: '600' },
  btn: {
    backgroundColor: C.green, height: 58, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, marginTop: 12, elevation: 6,
    shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  btnTxt:      { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
  resendRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  resendLabel: { color: C.textMuted, fontSize: 14 },
  resendTimer: { color: C.textMuted, fontSize: 13, fontWeight: '700' },
  resendBtn:   { color: C.green, fontSize: 14, fontWeight: '700' },
});