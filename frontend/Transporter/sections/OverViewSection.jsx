// frontend/Transporter/sections/OverViewSection.jsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  RefreshControl, StyleSheet, Platform, Modal,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar             from '../components/Avatar';
import { api }            from '../services/ApiService';

const API_BASE = 'https://raahi-q2ur.onrender.com/api';

const P = {
  main:'#415844', dark:'#2D3E2F', mid:'#5C7A5F', white:'#FFFFFF',
  bg:'#F5F7F5', cardBg:'#FFFFFF', light:'#EDF1ED', border:'#C5D0C5',
  divider:'#E5EBE5', textDark:'#1A2218', textMid:'#374151',
  textLight:'#6B7280', textMuted:'#9CA3AF',
  success:'#2E7D32', successBg:'#E8F5E9', warn:'#E65100', warnBg:'#FFF3E0',
  error:'#C62828', info:'#1565C0', infoBg:'#E3F2FD',
};

const DetailModal = ({ visible, onClose, title, icon, data, loading, renderItem, emptyText }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={m.root}>
      <LinearGradient colors={[P.main, P.dark]} style={m.header}>
        <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={P.white} />
        </TouchableOpacity>
        <View style={m.headerCenter}>
          <Ionicons name={icon} size={18} color="rgba(255,255,255,0.85)" style={{ marginBottom:3 }} />
          <Text style={m.headerTitle}>{title}</Text>
        </View>
        <View style={{ width:38 }} />
      </LinearGradient>

      {loading ? (
        <View style={m.center}>
          <ActivityIndicator size="large" color={P.main} />
          <Text style={m.loadingTxt}>Loading…</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={m.empty}>
          <Ionicons name="file-tray-outline" size={52} color={P.textMuted} />
          <Text style={m.emptyTxt}>{emptyText || 'No data found'}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => item._id?.toString() || String(i)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal:16, paddingVertical:12, paddingBottom:40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  </Modal>
);

const DriverRow = ({ driver }) => {
  const isOnline = driver.isOnline || driver.status === 'active';
  const initials = (driver.name || 'D').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={m.card}>
      <View style={[m.av, { backgroundColor: P.main }]}><Text style={m.avTxt}>{initials}</Text></View>
      <View style={{ flex:1 }}>
        <Text style={m.cardName}>{driver.name || 'Driver'}</Text>
        <Text style={m.cardSub}>{driver.vehicleType || driver.vehicle || 'Vehicle N/A'}</Text>
        {driver.phone   ? <Text style={m.cardMeta}><Ionicons name="call-outline" size={11} color={P.textLight} /> {driver.phone}</Text>   : null}
        {driver.vehicleNo ? <Text style={m.cardMeta}><Ionicons name="car-outline" size={11} color={P.textLight} /> {driver.vehicleNo}</Text> : null}
      </View>
      <View style={[m.statusPill, { backgroundColor: isOnline ? P.successBg : '#F3F4F6' }]}>
        <View style={[m.statusDot, { backgroundColor: isOnline ? P.success : P.textMuted }]} />
        <Text style={[m.statusTxt, { color: isOnline ? P.success : P.textMuted }]}>{isOnline ? 'Active' : 'Offline'}</Text>
      </View>
    </View>
  );
};

const PassengerRow = ({ passenger }) => {
  const initials = (passenger.name || 'P').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={m.card}>
      <View style={[m.av, { backgroundColor: P.info }]}><Text style={m.avTxt}>{initials}</Text></View>
      <View style={{ flex:1 }}>
        <Text style={m.cardName}>{passenger.name || 'Passenger'}</Text>
        <Text style={m.cardSub}>{passenger.email || ''}</Text>
        {passenger.phone        ? <Text style={m.cardMeta}><Ionicons name="call-outline"     size={11} color={P.textLight} /> {passenger.phone}</Text>        : null}
        {passenger.pickupPoint  ? <Text style={m.cardMeta}><Ionicons name="location-outline" size={11} color={P.textLight} /> {passenger.pickupPoint}</Text>   : null}
      </View>
    </View>
  );
};

