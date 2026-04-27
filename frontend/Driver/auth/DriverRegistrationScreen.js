// screens/auth/DriverRegisterScreen.js
// ✅ UPDATED: Email domain DNS check added (fake/non-existent domains block)
import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  StyleSheet, Modal, FlatList, SafeAreaView, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import axios from "axios";
import { C } from "../constants/theme";

const API_BASE_URL = Platform.select({
  ios:     "https://raahi-q2ur.onrender.com",
  android: "https://raahi-q2ur.onrender.com",
  default: "https://raahi-q2ur.onrender.com",
});
const GOOGLE_MAPS_API_KEY = "AIzaSyBrYAA7OEcYgtRqH8HXAS5OMi30IMZF-60";
const { height: SH } = Dimensions.get("window");

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

const VEHICLE_TYPES = [
  { id: "car", label: "Car", icon: "car-outline",   capacity: 4  },
  { id: "van", label: "Van", icon: "bus-outline",   capacity: 12 },
  { id: "bus", label: "Bus", icon: "train-outline", capacity: 30 },
];

const STEPS = [
  { key: "personal", label: "Personal" },
  { key: "vehicle",  label: "Vehicle"  },
  { key: "pickup",   label: "Pickup"   },
];

// ── Extract users array from any response shape ──────────────────
function extractUsers(data) {
  if (!data) return [];
  if (Array.isArray(data))         return data;
  if (Array.isArray(data.users))   return data.users;
  if (Array.isArray(data.data))    return data.data;
  if (Array.isArray(data.result))  return data.result;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function isTransporter(user) {
  const role = (user.role || user.type || "").trim().toLowerCase();
  return role === "transporter";
}

// ── StepBar ──────────────────────────────────────────────────────
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
                ? <Ionicons name="checkmark" size={11} color="#fff" />
                : <Text style={[s.stepNum, active && { color: "#fff" }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[s.stepLabel, active && { color: C.green, fontWeight: "700" }]}>
              {step.label}
            </Text>
          </View>
          {i < STEPS.length - 1 && (
            <View style={[s.stepLine, done && { backgroundColor: C.green }]} />
          )}
        </React.Fragment>
      );
    })}
  </View>
);

// ── Field ────────────────────────────────────────────────────────
const Field = ({ icon, label, value, onChange, placeholder, keyboardType, autoCapitalize, error, secure, right }) => (
  <View style={s.fieldWrap}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.inputRow, error && s.inputRowErr]}>
      <Ionicons name={icon} size={20} color={error ? C.error : C.green} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
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
    {error ? <Text style={s.errTxt}>{error}</Text> : null}
  </View>
);

