// Transporter/auth/TransporterRegisterScreen.js
// ✅ UPDATED: Email OTP verification added (same as Driver/Passenger)
//            DNS domain check + OTP confirm before Step 1

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Image, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Modal, StyleSheet, StatusBar,
  SafeAreaView, Dimensions, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const API_BASE_URL = 'https://raahi-q2ur.onrender.com/api';
const GOOGLE_API_KEY = 'AIzaSyAURA_WOTStUtf3-nnDUR88jeBr6qSejFs';
const { height: SH } = Dimensions.get('window');

const C = {
  primary:      '#415844',
  primaryDark:  '#2D3E2F',
  primaryLight: '#EDF1ED',
  primaryMid:   '#C5D0C5',
  error:        '#D32F2F',
  errorLight:   '#FFF5F5',
  success:      '#2E7D32',
  successLight: '#F1F8F1',
  textMain:     '#1b2a1c',
  textSub:      '#374151',
  textMuted:    '#6b7280',
  textLight:    '#9ca3af',
  white:        '#ffffff',
  bg:           '#f4f8f4',
  cardBg:       '#ffffff',
  inputBg:      '#f9fafb',
  border:       '#d1d5db',
  borderLight:  '#e5e7eb',
};

const STEPS = [
  { key: 'account',  label: 'Account'  },
  { key: 'company',  label: 'Company'  },
  { key: 'location', label: 'Location' },
  { key: 'photo',    label: 'Photo'    },
];

// ─────────────────────────────────────────────────────────────────────────────
// checkEmailDomain — Google DNS-over-HTTPS (free, no package needed)
// Fake/non-existent domains ko OTP bhejne se pehle hi rok deta hai
// Gmail, Yahoo, Outlook etc. → allow | fakexyz.com → block
// ─────────────────────────────────────────────────────────────────────────────
const checkEmailDomain = async (email) => {
  try {
    const domain = email.split('@')[1];
    if (!domain) return { valid: false, reason: 'Invalid email format.' };
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const data = await res.json();
    if (data.Status === 3 || !data.Answer || data.Answer.length === 0)
      return { valid: false, reason: `"${domain}" ek valid email domain nahi hai. Kripya apna asli email address use karein (jaise Gmail, Yahoo, Outlook).` };
    return { valid: true };
  } catch {
    return { valid: true }; // network error → allow
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────
const StepBar = ({ current }) => (
  <View style={s.stepBar}>
    {STEPS.map((step, i) => {
      const done   = i < current;
      const active = i === current;
      return (
        <React.Fragment key={step.key}>
          <View style={s.stepItem}>
            <View style={[s.stepDot, done && s.stepDone, active && s.stepActive]}>
              {done
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[s.stepNum, active && { color: '#fff' }]}>{i + 1}</Text>}
            </View>
            <Text style={[s.stepLabel, active && { color: C.primary, fontWeight: '700' }]}>{step.label}</Text>
          </View>
          {i < STEPS.length - 1 && <View style={[s.stepLine, done && { backgroundColor: C.primary }]} />}
        </React.Fragment>
      );
    })}
  </View>
);

const Field = ({ icon, label, value, onChange, placeholder, keyboardType, autoCapitalize, error, secure, right }) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.inputRow, !!error && s.inputRowErr]}>
      <Ionicons name={icon} size={18} color={error ? C.error : C.primary} style={s.inputIcon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.textLight}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={false}
        secureTextEntry={secure}
        style={s.input}
      />
      {right}
    </View>
    {!!error && <Text style={s.errTxt}>{error}</Text>}
  </View>
);

