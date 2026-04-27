import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { s } from '../styles/styles';
import C from '../constants/colors';
import { VEHICLE_INFO, VEHICLE_CAPS } from '../constants/vehicles';

const DriverCard = ({ driver, compact = false }) => {
  const vi   = VEHICLE_INFO[driver.vehicleType || driver.vehicle] || VEHICLE_INFO.van;
  const cap  = vi.capacity || driver.capacity || 8;
  const fill = driver.passengers?.length || 0;
  const pct  = Math.min((fill / cap) * 100, 100);

  return (
    <View style={[
      s.driverCard,
      compact && { flex: 1, marginBottom: 0, borderWidth: 0, elevation: 0, shadowOpacity: 0, padding: 0, backgroundColor: 'transparent' },
    ]}>
      <View style={s.driverAvatar}>
        <Text style={s.driverAvatarTxt}>
          {(driver.name || 'D').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </Text>
        <View style={[s.driverDot, { backgroundColor: driver.status === 'active' ? C.success : C.border }]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.driverName} numberOfLines={1}>{driver.name}</Text>
          <Icon
            name={vi.label === 'Car' ? 'directions-car' : vi.label === 'Bus' ? 'directions-bus' : 'airport-shuttle'}
            size={18}
            color={C.primaryDark}
          />
        </View>
        <Text style={s.driverSub}>{vi.label} · cap {cap}</Text>
        <View style={s.capRow}>
          <Text style={s.capTxt}>{fill}/{cap}</Text>
          <View style={s.capBg}>
            <View style={[s.capFill, { width: `${pct}%`, backgroundColor: pct > 80 ? C.error : C.primary }]} />
          </View>
        </View>
        {driver.phone && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Icon name="phone" size={11} color={C.textLight} />
            <Text style={{ fontSize: 11, color: C.textLight }}>{driver.phone}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default DriverCard;