// ── Main Component ───────────────────────────────────────────────
export default function DriverRegisterScreen({ navigation }) {
  const [step, setStep] = useState(0);

  // Step 0 — Personal
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Step 1 — Vehicle
  const [license,     setLicense]     = useState("");
  const [vehicleNo,   setVehicleNo]   = useState("");
  const [vehicleType, setVehicleType] = useState("");

  // Step 2 — Location + Transporter
  const [homeAddress,  setHomeAddress]  = useState("");
  const [homeLocation, setHomeLocation] = useState(null);

  const [transporters,         setTransporters]         = useState([]);
  const [selectedTransporter,  setSelectedTransporter]  = useState(null);
  const [fetchingTransporters, setFetchingTransporters] = useState(false);
  const [transporterMsg,       setTransporterMsg]       = useState("");

  // Search modal
  const [modalVisible,     setModalVisible]     = useState(false);
  const [searchQuery,      setSearchQuery]       = useState("");
  const [searchResults,    setSearchResults]     = useState([]);
  const [searchingLocation,setSearchingLocation] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Email verification state
  const [emailVerified,  setEmailVerified]  = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [emailOtpSent,   setEmailOtpSent]   = useState(false);
  const [emailOtpInput,  setEmailOtpInput]  = useState('');
  const [expectedOtp,    setExpectedOtp]    = useState('');
  const [otpExpiresAt,   setOtpExpiresAt]   = useState(null);
  const [emailOtpError,  setEmailOtpError]  = useState('');
  const [resentMsg,      setResentMsg]      = useState('');
  const [errors,     setErrors]     = useState({});

  const clearErr = (key) => setErrors(p => { const e = { ...p }; delete e[key]; return e; });

  // ── Fetch Transporters ───────────────────────────────────────
  const fetchTransporters = useCallback(async () => {
    setFetchingTransporters(true);
    setTransporterMsg("");
    setTransporters([]);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/users`, {
        timeout: 10000,
        params:  { role: "transporter" },
      });

      console.log("📦 /api/users response:", JSON.stringify(res.data).slice(0, 300));

      const allUsers = extractUsers(res.data);
      console.log(`👥 Total users received: ${allUsers.length}`);

      const list = allUsers.filter(isTransporter);
      console.log(`🚌 Transporters after filter: ${list.length}`);

      if (list.length > 0) {
        setTransporters(list);
      } else if (allUsers.length > 0) {
        const roles = [...new Set(allUsers.map(u => u.role || u.type || "unknown"))];
        console.warn("⚠️ No transporter role found. Roles in DB:", roles);
        setTransporterMsg(`No transporters found. Roles in DB: ${roles.join(", ")}`);
      } else {
        setTransporterMsg("No users returned from server.");
      }
    } catch (err) {
      console.error("❌ fetchTransporters error:", err?.message);
      setTransporterMsg("Could not load transporters. Check your connection.");
    } finally {
      setFetchingTransporters(false);
    }
  }, []);

  // ── Validation ────────────────────────────────────────────────
  // ── Schema-Based Validation ───────────────────────────────────────
  const validate = useCallback((s) => {
    const e = {};

    if (s === 0) {
      // fullName — schema: String
      if (!fullName.trim() || fullName.trim().length < 3)
        e.fullName = "Full name must be at least 3 characters (e.g. Ali Khan)";
      else if (!/^[a-zA-Z\u0600-\u06FF\s]+$/.test(fullName.trim()))
        e.fullName = "Name should contain letters only — no numbers or special characters";

      // email — schema: String, lowercase, trim
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        e.email = "Enter a valid email address (e.g. ali@gmail.com)";
      if (!emailVerified)
        e.email = e.email || "Please verify your email — click \"Verify Email\" first";

      // phone — schema: String
      if (!/^[\+]?[0-9]{7,15}$/.test(phone.replace(/[\s\-\(\)]/g, "")))
        e.phone = "Enter a valid phone number (e.g. +92 3XX XXXXXXX)";

      // password — schema: String, min 8
      if (!password || password.length < 8)
        e.password = "Password must be at least 8 characters long";
    }

    if (s === 1) {
      // license — schema: String, 16 alphanumeric chars
      const lic = license.trim().replace(/[\s\-]/g, "");
      if (!lic)
        e.license = "License number is required";
      else if (!/^[A-Za-z0-9]{16}$/.test(lic))
        e.license = "License number must be exactly 16 alphanumeric characters (letters & numbers only)";

      // vehicleNo — schema: String, 6–8 chars
      const vNo = vehicleNo.trim().replace(/[\s\-]/g, "");
      if (!vNo)
        e.vehicleNo = "Vehicle number plate is required";
      else if (vNo.length < 6 || vNo.length > 8)
        e.vehicleNo = "Number plate must be 6 to 8 characters (e.g. LEA-1234)";

      // vehicleType — schema: String enum
      if (!vehicleType)
        e.vehicleType = "Please select a vehicle type (Car, Van or Bus)";
    }

    if (s === 2) {
      // location.coordinates — schema: [Number]
      if (!homeLocation)
        e.location = "Please select your home address using GPS or Search";
      // transporterId — schema: ObjectId ref User
      if (!selectedTransporter)
        e.transporter = "Please select a transporter from the list";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [fullName, email, emailVerified, phone, password, license, vehicleNo, vehicleType, homeLocation, selectedTransporter]);

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
    if (step === 1) fetchTransporters();   // load transporters before showing step 2
    setStep(s => s + 1);
  };

  // ── Location ──────────────────────────────────────────────────
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied"); return; }
      // Try last known first (fast), fallback to current (slower)
      let loc = await Location.getLastKnownPositionAsync({});
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
      }
      if (!loc) { Alert.alert("Error", "Could not get location. Please search manually."); return; }
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      try {
        const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${GOOGLE_MAPS_API_KEY}`);
        const data = await res.json();
        setHomeAddress(data.results?.[0]?.formatted_address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      } catch {
        setHomeAddress(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      }
      setHomeLocation(coords);
      clearErr("location");
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
        setHomeAddress(description);
        setHomeLocation({ latitude: lat, longitude: lng });
        setModalVisible(false); setSearchQuery(""); setSearchResults([]);
        clearErr("location");
      }
    } catch { Alert.alert("Error", "Failed to get place details."); }
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate(2)) return;
    setSubmitting(true);
    try {
      const veh = VEHICLE_TYPES.find(v => v.id === vehicleType);
      const payload = {
        fullName:        fullName.trim(),
        email:           email.trim().toLowerCase(),
        phone:           phone.trim(),
        password:        password.trim(),
        license:         license.trim().toUpperCase(),
        vehicleNo:       vehicleNo.trim().toUpperCase(),
        vehicleType,
        vehicle:         vehicleType,
        capacity:        veh?.capacity || 4,
        address:         homeAddress,
        location:        { type: "Point", coordinates: [homeLocation.longitude, homeLocation.latitude], address: homeAddress },
        latitude:        homeLocation.latitude,
        longitude:       homeLocation.longitude,
        transporterId:   selectedTransporter._id,
        transporterName: selectedTransporter.name || selectedTransporter.fullName || "Transporter",
      };

      const res = await axios.post(`${API_BASE_URL}/api/driver-requests`, payload, {
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

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <View style={s.brand}>
            <Text style={s.title}>RAAHI</Text>
            <Text style={s.sub}>Driver Registration</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <StepBar currentStep={step} />

            {/* ══ STEP 0 — Personal ══ */}
            {step === 0 && (
              <>
                <Text style={s.stepHeading}>Personal Details</Text>
                <Field icon="person-outline"      label="Full Name" value={fullName}  onChange={v => { setFullName(v);  clearErr("fullName"); }} placeholder="Ahmed Raza"         error={errors.fullName} autoCapitalize="words" />
                <Field icon="mail-outline"        label="Email"     value={email}     onChange={v => { setEmail(v); setEmailVerified(false); setEmailOtpSent(false); setEmailOtpError(''); clearErr("email"); }} placeholder="driver@example.com" error={emailVerified ? undefined : errors.email} />

                {/* Email verification UI */}
                {!emailVerified && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (
                  <View style={{ marginTop: -8, marginBottom: 14 }}>
                    {!emailOtpSent ? (
                      <TouchableOpacity
                        style={[s.verifyBtn, verifyingEmail && { opacity: 0.6 }]}
                        onPress={sendEmailOTP}
                        disabled={verifyingEmail}
                      >
                        {verifyingEmail
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.verifyBtnTxt}>Verify Email — Send OTP</Text>
                        }
                      </TouchableOpacity>
                    ) : (
                      <View style={s.otpInlineWrap}>
                        <TextInput
                          style={s.otpInlineInput}
                          placeholder="Enter 6-digit OTP"
                          placeholderTextColor={C.textMuted}
                          value={emailOtpInput}
                          onChangeText={v => { setEmailOtpInput(v); setEmailOtpError(''); }}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                        <TouchableOpacity style={s.otpConfirmBtn} onPress={confirmEmailOTP}>
                          <Text style={s.otpConfirmTxt}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.otpResendBtn} onPress={sendEmailOTP} disabled={verifyingEmail}>
                          {verifyingEmail
                            ? <ActivityIndicator size="small" color={C.green} />
                            : <Text style={s.otpResendTxt}>Resend OTP</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    )}
                    {!!resentMsg && (
                      <View style={s.resentMsgBox}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#2e7d32" />
                        <Text style={s.resentMsgTxt}>{resentMsg}</Text>
                      </View>
                    )}
                    {!!emailOtpError && <Text style={s.errTxt}>{emailOtpError}</Text>}
                  </View>
                )}
                {emailVerified && (
                  <Text style={[s.errTxt, { color: '#2e7d32', marginTop: -8, marginBottom: 10 }]}>✓ Email verified</Text>
                )}
                <Field icon="call-outline"        label="Phone"     value={phone}     onChange={v => { setPhone(v);     clearErr("phone");    }} placeholder="+92 3XX XXXXXXX"    error={errors.phone}    keyboardType="phone-pad" />
                <Field icon="lock-closed-outline" label="Password"  value={password}  onChange={v => { setPassword(v);  clearErr("password"); }} placeholder="Min 6 characters"  error={errors.password} secure={!showPass}
                  right={
                    <TouchableOpacity onPress={() => setShowPass(p => !p)}>
                      <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={C.textMuted} />
                    </TouchableOpacity>
                  }
                />
              </>
            )}

            {/* ══ STEP 1 — Vehicle ══ */}
            {step === 1 && (
              <>
                <Text style={s.stepHeading}>Vehicle Details</Text>
                <Field icon="card-outline"    label="License Number" value={license}   onChange={v => { setLicense(v);   clearErr("license");   }} placeholder="LHR-12345" error={errors.license}   autoCapitalize="characters" />
                <Field icon="barcode-outline" label="Vehicle Number" value={vehicleNo} onChange={v => { setVehicleNo(v); clearErr("vehicleNo"); }} placeholder="LEA-1234"  error={errors.vehicleNo} autoCapitalize="characters" />

                <Text style={[s.fieldLabel, { marginTop: 6 }]}>Vehicle Type</Text>
                <View style={s.vehicleRow}>
                  {VEHICLE_TYPES.map(vt => {
                    const sel = vehicleType === vt.id;
                    return (
                      <TouchableOpacity key={vt.id} activeOpacity={0.8}
                        style={[s.vehicleCard, sel && s.vehicleCardSel]}
                        onPress={() => { setVehicleType(vt.id); clearErr("vehicleType"); }}
                      >
                        {sel && (
                          <View style={s.vehicleCheck}>
                            <Ionicons name="checkmark" size={10} color="#fff" />
                          </View>
                        )}
                        <View style={[s.vehicleIconBox, sel && s.vehicleIconBoxSel]}>
                          <Ionicons name={vt.icon} size={22} color={sel ? "#fff" : C.green} />
                        </View>
                        <Text style={[s.vehicleLabel, sel && { color: C.greenDark }]}>{vt.label}</Text>
                        <View style={[s.capPill, sel && s.capPillSel]}>
                          <Text style={[s.capTxt, sel && { color: "#fff" }]}>max {vt.capacity}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.vehicleType ? <Text style={s.errTxt}>{errors.vehicleType}</Text> : null}
              </>
            )}

            {/* ══ STEP 2 — Location + Transporter ══ */}
            {step === 2 && (
              <>
                <Text style={s.stepHeading}>HomeAddress & Transporter</Text>

                {/* Location */}
                <Text style={s.fieldLabel}>Your homeAddress </Text>
                <View style={[s.locationBox, errors.location && { borderColor: C.error }]}>
                  {homeAddress
                    ? <View style={s.locationRow}>
                        <Ionicons name="checkmark-circle" size={18} color={C.green} />
                        <Text style={s.locationTxt} numberOfLines={2}>{homeAddress}</Text>
                      </View>
                    : <Text style={s.locationEmpty}>No location selected</Text>
                  }
                  <View style={s.locationBtns}>
                    <TouchableOpacity style={s.locationBtn} onPress={getCurrentLocation}>
                      <Ionicons name="navigate-outline" size={15} color="#fff" />
                      <Text style={s.locationBtnTxt}>Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.locationBtn} onPress={() => setModalVisible(true)}>
                      <Ionicons name="search-outline" size={15} color="#fff" />
                      <Text style={s.locationBtnTxt}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {errors.location ? <Text style={s.errTxt}>{errors.location}</Text> : null}

                {/* Transporter list */}
                <View style={s.tHeader}>
                  <Text style={[s.fieldLabel, { marginBottom: 0 }]}>Select Transporter</Text>
                  {!fetchingTransporters && (
                    <TouchableOpacity onPress={fetchTransporters} style={s.refreshBtn}>
                      <Ionicons name="refresh-outline" size={14} color={C.green} />
                      <Text style={s.refreshTxt}>Refresh</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {fetchingTransporters ? (
                  <View style={s.centerBox}>
                    <ActivityIndicator size="large" color={C.green} />
                    <Text style={s.centerTxt}>Loading transporters...</Text>
                  </View>

                ) : transporterMsg ? (
                  <View style={s.warnBox}>
                    <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
                    <Text style={s.warnTxt}>{transporterMsg}</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={fetchTransporters}>
                      <Ionicons name="refresh-outline" size={14} color="#fff" />
                      <Text style={s.retryTxt}>Retry</Text>
                    </TouchableOpacity>
                  </View>

                ) : transporters.length === 0 ? (
                  <View style={s.centerBox}>
                    <View style={s.emptyIconCircle}>
                      <Ionicons name="business-outline" size={30} color={C.green} />
                    </View>
                    <Text style={s.emptyTitle}>No Transporters Yet</Text>
                    <Text style={s.centerTxt}>Please try again or contact support.</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={fetchTransporters}>
                      <Ionicons name="refresh-outline" size={14} color="#fff" />
                      <Text style={s.retryTxt}>Retry</Text>
                    </TouchableOpacity>
                  </View>

                ) : (
                  transporters.map(item => {
                    const sel      = selectedTransporter?._id === item._id;
                    const initials = (item.name || item.fullName || "T")[0].toUpperCase();
                    return (
                      <TouchableOpacity
                        key={item._id}
                        style={[s.tCard, sel && s.tCardSel]}
                        onPress={() => { setSelectedTransporter(item); clearErr("transporter"); }}
                        activeOpacity={0.8}
                      >
                        <View style={[s.tAvatar, sel && s.tAvatarSel]}>
                          <Text style={[s.tInitial, sel && { color: C.green }]}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.tName, sel && { color: C.green }]}>
                            {item.name || item.fullName || "Transporter"}
                          </Text>
                          {item.company ? <Text style={s.tMeta}>{item.company}</Text> : null}
                          {item.email ? (
                            <View style={s.tMetaRow}>
                              <Ionicons name="mail-outline" size={12} color={C.textMuted} />
                              <Text style={s.tMeta}>{item.email}</Text>
                            </View>
                          ) : null}
                          {item.phone ? (
                            <View style={s.tMetaRow}>
                              <Ionicons name="call-outline" size={12} color={C.textMuted} />
                              <Text style={s.tMeta}>{item.phone}</Text>
                            </View>
                          ) : null}
                          {(item.zone || item.city) ? (
                            <View style={s.tMetaRow}>
                              <Ionicons name="location-outline" size={12} color={C.textMuted} />
                              <Text style={s.tMeta}>{item.zone || item.city}</Text>
                            </View>
                          ) : null}
                        </View>
                        {sel
                          ? <Ionicons name="checkmark-circle" size={22} color={C.green} />
                          : <View style={s.tRadio} />
                        }
                      </TouchableOpacity>
                    );
                  })
                )}
                {errors.transporter ? <Text style={[s.errTxt, { marginTop: 6 }]}>{errors.transporter}</Text> : null}
              </>
            )}

            {/* Buttons */}
            <View style={[s.btnRow, { marginTop: 24 }]}>
              {step > 0 && (
                <TouchableOpacity style={s.backBtn} onPress={() => setStep(s => s - 1)}>
                  <Ionicons name="arrow-back" size={16} color={C.textSub} />
                  <Text style={s.backBtnTxt}>Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.nextBtn, { flex: 1 }, submitting && { opacity: 0.6 }]}
                onPress={step < 2 ? handleNext : handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Text style={s.nextBtnTxt}>{step < 2 ? "Next" : "Send Request"}</Text>
                      <Ionicons
                        name={step < 2 ? "arrow-forward" : "checkmark-circle-outline"}
                        size={16} color="#fff" style={{ marginLeft: 8 }}
                      />
                    </>
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.loginLink} onPress={() => navigation.navigate("Login")}>
              <Text style={s.loginLinkTxt}>
                Already registered?{"  "}
                <Text style={{ color: C.green, fontWeight: "800" }}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Safe. Reliable. Professional Raahi Service.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Location Search Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Search Location</Text>
              <TouchableOpacity style={s.modalCloseBtn}
                onPress={() => { setModalVisible(false); setSearchQuery(""); setSearchResults([]); }}
              >
                <Ionicons name="close" size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={18} color={C.green} />
              <TextInput
                style={s.searchInput}
                placeholder="Search area or landmark..."
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={t => { setSearchQuery(t); searchLocation(t); }}
                autoFocus
              />
              {searchingLocation && <ActivityIndicator size="small" color={C.green} />}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.place_id}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.resultRow} onPress={() => pickPlace(item.place_id, item.description)}>
                  <View style={s.resultIconBox}>
                    <Ionicons name="location-outline" size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultMain}>{item.structured_formatting.main_text}</Text>
                    <Text style={s.resultSub}>{item.structured_formatting.secondary_text}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={s.searchEmpty}>
                  <Ionicons name="search-outline" size={40} color={C.border} />
                  <Text style={s.searchEmptyTxt}>
                    {searchQuery.length > 0 ? "No results found" : "Type to search for a location"}
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

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.softBg },
  scroll:    { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40, minHeight: SH },

  brand:   { alignItems: "center", marginBottom: 28 },
  iconBox: { backgroundColor: C.green, width: 72, height: 72, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 14, elevation: 10, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 10 },
  title:   { fontSize: 36, fontWeight: "900", color: C.textMain, letterSpacing: 2, color: "#415844" },
  sub:     { fontSize: 17, color: C.textSub, marginTop: 4 },
  footer:  { textAlign: "center", color: C.textMuted, fontSize: 12, marginTop: 24 },

  card: { backgroundColor: C.white, borderRadius: 22, padding: 22, borderWidth: 1.5, borderColor: C.border, elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },

  stepBar:    { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  stepItem:   { alignItems: "center" },
  stepDot:    { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F1F5F9", borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  stepActive: { backgroundColor: C.green,     borderColor: C.green     },
  stepDone:   { backgroundColor: C.greenDark, borderColor: C.greenDark },
  stepNum:    { fontSize: 12, fontWeight: "800", color: C.textMuted },
  stepLine:   { flex: 1, height: 2, backgroundColor: C.border, marginHorizontal: 6, marginBottom: 14 },
  stepLabel:  { fontSize: 11, fontWeight: "500", color: C.textMuted },
  stepHeading:{ fontSize: 16, fontWeight: "800", color: C.textMain, marginBottom: 18 },

  fieldWrap:   { marginBottom: 14 },
  fieldLabel:  { fontSize: 13, fontWeight: "600", color: C.textSub, marginBottom: 7 },
  inputRow:    { flexDirection: "row", alignItems: "center", backgroundColor: C.softBg, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, height: 58 },
  inputRowErr: { borderColor: C.error, backgroundColor: "#FFF5F5" },
  input:       { flex: 1, fontSize: 15, color: C.textMain, marginLeft: 12 },
  errTxt:      { fontSize: 12, color: C.error, marginTop: 5 },
  verifyBtn:     { backgroundColor: C.green, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  verifyBtnTxt:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  otpInlineWrap: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  otpInlineInput:{ flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 18, color: C.textMain, letterSpacing: 4, backgroundColor: '#f9fafb' },
  otpConfirmBtn: { backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  otpConfirmTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  otpResendBtn:  { backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 12, justifyContent: 'center', minWidth: 68, alignItems: 'center' },
  otpResendTxt:  { color: C.green, fontWeight: '700', fontSize: 12 },
  resentMsgBox:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0faf0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 6, borderWidth: 1, borderColor: '#a5d6a7' },
  resentMsgTxt:  { flex: 1, fontSize: 12, color: '#2e7d32', fontWeight: '600' },

  vehicleRow:       { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 4 },
  vehicleCard:      { flex: 1, alignItems: "center", paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: C.border, backgroundColor: C.white, position: "relative" },
  vehicleCardSel:   { borderColor: C.green, backgroundColor: "#EAF5EB" },
  vehicleCheck:     { position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  vehicleIconBox:   { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EAF5EB", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  vehicleIconBoxSel:{ backgroundColor: C.green },
  vehicleLabel:     { fontSize: 13, fontWeight: "700", color: C.textMain, marginBottom: 6 },
  capPill:          { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: C.border },
  capPillSel:       { backgroundColor: C.green, borderColor: C.green },
  capTxt:           { fontSize: 10, fontWeight: "700", color: C.textMuted },

  locationBox:   { backgroundColor: C.softBg, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 6 },
  locationRow:   { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 },
  locationTxt:   { flex: 1, fontSize: 13, color: C.textSub, lineHeight: 18 },
  locationEmpty: { textAlign: "center", color: C.textMuted, paddingVertical: 8, fontSize: 13, marginBottom: 12 },
  locationBtns:  { flexDirection: "row", gap: 10 },
  locationBtn:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.green, borderRadius: 12, paddingVertical: 10, gap: 6 },
  locationBtnTxt:{ fontSize: 13, color: "#fff", fontWeight: "700" },

  tHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 10 },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: C.green },
  refreshTxt: { fontSize: 12, color: C.green, fontWeight: "700" },

  centerBox:       { alignItems: "center", paddingVertical: 28, gap: 10 },
  centerTxt:       { fontSize: 13, color: C.textMuted, textAlign: "center" },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#EAF5EB", alignItems: "center", justifyContent: "center" },
  emptyTitle:      { fontSize: 15, fontWeight: "700", color: C.textSub },

  warnBox:  { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 8 },
  warnTxt:  { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },
  retryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, gap: 5, marginTop: 4 },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  tCard:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.softBg, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, marginBottom: 10 },
  tCardSel:  { borderColor: C.green, backgroundColor: "#EAF5EB" },
  tAvatar:   { width: 46, height: 46, borderRadius: 23, backgroundColor: C.border, alignItems: "center", justifyContent: "center" },
  tAvatarSel:{ backgroundColor: C.textMain },
  tInitial:  { fontSize: 18, fontWeight: "800", color: C.textSub },
  tName:     { fontSize: 15, fontWeight: "700", color: C.textMain },
  tMetaRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  tMeta:     { fontSize: 12, color: C.textMuted },
  tRadio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border },

  btnRow:     { flexDirection: "row", gap: 10 },
  backBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: C.softBg, borderRadius: 16, borderWidth: 1.5, borderColor: C.border },
  backBtnTxt: { color: C.textSub, fontWeight: "700", fontSize: 14 },
  nextBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.green, borderRadius: 16, paddingVertical: 14, elevation: 5, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 8 },
  nextBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
  loginLink:  { alignItems: "center", marginTop: 16 },
  loginLinkTxt:{ fontSize: 14, color: C.textMuted },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: C.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: "82%" },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  modalTitle:    { fontSize: 17, fontWeight: "700", color: C.textMain },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.softBg, alignItems: "center", justifyContent: "center" },
  searchRow:     { flexDirection: "row", alignItems: "center", backgroundColor: C.softBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 10 },
  searchInput:   { flex: 1, fontSize: 15, color: C.textMain, marginLeft: 10 },
  resultRow:     { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.softBg },
  resultIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#EAF5EB", alignItems: "center", justifyContent: "center", marginRight: 10 },
  resultMain:    { fontSize: 14, fontWeight: "600", color: C.textMain },
  resultSub:     { fontSize: 12, color: C.textMuted, marginTop: 2 },
  searchEmpty:   { alignItems: "center", paddingVertical: 40 },
  searchEmptyTxt:{ fontSize: 14, color: C.textMuted, marginTop: 10 },
});