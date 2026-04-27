// frontend/auth/LoginScreen.js — FIXED VERSION
// Bug fixed: Removed inline comment from JSX (was causing "Text strings must be rendered within <Text>" error)

// ════════════════════════════════════════════════════════════
// ONLY THIS SECTION CHANGED — rest of your LoginScreen is same
// ════════════════════════════════════════════════════════════

// ❌ WRONG (your current code — comment inside JSX causes crash):
// // In LoginScreen.js, update the forgot password onPress:
// <TouchableOpacity
//   style={s.forgotWrap}
//   onPress={() => navigation.navigate("ForgetPassword")}
// >
//   <Text style={s.forgotTxt}>Forgot Password?</Text>
// </TouchableOpacity>

// ✅ CORRECT (just the component, no comment above it):
// Replace lines ~180-186 in your LoginScreen with this:

/*
<TouchableOpacity
  style={s.forgotWrap}
  onPress={() => navigation.navigate("ForgetPassword")}
>
  <Text style={s.forgotTxt}>Forgot Password?</Text>
</TouchableOpacity>
*/

// ════════════════════════════════════════════════════════════
// COMPLETE FIXED LoginScreen below (copy-paste this whole file)
// ════════════════════════════════════════════════════════════

import "react-native-gesture-handler";
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';
// Terms acceptance key — stored outside auth keys so it persists across logouts
const TERMS_ACCEPTED_KEY = 'passenger_terms_accepted';
const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  green:       "#415844",
  greenLight:  "#EAF4EB",
  greenDark:   "#2e6b37",
  greenFaint:  "#F0F9F1",
  white:       "#FFFFFF",
  bg:          "#EEF7EF",
  textMain:    "#1A2E1C",
  textSub:     "#5A7A5C",
  textMuted:   "#9DB89A",
  border:      "#D4E8D5",
  shadow:      "#439b4e",
};

const Dot = ({ size, top, left, right, bottom, opacity = 0.18 }) => (
  <View style={{
    position: "absolute", width: size, height: size, borderRadius: size / 2,
    backgroundColor: C.green, opacity,
    top, left, right, bottom,
  }} />
);

const Plus = ({ top, left, right, bottom, size = 14, opacity = 0.25 }) => (
  <View style={{ position: "absolute", top, left, right, bottom, opacity }}>
    <View style={{ width: size, height: 2, backgroundColor: C.green, position: "absolute", top: size / 2 - 1, left: 0 }} />
    <View style={{ width: 2, height: size, backgroundColor: C.green, position: "absolute", left: size / 2 - 1, top: 0 }} />
  </View>
);

const CarIllustration = () => (
  <View style={il.scene}>
    <View style={il.road}>
      <View style={il.roadLine} />
      <View style={il.roadLine} />
      <View style={il.roadLine} />
    </View>
    <View style={il.car}>
      <View style={il.roof}>
        <View style={il.windowRow}>
          <View style={il.window} />
          <View style={[il.window, { width: 30 }]} />
        </View>
      </View>
      <View style={il.body}>
        <View style={il.headlight} />
        <View style={il.taillight} />
        <View style={il.doorLine} />
      </View>
      <View style={il.wheelRow}>
        <View style={il.wheelWrap}>
          <View style={il.wheel}><View style={il.hubcap} /></View>
        </View>
        <View style={il.wheelWrap}>
          <View style={il.wheel}><View style={il.hubcap} /></View>
        </View>
      </View>
    </View>
    <View style={[il.tree, { left: 18, height: 38, width: 12 }]}>
      <View style={[il.treeCrown, { width: 28, height: 28 }]} />
    </View>
    <View style={[il.tree, { right: 22, height: 50, width: 10 }]}>
      <View style={[il.treeCrown, { width: 36, height: 36 }]} />
    </View>
    <View style={[il.tree, { right: 58, height: 30, width: 8 }]}>
      <View style={[il.treeCrown, { width: 22, height: 22 }]} />
    </View>
  </View>
);

