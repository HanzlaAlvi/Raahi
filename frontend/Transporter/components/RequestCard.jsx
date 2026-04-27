import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { s } from '../styles/styles';
import C from '../constants/colors';
import { VEHICLE_INFO } from '../constants/vehicles';

const RequestCard = ({ req, onAccept, onReject, isProcessing }) => {
  const vInfo = VEHICLE_INFO[req.vehicleType || req.vehicle_type] || null;
  const pInfo = VEHICLE_INFO[req.vehiclePreference || req.vehicle_preference] || null;

  return (
    <View style={s.card}>
      <View style={[s.cardAccentBar, { backgroundColor: req.type === 'driver' ? C.primaryDark : C.primary }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <View style={s.reqAvatar}>
          <Icon name={req.type === 'driver' ? 'directions-car' : 'person'} size={24} color={C.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{req.name || req.fullName}</Text>
          <View style={[s.chip, { marginTop: 4 }]}>
            <Text style={s.chipTxt}>{req.type === 'driver' ? 'Driver Request' : 'Passenger Request'}</Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 7, marginBottom: 12 }}>
        {req.email       && <View style={s.detailRow}><Icon name="email"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.email}</Text></View>}
        {req.phone       && <View style={s.detailRow}><Icon name="phone"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.phone}</Text></View>}
        {req.license     && <View style={s.detailRow}><Icon name="credit-card" size={14} color={C.primaryDark} /><Text style={s.detailTxt}>License: {req.license}</Text></View>}
        {req.pickupPoint && <View style={s.detailRow}><Icon name="place"       size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.pickupPoint}</Text></View>}
        {req.destination && <View style={s.detailRow}><Icon name="flag"        size={14} color={C.primaryDark} /><Text style={s.detailTxt}>{req.destination}</Text></View>}
      </View>
      {vInfo && (
        <View style={s.vBadge}>
          <Icon
            name={req.vehicleType === 'car' ? 'directions-car' : req.vehicleType === 'bus' ? 'directions-bus' : 'airport-shuttle'}
            size={22} color={C.primaryDark}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={s.vBadgeLbl}>VEHICLE TYPE</Text>
            <Text style={s.vBadgeVal}>{vInfo.label} — {vInfo.desc}</Text>
          </View>
        </View>
      )}
      {pInfo && (
        <View style={[s.vBadge, { marginTop: 8, backgroundColor: C.successLight, borderColor: C.success }]}>
          <Icon
            name={pInfo.label === 'Car' ? 'directions-car' : pInfo.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'}
            size={22} color={C.success}
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={[s.vBadgeLbl, { color: C.success }]}>
              {pInfo.label === 'Car' ? 'TRAVEL PREFERENCE — STRICT' : 'TRAVEL PREFERENCE — FLEXIBLE'}
            </Text>
            <Text style={[s.vBadgeVal, { color: C.success }]}>
              {pInfo.label === 'Car'
                ? 'Car only — never reassigned to van/bus'
                : `${pInfo.label} preferred — may flex to ${pInfo.label === 'Van' ? 'bus' : 'van'}`}
            </Text>
          </View>
        </View>
      )}
      <View style={s.twoBtn}>
        <TouchableOpacity style={s.rejectBtn} onPress={onReject} disabled={isProcessing}>
          <Icon name="close" size={16} color={C.white} />
          <Text style={s.btnTxt}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.acceptBtn} onPress={onAccept} disabled={isProcessing}>
          {isProcessing
            ? <ActivityIndicator size="small" color={C.black} />
            : <><Icon name="check" size={16} color={C.black} /><Text style={[s.btnTxt, { color: C.black }]}>Accept</Text></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default RequestCard;