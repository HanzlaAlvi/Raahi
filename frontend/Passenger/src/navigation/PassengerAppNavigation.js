// src/navigation/PassengerAppNavigation.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, StyleSheet, StatusBar, Platform,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator }  from '@react-navigation/stack';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';

// ── Screens ───────────────────────────────────────────────────────────────────
import PassengerDashboard              from '../screens/dashboard/PassengerDashboard';
import AlertScreen                     from '../screens/notifications/AlertScreen';
import NotificationsScreen             from '../screens/notifications/NotificationsScreen';
import RideHistoryScreen               from '../screens/rides/RideHistoryScreen';
import PassengerPaymentScreen          from '../screens/payments/PassengerPaymentScreen';
import ProfileScreen                   from '../screens/profile/ProfileScreen';
import HelpSupportScreen               from '../screens/support/HelpSupportScreen';
import ContactSupportScreen            from '../screens/support/ContactSupportScreen';
import TermsConditionsScreen           from '../screens/support/TermsConditionsScreen';
import PassengerTransporterChatScreen  from '../screens/chat/PassengerTransporterChatScreen';
import PassengerLeaveNetworkScreen     from '../screens/account/PassengerLeaveNetworkScreen';
import PassengerDeleteAccountScreen    from '../screens/account/PassengerDeleteAccountScreen';

import { clearSessionData, getItem } from '../services/storageService';
import { STORAGE_KEYS, SCREENS }     from '../constants';

const Stack  = createStackNavigator();
const Drawer = createDrawerNavigator();

const API_BASE     = 'https://raahi-q2ur.onrender.com/api';
const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const P = {
  main:      '#415844',
  dark:      '#2D3E2F',
  light:     '#EDF1ED',
  white:     '#FFFFFF',
  bg:        '#F5F7F5',
  border:    '#C5D0C5',
  textDark:  '#1A2218',
  textMid:   '#374151',
  textLight: '#6B7280',
  error:     '#C62828',
  accent:    '#69F0AE',
};