const TripRow = ({ trip }) => {
  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' }); }
    catch { return '—'; }
  };
  return (
    <View style={m.card}>
      <View style={[m.av, { backgroundColor: P.success }]}>
        <Ionicons name="checkmark-circle" size={20} color={P.white} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={m.cardName}>{trip.routeName || trip.name || 'Trip'}</Text>
        {trip.driverName     ? <Text style={m.cardSub}><Ionicons  name="person-outline"  size={11} color={P.textLight} /> {trip.driverName}</Text>             : null}
        {trip.passengerCount != null ? <Text style={m.cardMeta}><Ionicons name="people-outline" size={11} color={P.textLight} /> {trip.passengerCount} passengers</Text> : null}
        <Text style={m.cardMeta}><Ionicons name="time-outline" size={11} color={P.textLight} /> {fmtDate(trip.startTime || trip.completedAt || trip.createdAt)}</Text>
      </View>
      <View style={[m.statusPill, { backgroundColor: P.successBg }]}>
        <Text style={[m.statusTxt, { color: P.success }]}>Completed</Text>
      </View>
    </View>
  );
};

const StatTile = ({ icon, iconBg, iconColor, label, value, onPress }) => (
  <TouchableOpacity style={s.statTile} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
    <View style={[s.statIconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text style={[s.statValue, { color: iconColor }]}>{value ?? '—'}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {onPress && (
      <View style={[s.tapHint, { borderColor: iconColor + '30' }]}>
        <Text style={[s.tapHintTxt, { color: iconColor }]}>Tap to view</Text>
      </View>
    )}
  </TouchableOpacity>
);

const QuickBtn = ({ icon, label, onPress }) => (
  <TouchableOpacity style={s.quickBtn} onPress={onPress} activeOpacity={0.75}>
    <View style={s.quickIconBox}><Ionicons name={icon} size={22} color={P.main} /></View>
    <Text style={s.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const OverviewSection = ({
  profile, stats = {}, drivers = [], driverReqs = [], passReqs = [],
  unread, smartResults = [], totalBadge, refreshing, onRefresh,
  nav, lastUpdated,
}) => {
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning ☀️' : hour < 17 ? 'Good Afternoon 👋' : 'Good Evening 🌙';

  const [modal, setModal] = useState(null);
  const [mData, setMData] = useState([]);
  const [mLoad, setMLoad] = useState(false);

  const openModal = async (type) => {
    setModal(type);
    setMData([]);
    setMLoad(true);
    try {
      const { token, transporterId } = await api.getAuthData();
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      let url = '';
      if (type === 'drivers')    url = `${API_BASE}/dashboard/drivers?transporterId=${transporterId}`;
      if (type === 'passengers') url = `${API_BASE}/dashboard/passengers?transporterId=${transporterId}`;
      if (type === 'trips')      url = `${API_BASE}/dashboard/completed-trips?transporterId=${transporterId}`;

      const r    = await fetch(url, { headers });
      const data = await r.json();

      if      (type === 'drivers')    setMData(data.drivers    || []);
      else if (type === 'passengers') setMData(data.passengers || []);
      else if (type === 'trips')      setMData(data.trips      || []);
    } catch (e) {
      console.warn('openModal fetch error:', e);
    } finally {
      setMLoad(false);
    }
  };

  const STATS = [
    { icon:'people-outline',              iconBg:P.light,     iconColor:P.main,    label:'Active Drivers',  value:stats.activeDrivers    || 0, sec:'assign',     modalType:'drivers'    },
    { icon:'person-outline',              iconBg:P.infoBg,    iconColor:P.info,    label:'Passengers',      value:stats.totalPassengers  || 0, sec:'requests',   modalType:'passengers' },
    { icon:'checkmark-done-outline',      iconBg:P.successBg, iconColor:P.success, label:'Completed Trips', value:stats.completedTrips   || 0, sec:'routes',     modalType:'trips'      },
    { icon:'navigate-outline',            iconBg:P.warnBg,    iconColor:P.warn,    label:'Ongoing Trips',   value:stats.ongoingTrips     || 0, sec:'tracking',   modalType:null         },
    { icon:'chatbubble-ellipses-outline', iconBg:'#FEF2F2',   iconColor:P.error,   label:'Complaints',      value:stats.complaints       || 0, sec:'complaints', modalType:null         },
    { icon:'card-outline',                iconBg:'#E0F2FE',   iconColor:'#0369A1', label:'Received (Rs)',   value:stats.paymentsReceived || 0, sec:'payments',   modalType:null         },
  ];

  const QUICK = [
    { icon:'bar-chart-outline',  label:'New Poll',      sec:'poll'        },
    { icon:'flash-outline',      label:'Smart Routes',  sec:'smart-route' },
    { icon:'person-add-outline', label:'Assign Driver', sec:'assign'      },
    { icon:'navigate-outline',   label:'Live Tracking', sec:'tracking'    },
  ];

  const modalConfig = {
    drivers:    { title:'Your Network Drivers',  icon:'people-outline',         emptyText:'No drivers associated with you' },
    passengers: { title:'Your Passengers',       icon:'person-outline',         emptyText:'No passengers assigned yet'     },
    trips:      { title:'Completed Trips',       icon:'checkmark-done-outline', emptyText:'No completed trips yet'         },
  };

  return (
    <ScrollView
      style={{ flex:1, backgroundColor:P.bg }}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.main]} tintColor={P.main} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.welcomeCard}>
        <LinearGradient colors={['#4D6B51','#3A5440']} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={s.welcomeGrad}>
          <View style={s.welcomeTop}>
            <View style={{ flex:1 }}>
              <Text style={s.welcomeGreet}>{greeting}</Text>
              <Text style={s.welcomeName} numberOfLines={1}>{profile?.name || 'Transporter'}</Text>
              <Text style={s.welcomeTime}>Last updated {lastUpdated?.toLocaleTimeString?.() || '—'}</Text>
            </View>
            <Avatar uri={profile?.profileImage} name={profile?.name} size={60} />
          </View>
          <View style={s.welcomeDivider} />
          <View style={s.stripRow}>
            {[
              { v:stats.activeDrivers  || 0, l:'Drivers'    },
              { v:stats.ongoingTrips   || 0, l:'Live Trips' },
              { v:stats.completedTrips || 0, l:'Completed'  },
            ].map((item, i, arr) => (
              <React.Fragment key={i}>
                <View style={s.stripTile}>
                  <Text style={s.stripVal}>{item.v}</Text>
                  <Text style={s.stripLbl}>{item.l}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.stripDiv} />}
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>
      </View>

      {totalBadge > 0 && (
        <TouchableOpacity style={s.alertBanner} onPress={() => nav('notifications')} activeOpacity={0.85}>
          <View style={s.alertIconBox}><Ionicons name="notifications-outline" size={18} color={P.main} /></View>
          <Text style={s.alertTxt}>{totalBadge} item{totalBadge !== 1 ? 's' : ''} need attention</Text>
          <Ionicons name="chevron-forward" size={16} color={P.main} />
        </TouchableOpacity>
      )}

      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>Fleet Overview</Text>
        <Text style={s.sectionHint}>Tap tiles to view details</Text>
      </View>

      <View style={s.statsGrid}>
        {STATS.map((st, i) => (
          <StatTile
            key={i}
            icon={st.icon}
            iconBg={st.iconBg}
            iconColor={st.iconColor}
            label={st.label}
            value={st.value}
            onPress={() => st.modalType ? openModal(st.modalType) : nav(st.sec)}
          />
        ))}
      </View>

      <View style={s.sectionHeader}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={s.quickGrid}>
        {QUICK.map(q => <QuickBtn key={q.sec} icon={q.icon} label={q.label} onPress={() => nav(q.sec)} />)}
      </View>

      {driverReqs.length > 0 && (
        <TouchableOpacity style={s.pendingBanner} onPress={() => nav('requests')} activeOpacity={0.85}>
          <View style={[s.pendingDot, { backgroundColor: P.warn }]} />
          <Text style={s.pendingTxt}>{driverReqs.length} pending driver request{driverReqs.length !== 1 ? 's' : ''}</Text>
          <Ionicons name="chevron-forward" size={15} color={P.main} />
        </TouchableOpacity>
      )}
      {passReqs.length > 0 && (
        <TouchableOpacity style={s.pendingBanner} onPress={() => nav('requests')} activeOpacity={0.85}>
          <View style={[s.pendingDot, { backgroundColor: P.main }]} />
          <Text style={s.pendingTxt}>{passReqs.length} pending passenger request{passReqs.length !== 1 ? 's' : ''}</Text>
          <Ionicons name="chevron-forward" size={15} color={P.main} />
        </TouchableOpacity>
      )}
      {smartResults.length > 0 && (
        <TouchableOpacity style={[s.pendingBanner, { borderColor: P.info + '40' }]} onPress={() => nav('smart-route')} activeOpacity={0.85}>
          <View style={[s.pendingDot, { backgroundColor: P.info }]} />
          <Text style={s.pendingTxt}>{smartResults.length} smart route{smartResults.length !== 1 ? 's' : ''} ready to confirm</Text>
          <Ionicons name="chevron-forward" size={15} color={P.main} />
        </TouchableOpacity>
      )}

      {modal && (
        <DetailModal
          visible={!!modal}
          onClose={() => setModal(null)}
          title={modalConfig[modal]?.title}
          icon={modalConfig[modal]?.icon}
          emptyText={modalConfig[modal]?.emptyText}
          data={mData}
          loading={mLoad}
          renderItem={({ item }) => {
            if (modal === 'drivers')    return <DriverRow driver={item} />;
            if (modal === 'passengers') return <PassengerRow passenger={item} />;
            if (modal === 'trips')      return <TripRow trip={item} />;
            return null;
          }}
        />
      )}
    </ScrollView>
  );
};

export default OverviewSection;

const CARD_W = '48%';

const s = StyleSheet.create({
  scrollContent: { paddingBottom:30 },
  welcomeCard: {
    marginHorizontal:16, marginTop:16, borderRadius:22, overflow:'hidden',
    ...Platform.select({ ios:{ shadowColor:P.dark, shadowOpacity:0.22, shadowRadius:14, shadowOffset:{ width:0, height:5 } }, android:{ elevation:6 } }),
  },
  welcomeGrad:    { padding:18, paddingBottom:0 },
  welcomeTop:     { flexDirection:'row', alignItems:'center', marginBottom:16 },
  welcomeGreet:   { fontSize:13, color:'rgba(255,255,255,0.8)', fontWeight:'600', marginBottom:4 },
  welcomeName:    { fontSize:22, fontWeight:'900', color:P.white },
  welcomeTime:    { fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:4 },
  welcomeDivider: { height:1, backgroundColor:'rgba(255,255,255,0.15)', marginBottom:14 },
  stripRow:  { flexDirection:'row', paddingBottom:18 },
  stripTile: { flex:1, alignItems:'center' },
  stripVal:  { fontSize:24, fontWeight:'900', color:P.white },
  stripLbl:  { fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'600', marginTop:3 },
  stripDiv:  { width:1, backgroundColor:'rgba(255,255,255,0.2)', marginVertical:6 },
  alertBanner:  { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginTop:14, padding:13, backgroundColor:P.light, borderRadius:14, borderWidth:1, borderColor:P.border },
  alertIconBox: { width:34, height:34, borderRadius:9, backgroundColor:P.white, alignItems:'center', justifyContent:'center' },
  alertTxt:     { flex:1, fontSize:13, color:P.dark, fontWeight:'700' },
  sectionHeader: { flexDirection:'row', alignItems:'center', marginHorizontal:16, marginTop:22, marginBottom:12 },
  sectionAccent: { width:4, height:20, borderRadius:2, backgroundColor:P.main, marginRight:10 },
  sectionTitle:  { fontSize:16, fontWeight:'900', color:P.dark, flex:1 },
  sectionHint:   { fontSize:11, color:P.textMuted, fontStyle:'italic' },
  statsGrid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10 },
  statTile: {
    width:CARD_W, flexGrow:1, backgroundColor:P.cardBg, borderRadius:16,
    padding:14, alignItems:'flex-start', borderWidth:1, borderColor:P.border,
    ...Platform.select({ ios:{ shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, shadowOffset:{ width:0, height:2 } }, android:{ elevation:2 } }),
  },
  statIconBox: { width:40, height:40, borderRadius:11, alignItems:'center', justifyContent:'center', marginBottom:10 },
  statValue:   { fontSize:26, fontWeight:'900', marginBottom:3 },
  statLabel:   { fontSize:11, color:P.textMuted, fontWeight:'600' },
  tapHint:     { marginTop:8, borderWidth:1, borderRadius:6, paddingHorizontal:7, paddingVertical:3 },
  tapHintTxt:  { fontSize:9, fontWeight:'700' },
  quickGrid: { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:16, gap:10 },
  quickBtn: {
    width:CARD_W, flexGrow:1, backgroundColor:P.cardBg, borderRadius:16,
    padding:16, alignItems:'center', borderWidth:1, borderColor:P.border,
    ...Platform.select({ ios:{ shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{ width:0, height:2 } }, android:{ elevation:1 } }),
  },
  quickIconBox: { width:52, height:52, borderRadius:15, backgroundColor:P.light, alignItems:'center', justifyContent:'center', marginBottom:9 },
  quickLabel:   { fontSize:13, fontWeight:'700', color:P.textDark, textAlign:'center' },
  pendingBanner: { flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginTop:10, padding:13, backgroundColor:P.cardBg, borderRadius:12, borderWidth:1, borderColor:P.border },
  pendingDot:    { width:8, height:8, borderRadius:4 },
  pendingTxt:    { flex:1, fontSize:13, color:P.textDark, fontWeight:'600' },
});

const m = StyleSheet.create({
  root:   { flex:1, backgroundColor:P.bg },
  header: { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingTop:Platform.OS === 'ios' ? 54 : 40, paddingBottom:14, gap:10 },
  closeBtn:     { width:38, height:38, borderRadius:10, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' },
  headerCenter: { flex:1, alignItems:'center' },
  headerTitle:  { fontSize:17, fontWeight:'800', color:P.white },
  center:     { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  loadingTxt: { fontSize:13, color:P.textMuted },
  empty:      { flex:1, alignItems:'center', justifyContent:'center', gap:12, paddingHorizontal:40 },
  emptyTxt:   { fontSize:14, color:P.textMuted, textAlign:'center' },
  card: {
    flexDirection:'row', alignItems:'center', gap:12,
    backgroundColor:P.cardBg, borderRadius:14, padding:13, marginBottom:10,
    borderWidth:1, borderColor:P.border,
    ...Platform.select({ ios:{ shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, shadowOffset:{ width:0, height:1 } }, android:{ elevation:1 } }),
  },
  av:    { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  avTxt: { fontSize:14, fontWeight:'900', color:P.white },
  cardName: { fontSize:14, fontWeight:'700', color:P.textDark },
  cardSub:  { fontSize:12, color:P.textLight, marginTop:2 },
  cardMeta: { fontSize:11, color:P.textMuted, marginTop:3 },
  statusPill: { flexDirection:'row', alignItems:'center', gap:4, borderRadius:10, paddingHorizontal:9, paddingVertical:5 },
  statusDot:  { width:6, height:6, borderRadius:3 },
  statusTxt:  { fontSize:11, fontWeight:'700' },
});