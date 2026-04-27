// frontend/Passenger/src/screens/profile/ProfileScreen.js
// ✅ UPDATED: GPS + Search location (same as registration), matching validation
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, Platform,
  Modal, FlatList,
} from 'react-native';
import { Ionicons }       from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage       from '@react-native-async-storage/async-storage';
import * as Location     from 'expo-location';

const API_BASE       = 'https://raahi-q2ur.onrender.com/api';
const GOOGLE_API_KEY = 'AIzaSyAURA_WOTStUtf3-nnDUR88jeBr6qSejFs';

const G = {
  main:'#415844', dark:'#2D3E2F', light:'#EDF1ED', accent:'#69F0AE',
  white:'#FFFFFF', bg:'#F5F7F5', card:'#FFFFFF',
  border:'#C5D0C5', div:'#E5EBE5',
  tDark:'#1A2218', tMid:'#374151', tLight:'#6B7280', tMuted:'#9CA3AF',
  success:'#2E7D32', sBg:'#E8F5E9', error:'#C62828', eBg:'#FFEBEE', warn:'#E65100',
};

// ── Validation (same as PassengerRegisterScreen) ─────────────────────────────
const RULES = {
  name: v => {
    const s = (v||'').trim();
    if (!s)                        return 'Full name is required.';
    if (s.length < 3)              return 'At least 3 characters required.';
    if (/\d/.test(s))              return 'Name must not contain numbers.';
    if (!/^[a-zA-Z\u0600-\u06FF\s]+$/.test(s)) return 'Only letters and spaces allowed.';
    return null;
  },
  phone: v => {
    const s = (v||'').trim().replace(/[\s\-\(\)]/g,'');
    if (!s)                             return 'Phone number is required.';
    if (!/^[\+]?[0-9]{7,15}$/.test(s)) return 'Enter a valid phone number (e.g. +92 3XX XXXXXXX).';
    return null;
  },
  address: v => {
    const s = (v||'').trim();
    if (!s || s.length < 5) return 'Address is required — use GPS or Search.';
    return null;
  },
  pickupPoint: v => {
    if (!(v||'').trim()) return 'Pickup point is required.';
    return null;
  },
  destination: v => {
    if (!(v||'').trim()) return 'Destination is required.';
    return null;
  },
  city: v => {
    if (!(v||'').trim()) return 'City could not be detected — please type it manually.';
    return null;
  },
  country: v => {
    if (!(v||'').trim()) return 'Country could not be detected — please type it manually.';
    return null;
  },
};

const PASS_FIELDS = [
  { key:'name',        label:'Full Name',    icon:'person-outline',   keyboard:'default'   },
  { key:'phone',       label:'Phone',        icon:'call-outline',     keyboard:'phone-pad' },
  { key:'pickupPoint', label:'Pickup Point', icon:'navigate-outline', keyboard:'default'   },
  { key:'destination', label:'Destination',  icon:'flag-outline',     keyboard:'default'   },
];

const VEHICLE_OPTS = ['car','van','bus'];

const ini  = (n='') => (n||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)||'?';
const fmtD = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
const cap  = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : '—';
const smSt = s => ({
  active:  {color:G.success, label:'Active'},
  inactive:{color:G.error,   label:'Inactive'},
  pending: {color:G.warn,    label:'Pending'},
}[(s||'').toLowerCase()] || {color:G.tMuted, label:s||'Active'});

const Card = ({icon,title,children}) => (
  <View style={s.card}>
    <View style={s.cardHead}>
      <View style={s.cardHIcon}><Ionicons name={icon} size={15} color={G.main}/></View>
      <Text style={s.cardHTxt}>{title}</Text>
    </View>
    {children}
  </View>
);

const Row = ({icon,label,value,last}) => (
  <View style={[s.row, last&&{borderBottomWidth:0}]}>
    <View style={s.rowIcon}><Ionicons name={icon} size={14} color={G.main}/></View>
    <View style={{flex:1,minWidth:0}}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowVal} numberOfLines={2}>{value||'—'}</Text>
    </View>
  </View>
);