// =============================================================================
// TermsFirstLoginModal
// =============================================================================
const TermsFirstLoginModal = ({ visible, onAccept }) => {
  const [scrolled, setScrolled] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <LinearGradient colors={[P.main, P.dark]} style={tfm.header}>
          <Ionicons name="document-text-outline" size={22} color={P.white} style={{ marginRight: 10 }} />
          <Text style={tfm.headerTitle}>Terms & Conditions</Text>
        </LinearGradient>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator
          onScrollEndDrag={() => setScrolled(true)}
          onMomentumScrollEnd={() => setScrolled(true)}
        >
          <Text style={tfm.intro}>
            Welcome to Raahi. By using this app you agree to the following terms. Please read carefully.
          </Text>
          {[
            { title: '1. Service Agreement',          body: 'Raahi connects passengers with transporters for daily van-pooling services. Your use of the service constitutes acceptance of these terms.' },
            { title: '2. Account Responsibility',     body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.' },
            { title: '3. Payments',                   body: 'Monthly subscription amounts are set by your transporter. Payments are agreed upon offline between you and your transporter. Raahi facilitates record-keeping only.' },
            { title: '4. Code of Conduct',            body: 'You agree to treat drivers, transporters, and other passengers respectfully. Any abusive behaviour may result in account suspension.' },
            { title: '5. Data & Privacy',             body: 'We collect and store your name, phone number, email, and location data solely for the purpose of providing the van-pooling service. Your data is never sold to third parties.' },
            { title: '6. Cancellations & Complaints', body: 'Complaints can be raised through the app and are reviewed by your transporter. Raahi does not guarantee resolution timelines.' },
            { title: '7. Limitation of Liability',    body: 'Raahi is a platform provider and is not liable for delays, accidents, or disputes between passengers and transporters.' },
            { title: '8. Modifications',              body: 'These terms may be updated from time to time. Continued use of the app after changes constitutes acceptance of the new terms.' },
          ].map((sec) => (
            <View key={sec.title} style={tfm.section}>
              <Text style={tfm.sectionTitle}>{sec.title}</Text>
              <Text style={tfm.sectionBody}>{sec.body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={tfm.footer}>
          <Text style={tfm.footerNote}>Scroll through the terms before accepting.</Text>
          <TouchableOpacity
            style={[tfm.acceptBtn, !scrolled && { opacity: 0.5 }]}
            onPress={onAccept}
            disabled={!scrolled}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={P.white} />
            <Text style={tfm.acceptBtnTxt}>I Accept — Continue to App</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// =============================================================================
// MonthlyFeedbackModal
// =============================================================================
const MonthlyFeedbackModal = ({ visible, onClose, token, month }) => {
  const QUESTIONS = [
    'How would you rate the punctuality of your van service?',
    "How satisfied are you with the driver's behaviour?",
    'How would you rate the cleanliness and comfort of the van?',
    'How satisfied are you with the route and pickup timings?',
    'Would you recommend this service to others?',
  ];
  const RATING_OPTIONS = ['Excellent', 'Good', 'Average', 'Poor', 'Very Poor'];

  const [subject,   setSubject]   = useState('');
  const [answers,   setAnswers]   = useState({});
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const setAnswer   = (i, val) => setAnswers(prev => ({ ...prev, [i]: val }));
  const allAnswered = QUESTIONS.every((_, i) => answers[i]);

  const handleSubmit = async () => {
    if (!subject.trim()) { Alert.alert('Subject Required', 'Please enter a subject for your feedback.'); return; }
    if (!allAnswered)    { Alert.alert('Incomplete', 'Please answer all questions before submitting.'); return; }
    setSaving(true);
    try {
      const questions = QUESTIONS.map((q, i) => ({ question: q, answer: answers[i] }));
      const res  = await fetch(`${API_BASE}/feedback/monthly`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ subject: subject.trim(), date: new Date().toISOString(), questions }),
      });
      const data = await res.json();
      if (data.success) setSubmitted(true);
      else Alert.alert('Error', data.message || 'Could not submit feedback.');
    } catch { Alert.alert('Error', 'Could not connect to server.'); }
    finally  { setSaving(false); }
  };

  if (submitted) {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={fb.overlay}>
          <View style={fb.thanksCard}>
            <Ionicons name="checkmark-circle" size={52} color={P.main} />
            <Text style={fb.thanksTitle}>Thank You!</Text>
            <Text style={fb.thanksBody}>Your feedback for {month} has been submitted. We appreciate your time.</Text>
            <TouchableOpacity style={fb.closeThanksBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={fb.closeThanksText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, backgroundColor: P.bg }}>
          <LinearGradient colors={[P.main, P.dark]} style={fb.header}>
            <TouchableOpacity onPress={onClose} style={fb.closeBtn}>
              <Ionicons name="close" size={22} color={P.white} />
            </TouchableOpacity>
            <Text style={fb.headerTitle}>Monthly Feedback — {month}</Text>
            <View style={{ width: 38 }} />
          </LinearGradient>
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={fb.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
              <Text style={fb.infoBannerTxt}>Monthly feedback window is now open. Your response helps us improve the service.</Text>
            </View>
            <Text style={fb.fieldLabel}>Subject *</Text>
            <TextInput
              style={fb.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. April 2026 Monthly Feedback"
              placeholderTextColor={P.textLight}
            />
            {QUESTIONS.map((q, i) => (
              <View key={i} style={fb.questionBlock}>
                <Text style={fb.questionTxt}>{i + 1}. {q}</Text>
                <View style={fb.optionRow}>
                  {RATING_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[fb.optionBtn, answers[i] === opt && fb.optionBtnActive]}
                      onPress={() => setAnswer(i, opt)}
                      activeOpacity={0.75}
                    >
                      <Text style={[fb.optionTxt, answers[i] === opt && fb.optionTxtActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={[fb.submitBtn, (!allAnswered || saving) && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={!allAnswered || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={P.white} />
                : (<><Ionicons name="send-outline" size={16} color={P.white} /><Text style={fb.submitTxt}>Submit Feedback</Text></>)
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// =============================================================================
// DashboardStack
// =============================================================================
function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={SCREENS.DASHBOARD_MAIN} component={PassengerDashboard} />
      <Stack.Screen name={SCREENS.ALERT_SCREEN}   component={AlertScreen}        />
    </Stack.Navigator>
  );
}

// =============================================================================
// CustomDrawerContent
// =============================================================================
function CustomDrawerContent({ navigation, state }) {
  const [userData,         setUserData]         = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [feedbackVisible,  setFeedbackVisible]  = useState(false);
  const [feedbackWindow,   setFeedbackWindow]   = useState({ isOpen: false, month: '', alreadySubmitted: false });
  const [authToken,        setAuthToken]        = useState('');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadChatCount,  setUnreadChatCount]  = useState(0);

  const activeRouteName = state?.routeNames?.[state?.index] || SCREENS.DASHBOARD;

  useEffect(() => {
    (async () => {
      try {
        const raw = await getItem(STORAGE_KEYS.USER_DATA);
        if (raw) setUserData(JSON.parse(raw));

        const tok = await AsyncStorage.getItem('authToken')
                 || await AsyncStorage.getItem('userToken')
                 || await AsyncStorage.getItem('token');
        if (tok) {
          setAuthToken(tok);
          try {
            const res  = await fetch(`${API_BASE}/feedback/monthly-window`, { headers: { Authorization: `Bearer ${tok}` } });
            const data = await res.json();
            if (data.success) setFeedbackWindow(data);
          } catch {}
          try {
            const nRes  = await fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${tok}` } });
            const nData = await nRes.json();
            if (nData.success) {
              const n = nData.notifications || nData.data || [];
              setUnreadNotifCount(n.filter(x => !x.read).length);
            }
          } catch {}
          try {
            const cRes  = await fetch(`${API_BASE}/messages/conversations`, { headers: { Authorization: `Bearer ${tok}` } });
            const cData = await cRes.json();
            if (cData.success) {
              setUnreadChatCount((cData.conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0));
            }
          } catch {}
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const getInitials = () => {
    const n = userData?.fullName || userData?.name || '';
    return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'PK';
  };
  const getName  = () => userData?.fullName || userData?.name || 'Passenger';
  const getPhone = () => userData?.phone || userData?.email || 'Passenger App';
  const goTo = (screen) => navigation.navigate(screen);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          try {
            await clearSessionData();
            const parent = navigation.getParent();
            if (parent) parent.reset({ index: 0, routes: [{ name: SCREENS.LOGIN }] });
            else        navigation.replace(SCREENS.LOGIN);
          } catch { Alert.alert('Error', 'Failed to logout.'); }
        },
      },
    ]);
  };

  const mainMenu = [
    { icon: 'grid-outline',         activeIcon: 'grid',         name: 'Dashboard',           screen: SCREENS.DASHBOARD,        badge: 0               },
    { icon: 'notifications-outline',activeIcon: 'notifications',name: 'Notifications',       screen: SCREENS.NOTIFICATIONS,   badge: unreadNotifCount },
    { icon: 'time-outline',         activeIcon: 'time',         name: 'Ride History',        screen: SCREENS.RIDE_HISTORY,    badge: 0               },
    { icon: 'card-outline',         activeIcon: 'card',         name: 'Payments',            screen: SCREENS.PAYMENTS,        badge: 0               },
    { icon: 'chatbubbles-outline',  activeIcon: 'chatbubbles',  name: 'Contact Transporter', screen: SCREENS.TRANSPORTER_CHAT, badge: unreadChatCount },
  ];

  const supportMenu = [
    { icon: 'help-circle-outline', activeIcon: 'help-circle', name: 'Help & Support', screen: SCREENS.HELP_SUPPORT,    badge: 0 },
    { icon: 'warning-outline',     activeIcon: 'warning',     name: 'Complaints',     screen: SCREENS.CONTACT_SUPPORT, badge: 0 },
  ];

  const renderItem = (item) => {
    const active = activeRouteName === item.screen;
    const badge  = item.badge || 0;
    return (
      <TouchableOpacity
        key={item.screen}
        style={[s.menuItem, active && s.menuItemActive]}
        onPress={() => goTo(item.screen)}
        activeOpacity={0.75}
      >
        {active && <View style={s.menuAccent} />}
        <View style={[s.menuIconBox, active && s.menuIconBoxActive]}>
          <Ionicons name={active ? item.activeIcon : item.icon} size={18} color={active ? P.white : P.textLight} />
        </View>
        <Text style={[s.menuItemTxt, active && s.menuItemTxtActive]}>{item.name}</Text>
        {badge > 0 && (
          <View style={s.menuBadge}>
            <Text style={s.menuBadgeTxt}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={active ? P.main : '#ccc'} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.drawer}>
      <StatusBar backgroundColor={P.dark} barStyle="light-content" />

      <LinearGradient colors={[P.main, P.dark]} style={s.sidebarHeader}>
        <Text style={s.portalLabel}>PASSENGER PORTAL</Text>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.profileTap} onPress={() => goTo(SCREENS.PROFILE)} activeOpacity={0.75}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>{getInitials()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.uName}  numberOfLines={1}>{loading ? 'Loading...' : getName()}</Text>
              <Text style={s.uPhone} numberOfLines={1}>{getPhone()}</Text>
              <View style={s.activePill}>
                <View style={s.activeDot} />
                <Text style={s.activeTxt}>Active</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(172,197,168,0.7)" />
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.closeDrawer()}>
            <Ionicons name="close" size={20} color={P.white} />
          </TouchableOpacity>
        </View>
        <Text style={s.profileHint}>Tap to view profile</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.sectionLabel}>MAIN MENU</Text>
        {mainMenu.map(renderItem)}

        <View style={s.menuDivider} />
        <Text style={s.sectionLabel}>SUPPORT</Text>
        {supportMenu.map(renderItem)}

        {feedbackWindow.isOpen && !feedbackWindow.alreadySubmitted && (
          <>
            <View style={s.menuDivider} />
            <Text style={s.sectionLabel}>FEEDBACK</Text>
            <TouchableOpacity style={s.menuItem} onPress={() => setFeedbackVisible(true)} activeOpacity={0.75}>
              <View style={[s.menuIconBox, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="star-outline" size={18} color={P.main} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.menuItemTxt}>Monthly Feedback</Text>
                <Text style={{ fontSize: 10, color: P.textLight, marginTop: 1 }}>{feedbackWindow.month} — Window Open</Text>
              </View>
              <View style={s.newBadge}><Text style={s.newBadgeTxt}>NEW</Text></View>
            </TouchableOpacity>
          </>
        )}

        <View style={s.menuDivider} />
        <Text style={s.sectionLabel}>ACCOUNT</Text>

        <TouchableOpacity style={s.menuItem} onPress={() => goTo(SCREENS.LEAVE_NETWORK)} activeOpacity={0.75}>
          <View style={[s.menuIconBox, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="exit-outline" size={18} color={P.error} />
          </View>
          <Text style={[s.menuItemTxt, { color: P.error }]}>Leave Transporter Network</Text>
          <Ionicons name="chevron-forward" size={14} color={P.error + '80'} />
        </TouchableOpacity>

        <TouchableOpacity style={s.menuItem} onPress={() => goTo(SCREENS.DELETE_ACCOUNT)} activeOpacity={0.75}>
          <View style={[s.menuIconBox, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="trash-outline" size={18} color="#C62828" />
          </View>
          <Text style={[s.menuItemTxt, { color: '#C62828' }]}>Delete Account Permanently</Text>
          <Ionicons name="chevron-forward" size={14} color="#C6282880" />
        </TouchableOpacity>

        <View style={s.menuDivider} />
        <TouchableOpacity style={s.menuItem} onPress={handleLogout} activeOpacity={0.75}>
          <View style={[s.menuIconBox, { backgroundColor: '#FFEBEE' }]}>
            <Ionicons name="log-out-outline" size={18} color={P.error} />
          </View>
          <Text style={[s.menuItemTxt, { color: P.error, fontWeight: '700' }]}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <MonthlyFeedbackModal
        visible={feedbackVisible}
        onClose={() => setFeedbackVisible(false)}
        token={authToken}
        month={feedbackWindow.month}
      />
    </View>
  );
}

// =============================================================================
// Main Navigator
// =============================================================================
export default function PassengerAppNavigation() {
  return (
    <Drawer.Navigator
      initialRouteName={SCREENS.DASHBOARD}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown:  false,
        drawerStyle:  { backgroundColor: 'transparent', width: 300 },
        swipeEnabled: true,
        drawerType:   'front',
        overlayColor: 'rgba(0,0,0,0.42)',
      }}
    >
      <Drawer.Screen name={SCREENS.DASHBOARD}        component={DashboardStack}                />
      <Drawer.Screen name={SCREENS.NOTIFICATIONS}    component={NotificationsScreen}           />
      <Drawer.Screen name={SCREENS.RIDE_HISTORY}     component={RideHistoryScreen}             />
      <Drawer.Screen name={SCREENS.PAYMENTS}         component={PassengerPaymentScreen}        />
      <Drawer.Screen name={SCREENS.PROFILE}          component={ProfileScreen}                 />
      <Drawer.Screen name={SCREENS.HELP_SUPPORT}     component={HelpSupportScreen}             />
      <Drawer.Screen name={SCREENS.CONTACT_SUPPORT}  component={ContactSupportScreen}          />
      <Drawer.Screen name={SCREENS.TERMS_CONDITIONS} component={TermsConditionsScreen}         />
      <Drawer.Screen name={SCREENS.TRANSPORTER_CHAT} component={PassengerTransporterChatScreen}/>
      <Drawer.Screen name={SCREENS.LEAVE_NETWORK}    component={PassengerLeaveNetworkScreen}   />
      <Drawer.Screen name={SCREENS.DELETE_ACCOUNT}   component={PassengerDeleteAccountScreen}  />
    </Drawer.Navigator>
  );
}

// =============================================================================
// STYLES
// =============================================================================
const s = StyleSheet.create({
  drawer: { flex: 1, backgroundColor: P.white },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingTop:    Platform.OS === 'ios' ? 54 : STATUS_BAR_H + 16,
    paddingBottom: 16,
  },
  portalLabel:  { fontSize: 10, color: 'rgba(172,197,168,0.8)', fontWeight: '700', letterSpacing: 2, marginBottom: 14 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  profileTap:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarTxt:    { color: P.white, fontSize: 18, fontWeight: '800' },
  uName:        { fontSize: 15, fontWeight: '800', color: P.white, marginBottom: 2 },
  uPhone:       { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  activePill:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start' },
  activeDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: P.accent, marginRight: 5 },
  activeTxt:    { color: P.white, fontSize: 11, fontWeight: '600' },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  profileHint:  { fontSize: 11, color: 'rgba(172,197,168,0.6)', marginLeft: 72 },
  scroll:       { flex: 1, paddingTop: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', marginBottom: 6, marginLeft: 20, marginTop: 8, letterSpacing: 1.2 },
  menuItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12, position: 'relative' },
  menuItemActive:   { backgroundColor: P.light },
  menuAccent:       { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, backgroundColor: P.main, borderRadius: 2 },
  menuIconBox:      { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F7F5', alignItems: 'center', justifyContent: 'center' },
  menuIconBoxActive:{ backgroundColor: P.main },
  menuItemTxt:      { flex: 1, fontSize: 14, fontWeight: '600', color: P.textMid },
  menuItemTxtActive:{ color: P.textDark, fontWeight: '800' },
  menuBadge:        { backgroundColor: P.error, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  menuBadgeTxt:     { fontSize: 10, color: P.white, fontWeight: '900' },
  menuDivider:      { height: 1, backgroundColor: '#E5EBE5', marginHorizontal: 16, marginVertical: 8 },
  newBadge:         { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  newBadgeTxt:      { fontSize: 10, color: P.main, fontWeight: '700' },
});

const tfm = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: P.white },
  intro:       { fontSize: 14, color: '#374151', lineHeight: 22, marginBottom: 16 },
  section:     { backgroundColor: P.white, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5EBE5' },
  sectionTitle:{ fontSize: 14, fontWeight: '800', color: '#1A2218', marginBottom: 6 },
  sectionBody: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  footer:      { padding: 18, borderTopWidth: 1, borderTopColor: '#E5EBE5', backgroundColor: P.white },
  footerNote:  { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 10 },
  acceptBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: P.main, borderRadius: 14, paddingVertical: 15 },
  acceptBtnTxt:{ fontSize: 15, fontWeight: '800', color: P.white },
});

const fb = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14 },
  closeBtn:      { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { fontSize: 16, fontWeight: '800', color: P.white, flex: 1, textAlign: 'center' },
  infoBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: '#BBDEFB' },
  infoBannerTxt: { flex: 1, fontSize: 12, color: '#1565C0', fontWeight: '600' },
  fieldLabel:    { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  input:         { backgroundColor: P.white, borderWidth: 1.5, borderColor: '#C5D0C5', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A2218', marginBottom: 16 },
  questionBlock: { marginBottom: 16, backgroundColor: P.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5EBE5' },
  questionTxt:   { fontSize: 13, fontWeight: '700', color: '#1A2218', marginBottom: 10, lineHeight: 19 },
  optionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optionBtn:        { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F5F7F5', borderRadius: 9, borderWidth: 1.5, borderColor: '#C5D0C5' },
  optionBtnActive:  { backgroundColor: P.main, borderColor: P.main },
  optionTxt:        { fontSize: 11, fontWeight: '600', color: '#374151' },
  optionTxtActive:  { color: P.white },
  submitBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: P.main, borderRadius: 14, paddingVertical: 15, marginTop: 10 },
  submitTxt:     { fontSize: 15, fontWeight: '800', color: P.white },
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  thanksCard:       { backgroundColor: P.white, borderRadius: 20, padding: 30, alignItems: 'center', gap: 12, width: '100%' },
  thanksTitle:      { fontSize: 22, fontWeight: '900', color: '#1A2218' },
  thanksBody:       { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  closeThanksBtn:   { backgroundColor: P.main, borderRadius: 12, paddingHorizontal: 30, paddingVertical: 13, marginTop: 8 },
  closeThanksText:  { fontSize: 15, fontWeight: '800', color: P.white },
});