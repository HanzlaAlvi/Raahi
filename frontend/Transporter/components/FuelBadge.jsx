import React from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { s } from '../styles/styles';
import C from '../constants/colors';
import { PK_FUEL } from '../constants/fuels';
import { VEHICLE_INFO } from '../constants/vehicles';
import { fmtPKR } from '../utils/formatters';

const FuelBadge = ({ fuelType, fuelCostPKR, estimatedFuel, estimatedKm, vehicleType }) => {
  const isDiesel    = fuelType === 'diesel';
  const consumption = PK_FUEL.consumption[vehicleType] || (isDiesel ? 15 : 12);
  const pricePerL   = PK_FUEL.pricePerLitre[fuelType] || (isDiesel ? 283 : 278);

  return (
    <View style={s.fuelBadge}>
      <View style={s.fuelIconBox}>
        <Icon name="local-gas-station" size={20} color={C.primaryDark} />
      </View>
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={s.fuelBadgeType}>{isDiesel ? 'Diesel' : 'Petrol'} — {VEHICLE_INFO[vehicleType]?.label || vehicleType}</Text>
        <Text style={s.fuelBadgeVal}>
          {estimatedFuel}
          {fuelCostPKR ? ` · ${typeof fuelCostPKR === 'string' ? fuelCostPKR : fmtPKR(fuelCostPKR)}` : ''}
        </Text>
        <Text style={s.fuelBadgeNote}>Rs.{pricePerL}/L · {consumption}L per 100km</Text>
      </View>
    </View>
  );
};

export default FuelBadge;