function InputField({ icon, placeholder, value, onChangeText, secure, keyboardType, right }) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const focus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const blur = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.green] });
  const bgColor     = anim.interpolate({ inputRange: [0, 1], outputRange: ["#FFFFFF", C.greenFaint] });

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
        secureTextEntry={secure}
        keyboardType={keyboardType || "default"}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {right}
    </Animated.View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [loading,        setLoading]        = useState(false);
  const [showPassword,   setShowPassword]   = useState(false);
  const [termsAccepted,  setTermsAccepted]  = useState(null);  // null = checking
  const [termsScrolled,  setTermsScrolled]  = useState(false);

  // Check if terms have been accepted before (only show once, ever)
  useEffect(() => {
    AsyncStorage.getItem(TERMS_ACCEPTED_KEY)
      .then(v => setTermsAccepted(!!v))
      .catch(() => setTermsAccepted(true)); // if storage fails, don't block user
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter both email and password');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password: password.trim() }),
      });
      const data = await response.json();

      if (data.success && data.token) {
        const user   = data.user || data.driver || data.transporter;
        const role   = user.role.toLowerCase();
        const userId = user.id || user._id;

        // Preserve terms-acceptance flag so it is not cleared on re-login
        const savedTerms = await AsyncStorage.getItem(TERMS_ACCEPTED_KEY).catch(() => null);
        await AsyncStorage.clear();
        if (savedTerms) await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, savedTerms).catch(() => {});
        const authData = [
          ['authToken', data.token],
          ['userId', userId.toString()],
          ['userRole', role],
          ['userData', JSON.stringify(user)],
        ];
        if (role === 'driver')      authData.push(['driverId',      userId.toString()]);
        if (role === 'transporter') authData.push(['transporterId', userId.toString()]);
        await AsyncStorage.multiSet(authData);

        setTimeout(() => {
          if      (role === 'passenger')   navigation.replace('PassengerAppNavigation');
          else if (role === 'driver')      navigation.replace('Driver', { driver: user });
          else if (role === 'transporter') navigation.reset({ index: 0, routes: [{ name: "Transporter" }] });
        }, 100);
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
      }
    } catch {
      Alert.alert('Connection Error', 'Unable to reach the server.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    try {
      await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
    } catch {}
    setTermsAccepted(true);
  };

  // While checking AsyncStorage, show nothing (no flash)
  if (termsAccepted === null) return null;

  // First time user — show Terms & Conditions before allowing login
  if (!termsAccepted) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Header */}
          <View style={{ backgroundColor: C.green, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 16, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="document-text-outline" size={22} color={C.white} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.white }}>Terms &amp; Conditions</Text>
            </View>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              Please read and accept before using the app
            </Text>
          </View>

          {/* Terms content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator
            onScrollEndDrag={() => setTermsScrolled(true)}
            onMomentumScrollEnd={() => setTermsScrolled(true)}
          >
            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 16 }}>
              Welcome to Raahi. By using this app you agree to the following terms. Please read carefully.
            </Text>

            {[
              {
                title: '1. Service Agreement',
                body: 'Raahi connects passengers and drivers with transporters for daily van-pooling services. Your use of the service constitutes acceptance of these terms.',
              },
              {
                title: '2. Account Responsibility',
                body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.',
              },
              {
                title: '3. Payments',
                body: 'Monthly subscription amounts are set by your transporter. Payments are agreed upon offline between you and your transporter. Raahi facilitates record-keeping only.',
              },
              {
                title: '4. Code of Conduct',
                body: 'You agree to treat drivers, transporters, and other passengers respectfully. Abusive behaviour may result in account suspension.',
              },
              {
                title: '5. Data & Privacy',
                body: 'We collect and store your name, phone number, email, and location data solely for the purpose of providing the van-pooling service. Your data is never sold to third parties.',
              },
              {
                title: '6. Complaints & Support',
                body: 'Complaints can be raised through the app and are reviewed by your transporter. Raahi does not guarantee resolution timelines.',
              },
              {
                title: '7. Limitation of Liability',
                body: 'Raahi is a platform provider and is not liable for delays, accidents, or disputes between passengers and transporters.',
              },
              {
                title: '8. Modifications',
                body: 'These terms may be updated from time to time. Continued use of the app after changes constitutes acceptance of the new terms.',
              },
            ].map((section) => (
              <View key={section.title} style={{ backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A2E1C', marginBottom: 6 }}>{section.title}</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 20 }}>{section.body}</Text>
              </View>
            ))}

            <View style={{ backgroundColor: C.greenFaint, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Ionicons name="information-circle-outline" size={16} color={C.green} />
              <Text style={{ flex: 1, fontSize: 12, color: C.green, fontWeight: '600', lineHeight: 18 }}>
                Scroll through all the terms above before accepting.
              </Text>
            </View>
          </ScrollView>

          {/* Accept button */}
          <View style={{ padding: 18, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.white }}>
            <TouchableOpacity
              style={[s.btn, !termsScrolled && { opacity: 0.45 }]}
              onPress={handleAcceptTerms}
              disabled={!termsScrolled}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={C.white} style={{ marginRight: 8 }} />
              <Text style={s.btnTxt}>I ACCEPT — CONTINUE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topBand}>
          <Dot size={14} top={18}  left={24}  opacity={0.22} />
          <Dot size={8}  top={60}  left={60}  opacity={0.15} />
          <Dot size={22} top={14}  right={20} opacity={0.13} />
          <Dot size={10} bottom={30} left={40} opacity={0.18} />
          <Plus top={40} right={56} size={12} opacity={0.28} />
          <Plus top={22} left={SW * 0.42} size={10} opacity={0.22} />
          <Plus bottom={22} right={28} size={14} opacity={0.2} />
          <CarIllustration />
        </View>

        <View style={s.card}>
          <View style={s.notch} />

          <Text style={s.hello}>Welcome Back</Text>
          <Text style={s.desc}>Sign in to continue your journey</Text>

          <View style={s.fields}>
            <InputField
              icon="mail-outline"
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <InputField
              icon="lock-closed-outline"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secure={!showPassword}
              right={
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} />
                </TouchableOpacity>
              }
            />
          </View>

          {/* ✅ FIXED: No comment above this TouchableOpacity */}
          <TouchableOpacity
            style={s.forgotWrap}
            onPress={() => navigation.navigate("ForgetPassword")}
          >
            <Text style={s.forgotTxt}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={s.btnTxt}>SIGN IN</Text>
            }
          </TouchableOpacity>

          <View style={s.registerRow}>
            <Text style={s.registerTxt}>New here? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("DashboardRegister")}>
              <Text style={s.registerLink}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 10 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const il = StyleSheet.create({
  scene:     { width: SW * 0.72, height: 130, alignSelf: "center", justifyContent: "flex-end", marginBottom: 0, position: "relative" },
  road:      { height: 14, backgroundColor: "#2e6b37", borderRadius: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: 10 },
  roadLine:  { width: 28, height: 3, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2 },
  car:       { position: "absolute", bottom: 14, left: SW * 0.1, width: 170 },
  roof:      { backgroundColor: "#FFFFFF", borderTopLeftRadius: 14, borderTopRightRadius: 20, marginHorizontal: 20, paddingVertical: 8, paddingHorizontal: 10 },
  windowRow: { flexDirection: "row", gap: 6 },
  window:    { width: 38, height: 22, borderRadius: 6, backgroundColor: C.greenLight, borderWidth: 1.5, borderColor: C.border },
  body:      { backgroundColor: C.white, height: 38, borderRadius: 8, marginHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.border },
  headlight: { width: 12, height: 8, backgroundColor: "#FFF176", borderRadius: 4 },
  taillight: { width: 10, height: 8, backgroundColor: "#FF8A80", borderRadius: 3 },
  doorLine:  { position: "absolute", left: "45%", top: 6, width: 1.5, height: 26, backgroundColor: C.border },
  wheelRow:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, marginTop: -6 },
  wheelWrap: { width: 34, height: 17, overflow: "hidden" },
  wheel:     { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1A2E1C", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#2e6b37" },
  hubcap:    { width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", opacity: 0.3 },
  tree:      { position: "absolute", bottom: 14, alignItems: "center", justifyContent: "flex-end" },
  treeCrown: { backgroundColor: C.green, borderRadius: 999, opacity: 0.8, marginBottom: -6 },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1 },
  topBand: {
    backgroundColor: C.bg, paddingTop: SH * 0.07, paddingBottom: 0,
    minHeight: SH * 0.38, justifyContent: "flex-end", overflow: "hidden",
  },
  card: {
    flex: 1, minHeight: SH * 0.62, backgroundColor: C.white,
    borderTopLeftRadius: 36, borderTopRightRadius: 36,
    paddingHorizontal: 28, paddingTop: 18,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  notch: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 22 },
  hello: { fontSize: 30, fontWeight: "900", color: C.textMain, letterSpacing: -0.5, marginBottom: 6 },
  desc:  { fontSize: 14, color: C.textMuted, marginBottom: 28, fontWeight: "500" },
  fields: { gap: 14, marginBottom: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, height: 58 },
  input:     { flex: 1, fontSize: 15, color: C.textMain, fontWeight: "500" },
  forgotWrap: { alignSelf: "flex-end", marginTop: 12, marginBottom: 28 },
  forgotTxt:  { color: C.green, fontWeight: "700", fontSize: 14 },
  btn: {
    backgroundColor: C.green, height: 58, borderRadius: 18,
    justifyContent: "center", alignItems: "center", marginBottom: 24,
    elevation: 6, shadowColor: C.green, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  btnTxt:       { color: C.white, fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  registerRow:  { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerTxt:  { color: C.textMuted, fontSize: 14, fontWeight: "500" },
  registerLink: { color: C.green, fontWeight: "800", fontSize: 14 },
});