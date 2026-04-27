// screens/auth/PassengerRequestScreen.js
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView,
  Dimensions,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import axios from "axios";

const API_BASE_URL        = "https://raahi-q2ur.onrender.com";
const GOOGLE_MAPS_API_KEY = "AIzaSyAURA_WOTStUtf3-nnDUR88jeBr6qSejFs";
const { height: SH }      = Dimensions.get("window");

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
    return { valid: true }; // network error → allow (real users block na hon)
  }
};

// ─────────────────────────────────────────────────────────────────
// THEME  —  primary: #439b4e
// ─────────────────────────────────────────────────────────────────
const C = {
  primary:      "#415844",
  primaryDark:  "#357a3e",
  primaryLight: "#edf7ee",
  primaryMid:   "#c8e6ca",

  error:      "#d32f2f",
  errorLight: "#fff5f5",

  textMain:  "#1b2a1c",
  textSub:   "#374151",
  textMuted: "#6b7280",
  textLight: "#9ca3af",

  white:       "#ffffff",
  bg:          "#f4f8f4",
  cardBg:      "#ffffff",
  inputBg:     "#f9fafb",
  border:      "#d1d5db",
  borderLight: "#e5e7eb",
};

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "personal",    label: "Personal"    },
  { key: "vehicle",     label: "Vehicle"     },
  { key: "location",    label: "Location"    },
  { key: "transporter", label: "Transporter" },
];

const VEHICLE_OPTIONS = [
  { id: "car", label: "Car", icon: "car-outline",        description: "Sedan / Hatchback" },
  { id: "van", label: "Van", icon: "bus-outline",        description: "Van / Minibus"     },
  { id: "bus", label: "Bus", icon: "trail-sign-outline", description: "Large Bus / Coach" },
];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function extractUsers(data) {
  if (!data) return [];
  if (Array.isArray(data))         return data;
  if (Array.isArray(data.users))   return data.users;
  if (Array.isArray(data.data))    return data.data;
  if (Array.isArray(data.result))  return data.result;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

const StepBar = ({ currentStep }) => (
  <View style={s.stepBar}>
    {STEPS.map((step, i) => {
      const done   = i < currentStep;
      const active = i === currentStep;
      return (
        <React.Fragment key={step.key}>
          <View style={s.stepItem}>
            <View style={[s.stepDot, done && s.stepDone, active && s.stepActive]}>
              {done
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[s.stepNum, active && { color: "#fff" }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[s.stepLabel, active && { color: C.primary, fontWeight: "700" }]}>
              {step.label}
            </Text>
          </View>
          {i < STEPS.length - 1 && (
            <View style={[s.stepConnector, done && { backgroundColor: C.primary }]} />
          )}
        </React.Fragment>
      );
    })}
  </View>
);

const Field = ({ icon, label, value, onChange, placeholder, keyboardType, autoCapitalize, error, secure, right }) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.inputRow, error && s.inputRowErr]}>
      <Ionicons name={icon} size={18} color={error ? C.error : C.primary} style={s.inputIcon} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.textLight}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize || "none"}
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

