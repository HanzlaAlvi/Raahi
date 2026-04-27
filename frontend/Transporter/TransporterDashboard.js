// frontend/Transporter/TransporterDashboard.js
import React, {
  useState, useCallback, useMemo, useRef, useEffect,
} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, SafeAreaView,
  Alert, Animated, ActivityIndicator, StatusBar, StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import { useNavigation }  from '@react-navigation/native';

import C                   from './constants/colors';
import { VEHICLE_INFO }    from './constants/vehicles';
import { fmtPKR }          from './utils/formatters';
import { api }             from './services/ApiService';
import { optimizer, normalizePassenger } from './services/RouteOptimizer';

import Avatar              from './components/Avatar';
import OverviewSection     from './sections/OverViewSection';
import ProfileSection      from './sections/ProfileSection';
import PollSection         from './sections/PollSection';
import SmartRouteSection   from './sections/SmartRouteSection';
import RoutesSection       from './sections/RoutesSection';
import AssignSection       from './sections/AssignSection';
import TrackingSection     from './sections/TrackingSection';
import RequestSection      from './sections/RequestSection';
import PaymentsSection     from './sections/PaymentsSection';
import ComplaintsSection   from './sections/ComplaintsSection';
import FeedbackSection     from './sections/FeedbackSection';
import { NotificationsSection } from './sections/NotificationsSection';
import MessageSection      from './sections/MessageSection';
import AlarmModal from './components/AlarmModal';

import {
  scheduleNightAlarms,
  areTodayAlarmsScheduled,
  setupAlarmNotificationListener,
  registerAndSavePushToken,
  isNightWindow,
  playAlarmSound,
} from './services/AlarmService';

const STATUS_BAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const API_BASE     = 'https://raahi-q2ur.onrender.com/api';

const MENU_ITEMS = [
  { key: 'overview',    label: 'Dashboard',                   ionIcon: 'grid-outline'         },
  { key: 'poll',        label: 'Availability Polls',          ionIcon: 'bar-chart-outline'    },
  { key: 'smart-route', label: 'Smart Routes',                ionIcon: 'flash-outline'        },
  { key: 'routes',      label: 'Routes',                      ionIcon: 'map-outline'          },
  { key: 'assign',      label: 'Assign Driver',               ionIcon: 'person-add-outline'   },
  { key: 'tracking',    label: 'Live Tracking',               ionIcon: 'navigate-outline'     },
  { key: 'requests',    label: 'Network Join Approvals',      ionIcon: 'clipboard-outline'    },
  { key: 'messages',    label: 'Messages',                    ionIcon: 'chatbubbles-outline'  },
  { key: 'payments',    label: 'Payments',                    ionIcon: 'wallet-outline'       },
  { key: 'complaints',  label: 'Complaints',                  ionIcon: 'warning-outline'      },
  { key: 'feedback',    label: 'Feedback',                    ionIcon: 'star-outline'          },
];

const SECTION_TITLES = {
  overview:      'Dashboard',
  profile:       'My Profile',
  poll:          'Availability Polls',
  'smart-route': 'Smart Routes',
  routes:        'Routes',
  assign:        'Assign Driver',
  tracking:      'Live Tracking',
  requests:      'Requests',
  messages:      'Messages',
  payments:      'Payments',
  complaints:    'Complaints',
  feedback:      'Feedback',
  notifications: 'Notifications',
};