const Field = ({label, value, onChange, keyboard, icon, error}) => (
  <View style={s.fWrap}>
    <View style={s.fLabelRow}>
      <Ionicons name={icon} size={11} color={error ? G.error : G.main}/>
      <Text style={[s.fLabel, error && {color:G.error}]}>{label}</Text>
    </View>
    <TextInput
      style={[s.input, error && s.inputErr]}
      value={value||''}
      onChangeText={onChange}
      placeholder={'Enter '+label.toLowerCase()}
      placeholderTextColor={G.tMuted}
      keyboardType={keyboard||'default'}
      autoCapitalize={keyboard==='phone-pad'?'none':'sentences'}
    />
    {!!error && (
      <View style={s.errRow}>
        <Ionicons name="alert-circle-outline" size={12} color={G.error}/>
        <Text style={s.errTxt}>{error}</Text>
      </View>
    )}
  </View>
);

export default function PassengerProfileScreen({ refreshing, onRefresh }) {
  const [profile,   setProfile]   = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData,  setEditData]  = useState({});
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [loadErr,   setLoadErr]   = useState(null);

  // ── Location states ───────────────────────────────────────────────────────
  const [locationCoords, setLocationCoords] = useState(null);
  const [address,        setAddress]        = useState('');
  const [city,           setCity]           = useState('');
  const [country,        setCountry]        = useState('');
  const [zone,           setZone]           = useState('');
  const [modalVisible,   setModalVisible]   = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searching,      setSearching]      = useState(false);

  const tokenRef = useRef(null);
  const mounted  = useRef(true);

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  const getToken = async () => {
    for (const k of ['authToken','userToken','token']) {
      try { const v = await AsyncStorage.getItem(k); if (v) return v; } catch {}
    }
    return null;
  };

  const load = async () => {
    if (!mounted.current) return;
    setLoading(true); setLoadErr(null);
    try {
      const token = await getToken();
      if (!token) { setLoadErr('Not logged in.'); setLoading(false); return; }
      tokenRef.current = token;
      const res  = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!mounted.current) return;
      if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
      const data = json.user || json.data || json;
      setProfile(data);
    } catch(e) {
      if (mounted.current) setLoadErr(e.message || 'Could not load profile.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const startEdit = () => {
    setEditData({
      name:              profile.name              || '',
      phone:             profile.phone             || '',
      pickupPoint:       profile.pickupPoint       || '',
      destination:       profile.destination       || '',
      vehiclePreference: profile.vehiclePreference || null,
    });
    setAddress(profile.address  || '');
    setCity(profile.city        || '');
    setCountry(profile.country  || '');
    setZone(profile.zone        || '');
    setLocationCoords(
      profile.latitude && profile.longitude
        ? { latitude: profile.latitude, longitude: profile.longitude }
        : null
    );
    setErrors({});
    setIsEditing(true);
  };

  const sf = (k, v) => {
    setEditData(p => ({ ...p, [k]: v }));
    if (RULES[k]) {
      const msg = RULES[k](v);
      setErrors(p => ({ ...p, [k]: msg || undefined }));
    }
  };

  const clearErr = (k) => setErrors(p => { const e={...p}; delete e[k]; return e; });

  const runValidation = () => {
    const errs = {};
    ['name','phone','pickupPoint','destination'].forEach(k => {
      if (RULES[k]) { const m = RULES[k](editData[k]); if (m) errs[k] = m; }
    });
    const addrErr    = RULES.address(address);    if (addrErr)    errs.address = addrErr;
    const cityErr    = RULES.city(city);          if (cityErr)    errs.city    = cityErr;
    const countryErr = RULES.country(country);    if (countryErr) errs.country = countryErr;
    return errs;
  };

  const save = async () => {
    const errs = runValidation();
    if (Object.keys(errs).length) {
      setErrors(errs);
      Alert.alert('Fix Errors', 'Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const token = tokenRef.current || await getToken();
      if (!token) throw new Error('Not authenticated.');
      const payload = {
        ...editData,
        address,
        city,
        country,
        zone,
        latitude:  locationCoords?.latitude  || null,
        longitude: locationCoords?.longitude || null,
      };
      const res  = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Update failed');
      setProfile(prev => ({ ...prev, ...(json.user || json.data || json), address, city, country, zone }));
      setIsEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch(e) { Alert.alert('Error', e.message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  // ── GPS Current Location ──────────────────────────────────────────────────
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
          const comps = d.results[0].address_components || [];
          const get = (type) => comps.find(c => c.types.includes(type))?.long_name || '';
          const parsedCity    = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2');
          const parsedCountry = get('country');
          const parsedZone    = get('administrative_area_level_1');
          if (parsedCity)    { setCity(parsedCity);       clearErr('city');    }
          if (parsedCountry) { setCountry(parsedCountry); clearErr('country'); }
          if (parsedZone)    setZone(parsedZone);
        }
      } catch {}
      setLocationCoords(coords);
      setAddress(resolvedAddress);
      clearErr('address');
      Alert.alert('✅ Location Set', resolvedAddress);
    } catch { Alert.alert('Error', 'Failed to get current location. Try Search.'); }
  };

  // ── Search Location ───────────────────────────────────────────────────────
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
        setLocationCoords({ latitude: lat, longitude: lng });
        setAddress(description);
        const comps = d.result.address_components || [];
        const get = (type) => comps.find(c => c.types.includes(type))?.long_name || '';
        const parsedCity    = get('locality') || get('sublocality_level_1') || get('administrative_area_level_2');
        const parsedCountry = get('country');
        const parsedZone    = get('administrative_area_level_1');
        if (parsedCity)    { setCity(parsedCity);       clearErr('city');    }
        if (parsedCountry) { setCountry(parsedCountry); clearErr('country'); }
        if (parsedZone)    setZone(parsedZone);
        clearErr('address');
        setModalVisible(false); setSearchQuery(''); setSearchResults([]);
        Alert.alert('✅ Location Selected', description);
      }
    } catch { Alert.alert('Error', 'Failed to get place details.'); }
  };

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={G.main}/>
      <Text style={s.loadTxt}>Loading profile...</Text>
    </View>
  );

  if (loadErr) return (
    <View style={s.center}>
      <Ionicons name="alert-circle-outline" size={48} color={G.error}/>
      <Text style={[s.loadTxt,{color:G.error,marginTop:12}]}>{loadErr}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}><Text style={s.retryTxt}>Retry</Text></TouchableOpacity>
    </View>
  );

  const sm = smSt(profile.status);

  return (
    <>
      <ScrollView style={{flex:1,backgroundColor:G.bg}} contentContainerStyle={{paddingBottom:40}}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{load();onRefresh?.();}} colors={[G.main]} tintColor={G.main}/>}>

        <LinearGradient colors={[G.main,G.dark]} style={s.avatarBlock}>
          <View style={s.avatarRing}>
            <LinearGradient colors={['rgba(255,255,255,0.25)','rgba(255,255,255,0.1)']} style={s.avatar}>
              <Text style={s.avatarTxt}>{ini(profile.name)}</Text>
            </LinearGradient>
          </View>
          <Text style={s.heroName}>{profile.name||'Passenger'}</Text>
          <Text style={s.heroEmail}>{profile.email||'—'}</Text>
          <View style={[s.statusPill,{backgroundColor:'rgba(105,240,174,0.18)',borderColor:'rgba(105,240,174,0.35)'}]}>
            <View style={[s.statusDot,{backgroundColor:G.accent}]}/>
            <Text style={[s.statusTxt,{color:G.accent}]}>{sm.label}</Text>
          </View>
        </LinearGradient>

        <View style={s.statsRow}>
          {[
            {val:profile.phone,             color:G.main,    label:'Phone'},
            {val:profile.vehiclePreference, color:'#2196F3', label:'Vehicle'},
            {val:profile.registrationDate ? fmtD(profile.registrationDate).split(' ').slice(1).join(' ') : '—', color:'#FF9800', label:'Joined'},
            {val:profile.preferredTimeSlot, color:'#4CAF50', label:'Time Slot'},
          ].map((item,i,arr) => (
            <React.Fragment key={i}>
              <View style={s.statItem}>
                <Text style={[s.statVal,{color:item.color,fontSize:11}]} numberOfLines={1}>{item.val||'—'}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
              {i < arr.length-1 && <View style={s.statDiv}/>}
            </React.Fragment>
          ))}
        </View>

        {!isEditing && (<>
          <Card icon="person-circle-outline" title="Personal Information">
            <Row icon="person-outline"   label="Full Name" value={profile.name}    />
            <Row icon="mail-outline"     label="Email"     value={profile.email}   />
            <Row icon="call-outline"     label="Phone"     value={profile.phone}   />
            <Row icon="location-outline" label="Address"   value={profile.address} last/>
          </Card>
          <Card icon="map-outline" title="Location">
            <Row icon="globe-outline"    label="Country" value={profile.country}/>
            <Row icon="business-outline" label="City"    value={profile.city}/>
            <Row icon="map-outline"      label="Zone"    value={profile.zone} last/>
          </Card>
          <Card icon="navigate-outline" title="Travel Preferences">
            <Row icon="navigate-outline" label="Pickup Point"       value={profile.pickupPoint}/>
            <Row icon="flag-outline"     label="Destination"        value={profile.destination}/>
            <Row icon="time-outline"     label="Preferred Time"     value={profile.preferredTimeSlot}/>
            <Row icon="car-outline"      label="Vehicle Preference" value={profile.vehiclePreference ? cap(profile.vehiclePreference) : '—'} last/>
          </Card>
          <TouchableOpacity style={s.editBtn} onPress={startEdit} activeOpacity={0.85}>
            <LinearGradient colors={[G.main,G.dark]} style={s.editBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
              <Ionicons name="pencil-outline" size={15} color={G.white}/>
              <Text style={s.editBtnTxt}>Edit Profile</Text>
            </LinearGradient>
          </TouchableOpacity>
        </>)}

        {isEditing && (<>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={s.cardHIcon}><Ionicons name="pencil-outline" size={15} color={G.main}/></View>
              <Text style={s.cardHTxt}>Edit Profile</Text>
            </View>
            <View style={{padding:14}}>
              {Object.values(errors).some(Boolean) && (
                <View style={s.summaryBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={G.error}/>
                  <Text style={s.summaryTxt}>Please enter the correct information</Text>
                </View>
              )}

              {PASS_FIELDS.map(f => (
                <Field key={f.key} label={f.label} value={editData[f.key]}
                  onChange={v=>sf(f.key,v)} keyboard={f.keyboard} icon={f.icon} error={errors[f.key]}/>
              ))}

              {/* Vehicle Preference */}
              <View style={s.fWrap}>
                <View style={s.fLabelRow}><Ionicons name="car-outline" size={11} color={G.main}/><Text style={s.fLabel}>Vehicle Preference</Text></View>
                <View style={s.vpRow}>
                  {VEHICLE_OPTS.map(v => {
                    const sel = editData.vehiclePreference === v;
                    return (
                      <TouchableOpacity key={v} style={[s.vpChip, sel&&s.vpChipSel]}
                        onPress={()=>sf('vehiclePreference', sel ? null : v)} activeOpacity={0.8}>
                        <Ionicons name={v==='bus'?'trail-sign-outline':v==='van'?'bus-outline':'car-outline'} size={13} color={sel?G.white:G.main}/>
                        <Text style={[s.vpTxt, sel&&{color:G.white}]}>{cap(v)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Location Picker ── */}
              <View style={s.fWrap}>
                <View style={s.fLabelRow}>
                  <Ionicons name="location-outline" size={11} color={errors.address ? G.error : G.main}/>
                  <Text style={[s.fLabel, errors.address && {color:G.error}]}>Location / Address</Text>
                </View>
                <View style={[s.locationBox, !!errors.address && {borderColor:G.error}]}>
                  {locationCoords ? (
                    <View style={s.locationRow}>
                      <Ionicons name="checkmark-circle" size={16} color={G.main}/>
                      <Text style={s.locationTxt} numberOfLines={2}>{address}</Text>
                    </View>
                  ) : (
                    <Text style={s.locationEmpty}>{address || 'No location selected'}</Text>
                  )}
                  <View style={s.locationBtns}>
                    <TouchableOpacity style={s.locationBtn} onPress={getCurrentLocation}>
                      <Ionicons name="navigate-outline" size={13} color="#fff"/>
                      <Text style={s.locationBtnTxt}>Current</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.locationBtn,{borderLeftWidth:1,borderLeftColor:'rgba(255,255,255,0.3)'}]} onPress={()=>setModalVisible(true)}>
                      <Ionicons name="search-outline" size={13} color="#fff"/>
                      <Text style={s.locationBtnTxt}>Search</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {!!errors.address && <View style={s.errRow}><Ionicons name="alert-circle-outline" size={12} color={G.error}/><Text style={s.errTxt}>{errors.address}</Text></View>}
              </View>

              <Field icon="globe-outline"    label="Country"     value={country} onChange={v=>{setCountry(v);clearErr('country');}} error={errors.country}/>
              <Field icon="business-outline" label="City"        value={city}    onChange={v=>{setCity(v);   clearErr('city');   }} error={errors.city}/>
              <Field icon="map-outline"      label="Zone/Region" value={zone}    onChange={v=>setZone(v)}/>
            </View>
          </View>

          <View style={s.formBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={()=>{setIsEditing(false);setErrors({});}}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving&&{opacity:0.5}]}
              onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={G.white}/> : <Text style={s.saveTxt}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </>)}
      </ScrollView>

      {/* Search Location Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={()=>setModalVisible(false)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle}/>
            <Text style={s.sheetTitle}>Search Location</Text>
            <View style={s.sheetSearchRow}>
              <Ionicons name="search-outline" size={16} color={G.main}/>
              <TextInput
                style={s.sheetInput}
                placeholder="Search area, street or landmark…"
                placeholderTextColor={G.tMuted}
                value={searchQuery}
                onChangeText={t=>{setSearchQuery(t);searchLocation(t);}}
                autoFocus
              />
              {searching && <ActivityIndicator size="small" color={G.main}/>}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item=>item.place_id}
              style={{maxHeight:300}}
              renderItem={({item})=>(
                <TouchableOpacity style={s.resultRow} onPress={()=>pickPlace(item.place_id,item.description)}>
                  <Ionicons name="location-outline" size={14} color={G.main} style={{marginRight:8}}/>
                  <Text style={{flex:1,fontSize:13,color:G.tDark}}>{item.description}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={s.searchEmptyTxt}>{searchQuery.length>=3?'No results':'Start typing to search…'}</Text>}
            />
            <TouchableOpacity style={s.closeModalBtn} onPress={()=>setModalVisible(false)}>
              <Text style={s.closeModalTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  center:{flex:1,justifyContent:'center',alignItems:'center',paddingVertical:60},
  loadTxt:{marginTop:12,color:G.tMuted,fontSize:14,textAlign:'center'},
  retryBtn:{marginTop:16,paddingHorizontal:24,paddingVertical:10,borderRadius:10,backgroundColor:G.main},
  retryTxt:{color:G.white,fontWeight:'700',fontSize:14},
  avatarBlock:{alignItems:'center',paddingTop:28,paddingBottom:26},
  avatarRing:{width:88,height:88,borderRadius:44,borderWidth:3,borderColor:'rgba(255,255,255,0.45)',overflow:'hidden',marginBottom:14},
  avatar:{flex:1,alignItems:'center',justifyContent:'center'},
  avatarTxt:{fontSize:30,fontWeight:'800',color:G.white},
  heroName:{fontSize:20,fontWeight:'800',color:G.white,marginBottom:4},
  heroEmail:{fontSize:13,color:'rgba(255,255,255,0.65)',marginBottom:12},
  statusPill:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:5,borderRadius:20,borderWidth:1},
  statusDot:{width:7,height:7,borderRadius:4},
  statusTxt:{fontSize:12,fontWeight:'600'},
  statsRow:{flexDirection:'row',backgroundColor:G.card,marginHorizontal:14,marginTop:12,marginBottom:12,borderRadius:14,paddingVertical:14,paddingHorizontal:8,borderWidth:0.5,borderColor:G.border,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,shadowOffset:{width:0,height:2}},android:{elevation:2}})},
  statItem:{flex:1,alignItems:'center',paddingHorizontal:2},
  statDiv:{width:1,backgroundColor:G.div,marginVertical:4},
  statVal:{fontSize:13,fontWeight:'800',marginBottom:3,textAlign:'center'},
  statLabel:{fontSize:9,color:G.tMuted,fontWeight:'500',textAlign:'center'},
  card:{backgroundColor:G.card,marginHorizontal:14,marginBottom:10,borderRadius:14,overflow:'hidden',borderWidth:0.5,borderColor:G.border,...Platform.select({ios:{shadowColor:'#000',shadowOpacity:0.05,shadowRadius:5,shadowOffset:{width:0,height:2}},android:{elevation:2}})},
  cardHead:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,paddingTop:13,paddingBottom:10,borderBottomWidth:0.5,borderBottomColor:G.div},
  cardHIcon:{width:30,height:30,borderRadius:8,backgroundColor:G.light,alignItems:'center',justifyContent:'center'},
  cardHTxt:{fontSize:13,fontWeight:'700',color:G.tDark},
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingVertical:11,borderBottomWidth:0.5,borderBottomColor:G.div},
  rowIcon:{width:30,height:30,borderRadius:8,backgroundColor:G.light,alignItems:'center',justifyContent:'center',marginRight:11,flexShrink:0},
  rowLabel:{fontSize:10,color:G.tMuted,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.3,marginBottom:2},
  rowVal:{fontSize:13,color:G.tDark,fontWeight:'400'},
  editBtn:{marginHorizontal:14,marginTop:2,marginBottom:10,borderRadius:13,overflow:'hidden'},
  editBtnGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14},
  editBtnTxt:{fontSize:14,fontWeight:'700',color:G.white},
  fWrap:{marginBottom:14},
  fLabelRow:{flexDirection:'row',alignItems:'center',gap:5,marginBottom:5},
  fLabel:{fontSize:10,fontWeight:'700',color:G.tLight,textTransform:'uppercase',letterSpacing:0.5},
  input:{backgroundColor:G.bg,borderRadius:10,borderWidth:1.5,borderColor:G.border,paddingHorizontal:13,paddingVertical:11,fontSize:13,color:G.tDark},
  inputErr:{borderColor:G.error,backgroundColor:G.eBg},
  errRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:4},
  errTxt:{fontSize:11,color:G.error,flex:1},
  summaryBox:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:G.eBg,padding:10,borderRadius:10,marginBottom:12,borderWidth:0.5,borderColor:G.error},
  summaryTxt:{fontSize:12,color:G.error,flex:1,fontWeight:'600'},
  vpRow:{flexDirection:'row',gap:8},
  vpChip:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:10,borderRadius:9,borderWidth:1.5,borderColor:G.border,backgroundColor:G.card},
  vpChipSel:{backgroundColor:G.main,borderColor:G.main},
  vpTxt:{fontSize:12,fontWeight:'700',color:G.main},
  formBtns:{flexDirection:'row',gap:8,marginHorizontal:14,marginBottom:10},
  cancelBtn:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:13,borderRadius:12,borderWidth:1.5,borderColor:G.border},
  cancelTxt:{fontSize:13,fontWeight:'600',color:G.tMid},
  saveBtn:{flex:2,alignItems:'center',justifyContent:'center',paddingVertical:13,borderRadius:12,backgroundColor:G.main},
  saveTxt:{fontSize:14,fontWeight:'700',color:G.white},
  locationBox:{backgroundColor:G.bg,borderRadius:10,borderWidth:1.5,borderColor:G.border,overflow:'hidden'},
  locationRow:{flexDirection:'row',alignItems:'flex-start',gap:8,padding:12,paddingBottom:8},
  locationTxt:{flex:1,fontSize:13,color:G.tMid,lineHeight:18},
  locationEmpty:{padding:14,fontSize:13,color:G.tMuted},
  locationBtns:{flexDirection:'row',borderTopWidth:1,borderTopColor:G.div},
  locationBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:9,gap:5,backgroundColor:G.main},
  locationBtnTxt:{fontSize:11,color:'#fff',fontWeight:'600'},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.38)',justifyContent:'flex-end'},
  modalSheet:{backgroundColor:G.card,borderTopLeftRadius:22,borderTopRightRadius:22,padding:20,maxHeight:'80%'},
  sheetHandle:{width:36,height:4,borderRadius:2,backgroundColor:G.div,alignSelf:'center',marginBottom:14},
  sheetTitle:{fontSize:15,fontWeight:'700',color:G.tDark,textAlign:'center',marginBottom:12},
  sheetSearchRow:{flexDirection:'row',alignItems:'center',backgroundColor:G.bg,borderRadius:12,borderWidth:1.5,borderColor:G.border,paddingHorizontal:13,paddingVertical:10,marginBottom:8,gap:8},
  sheetInput:{flex:1,fontSize:14,color:G.tDark},
  resultRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:G.bg},
  closeModalBtn:{marginTop:16,padding:14,backgroundColor:G.bg,borderRadius:12,alignItems:'center'},
  closeModalTxt:{fontWeight:'600',color:G.tMuted},
  searchEmptyTxt:{textAlign:'center',color:G.tMuted,marginTop:30,fontSize:13},
});