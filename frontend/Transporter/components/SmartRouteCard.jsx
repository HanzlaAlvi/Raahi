import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { s } from '../styles/styles';
import C from '../constants/colors';
import { VEHICLE_INFO } from '../constants/vehicles';
import { PK_FUEL } from '../constants/fuels';
import { prefLabel } from '../utils/formatters';
import FuelBadge from './FuelBadge';

const SmartRouteCard = ({ result, onConfirm, onDiscard, isConfirming }) => {
  const [expanded, setExpanded] = useState(false);
  const vi = VEHICLE_INFO[result.vehicleType] || VEHICLE_INFO.van;

  const prefSummary = useMemo(() => {
    const counts = {};
    (result.passengers || []).forEach(p => {
      const pref = p.vehiclePreference || 'auto';
      counts[pref] = (counts[pref] || 0) + 1;
    });
    return counts;
  }, [result.passengers]);

  const vehicleIcon = result.vehicleType === 'car'
    ? 'directions-car' : result.vehicleType === 'bus'
    ? 'directions-bus' : 'airport-shuttle';

  return (
    <View style={s.card}>
      <View style={[s.cardAccentBar, { backgroundColor: C.primary }]} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <View style={s.vIconWrap}>
          <Icon name={vehicleIcon} size={24} color={C.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {vi.label} Route — {result.passengerCount}/{result.capacity} passengers
          </Text>
          <Text style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{result.areaLabel || 'Route'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            <View style={s.chip}><Text style={s.chipTxt}>{vi.label} · cap {vi.capacity}</Text></View>
            <View style={[s.chip, { backgroundColor: C.warningLight, borderColor: C.warning }]}>
              <Text style={[s.chipTxt, { color: C.warning }]}>Needs Driver</Text>
            </View>
            {result.preferenceGroup && (
              <View style={[s.chip, { backgroundColor: C.successLight, borderColor: C.success }]}>
                <Text style={[s.chipTxt, { color: C.success }]}>Preference Route</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {Object.keys(prefSummary).length > 0 && (
        <View style={s.prefBreakdown}>
          <Text style={s.prefBreakdownLabel}>PASSENGER PREFERENCES</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
            {Object.entries(prefSummary).map(([pref, count]) => {
              const isStrict = pref === 'car';
              const isAuto   = pref === 'auto';
              return (
                <View key={pref} style={[s.prefChip, {
                  backgroundColor: isStrict ? '#FFF3E0' : isAuto ? C.offWhite : C.primaryGhost,
                  borderColor:     isStrict ? '#FF9800' : isAuto ? C.divider  : C.border,
                }]}>
                  <Icon
                    name={isStrict ? 'directions-car' : isAuto ? 'shuffle' : pref === 'bus' ? 'directions-bus' : 'airport-shuttle'}
                    size={12}
                    color={isStrict ? '#E65100' : isAuto ? C.textLight : C.primaryDark}
                  />
                  <Text style={[s.prefChipTxt, { color: isStrict ? '#E65100' : isAuto ? C.textLight : C.primaryDark }]}>
                    {prefLabel(pref, count)}
                  </Text>
                </View>
              );
            })}
            <View style={[s.prefChip, { backgroundColor: C.primaryPale, borderColor: C.primary }]}>
              <Icon name={vehicleIcon} size={12} color={C.primaryDark} />
              <Text style={[s.prefChipTxt, { color: C.primaryDark }]}>Assigned: {vi.label}</Text>
            </View>
          </View>
        </View>
      )}

      {result.warning && (
        <View style={s.warnBox}>
          <Icon name="warning" size={14} color={C.warning} />
          <Text style={s.warnTxt}>{result.warning}</Text>
        </View>
      )}

      {result.destination && (
        <View style={[s.detailRow, { backgroundColor: C.primaryGhost, borderRadius: 8, padding: 9, marginBottom: 10 }]}>
          <Icon name="flag" size={14} color={C.primaryDark} />
          <Text style={[s.detailTxt, { fontWeight: '700' }]} numberOfLines={2}>{result.destination}</Text>
        </View>
      )}

      <View style={s.statsRow}>
        {[
          { i: 'straighten',        v: result.estimatedKm,   l: 'Road Dist.' },
          { i: 'schedule',          v: result.estimatedTime, l: 'Est. Time'  },
          { i: 'local-gas-station', v: result.estimatedFuel, l: 'Fuel'       },
        ].map((item, idx, arr) => (
          <React.Fragment key={idx}>
            <View style={s.statBox}>
              <Icon name={item.i} size={16} color={C.primaryDark} />
              <Text style={s.statBoxVal}>{item.v}</Text>
              <Text style={s.statBoxLbl}>{item.l}</Text>
            </View>
            {idx < arr.length - 1 && <View style={s.statDiv} />}
          </React.Fragment>
        ))}
      </View>

      <FuelBadge
        fuelType={result.fuelType}
        fuelCostPKR={result.fuelCostPKR}
        estimatedFuel={result.estimatedFuel}
        estimatedKm={result.estimatedKm}
        vehicleType={result.vehicleType}
      />

      <View style={[s.srcBadge, { marginTop: 6 }]}>
        <Icon name="calculate" size={12} color={C.primaryDark} />
        <Text style={s.srcTxt}>
          {result.estimatedKm} × Rs.{result.fuelType === 'diesel' ? 283 : 278}/L @ {PK_FUEL.consumption[result.vehicleType] || 15}L/100km = {result.fuelCostPKR}
        </Text>
      </View>

      <TouchableOpacity style={s.stopsHeader} onPress={() => setExpanded(!expanded)}>
        <Text style={s.stopsTitle}>Route Stops ({result.stops?.length || 0})</Text>
        <Icon name={expanded ? 'expand-less' : 'expand-more'} size={22} color={C.primaryDark} />
      </TouchableOpacity>

      {expanded && (result.stops || []).map((stop, i) => (
        <View key={i} style={s.stopRow}>
          <View style={[s.stopDot, { backgroundColor: stop.type === 'pickup' ? C.primary : C.primaryDark }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.stopName}>
              {typeof stop === 'string' ? stop : stop.name}
              {typeof stop !== 'string' && (
                <Text style={{ fontWeight: '700', color: stop.type === 'pickup' ? C.primaryDark : C.textLight }}>
                  {' '}{stop.type === 'pickup' ? 'Pickup' : 'Drop-off'}
                </Text>
              )}
            </Text>
            {typeof stop !== 'string' && stop.address && (
              <Text style={s.stopAddr} numberOfLines={2}>{stop.address}</Text>
            )}
          </View>
        </View>
      ))}

      {expanded && result.passengers?.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.stopsTitle}>Passengers ({result.passengers.length})</Text>
          {result.passengers.map((p, i) => (
            <View key={i} style={s.paxRow}>
              <View style={s.paxAvatar}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: C.primaryDark }}>
                  {(p.name || 'P').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.textDark }}>{p.name}</Text>
                {p.pickupAddress && <Text style={{ fontSize: 11, color: C.textLight }} numberOfLines={1}>{p.pickupAddress}</Text>}
                {(p.dropAddress || p.destination) && (
                  <Text style={{ fontSize: 11, color: C.primaryDark, fontWeight: '600' }} numberOfLines={1}>
                    {p.dropAddress || p.destination}
                  </Text>
                )}
                {p.vehiclePreference && (
                  <View style={[s.chip, { marginTop: 4,
                    backgroundColor: p.vehiclePreference === 'car' ? '#FFF3E0' : C.primaryGhost,
                    borderColor:     p.vehiclePreference === 'car' ? '#FF9800' : C.border,
                  }]}>
                    <Icon
                      name={p.vehiclePreference === 'car' ? 'directions-car' : 'airport-shuttle'}
                      size={11}
                      color={p.vehiclePreference === 'car' ? '#E65100' : C.primaryDark}
                    />
                    <Text style={[s.chipTxt, { marginLeft: 4, color: p.vehiclePreference === 'car' ? '#E65100' : C.primaryDark }]}>
                      {p.vehiclePreference === 'car' ? 'Car only (strict)' : `${VEHICLE_INFO[p.vehiclePreference]?.label || p.vehiclePreference} (flexible)`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={s.twoBtn}>
        <TouchableOpacity style={s.discardBtn} onPress={onDiscard}>
          <Icon name="delete-outline" size={16} color={C.white} />
          <Text style={s.btnTxt}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.confirmBtnGreen, isConfirming && { opacity: 0.6 }]} onPress={onConfirm} disabled={isConfirming}>
          {isConfirming
            ? <ActivityIndicator size="small" color={C.black} />
            : <><Icon name="save" size={16} color={C.white} /><Text style={[s.btnTxt, { color: C.white }]}>Save Route</Text></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SmartRouteCard;