const SectionHead = ({ title, subtitle }) => (
  <View style={s.sectionHead}>
    <Text style={s.stepHeading}>{title}</Text>
    {!!subtitle && <Text style={s.stepSub}>{subtitle}</Text>}
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function TransporterRegisterScreen({ navigation }) {
  const [step, setStep] = useState(0);

  // Step 0 — Account
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [phone,           setPhone]           = useState('');

  // ── Email OTP states (same as Driver/Passenger) ──────────────────────────
  const [emailVerified,  setEmailVerified]  = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailOtpSent,   setEmailOtpSent]   = useState(false);
  const [emailOtpInput,  setEmailOtpInput]  = useState('');
  const [expectedOtp,    setExpectedOtp]    = useState('');
  const [otpExpiresAt,   setOtpExpiresAt]   = useState(null);
  const [emailOtpError,  setEmailOtpError]  = useState('');
  const [resentMsg,      setResentMsg]      = useState('');

  // Step 1 — Company
  const [fullName,    setFullName]    = useState('');
  const [companyName, setCompanyName] = useState('');
  const [license,     setLicense]     = useState('');

  // Step 2 — Location
  const [country,       setCountry]       = useState('');
  const [city,          setCity]          = useState('');
  const [zone,          setZone]          = useState('');
  const [location,      setLocation]      = useState(null);
  const [address,       setAddress]       = useState('');
  const [modalVisible,  setModalVisible]  = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);

  // Step 3 — Photo
  const [profileImage, setProfileImage] = useState(null);
  const [imageModal,   setImageModal]   = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});

  const clearErr = (k) => setErrors(p => { const e = {...p}; delete e[k]; return e; });

  // ── Schema-Based Validation (User model fields) ─────────────────────
  const validateSync = (s) => {
    const e = {};

    // ── STEP 0: Account (email, phone, password) ──────────────────
    if (s === 0) {
      // email — schema: String, lowercase, trim
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        e.email = 'Enter a valid email address (e.g. name@gmail.com)';
      if (!emailVerified)
        e.email = e.email || 'Please verify your email — click "Verify" first';

      // phone — schema: String, valid number format
      if (!/^[\+]?[0-9]{7,15}$/.test(phone.trim().replace(/[\s\-\(\)]/g, '')))
        e.phone = 'Enter a valid phone number (e.g. +92 3XX XXXXXXX)';

      // password — schema: String, min 8 chars
      if (!password || password.length < 8)
        e.password = 'Password must be at least 8 characters long';

      // confirmPassword
      if (password !== confirmPassword)
        e.confirmPassword = 'Passwords do not match — please re-enter';
    }

    // ── STEP 1: Company (fullName, companyName, license) ─────────
    if (s === 1) {
      // fullName / name — schema: String, min 3, letters only
      if (!fullName.trim() || fullName.trim().length < 3)
        e.fullName = 'Full name must be at least 3 characters (e.g. Ahmed Ali)';
      else if (!/^[a-zA-Z\u0600-\u06FF\s]+$/.test(fullName.trim()))
        e.fullName = 'Name should contain letters only — no numbers or special characters';

      // companyName / company — schema: String
      if (!companyName.trim() || companyName.trim().length < 2)
        e.companyName = 'Company name is required (at least 2 characters)';

      // license — schema: String, 16 alphanumeric chars (if provided)
      if (license.trim()) {
        const lic = license.trim().replace(/[\s\-]/g, '');
        if (!/^[A-Za-z0-9]{16}$/.test(lic))
          e.license = 'License number must be exactly 16 alphanumeric characters';
      }
    }

    // ── STEP 2: Location (address, city, country, zone, coordinates) ──
    if (s === 2) {
      // location.coordinates — schema: [Number]
      if (!location)
        e.location = 'Please select your location using GPS or Search';

      // city & country — auto-filled from map selection; shown if still empty
      if (!city.trim())
        e.city = 'City could not be detected — please type it manually';
      if (!country.trim())
        e.country = 'Country could not be detected — please type it manually';
    }

    // ── STEP 3: Profile Photo (profileImage) ─────────────────────
    if (s === 3 && !profileImage)
      e.photo = 'A profile photo is required — please upload one';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Send OTP: DNS check first, then backend ────────────────────────────
  const sendEmailOTP = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors(p => ({ ...p, email: 'Enter a valid email address first' }));
      return;
    }
    setVerifyingEmail(true);
    setEmailOtpError('');
    try {
      // Layer 1: DNS domain check — fake domain foran block
      const domainCheck = await checkEmailDomain(trimmed.toLowerCase());
      if (!domainCheck.valid) {
        setErrors(p => ({ ...p, email: domainCheck.reason }));
        setVerifyingEmail(false);
        return;
      }
      // Layer 2: Backend OTP (backend pe bhi DNS+SMTP check hai)
      const res = await fetch(`${API_BASE_URL}/auth/send-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setExpectedOtp(data.otp);
        setOtpExpiresAt(new Date(data.expiresAt));
        const isResend = emailOtpSent;
        setEmailOtpSent(true);
        setEmailOtpInput('');
        clearErr('email');
        if (isResend) {
          setResentMsg('A new OTP has been sent to your email. Please check your inbox.');
          setTimeout(() => setResentMsg(''), 5000);
        }
      } else {
        setEmailOtpError(data.message || 'Failed to send OTP');
      }
    } catch {
      setEmailOtpError('Could not send OTP. Check your connection.');
    } finally {
      setVerifyingEmail(false);
    }
  };

  // ── Confirm OTP ────────────────────────────────────────────────────────
  const confirmEmailOTP = () => {
    if (!emailOtpInput.trim()) { setEmailOtpError('Enter the OTP sent to your email'); return; }
    if (otpExpiresAt && new Date() > otpExpiresAt) { setEmailOtpError('OTP expired. Please resend.'); return; }
    if (emailOtpInput.trim() !== expectedOtp) { setEmailOtpError('Incorrect OTP. Please try again.'); return; }
    setEmailVerified(true);
    setEmailOtpSent(false);
    setEmailOtpError('');
    setResentMsg('');
    clearErr('email');
  };

  const handleNext = () => {
    if (!validateSync(step)) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateSync(3)) return;
    setSubmitting(true);
    try {
      const body = {
        fullName: fullName.trim(), name: fullName.trim(),
        companyName: companyName.trim(), company: companyName.trim(),
        license: license.trim(),
        email: email.trim().toLowerCase(), password, phone: phone.trim(),
        country, city, zone, address: address || '',
        latitude: location?.latitude || null, longitude: location?.longitude || null,
      };
      const res = await fetch(`${API_BASE_URL}/auth/transporter/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('🎉 Success', 'Transporter account created successfully!', [
          { text: 'Go to Login', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Registration Failed', data.message || 'Please try again.');
      }
    } catch {
      Alert.alert('Network Error', 'Check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Location ───────────────────────────────────────────────────────────
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Please allow location access.'); return; }
      let loc = await Location.getLastKnownPositionAsync({});
      if (!loc) loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      let resolvedAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      try {
        const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_API_KEY}`);
        const d = await r.json();
        if (d.results?.[0]) {
          resolvedAddress = d.results[0].formatted_address;
          // BUG FIX: parse city/country/zone from reverse geocode
          const comps = d.results[0].address_components || [];
          const get = (type) => comps.find(c => c.types.includes(type))?.long_name || '';
          const parsedCity    = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2');
          const parsedCountry = get('country');
          const parsedZone    = get('administrative_area_level_1');
          if (parsedCity)    setCity(parsedCity);
          if (parsedCountry) setCountry(parsedCountry);
          if (parsedZone)    setZone(parsedZone);
        }
      } catch {}
      setLocation(coords); setAddress(resolvedAddress); clearErr('location');
      Alert.alert('✅ Location Set', resolvedAddress);
    } catch { Alert.alert('Error', 'Failed to get current location. Try Search.'); }
  };

  const searchLocation = async (q) => {
    if (q.trim().length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}&components=country:pk`);
      const d = await r.json();
      setSearchResults(d.status === 'OK' ? d.predictions : []);
    } catch { setSearchResults([]); } finally { setSearching(false); }
  };

  const pickPlace = async (placeId, description) => {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,address_components&key=${GOOGLE_API_KEY}`);
      const d = await r.json();
      if (d.status === 'OK') {
        const { lat, lng } = d.result.geometry.location;
        setLocation({ latitude: lat, longitude: lng });
        setAddress(description);
        // BUG FIX: extract city/country/zone from Google address_components
        const comps = d.result.address_components || [];
        const get = (type) => comps.find(c => c.types.includes(type))?.long_name || '';
        const parsedCity    = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2');
        const parsedCountry = get('country');
        const parsedZone    = get('administrative_area_level_1');
        if (parsedCity)    setCity(parsedCity);
        if (parsedCountry) setCountry(parsedCountry);
        if (parsedZone)    setZone(parsedZone);
        clearErr('location'); setModalVisible(false); setSearchQuery(''); setSearchResults([]);
        Alert.alert('✅ Location Selected', description);
      }
    } catch { Alert.alert('Error', 'Failed to get place details.'); }
  };

  // ── Image Picker ───────────────────────────────────────────────────────
  const pickImage = async (source) => {
    setImageModal(false);
    let result;
    if (source === 'camera') {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return Alert.alert('Permission Required');
      result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.8 });
    } else {
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) return Alert.alert('Permission Required');
      result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.8 });
    }
    if (!result.canceled) setProfileImage(result.assets[0].uri);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <View style={s.brand}>
            <Text style={s.appName}>RAAHI</Text>
            <Text style={s.appSub}>Transporter Registration</Text>
          </View>

          <View style={s.card}>
            <StepBar current={step} />

            {/* ── STEP 0: Account Details ── */}
            {step === 0 && (
              <>
                <SectionHead title="Account Details" subtitle="Set up your login credentials" />

                {/* Email with inline Verify button */}
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Email Address</Text>
                  <View style={[
                    s.inputRow,
                    !!errors.email && !emailVerified && s.inputRowErr,
                    emailVerified && s.inputRowSuccess,
                  ]}>
                    <Ionicons
                      name="mail-outline" size={18}
                      color={emailVerified ? C.success : errors.email ? C.error : C.primary}
                      style={s.inputIcon}
                    />
                    <TextInput
                      placeholder="you@gmail.com"
                      placeholderTextColor={C.textLight}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setEmailVerified(false);
                        setEmailOtpSent(false);
                        setEmailOtpError('');
                        clearErr('email');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={s.input}
                      editable={!emailVerified}
                    />
                    {emailVerified
                      ? <Ionicons name="checkmark-circle" size={20} color={C.success} style={{ marginRight: 6 }} />
                      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
                          <TouchableOpacity
                            onPress={sendEmailOTP}
                            disabled={verifyingEmail}
                            style={[s.verifyBtn, verifyingEmail && { opacity: 0.6 }]}
                          >
                            {verifyingEmail
                              ? <ActivityIndicator size="small" color="#fff" />
                              : <Text style={s.verifyBtnTxt}>{emailOtpSent ? 'Resend OTP' : 'Verify'}</Text>
                            }
                          </TouchableOpacity>
                        )
                    }
                  </View>
                  {!!errors.email && !emailVerified && <Text style={s.errTxt}>{errors.email}</Text>}
                  {emailVerified && <Text style={s.successTxt}>✓ Email verified</Text>}
                </View>

                {/* OTP input box */}
                {emailOtpSent && !emailVerified && (
                  <View style={s.otpBox}>
                    <Text style={s.otpLabel}>Enter OTP sent to {email.trim()}</Text>
                    <View style={s.otpRow}>
                      <TextInput
                        style={s.otpInput}
                        placeholder="6-digit OTP"
                        placeholderTextColor={C.textLight}
                        value={emailOtpInput}
                        onChangeText={setEmailOtpInput}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity style={s.otpConfirmBtn} onPress={confirmEmailOTP}>
                        <Text style={s.otpConfirmTxt}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                    {!!resentMsg && (
                      <View style={s.resentMsgBox}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={C.success} />
                        <Text style={s.resentMsgTxt}>{resentMsg}</Text>
                      </View>
                    )}
                    {!!emailOtpError && <Text style={s.errTxt}>{emailOtpError}</Text>}
                  </View>
                )}

                <Field icon="call-outline" label="Phone Number" value={phone} onChange={(v)=>{ setPhone(v); clearErr('phone'); }} placeholder="+92 3XX XXXXXXX" keyboardType="phone-pad" error={errors.phone} />
                <Field
                  icon="lock-closed-outline" label="Password"
                  value={password} onChange={setPassword}
                  placeholder="Minimum 8 characters" secure={!showPass} error={errors.password}
                  right={<TouchableOpacity onPress={() => setShowPass(p => !p)}><Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textMuted} /></TouchableOpacity>}
                />
                <Field icon="lock-closed-outline" label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} secure error={errors.confirmPassword} />
              </>
            )}

            {/* ── STEP 1: Company Details ── */}
            {step === 1 && (
              <>
                <SectionHead title="Company Details" subtitle="Tell us about your transport business" />
                <Field icon="person-outline" label="Full Name" value={fullName} onChange={(v)=>{ setFullName(v); clearErr('fullName'); }} placeholder="e.g. Ahmed Ali" error={errors.fullName} autoCapitalize="words" />
                <Field icon="business-outline" label="Company Name" value={companyName} onChange={(v)=>{ setCompanyName(v); clearErr('companyName'); }} placeholder="e.g. Ali Transport Co." error={errors.companyName} />
                <Field icon="id-card-outline" label="License Number" value={license} onChange={(v)=>{ setLicense(v); clearErr('license'); }} placeholder="e.g. TRN-2024-001" autoCapitalize="characters" error={errors.license} />
              </>
            )}

            {/* ── STEP 2: Location ── */}
            {step === 2 && (
              <>
                <SectionHead title="Service Area" subtitle="Select where you operate from" />
                <Text style={s.fieldLabel}>Location</Text>
                <TouchableOpacity style={[s.locationBox, !!errors.location && { borderColor: C.error }]} activeOpacity={0.8}>
                  {location ? (
                    <View style={s.locationRow}>
                      <Ionicons name="checkmark-circle" size={18} color={C.primary} />
                      <Text style={s.locationTxt} numberOfLines={2}>{address}</Text>
                    </View>
                  ) : (
                    <Text style={s.locationEmpty}>No location selected</Text>
                  )}
                  <View style={s.locationBtns}>
                    <TouchableOpacity style={s.locationBtn} onPress={getCurrentLocation}>
                      <Ionicons name="navigate-outline" size={14} color="#fff" />
                      <Text style={s.locationBtnTxt}>Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.locationBtn, { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.3)' }]} onPress={() => setModalVisible(true)}>
                      <Ionicons name="search-outline" size={14} color="#fff" />
                      <Text style={s.locationBtnTxt}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                {!!errors.location && <Text style={s.errTxt}>{errors.location}</Text>}
                {/* BUG FIX: manual fields so city/country/zone are always filled */}
                <Field icon="globe-outline"    label="Country"     value={country} onChange={(v)=>{ setCountry(v); clearErr('country'); }} placeholder="e.g. Pakistan"  autoCapitalize="words" error={errors.country} />
                <Field icon="business-outline" label="City"        value={city}    onChange={(v)=>{ setCity(v);    clearErr('city');    }} placeholder="e.g. Islamabad" autoCapitalize="words" error={errors.city} />
                <Field icon="map-outline"      label="Zone/Region" value={zone}    onChange={(v)=>{ setZone(v);    clearErr('zone');    }} placeholder="e.g. Punjab"    autoCapitalize="words" />
              </>
            )}

            {/* ── STEP 3: Photo ── */}
            {step === 3 && (
              <>
                <SectionHead title="Profile Photo" subtitle="A clear photo helps passengers identify you" />
                <View style={s.photoWrap}>
                  <TouchableOpacity style={s.photoCircle} onPress={() => setImageModal(true)}>
                    {profileImage
                      ? <Image source={{ uri: profileImage }} style={s.photoImg} />
                      : <Ionicons name="camera-outline" size={36} color={C.primary} />
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={s.photoBtn} onPress={() => setImageModal(true)}>
                    <Ionicons name={profileImage ? "sync-outline" : "cloud-upload-outline"} size={16} color="#fff" />
                    <Text style={s.photoBtnTxt}>{profileImage ? 'Change Photo' : 'Upload Photo'}</Text>
                  </TouchableOpacity>
                </View>
                {!!errors.photo && <Text style={[s.errTxt, { textAlign: 'center', marginTop: 8 }]}>{errors.photo}</Text>}
              </>
            )}

            {/* ── Nav Buttons ── */}
            <View style={[s.btnRow, { marginTop: 24 }]}>
              {step > 0 && (
                <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
                  <Ionicons name="arrow-back" size={15} color={C.textSub} />
                  <Text style={s.backBtnTxt}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.nextBtn, { flex: 1 }, submitting && { opacity: 0.65 }]}
                onPress={step < 3 ? handleNext : handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Text style={s.nextBtnTxt}>{step < 3 ? 'Continue' : 'Create Account'}</Text>
                      <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark-circle-outline'} size={15} color="#fff" style={{ marginLeft: 6 }} />
                    </>
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.loginLink} onPress={() => navigation.navigate('Login')}>
              <Text style={s.loginLinkTxt}>
                Already have an account? <Text style={{ color: C.primary, fontWeight: '700' }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Search Location Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Search Location</Text>
            <View style={s.sheetSearchRow}>
              <Ionicons name="search-outline" size={16} color={C.primary} />
              <TextInput
                style={s.sheetInput}
                placeholder="Search area, street or landmark…"
                value={searchQuery}
                onChangeText={t => { setSearchQuery(t); searchLocation(t); }}
                autoFocus
              />
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.resultRow} onPress={() => pickPlace(item.place_id, item.description)}>
                  <Text>{item.description}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.searchEmptyTxt}>{searchQuery ? 'No results' : 'Start typing...'}</Text>}
            />
            <TouchableOpacity style={s.closeModalBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.closeModalTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal visible={imageModal} animationType="slide" transparent>
        <View style={s.sheetBg}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Choose Photo</Text>
            <TouchableOpacity style={s.sheetOpt} onPress={() => pickImage('camera')}>
              <Ionicons name="camera-outline" size={20} color={C.primary} />
              <Text style={s.sheetOptTxt}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetOpt} onPress={() => pickImage('gallery')}>
              <Ionicons name="image-outline" size={20} color={C.primary} />
              <Text style={s.sheetOptTxt}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetOpt} onPress={() => setImageModal(false)}>
              <Text style={{ color: C.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 ,justifyContent: 'center', },
  brand:  { alignItems: 'center', marginBottom: 28 },
  appName:{ fontSize: 36, fontWeight: '900', color: C.primary, letterSpacing: 2.5 },
  appSub: { fontSize: 13, color: C.textMuted, marginTop: 4 },
  card:   { backgroundColor: C.cardBg, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: C.borderLight, elevation: 2 },

  stepBar:    { flexDirection: 'row', alignItems: 'center', marginBottom: 26 },
  stepItem:   { alignItems: 'center' },
  stepDot:    { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  stepActive: { backgroundColor: C.primary, borderColor: C.primary },
  stepDone:   { backgroundColor: C.primaryDark, borderColor: C.primaryDark },
  stepNum:    { fontSize: 12, fontWeight: '700', color: C.textMuted },
  stepLine:   { flex: 1, height: 1.5, backgroundColor: C.borderLight, marginHorizontal: 4, marginBottom: 20 },
  stepLabel:  { fontSize: 10, fontWeight: '500', color: C.textLight },

  sectionHead: { marginBottom: 18 },
  stepHeading: { fontSize: 15, fontWeight: '700', color: C.textMain },
  stepSub:     { fontSize: 12, color: C.textMuted, marginTop: 3 },

  fieldWrap:       { marginBottom: 14 },
  fieldLabel:      { fontSize: 12, fontWeight: '600', color: C.textSub, marginBottom: 6 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 13, height: 52 },
  inputRowErr:     { borderColor: C.error,   backgroundColor: C.errorLight   },
  inputRowSuccess: { borderColor: C.success, backgroundColor: C.successLight },
  inputIcon:       { marginRight: 10 },
  input:           { flex: 1, fontSize: 14, color: C.textMain },
  errTxt:          { fontSize: 11, color: C.error,   marginTop: 4 },
  successTxt:      { fontSize: 11, color: C.success, marginTop: 4, fontWeight: '600' },

  verifyBtn:    { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginRight: 2 },
  verifyBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  otpBox:       { backgroundColor: '#F0F7F0', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.primaryMid },
  otpLabel:     { fontSize: 12, color: C.textSub, marginBottom: 10, fontWeight: '600' },
  otpRow:       { flexDirection: 'row', gap: 8 },
  otpInput:     { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, height: 46, fontSize: 18, fontWeight: '700', letterSpacing: 4, color: C.textMain },
  otpConfirmBtn:{ backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  otpConfirmTxt:{ color: '#fff', fontWeight: '800', fontSize: 13 },
  resentMsgBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8, borderWidth: 1, borderColor: '#a5d6a7' },
  resentMsgTxt: { flex: 1, fontSize: 12, color: C.success, fontWeight: '600' },

  locationBox:   { backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden', marginBottom: 4 },
  locationRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, paddingBottom: 8 },
  locationTxt:   { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18 },
  locationEmpty: { padding: 14, fontSize: 13, color: C.textLight },
  locationBtns:  { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.borderLight },
  locationBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 5, backgroundColor: C.primary },
  locationBtnTxt:{ fontSize: 12, color: '#fff', fontWeight: '600' },

  photoWrap:   { alignItems: 'center', paddingVertical: 10, gap: 16 },
  photoCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.primaryLight, borderWidth: 2, borderColor: C.primaryMid, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg:    { width: '100%', height: '100%' },
  photoBtn:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.primary, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11 },
  photoBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  btnRow:      { flexDirection: 'row', gap: 10 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border },
  backBtnTxt:  { color: C.textSub, fontWeight: '600', fontSize: 13 },
  nextBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, elevation: 4 },
  nextBtnTxt:  { color: '#fff', fontWeight: '800', fontSize: 14 },
  loginLink:   { alignItems: 'center', marginTop: 18 },
  loginLinkTxt:{ fontSize: 13, color: C.textMuted },

  sheetBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: C.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingTop: 10 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: 'center', marginBottom: 14 },
  sheetTitle:    { fontSize: 15, fontWeight: '700', color: C.textMain, textAlign: 'center', marginBottom: 12 },
  sheetOpt:      { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  sheetOptTxt:   { fontSize: 14, fontWeight: '600', color: C.textMain },

  modalBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: C.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20 },
  sheetSearchRow:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 8 },
  sheetInput:    { flex: 1, fontSize: 14, color: C.textMain },
  resultRow:     { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  closeModalBtn: { marginTop: 20, padding: 14, backgroundColor: C.inputBg, borderRadius: 12, alignItems: 'center' },
  closeModalTxt: { fontWeight: '600', color: C.textMuted },
  searchEmptyTxt:{ textAlign: 'center', color: C.textMuted, marginTop: 30 },
});