// ─────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────
export default function PassengerRequestScreen({ navigation }) {
  const [step, setStep] = useState(0);

  // Step 0
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Step 1
  const [vehiclePreference, setVehiclePreference] = useState(null);

  // Step 2
  const [pickupAddress,   setPickupAddress]   = useState("");
  const [pickupLocation,  setPickupLocation]  = useState(null);
  const [dropoffAddress,  setDropoffAddress]  = useState("");
  const [dropoffLocation, setDropoffLocation] = useState(null);

  // Search modal
  const [modalVisible,      setModalVisible]      = useState(false);
  const [searchQuery,       setSearchQuery]        = useState("");
  const [searchResults,     setSearchResults]      = useState([]);
  const [searchingLocation, setSearchingLocation]  = useState(false);
  const [searchType,        setSearchType]         = useState("pickup");

  // Step 3
  const [transporters,         setTransporters]         = useState([]);
  const [selectedTransporter,  setSelectedTransporter]  = useState(null);
  const [fetchingTransporters, setFetchingTransporters] = useState(false);
  const [transporterMsg,       setTransporterMsg]       = useState("");

  // Email verification state
  const [emailVerified,     setEmailVerified]     = useState(false);
  const [verifyingEmail,    setVerifyingEmail]     = useState(false);
  const [emailOtpSent,      setEmailOtpSent]       = useState(false);
  const [emailOtpInput,     setEmailOtpInput]      = useState('');
  const [expectedOtp,       setExpectedOtp]        = useState('');
  const [otpExpiresAt,      setOtpExpiresAt]       = useState(null);
  const [emailOtpError,     setEmailOtpError]      = useState('');
  const [resentMsg,         setResentMsg]          = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errors,     setErrors]     = useState({});

  const clearErr = (k) => setErrors(p => { const e = { ...p }; delete e[k]; return e; });

  // ── Schema-Based Validation (User model fields) ─────────────────
  const validate = useCallback((s) => {
    const e = {};

    // ── STEP 0: Personal Info (fullName, email, phone, password) ─
    if (s === 0) {
      // fullName / name — schema: String, min 3, letters only
      if (!fullName.trim() || fullName.trim().length < 3)
        e.fullName = "Full name must be at least 3 characters (e.g. Sara Khan)";
      else if (!/^[a-zA-Z\u0600-\u06FF\s]+$/.test(fullName.trim()))
        e.fullName = "Name should contain letters only — no numbers or special characters";

      // email — schema: String, lowercase, trim
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        e.email = "Enter a valid email address (e.g. sara@gmail.com)";
      if (!emailVerified)
        e.email = e.email || "Please verify your email — click \"Verify Email\" first";

      // phone — schema: String
      if (!/^[\+]?[0-9]{7,15}$/.test(phone.replace(/[\s\-\(\)]/g, "")))
        e.phone = "Enter a valid phone number (e.g. +92 3XX XXXXXXX)";

      // password — schema: String, min 8 chars
      if (!password || password.length < 8)
        e.password = "Password must be at least 8 characters long";
    }

    // ── STEP 1: Vehicle Preference (vehicle / vehicleType) ───────
    // schema: vehicleType — String
    if (s === 1 && !vehiclePreference)
      e.vehiclePreference = "Please select a vehicle type (Car, Van or Bus)";

    // ── STEP 2: Location (pickupPoint, destination) ───────────────
    if (s === 2) {
      // pickupPoint — schema: String
      if (!pickupLocation)
        e.pickup = "Please select a pickup location — where should we pick you up?";

      // destination — schema: String
      if (!dropoffLocation)
        e.dropoff = "Please select a drop-off location — where are you going?";
    }

    // ── STEP 3: Transporter (transporterId) ──────────────────────
    // schema: transporterId — ObjectId ref User
    if (s === 3 && !selectedTransporter)
      e.transporter = "Please select a transporter from the list";

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [fullName, email, emailVerified, phone, password, vehiclePreference, pickupLocation, dropoffLocation, selectedTransporter]);

  const sendEmailOTP = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors(p => ({ ...p, email: 'Enter a valid email address first' }));
      return;
    }
    setVerifyingEmail(true);
    setEmailOtpError('');
    try {
      // ── DNS domain check — fake domains yahan block ho jayen ──────────────
      const domainCheck = await checkEmailDomain(trimmed.toLowerCase());
      if (!domainCheck.valid) {
        setErrors(p => ({ ...p, email: domainCheck.reason }));
        setVerifyingEmail(false);
        return;
      }

      const res = await axios.post(`${API_BASE_URL}/api/auth/send-email-verification`, { email: trimmed }, { timeout: 30000 });
      if (res.data.success) {
        const isResend = emailOtpSent;
        setExpectedOtp(res.data.otp);
        setOtpExpiresAt(new Date(res.data.expiresAt));
        setEmailOtpSent(true);
        setEmailOtpInput('');
        clearErr('email');
        if (isResend) {
          setResentMsg('A new OTP has been sent to your email. Please check your inbox.');
          setTimeout(() => setResentMsg(''), 5000);
        }
      } else {
        setEmailOtpError(res.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setEmailOtpError(err.response?.data?.message || 'Could not send OTP. Check your connection.');
    } finally {
      setVerifyingEmail(false);
    }
  };

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
    if (!validate(step)) return;
    if (step === 2) fetchTransporters();
    setStep(s => s + 1);
  };

  // ── Fetch transporters ──────────────────────────────────────────
  const fetchTransporters = useCallback(async () => {
    setFetchingTransporters(true);
    setTransporterMsg("");
    setTransporters([]);
    try {
      const res      = await axios.get(`${API_BASE_URL}/api/users`, { timeout: 10000, params: { role: "transporter" } });
      const allUsers = extractUsers(res.data);
      const list     = allUsers.filter(u => (u.role || u.type || "").trim().toLowerCase() === "transporter");
      if (list.length > 0) {
        setTransporters(list);
      } else if (allUsers.length > 0) {
        const roles = [...new Set(allUsers.map(u => u.role || u.type || "unknown"))];
        setTransporterMsg(`No transporters found. Roles in DB: ${roles.join(", ")}`);
      } else {
        setTransporterMsg("No users returned from server.");
      }
    } catch { setTransporterMsg("Could not load transporters. Check your connection."); }
    finally  { setFetchingTransporters(false); }
  }, []);

  // ── Location ────────────────────────────────────────────────────
  const getCurrentLocation = async (type) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied", "Please allow location access."); return; }
      // Try last known first (fast), fallback to current (slower)
      let loc = await Location.getLastKnownPositionAsync({});
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
      }
      if (!loc) { Alert.alert("Error", "Could not get location. Please search manually."); return; }
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      let address  = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
      try {
        const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        if (data.results?.[0]) address = data.results[0].formatted_address;
      } catch {}
      if (type === "pickup") { setPickupAddress(address);  setPickupLocation(coords);  clearErr("pickup");  }
      else                   { setDropoffAddress(address); setDropoffLocation(coords); clearErr("dropoff"); }
    } catch { Alert.alert("Error", "Failed to get location."); }
  };

  const searchLocation = async (q) => {
    if (q.trim().length < 3) { setSearchResults([]); return; }
    setSearchingLocation(true);
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}&components=country:pk`);
      const data = await res.json();
      setSearchResults(data.status === "OK" ? data.predictions : []);
    } catch { setSearchResults([]); }
    finally  { setSearchingLocation(false); }
  };

  const pickPlace = async (placeId, description) => {
    try {
      const res  = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`);
      const data = await res.json();
      if (data.status === "OK") {
        const { lat, lng } = data.result.geometry.location;
        const coords       = { latitude: lat, longitude: lng };
        if (searchType === "pickup") { setPickupAddress(description);  setPickupLocation(coords);  clearErr("pickup");  }
        else                         { setDropoffAddress(description); setDropoffLocation(coords); clearErr("dropoff"); }
        setModalVisible(false); setSearchQuery(""); setSearchResults([]);
      }
    } catch { Alert.alert("Error", "Failed to get place details."); }
  };

  const openSearch = (type) => { setSearchType(type); setModalVisible(true); };

  const mapUrl = (coords, color, label) =>
    coords
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${coords.latitude},${coords.longitude}&zoom=15&size=600x160&markers=color:${color}%7Clabel:${label}%7C${coords.latitude},${coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      : null;

  // ── Submit ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate(3)) return;
    setSubmitting(true);
    try {
      const payload = {
        fullName:             fullName.trim(),
        email:                email.trim().toLowerCase(),
        phone:                phone.trim(),
        password:             password.trim(),
        address:              pickupAddress,
        latitude:             pickupLocation.latitude,
        longitude:            pickupLocation.longitude,
        destination:          dropoffAddress,
        destinationLatitude:  dropoffLocation.latitude,
        destinationLongitude: dropoffLocation.longitude,
        vehiclePreference,
        transporterId:        selectedTransporter._id,
        type:                 "passenger",
        name:                 fullName.trim(),
      };
      const res = await axios.post(`${API_BASE_URL}/api/join-requests`, payload, {
        timeout: 15000,
        headers: { "Content-Type": "application/json" },
      });
      if (res.data.success) {
        Alert.alert(
          "Request Sent ✓",
          `Your request has been sent to ${selectedTransporter.name || selectedTransporter.fullName || "Transporter"}.\n\nYou'll be notified at ${email.trim()} once approved.`,
          [{ text: "Go to Login", onPress: () => navigation.navigate("Login") }]
        );
      } else {
        Alert.alert("Error", res.data.message || "Failed to send request.");
      }
    } catch (err) {
      if (err.response)     Alert.alert("Error", err.response.data?.message || "Registration failed.");
      else if (err.request) Alert.alert("Network Error", "Cannot connect to server. Please retry.");
      else                  Alert.alert("Error", err.message || "Something went wrong.");
    } finally { setSubmitting(false); }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ────────────────────────────────────────── */}
          <View style={s.header}>
            <Text style={s.appName}>RAAHI</Text>
            <Text style={s.appSub}>Passenger Registration</Text>
          </View>

          {/* ── Card ──────────────────────────────────────────── */}
          <View style={s.card}>
            <StepBar currentStep={step} />

            {/* ══ STEP 0 — Personal ═══════════════════════════ */}
            {step === 0 && (
              <>
                <SectionHead title="Personal Details" subtitle="Enter your account information" />
                <Field icon="person-outline"      label="Full Name"      value={fullName}  onChange={v => { setFullName(v);  clearErr("fullName"); }} placeholder="e.g. Ali Hassan"       error={errors.fullName} autoCapitalize="words" />

                {/* Email with inline verification */}
                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Email Address</Text>
                  <View style={[s.inputRow, errors.email && s.inputRowErr]}>
                    <Ionicons name="mail-outline" size={18} color={errors.email ? C.error : C.primary} style={s.inputIcon} />
                    <TextInput
                      placeholder="you@example.com"
                      placeholderTextColor={C.textLight}
                      value={email}
                      onChangeText={v => { setEmail(v); setEmailVerified(false); setEmailOtpSent(false); setEmailOtpError(''); clearErr('email'); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={s.input}
                      editable={!emailVerified}
                    />
                    {emailVerified ? (
                      <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
                    ) : (
                      <TouchableOpacity
                        onPress={sendEmailOTP}
                        disabled={verifyingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
                        style={[s.verifyBtn, (verifyingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) && { opacity: 0.5 }]}
                      >
                        {verifyingEmail
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.verifyBtnTxt}>{emailOtpSent ? 'Resend OTP' : 'Verify Email'}</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                  {emailVerified && <Text style={s.verifiedTxt}>✓ Email verified</Text>}
                  {!!errors.email && !emailVerified && <Text style={s.errTxt}>{errors.email}</Text>}

                  {/* OTP input row — shown after OTP is sent */}
                  {emailOtpSent && !emailVerified && (
                    <View style={s.otpInlineWrap}>
                      <TextInput
                        style={s.otpInlineInput}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor={C.textLight}
                        value={emailOtpInput}
                        onChangeText={v => { setEmailOtpInput(v); setEmailOtpError(''); }}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity style={s.otpConfirmBtn} onPress={confirmEmailOTP}>
                        <Text style={s.otpConfirmTxt}>Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {!!resentMsg && (
                    <View style={s.resentMsgBox}>
                      <Ionicons name="checkmark-circle-outline" size={14} color={C.primary} />
                      <Text style={s.resentMsgTxt}>{resentMsg}</Text>
                    </View>
                  )}
                  {!!emailOtpError && <Text style={s.errTxt}>{emailOtpError}</Text>}
                </View>
                <Field icon="call-outline"        label="Phone Number"   value={phone}     onChange={v => { setPhone(v);     clearErr("phone");    }} placeholder="+92 3XX XXXXXXX"       error={errors.phone}    keyboardType="phone-pad" />
                <Field icon="lock-closed-outline" label="Password"       value={password}  onChange={v => { setPassword(v);  clearErr("password"); }} placeholder="Minimum 6 characters"  error={errors.password} secure={!showPass}
                  right={
                    <TouchableOpacity onPress={() => setShowPass(p => !p)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                      <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={C.textMuted} />
                    </TouchableOpacity>
                  }
                />
              </>
            )}

            {/* ══ STEP 1 — Vehicle ════════════════════════════ */}
            {step === 1 && (
              <>
                <SectionHead title="Vehicle Preference" subtitle="Select the type of vehicle you'd like to travel in" />
                <View style={s.vehicleRow}>
                  {VEHICLE_OPTIONS.map(opt => {
                    const sel = vehiclePreference === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.75}
                        style={[s.vehicleCard, sel && s.vehicleCardSel]}
                        onPress={() => { setVehiclePreference(opt.id); clearErr("vehiclePreference"); }}
                      >
                        {sel && (
                          <View style={s.vehicleCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                        <View style={[s.vehicleIconWrap, sel && s.vehicleIconWrapSel]}>
                          <Ionicons name={opt.icon} size={24} color={sel ? "#fff" : C.primary} />
                        </View>
                        <Text style={[s.vehicleLabel, sel && { color: C.primaryDark }]}>{opt.label}</Text>
                        <Text style={[s.vehicleDesc, sel && { color: C.primary }]} numberOfLines={2}>
                          {opt.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!!errors.vehiclePreference && <Text style={s.errTxt}>{errors.vehiclePreference}</Text>}
              </>
            )}

            {/* ══ STEP 2 — Locations ══════════════════════════ */}
            {step === 2 && (
              <>
                <SectionHead title="Travel Route" subtitle="Set your pickup and drop-off points" />

                {/* Pickup */}
                <Text style={s.fieldLabel}>Pickup Location</Text>
                <View style={[s.locationCard, !!errors.pickup && s.locationCardErr]}>
                  {pickupLocation ? (
                    <>
                      <View style={s.locationAddressRow}>
                        <View style={s.locDot} />
                        <Text style={s.locationAddress} numberOfLines={2}>{pickupAddress}</Text>
                      </View>
                      <Image source={{ uri: mapUrl(pickupLocation, "0x439b4e", "P") }} style={s.miniMap} resizeMode="cover" />
                    </>
                  ) : (
                    <View style={s.locationPlaceholder}>
                      <Ionicons name="location-outline" size={18} color={C.textLight} />
                      <Text style={s.locationPlaceholderTxt}>No pickup location selected</Text>
                    </View>
                  )}
                  <View style={s.locationBtnRow}>
                    <TouchableOpacity style={s.locBtn} onPress={() => getCurrentLocation("pickup")}>
                      <Ionicons name="navigate-outline" size={13} color="#fff" />
                      <Text style={s.locBtnTxt}>Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.locBtn, s.locBtnOutline]} onPress={() => openSearch("pickup")}>
                      <Ionicons name="search-outline" size={13} color={C.primary} />
                      <Text style={[s.locBtnTxt, { color: C.primary }]}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!errors.pickup && <Text style={s.errTxt}>{errors.pickup}</Text>}

                {/* Visual connector */}
                <View style={s.routeConnector}>
                  <View style={s.routeLine} />
                  <View style={s.routeArrowBox}>
                    <Ionicons name="arrow-down" size={11} color={C.textLight} />
                  </View>
                  <View style={s.routeLine} />
                </View>

                {/* Dropoff */}
                <Text style={s.fieldLabel}>Drop-off Location</Text>
                <View style={[s.locationCard, !!errors.dropoff && s.locationCardErr]}>
                  {dropoffLocation ? (
                    <>
                      <View style={s.locationAddressRow}>
                        <View style={[s.locDot, { backgroundColor: "#d32f2f" }]} />
                        <Text style={s.locationAddress} numberOfLines={2}>{dropoffAddress}</Text>
                      </View>
                      <Image source={{ uri: mapUrl(dropoffLocation, "red", "D") }} style={s.miniMap} resizeMode="cover" />
                    </>
                  ) : (
                    <View style={s.locationPlaceholder}>
                      <Ionicons name="flag-outline" size={18} color={C.textLight} />
                      <Text style={s.locationPlaceholderTxt}>No drop-off location selected</Text>
                    </View>
                  )}
                  <View style={s.locationBtnRow}>
                    <TouchableOpacity style={s.locBtn} onPress={() => getCurrentLocation("dropoff")}>
                      <Ionicons name="navigate-outline" size={13} color="#fff" />
                      <Text style={s.locBtnTxt}>Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.locBtn, s.locBtnOutline]} onPress={() => openSearch("dropoff")}>
                      <Ionicons name="search-outline" size={13} color={C.primary} />
                      <Text style={[s.locBtnTxt, { color: C.primary }]}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!errors.dropoff && <Text style={s.errTxt}>{errors.dropoff}</Text>}
              </>
            )}

            {/* ══ STEP 3 — Transporter ════════════════════════ */}
            {step === 3 && (
              <>
                <SectionHead title="Select Transporter" subtitle="Choose who will manage your rides" />

                {/* Vehicle badge */}
                {vehiclePreference && (
                  <View style={s.prefBadge}>
                    <Ionicons name={VEHICLE_OPTIONS.find(v => v.id === vehiclePreference)?.icon} size={13} color={C.primary} />
                    <Text style={s.prefBadgeTxt}>
                      {VEHICLE_OPTIONS.find(v => v.id === vehiclePreference)?.label} preferred
                    </Text>
                  </View>
                )}

                <View style={s.tListHeader}>
                  <Text style={s.tListCount}>
                    {fetchingTransporters ? "Loading…" : `${transporters.length} available`}
                  </Text>
                  {!fetchingTransporters && (
                    <TouchableOpacity style={s.refreshBtn} onPress={fetchTransporters}>
                      <Ionicons name="refresh-outline" size={13} color={C.primary} />
                      <Text style={s.refreshTxt}>Refresh</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {fetchingTransporters ? (
                  <View style={s.stateBox}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={s.stateTxt}>Loading transporters…</Text>
                  </View>

                ) : transporterMsg ? (
                  <View style={s.warnBox}>
                    <Ionicons name="alert-circle-outline" size={18} color="#b45309" style={{ marginTop: 1 }} />
                    <Text style={s.warnTxt}>{transporterMsg}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={fetchTransporters}>
                      <Ionicons name="refresh-outline" size={12} color="#fff" />
                      <Text style={s.retryTxt}>Retry</Text>
                    </TouchableOpacity>
                  </View>

                ) : transporters.length === 0 ? (
                  <View style={s.stateBox}>
                    <View style={s.emptyIconBox}>
                      <Ionicons name="business-outline" size={26} color={C.primary} />
                    </View>
                    <Text style={s.emptyTitle}>No Transporters Found</Text>
                    <Text style={s.stateTxt}>Please try again or contact support.</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={fetchTransporters}>
                      <Ionicons name="refresh-outline" size={12} color="#fff" />
                      <Text style={s.retryTxt}>Retry</Text>
                    </TouchableOpacity>
                  </View>

                ) : (
                  transporters.map(item => {
                    const sel     = selectedTransporter?._id === item._id;
                    const initial = (item.name || item.fullName || "T")[0].toUpperCase();
                    return (
                      <TouchableOpacity
                        key={item._id}
                        style={[s.tCard, sel && s.tCardSel]}
                        onPress={() => { setSelectedTransporter(item); clearErr("transporter"); }}
                        activeOpacity={0.75}
                      >
                        <View style={[s.tAvatar, sel && s.tAvatarSel]}>
                          <Text style={[s.tInitial, sel && { color: "#fff" }]}>{initial}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.tName, sel && { color: C.primary }]}>
                            {item.name || item.fullName || "Transporter"}
                          </Text>
                          {!!item.company && <Text style={s.tCompany}>{item.company}</Text>}
                          <View style={{ gap: 2, marginTop: 3 }}>
                            {!!item.email  && <View style={s.tMetaRow}><Ionicons name="mail-outline"     size={11} color={C.textLight} /><Text style={s.tMeta}> {item.email}</Text></View>}
                            {!!item.phone  && <View style={s.tMetaRow}><Ionicons name="call-outline"     size={11} color={C.textLight} /><Text style={s.tMeta}> {item.phone}</Text></View>}
                            {!!(item.zone || item.city) && <View style={s.tMetaRow}><Ionicons name="location-outline" size={11} color={C.textLight} /><Text style={s.tMeta}> {item.zone || item.city}</Text></View>}
                          </View>
                        </View>
                        {sel
                          ? <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                          : <View style={s.tRadio} />
                        }
                      </TouchableOpacity>
                    );
                  })
                )}
                {!!errors.transporter && <Text style={[s.errTxt, { marginTop: 4 }]}>{errors.transporter}</Text>}
              </>
            )}

            {/* ── Navigation Buttons ──────────────────────────── */}
            <View style={s.btnRow}>
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
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={s.nextBtnTxt}>{step < 3 ? "Continue" : "Send Request"}</Text>
                    <Ionicons
                      name={step < 3 ? "arrow-forward" : "checkmark-circle-outline"}
                      size={15}
                      color="#fff"
                      style={{ marginLeft: 6 }}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.loginLink} onPress={() => navigation.navigate("Login")}>
              <Text style={s.loginLinkTxt}>
                Already have an account?{" "}
                <Text style={{ color: C.primary, fontWeight: "700" }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Raahi · Safe & Reliable Van Pooling</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Location Search Modal ──────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Search {searchType === "pickup" ? "Pickup" : "Drop-off"} Location</Text>
              <TouchableOpacity
                style={s.sheetClose}
                onPress={() => { setModalVisible(false); setSearchQuery(""); setSearchResults([]); }}
              >
                <Ionicons name="close" size={17} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={s.sheetSearchRow}>
              <Ionicons name="search-outline" size={16} color={C.primary} />
              <TextInput
                style={s.sheetInput}
                placeholder="Search area, street or landmark…"
                placeholderTextColor={C.textLight}
                value={searchQuery}
                onChangeText={t => { setSearchQuery(t); searchLocation(t); }}
                autoFocus
              />
              {searchingLocation
                ? <ActivityIndicator size="small" color={C.primary} />
                : searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                      <Ionicons name="close-circle" size={16} color={C.textLight} />
                    </TouchableOpacity>
                  )
              }
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.place_id}
              style={{ maxHeight: SH * 0.44 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={s.resultRow} onPress={() => pickPlace(item.place_id, item.description)} activeOpacity={0.7}>
                  <View style={s.resultIcon}>
                    <Ionicons name="location-outline" size={14} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultMain} numberOfLines={1}>{item.structured_formatting.main_text}</Text>
                    <Text style={s.resultSub}  numberOfLines={1}>{item.structured_formatting.secondary_text}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={13} color={C.borderLight} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={s.searchEmpty}>
                  <Ionicons name="map-outline" size={34} color={C.borderLight} />
                  <Text style={s.searchEmptyTxt}>
                    {searchQuery.length > 0 ? "No results found" : "Start typing to search"}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // Header
  header:   { alignItems: "center", marginBottom: 28, width: "100%", maxWidth: 480, alignSelf: "center" },
  logoMark: {
    width: 42, height: 42, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    elevation: 4, shadowColor: C.primary,
    shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  appName: { fontSize: 24, fontWeight: "900", color: C.primary, letterSpacing: 3, textAlign: "center" },
  appSub:  { fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: "center" },
  footer:  { textAlign: "center", color: C.textLight, fontSize: 11, marginTop: 20, alignSelf: "center" },

  // Card
  card: {
    backgroundColor: C.cardBg, borderRadius: 20, padding: 22,
    borderWidth: 1, borderColor: C.borderLight,
    elevation: 2, shadowColor: "#000",
    shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
    width: "100%", maxWidth: 480, alignSelf: "center",
  },

  // Step bar
  stepBar:      { flexDirection: "row", alignItems: "center", marginBottom: 26 },
  stepItem:     { alignItems: "center" },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginBottom: 5,
  },
  stepActive:    { backgroundColor: C.primary,     borderColor: C.primary     },
  stepDone:      { backgroundColor: C.primaryDark, borderColor: C.primaryDark },
  stepNum:       { fontSize: 12, fontWeight: "700", color: C.textMuted         },
  stepConnector: { flex: 1, height: 1.5, backgroundColor: C.borderLight, marginHorizontal: 4, marginBottom: 20 },
  stepLabel:     { fontSize: 10, fontWeight: "500", color: C.textLight          },

  // Section heading
  sectionHead: { marginBottom: 18 },
  stepHeading: { fontSize: 15, fontWeight: "700", color: C.textMain },
  stepSub:     { fontSize: 12, color: C.textMuted, marginTop: 3     },

  // Field
  fieldWrap:   { marginBottom: 14 },
  fieldLabel:  { fontSize: 12, fontWeight: "600", color: C.textSub, marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 13, height: 52,
  },
  inputRowErr: { borderColor: C.error, backgroundColor: C.errorLight },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, fontSize: 14, color: C.textMain },
  errTxt:      { fontSize: 11, color: C.error, marginTop: 4 },
  verifyBtn:       { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  verifyBtnTxt:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  verifiedTxt:     { fontSize: 11, color: '#2e7d32', marginTop: 4, fontWeight: '600' },
  otpInlineWrap:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  otpInlineInput:  { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 16, color: C.textMain, letterSpacing: 4, backgroundColor: C.inputBg },
  otpConfirmBtn:   { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  resentMsgBox:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0faf0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6, borderWidth: 1, borderColor: '#a5d6a7' },
  resentMsgTxt:    { flex: 1, fontSize: 12, color: C.primary, fontWeight: '600' },
  otpConfirmTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Vehicle
  vehicleRow:         { flexDirection: "row", gap: 10, marginBottom: 4 },
  vehicleCard: {
    flex: 1, alignItems: "center", paddingVertical: 18, paddingHorizontal: 4,
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.cardBg, position: "relative",
  },
  vehicleCardSel:     { borderColor: C.primary, backgroundColor: C.primaryLight },
  vehicleCheck: {
    position: "absolute", top: 7, right: 7,
    width: 17, height: 17, borderRadius: 9,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  vehicleIconWrap:    { width: 46, height: 46, borderRadius: 11, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  vehicleIconWrapSel: { backgroundColor: C.primary },
  vehicleLabel:       { fontSize: 13, fontWeight: "700", color: C.textMain, marginBottom: 4 },
  vehicleDesc:        { fontSize: 10, color: C.textLight, textAlign: "center", lineHeight: 14, paddingHorizontal: 2 },

  // Location
  locationCard: {
    backgroundColor: C.inputBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    overflow: "hidden", marginBottom: 4,
  },
  locationCardErr:        { borderColor: C.error },
  locationPlaceholder:    { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  locationPlaceholderTxt: { fontSize: 13, color: C.textLight },
  locationAddressRow:     { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, paddingBottom: 8 },
  locDot:                 { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary, marginTop: 3, flexShrink: 0 },
  locationAddress:        { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18 },
  miniMap:                { width: "100%", height: 108 },
  locationBtnRow:         { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.borderLight },
  locBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, gap: 5, backgroundColor: C.primary,
  },
  locBtnOutline: {
    backgroundColor: C.cardBg,
    borderLeftWidth: 1, borderLeftColor: C.borderLight,
  },
  locBtnTxt: { fontSize: 12, color: "#fff", fontWeight: "600" },

  // Route connector
  routeConnector: { flexDirection: "row", alignItems: "center", marginVertical: 8, paddingHorizontal: 6 },
  routeLine:      { flex: 1, height: 1, backgroundColor: C.borderLight },
  routeArrowBox: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.borderLight,
    alignItems: "center", justifyContent: "center", marginHorizontal: 8,
  },

  // Preference badge
  prefBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 14,
    borderWidth: 1, borderColor: C.primaryMid,
  },
  prefBadgeTxt: { fontSize: 12, color: C.primary, fontWeight: "600" },

  // Transporter
  tListHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  tListCount:  { fontSize: 12, color: C.textMuted },
  refreshBtn:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.primaryMid, backgroundColor: C.primaryLight },
  refreshTxt:  { fontSize: 11, color: C.primary, fontWeight: "700" },

  stateBox:    { alignItems: "center", paddingVertical: 30, gap: 10 },
  stateTxt:    { fontSize: 13, color: C.textMuted, textAlign: "center" },
  emptyIconBox:{ width: 58, height: 58, borderRadius: 29, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  emptyTitle:  { fontSize: 14, fontWeight: "700", color: C.textSub },

  warnBox: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8,
    backgroundColor: "#fffbeb", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#fde68a", marginBottom: 10,
  },
  warnTxt:  { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginTop: 4 },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },

  tCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 13, borderRadius: 14,
    backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border,
    marginBottom: 10,
  },
  tCardSel:   { borderColor: C.primary, backgroundColor: C.primaryLight },
  tAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: C.borderLight, alignItems: "center", justifyContent: "center" },
  tAvatarSel: { backgroundColor: C.primaryDark },
  tInitial:   { fontSize: 16, fontWeight: "800", color: C.textSub },
  tName:      { fontSize: 14, fontWeight: "700", color: C.textMain },
  tCompany:   { fontSize: 12, color: C.textMuted, marginBottom: 2 },
  tMetaRow:   { flexDirection: "row", alignItems: "center" },
  tMeta:      { fontSize: 11, color: C.textLight },
  tRadio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.border },

  // Buttons
  btnRow:     { flexDirection: "row", gap: 10, marginTop: 22 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: C.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border,
  },
  backBtnTxt: { color: C.textSub, fontWeight: "600", fontSize: 13 },
  nextBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13,
    elevation: 4, shadowColor: C.primary,
    shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  nextBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  loginLink:  { alignItems: "center", marginTop: 18 },
  loginLinkTxt: { fontSize: 13, color: C.textMuted },

  // Modal
  modalBg:   { flex: 1, backgroundColor: "rgba(0,0,0,0.38)", justifyContent: "flex-end" },
  modalSheet:{ backgroundColor: C.cardBg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingTop: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderLight, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sheetTitle:  { fontSize: 15, fontWeight: "700", color: C.textMain },
  sheetClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  sheetSearchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 13, paddingVertical: 10,
    marginBottom: 8, gap: 8,
  },
  sheetInput: { flex: 1, fontSize: 14, color: C.textMain },
  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.bg, gap: 10,
  },
  resultIcon:     { width: 28, height: 28, borderRadius: 7, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
  resultMain:     { fontSize: 13, fontWeight: "600", color: C.textMain },
  resultSub:      { fontSize: 11, color: C.textMuted, marginTop: 1 },
  searchEmpty:    { alignItems: "center", paddingVertical: 32 },
  searchEmptyTxt: { fontSize: 13, color: C.textLight, marginTop: 8 },
});