const TransporterDashboard = () => {
  const navigation = useNavigation();

  const [section,     setSection]     = useState('overview');
  const [requestsTab, setRequestsTab] = useState('driver');
  const [sidebar,     setSidebar]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const slideAnim        = useRef(new Animated.Value(-320)).current;
  const blinkAnim        = useRef(new Animated.Value(0)).current;
  const alarmBannerAnim  = useRef(new Animated.Value(0)).current;   // ✅ FIX: was missing
  const alarmCleanupRef  = useRef(null);                            // ✅ FIX: was missing

  const [profile,        setProfile]        = useState(null);
  const [stats,          setStats]          = useState({ activeDrivers:0, totalPassengers:0, completedTrips:0, ongoingTrips:0, complaints:0, paymentsReceived:0, paymentsPending:0 });
  const [polls,          setPolls]          = useState([]);
  const [drivers,        setDrivers]        = useState([]);
  const [routes,         setRoutes]         = useState([]);
  const [trips,          setTrips]          = useState([]);
  const [driverReqs,     setDriverReqs]     = useState([]);
  const [passReqs,       setPassReqs]       = useState([]);
  const [complaints,     setComplaints]     = useState([]);
  const [notifications,  setNotifications]  = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [lastUpdated,    setLastUpdated]    = useState(new Date());

  const [smartResults,   setSmartResults]   = useState([]);
  const [optimizing,     setOptimizing]     = useState(false);
  const [optimizeStatus, setOptimizeStatus] = useState('');
  const [confirmingIdx,  setConfirmingIdx]  = useState(null);
  const [activePoll,     setActivePoll]     = useState(null);

  const [alarmBannerVisible, setAlarmBannerVisible] = useState(false);
  const [alarmCount,         setAlarmCount]         = useState(0);
  const [showAlarmModal, setShowAlarmModal] = useState(false);
  const [alarmData, setAlarmData] = useState({title:'', message:'', unassigned:0});

  useEffect(() => { checkAuthAndLoad(); }, []);

  useEffect(() => {
    async function initAlarms() {
      try {
        await registerAndSavePushToken();

        const alreadyScheduled = await areTodayAlarmsScheduled();
        if (!alreadyScheduled) {
          const count = await scheduleNightAlarms();
          console.log(`[TransporterDashboard] ${count} alarms scheduled`);
        }

        alarmCleanupRef.current = setupAlarmNotificationListener(
          (notification, isMidnight) => {
            setAlarmCount(prev => prev + 1);
            showAlarmBanner(isMidnight);
            if (isMidnight) {
              setSection('routes');
              loadAll();
            }
          }
        );

        if (isNightWindow()) {
          showAlarmBanner(false);
        }
      } catch (err) {
        console.warn('[TransporterDashboard] initAlarms error:', err.message);
      }
    }

    initAlarms();

    return () => { if (alarmCleanupRef.current) alarmCleanupRef.current(); }; // ✅ FIX: proper cleanup
  }, []); 

  // Listen for alarm FCM + banner
  useEffect(() => {
    // api.notifications.addListener does not exist — removed to fix crash
    console.log('[Dashboard] Alarm listener ready via AlarmService');
  }, []); 

  const showAlarmBanner = (isMidnight = false) => {
    setAlarmBannerVisible(true);
    Animated.sequence([
      Animated.timing(alarmBannerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(alarmBannerAnim, { toValue: 0.97, duration: 300, useNativeDriver: true }),
      Animated.timing(alarmBannerAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    if (isMidnight) {
      Alert.alert(
        '🌙 12 AM — Auto-Process Complete!',
        'Passengers auto-confirmed aur routes auto-assign ho gayi hain. Routes section check karo.',
        [{ text: 'Routes Dekho', onPress: () => setSection('routes') }, { text: 'OK' }]
      );
    }
  };

  const dismissAlarmBanner = () => {
    Animated.timing(alarmBannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setAlarmBannerVisible(false);
    });
  };

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: sidebar ? 0 : -320,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [sidebar]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(blinkAnim, { toValue:1, duration:800, useNativeDriver:false }),
      Animated.timing(blinkAnim, { toValue:0, duration:800, useNativeDriver:false }),
    ])).start();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { token, transporterId } = await api.getAuthData();
      if (!token || !transporterId) {
        navigation.reset({ index:0, routes:[{ name:'Login' }] });
        return;
      }
      await loadAll();
    } catch (e) {
      console.warn('checkAuthAndLoad:', e);
      setLoading(false);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const { token } = await api.getAuthData();
      const headers   = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };

      const [p, st, po, dr, req_d, req_p, rt, tr, co, no, msgs] = await Promise.allSettled([
        api.getProfile(),
        api.getStats(),
        api.getPolls(),
        api.getDrivers(),
        api.getDriverRequests(),
        api.getPassengerRequests(),
        api.getRoutes(),
        api.getTrips(),
        api.getComplaints(),
        api.getNotifications(),
        fetch(`${API_BASE}/messages/conversations`, { headers })
          .then(r => r.json())
          .catch(() => ({ success:false, conversations:[] })),
      ]);

      if (p.status     === 'fulfilled' && p.value)  setProfile(p.value);
      if (st.status    === 'fulfilled' && st.value) setStats(st.value);
      if (po.status    === 'fulfilled' && po.value) setPolls(po.value);
      if (dr.status    === 'fulfilled' && dr.value) setDrivers(dr.value);
      if (req_d.status === 'fulfilled') setDriverReqs(req_d.value || []);
      if (req_p.status === 'fulfilled') setPassReqs(req_p.value || []);
      if (rt.status    === 'fulfilled') setRoutes(rt.value || []);
      if (tr.status    === 'fulfilled') setTrips(tr.value || []);
      if (co.status    === 'fulfilled') setComplaints(co.value || []);
      if (no.status    === 'fulfilled') setNotifications(no.value || []);

      if (msgs.status === 'fulfilled') {
        try {
          const convData = msgs.value;
          if (convData?.success) {
            const total = (convData.conversations || []).reduce((s, c) => s + (c.unreadCount || 0), 0);
            setUnreadMessages(total);
          }
        } catch {}
      }

      setLastUpdated(new Date());
    } catch (e) {
      console.warn('loadAll:', e);
      if (e?.message?.includes('Authentication')) {
        Alert.alert('Session Expired', 'Please login again.', [{
          text: 'OK',
          onPress: () => navigation.reset({ index:0, routes:[{ name:'Login' }] }),
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  }, []);

  const unread     = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const totalReqs  = driverReqs.length + passReqs.length;
  const totalBadge = totalReqs + unread + smartResults.length + unreadMessages;

  const nav = useCallback((sec) => {
    setSection(sec);
    setSidebar(false);
  }, []);

  const handleOptimize = async (poll) => {
    if (!poll) { Alert.alert('No Poll', 'Select a poll first.'); return; }
    setOptimizing(true); setActivePoll(poll); setSmartResults([]); setOptimizeStatus('Preparing passenger data…');
    try {
      const yesResponses = (poll.responses || []).filter(r => r.response === 'yes');
      if (!yesResponses.length) { Alert.alert('No Passengers', 'No passengers responded "Yes".'); return; }
      const passengers = yesResponses.map((r, i) => normalizePassenger(r, i));
      let results = null;
      try {
        setOptimizeStatus('Requesting server optimization…');
        const apiRes = await api.call('/routes/optimize', { method:'POST', body:JSON.stringify({ pollId:poll._id }) });
        if (apiRes?.success && apiRes.routes?.length) {
          results = apiRes.routes;
          setOptimizeStatus(`${results.length} route(s) ready from server`);
        }
      } catch { setOptimizeStatus('Running local optimization engine…'); }
      if (!results?.length) results = await optimizer.optimize(passengers, (msg) => setOptimizeStatus(msg));
      if (!results?.length) { Alert.alert('No Routes', 'Could not generate routes.'); return; }
      setSmartResults(results);
      nav('smart-route');
      const totalPax    = results.reduce((s, r) => s + (r.passengerCount || 0), 0);
      const totalFuel   = results.reduce((s, r) => s + (r.rawFuelCostPKR || 0), 0);
      const totalLitres = results.reduce((s, r) => s + (r.rawFuelLitres || 0), 0);
      const uniqueDests = [...new Set(results.map(r => r.destination).filter(Boolean))];
      Alert.alert(
        `${results.length} Route${results.length !== 1 ? 's' : ''} Ready`,
        `Passengers: ${totalPax}\nDestinations: ${uniqueDests.length}\nFuel: ${totalLitres.toFixed(1)} L · ${fmtPKR(totalFuel)}`,
        [{ text:'View Routes', onPress:() => nav('smart-route') }, { text:'OK', style:'cancel' }],
      );
    } catch (err) {
      Alert.alert('Error', `Could not build routes: ${err?.message || 'Unknown error'}`);
    } finally {
      setOptimizing(false); setOptimizeStatus('');
    }
  };

  const blinkOpacity = blinkAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1] });

  const renderContent = () => {
    switch (section) {
      // ✅ FIX: onNavigate={nav} → nav={nav}  (OverViewSection expects prop named "nav")
      case 'overview':    return <OverviewSection profile={profile} stats={stats} routes={routes} drivers={drivers} trips={trips} complaints={complaints} notifications={notifications} polls={polls} lastUpdated={lastUpdated} nav={nav} />;
      case 'profile':     return <ProfileSection profile={profile} setProfile={setProfile} refreshing={refreshing} onRefresh={loadAll} />;
      case 'poll':        return <PollSection polls={polls} refreshing={refreshing} onRefresh={onRefresh} loadAll={loadAll} handleOptimize={handleOptimize} optimizing={optimizing} activePoll={activePoll} />;
      case 'smart-route': return <SmartRouteSection smartResults={smartResults} optimizing={optimizing} optimizeStatus={optimizeStatus} confirmingIdx={confirmingIdx} refreshing={refreshing} onRefresh={loadAll} nav={nav} handleConfirmRoute={handleConfirmRoute} handleDiscardRoute={handleDiscardRoute} />;
      case 'routes':      return <RoutesSection routes={routes} drivers={drivers} refreshing={refreshing} onRefresh={onRefresh} loadAll={loadAll} nav={nav} />;
      case 'assign':      return <AssignSection routes={routes} drivers={drivers} refreshing={refreshing} onRefresh={onRefresh} loadAll={loadAll} />;
      case 'tracking':    return <TrackingSection routes={routes} drivers={drivers} />;
      case 'requests':    return <RequestSection driverReqs={driverReqs} passReqs={passReqs} tab={requestsTab} setTab={setRequestsTab} refreshing={refreshing} onRefresh={onRefresh} loadAll={loadAll} />;
      case 'messages':    return <MessageSection />;
      case 'payments':    return <PaymentsSection />;
      case 'complaints':  return <ComplaintsSection complaints={complaints} refreshing={refreshing} onRefresh={onRefresh} />;
      case 'feedback':    return <FeedbackSection refreshing={refreshing} onRefresh={onRefresh} />;
      case 'notifications': return <NotificationsSection notifications={notifications} onRead={loadAll} />;
      // ✅ FIX: default case mein bhi nav={nav}
      default:            return <OverviewSection profile={profile} stats={stats} routes={routes} drivers={drivers} trips={trips} complaints={complaints} notifications={notifications} polls={polls} lastUpdated={lastUpdated} nav={nav} />;
    }
  };

  const handleConfirmRoute = async (result, idx) => {
    setConfirmingIdx(idx);
    try {
      if (!activePoll) throw new Error('No active poll selected');
      const { transporterId } = await api.getAuthData();
      const vehicleLabel = VEHICLE_INFO[result.vehicleType]?.label || 'Vehicle';
      const routeName = `${vehicleLabel} Route — ${result.passengerCount} pax · ${result.areaLabel || ''} → ${result.destination || ''}`;

      // ✅ FIX 1: api.saveUnassignedRoute() use karo — yeh date, status:'unassigned',
      //    vehiclePreference, name, pickupTime sab automatically deta hai.
      //    Pehle raw api.call('/routes') tha jisme date/status missing tha
      //    isliye routes RoutesSection "Today" tab mein nahi dikhte the.
      await api.saveUnassignedRoute({
        routeName,
        pollId:         activePoll._id,
        vehicleType:    result.vehicleType,
        destination:    result.destination,
        destinationLat: result.destinationLat,
        destinationLng: result.destinationLng,
        timeSlot:       result.passengers?.[0]?.timeSlot || '08:00 AM',
        pickupTime:     result.passengers?.[0]?.timeSlot || '08:00 AM',
        startPoint:     result.stops?.[0]?.address || 'Multiple Pickup Points',
        passengers:     result.passengers,   // saveUnassignedRoute khud map + vehiclePreference add karega
        stops:          result.stops,
        estimatedKm:    result.estimatedKm,
        estimatedTime:  result.estimatedTime,
        estimatedFuel:  result.estimatedFuel,
        fuelCostPKR:    result.fuelCostPKR,
        fuelType:       result.fuelType,
        transporterId,
      });

      // ✅ FIX 2: Confirmed route ko smartResults se hata do — duplicate confirm hone se bachao
      setSmartResults(prev => prev.filter((_, i) => i !== idx));

      // ✅ FIX 3: Alert mein "View Routes" option bhi add kiya
      Alert.alert('Route Saved ✅', `"${routeName}" saved successfully.`, [
        { text: 'View Routes',   onPress: () => nav('routes') },
        { text: 'Assign Driver', onPress: () => nav('assign') },
        { text: 'OK', style: 'cancel' },
      ]);
      await loadAll();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save route');
    } finally {
      setConfirmingIdx(null);
    }
  };

  // ✅ FIX: handleDiscardRoute — smartResults se ek route remove karta hai
  const handleDiscardRoute = useCallback((idx) => {
    Alert.alert(
      'Discard Route',
      'Kya aap yeh optimized route hataana chahte hain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard', style: 'destructive',
          onPress: () => setSmartResults(prev => prev.filter((_, i) => i !== idx)),
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark || '#2D3E2F'} />

      <LinearGradient
        colors={[C.main || '#415844', C.dark || '#2D3E2F']}
        start={{ x:0, y:0 }} end={{ x:1, y:0 }}
        style={[st.header, { paddingTop: STATUS_BAR_H + 12 }]}
      >
        <TouchableOpacity onPress={() => setSidebar(true)} style={st.menuBtn}>
          <Ionicons name="menu" size={26} color="#fff" />
          {totalBadge > 0 && (
            <Animated.View style={[st.menuBadge, { opacity: blinkOpacity }]}>
              <Text style={st.menuBadgeTxt}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
            </Animated.View>
          )}
        </TouchableOpacity>

        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>{SECTION_TITLES[section] || 'Dashboard'}</Text>
          {profile?.company && <Text style={st.headerSub}>{profile.company}</Text>}
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          {alarmBannerVisible && (
            <TouchableOpacity onPress={() => nav('routes')} style={st.alarmBell}>
              <Ionicons name="alarm" size={20} color="#FFD700" />
              {alarmCount > 0 && (
                <View style={st.alarmBadge}>
                  <Text style={st.alarmBadgeTxt}>{alarmCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => nav('notifications')} style={{ padding:4 }}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unread > 0 && (
              <View style={st.notifBadge}>
                <Text style={st.notifBadgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav('profile')}>
            <Avatar name={profile?.name || 'T'} size={36} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {alarmBannerVisible && (
        <Animated.View style={[st.alarmBanner, { opacity: alarmBannerAnim }]}>
          <LinearGradient
            colors={['#7A1A1A', '#C62828']}
            start={{ x:0, y:0 }} end={{ x:1, y:0 }}
            style={st.alarmBannerInner}
          >
            <Ionicons name="alarm" size={20} color="#FFD700" />
            <Text style={st.alarmBannerTxt}>
              ⏰ Routes assign karo — 12 AM tak waqt hai!
            </Text>
            <TouchableOpacity onPress={() => { nav('routes'); dismissAlarmBanner(); }}>
              <Text style={st.alarmBannerAction}>Assign →</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissAlarmBanner} style={{ marginLeft:6 }}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      )}

      <View style={st.content}>
      {loading && !refreshing
        ? <View style={st.loadingBox}><ActivityIndicator size="large" color={C.main} /><Text style={st.loadingTxt}>Loading...</Text></View>
        : renderContent()
      }
      <AlarmModal
        visible={showAlarmModal}
        onDismiss={() => setShowAlarmModal(false)}
        title={alarmData.title}
        message={alarmData.message}
        unassignedCount={alarmData.unassigned}
      />
      </View>

      {sidebar && (
        <TouchableOpacity
          style={st.overlay}
          activeOpacity={1}
          onPress={() => setSidebar(false)}
        />
      )}

      <Animated.View style={[st.sidebar, { transform:[{ translateX: slideAnim }] }]}>
        <LinearGradient
          colors={[C.dark || '#2D3E2F', C.main || '#415844']}
          style={st.sidebarHeader}
        >
          <View style={st.sidebarHeaderRow}>
            <TouchableOpacity style={st.sidebarProfileTap} onPress={() => nav('profile')} activeOpacity={0.75}>
              <Avatar name={profile?.name || 'T'} size={52} />
              <View style={{ marginLeft:12, flex:1 }}>
                <Text style={st.sidebarName}>{profile?.name || 'Transporter'}</Text>
                <Text style={st.sidebarEmail} numberOfLines={1}>{profile?.email || ''}</Text>
                <View style={st.activePill}>
                  <View style={st.activeDot} />
                  <Text style={st.activeTxt}>Active</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(172,197,168,0.7)" style={{ marginRight: 36 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSidebar(false)} style={st.sidebarCloseBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          <Text style={st.profileHint}>Tap to view profile</Text>
        </LinearGradient>

        <ScrollView style={st.sidebarMenu}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[st.menuItem, section === item.key && st.menuItemActive]}
              onPress={() => nav(item.key)}
            >
              <Ionicons
                name={item.ionIcon}
                size={20}
                color={section === item.key ? (C.main || '#415844') : '#555'}
              />
              <Text style={[st.menuLabel, section === item.key && st.menuLabelActive]}>
                {item.label}
              </Text>
              {item.key === 'requests' && totalReqs > 0 && (
                <View style={st.sidebarBadge}><Text style={st.sidebarBadgeTxt}>{totalReqs}</Text></View>
              )}
              {item.key === 'notifications' && unread > 0 && (
                <View style={st.sidebarBadge}><Text style={st.sidebarBadgeTxt}>{unread}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={st.logoutBtn}
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout', style: 'destructive',
                onPress: async () => {
                  await AsyncStorage.multiRemove(['authToken','userId','transporterId','transporterData']);
                  navigation.reset({ index:0, routes:[{ name:'Login' }] });
                },
              },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#C62828" />
          <Text style={st.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default TransporterDashboard;

const st = StyleSheet.create({
  root:    { flex:1, backgroundColor:'#F5F7F5' },
  header:  { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingBottom:12, gap:10 },
  headerCenter: { flex:1 },
  headerTitle:  { fontSize:18, fontWeight:'900', color:'#fff', letterSpacing:-0.3 },
  headerSub:    { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:1 },

  menuBtn:   { position:'relative', padding:4 },
  menuBadge: { position:'absolute', top:-2, right:-2, backgroundColor:'#E53935', borderRadius:8, minWidth:16, height:16, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  menuBadgeTxt: { color:'#fff', fontSize:9, fontWeight:'800' },

  notifBadge:    { position:'absolute', top:-4, right:-4, backgroundColor:'#C62828', borderRadius:8, minWidth:16, height:16, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  notifBadgeTxt: { color:'#fff', fontSize:9, fontWeight:'800' },

  alarmBell:      { position:'relative', padding:4 },
  alarmBadge:     { position:'absolute', top:-4, right:-4, backgroundColor:'#C62828', borderRadius:8, minWidth:16, height:16, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  alarmBadgeTxt:  { color:'#fff', fontSize:9, fontWeight:'800' },

  alarmBanner:      { marginHorizontal:0 },
  alarmBannerInner: { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, gap:8 },
  alarmBannerTxt:   { flex:1, color:'#fff', fontSize:12, fontWeight:'700' },
  alarmBannerAction:{ color:'#FFD700', fontSize:13, fontWeight:'900' },

  content: { flex:1 },

  loadingBox: { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loadingTxt: { fontSize:14, color:'#666', fontWeight:'600' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.45)', zIndex:10 },

  sidebar: {
    position:'absolute', top:0, bottom:0, left:0, width:300,
    backgroundColor:'#fff', zIndex:20,
    ...Platform.select({
      ios:     { shadowColor:'#000', shadowOpacity:0.25, shadowRadius:16, shadowOffset:{ width:4, height:0 } },
      android: { elevation:20 },
    }),
  },
  sidebarHeader: { paddingTop: Platform.OS === 'ios' ? 54 : STATUS_BAR_H + 16, paddingBottom:16, paddingHorizontal:18 },
  sidebarHeaderRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  sidebarProfileTap: { flex:1, flexDirection:'row', alignItems:'center' },
  sidebarCloseBtn: { width:32, height:32, borderRadius:10, backgroundColor:'rgba(255,255,255,0.18)', alignItems:'center', justifyContent:'center' },
  activePill: { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.2)', paddingHorizontal:9, paddingVertical:3, borderRadius:12, alignSelf:'flex-start', marginTop:4 },
  activeDot: { width:7, height:7, borderRadius:4, backgroundColor:'#69F0AE', marginRight:5 },
  activeTxt: { color:'#fff', fontSize:11, fontWeight:'600' },
  profileHint: { fontSize:11, color:'rgba(172,197,168,0.6)', marginLeft:68 },
  sidebarName:  { fontSize:16, fontWeight:'800', color:'#fff' },
  sidebarEmail: { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  sidebarMenu:  { flex:1, paddingTop:8 },

  menuItem:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, gap:14, borderRadius:12, marginHorizontal:8, marginVertical:1 },
  menuItemActive: { backgroundColor:'#EDF5ED' },
  menuLabel:      { fontSize:14, fontWeight:'600', color:'#444', flex:1 },
  menuLabelActive:{ color:'#2D3E2F', fontWeight:'800' },

  sidebarBadge:    { backgroundColor:'#E53935', borderRadius:8, minWidth:18, height:18, alignItems:'center', justifyContent:'center', paddingHorizontal:4 },
  sidebarBadgeTxt: { color:'#fff', fontSize:10, fontWeight:'800' },

  logoutBtn: { flexDirection:'row', alignItems:'center', gap:10, padding:20, borderTopWidth:1, borderTopColor:'#F0F0F0' },
  logoutTxt: { fontSize:14, fontWeight:'700', color:'#C62828' },
});