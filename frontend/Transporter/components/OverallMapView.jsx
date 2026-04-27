import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import C from '../constants/colors';
import { ROUTE_COLORS } from '../constants/vehicles';
import { API_BASE } from '../constants/fuels';
import { safeNum, isValidGPS } from '../utils/geo';
import { fmtPKR } from '../utils/formatters';
import { decodePolyline } from '../utils/polyLine';
import { om } from '../styles/mapStyles';

const OverallMapView = ({ routes, onClose }) => {
  const [routePolylines, setRoutePolylines] = useState({});
  const [loadingRoutes, setLoadingRoutes]   = useState(true);
  const mapRef = useRef(null);

  const allStops = useMemo(() =>
    routes.flatMap((r, ri) =>
      (r.stops || [])
        .filter(s => s && isValidGPS(s.lat, s.lng))
        .map(s => ({ ...s, routeIdx: ri, routeLabel: r.areaLabel || `Route ${ri + 1}`, vehicleType: r.vehicleType })),
    ), [routes]);

  const region = useMemo(() => {
    if (!allStops.length) return { latitude: 33.6135, longitude: 73.1998, latitudeDelta: 0.15, longitudeDelta: 0.15 };
    const lats = allStops.map(s => safeNum(s.lat));
    const lngs = allStops.map(s => safeNum(s.lng));
    return {
      latitude:       (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude:      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta:  Math.max((Math.max(...lats) - Math.min(...lats)) * 1.5, 0.05),
      longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.5, 0.05),
    };
  }, [allStops]);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoadingRoutes(true);
      for (let ri = 0; ri < routes.length; ri++) {
        if (cancelled) return;
        const r     = routes[ri];
        const stops = (r.stops || []).filter(s => s && isValidGPS(s.lat, s.lng));
        if (stops.length < 2) continue;
        const origin = stops[0], dest = stops[stops.length - 1];
        const mids   = stops.slice(1, -1).map(s => `${safeNum(s.lat)},${safeNum(s.lng)}`).join('|');
        try {
          const params = new URLSearchParams({
            origin:      `${safeNum(origin.lat)},${safeNum(origin.lng)}`,
            destination: `${safeNum(dest.lat)},${safeNum(dest.lng)}`,
            mode:        'driving',
          });
          if (mids) params.append('waypoints', mids);
          const res  = await fetch(`${API_BASE}/directions?${params}`);
          const ct   = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) continue;
          const data = await res.json();
          if (data.success && data.routes?.[0]?.overview_polyline?.encoded) {
            const poly = decodePolyline(data.routes[0].overview_polyline.encoded);
            if (!cancelled) setRoutePolylines(prev => ({ ...prev, [ri]: poly }));
          }
        } catch (e) { console.warn(`[OverallMap] route ${ri} failed:`, e.message); }
      }
      if (!cancelled) setLoadingRoutes(false);
    };
    fetchAll();
    return () => { cancelled = true; };
  }, [routes]);

  const totalPax     = routes.reduce((s, r) => s + (r.passengerCount || 0), 0);
  const totalFuelPKR = routes.reduce((s, r) => s + (r.rawFuelCostPKR || 0), 0);
  const totalFuelL   = routes.reduce((s, r) => s + (r.rawFuelLitres || 0), 0);
  const uniqueDests  = [...new Set(routes.map(r => r.destination).filter(Boolean))];

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <View style={om.header}>
          <TouchableOpacity onPress={onClose} style={om.backBtn}>
            <Icon name="arrow-back" size={22} color={C.white} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={om.headerTitle}>All Routes Overview</Text>
            <Text style={om.headerSub}>{routes.length} routes · {totalPax} passengers · {uniqueDests.length} destination(s)</Text>
          </View>
          {loadingRoutes && <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 4 }} />}
        </View>
        <View style={{ flex: 1 }}>
          <MapView ref={mapRef} style={{ flex: 1 }} provider={PROVIDER_GOOGLE} initialRegion={region} showsTraffic showsBuildings>
            {routes.map((r, ri) => {
              const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
              const poly  = routePolylines[ri];
              const stops = (r.stops || []).filter(s => s && isValidGPS(s.lat, s.lng));
              return (
                <React.Fragment key={ri}>
                  {poly?.length > 0
                    ? <Polyline coordinates={poly} strokeColor={color} strokeWidth={4} />
                    : stops.length > 1
                      ? <Polyline coordinates={stops.map(s => ({ latitude: safeNum(s.lat), longitude: safeNum(s.lng) }))} strokeColor={color} strokeWidth={3} lineDashPattern={[8, 5]} />
                      : null
                  }
                  {stops.map((stop, si) => {
                    const isDrop  = stop.type === 'dropoff';
                    const isFirst = si === 0;
                    return (
                      <Marker
                        key={`${ri}_${si}`}
                        coordinate={{ latitude: safeNum(stop.lat), longitude: safeNum(stop.lng) }}
                        title={stop.name || (isDrop ? 'Destination' : `Stop ${si + 1}`)}
                        description={`Route ${ri + 1}: ${stop.address || ''}`}
                      >
                        <View style={[om.markerPin, {
                          backgroundColor: isDrop ? '#1a1a1a' : isFirst ? color : C.white,
                          borderColor:     color,
                          width:           isDrop || isFirst ? 36 : 26,
                          height:          isDrop || isFirst ? 36 : 26,
                          borderRadius:    isDrop || isFirst ? 18 : 13,
                        }]}>
                          <Icon
                            name={isDrop ? 'flag' : isFirst ? 'directions-car' : 'person-pin-circle'}
                            size={isDrop || isFirst ? 18 : 12}
                            color={isDrop ? color : isFirst ? C.black : '#333'}
                          />
                        </View>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </MapView>
          <View style={om.legendBox}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {routes.map((r, ri) => (
                <View key={ri} style={[om.legendItem, { borderLeftColor: ROUTE_COLORS[ri % ROUTE_COLORS.length] }]}>
                  <Icon
                    name={r.vehicleType === 'car' ? 'directions-car' : r.vehicleType === 'bus' ? 'directions-bus' : 'airport-shuttle'}
                    size={18} color={C.textDark}
                  />
                  <View>
                    <Text style={om.legendLabel}>{r.areaLabel || `Route ${ri + 1}`}</Text>
                    <Text style={om.legendSub}>{r.passengerCount} pax · {r.estimatedKm}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={om.bottomPanel}>
          <View style={om.summaryRow}>
            <View style={om.summaryBox}><Icon name="directions-bus" size={20} color={C.primary} /><Text style={om.summaryVal}>{routes.length}</Text><Text style={om.summaryLbl}>Routes</Text></View>
            <View style={om.summaryDiv} />
            <View style={om.summaryBox}><Icon name="groups" size={20} color={C.primary} /><Text style={om.summaryVal}>{totalPax}</Text><Text style={om.summaryLbl}>Passengers</Text></View>
            <View style={om.summaryDiv} />
            <View style={om.summaryBox}><Icon name="local-gas-station" size={20} color={C.primary} /><Text style={om.summaryVal}>{totalFuelL.toFixed(1)} L</Text><Text style={om.summaryLbl}>Fuel</Text></View>
            <View style={om.summaryDiv} />
            <View style={om.summaryBox}><Icon name="account-balance-wallet" size={20} color={C.primary} /><Text style={om.summaryVal}>Rs.{Math.round(totalFuelPKR / 1000)}k</Text><Text style={om.summaryLbl}>Cost</Text></View>
          </View>
          {uniqueDests.length > 0 && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.textLight, letterSpacing: 1 }}>DESTINATIONS</Text>
              {uniqueDests.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
                  <Text style={{ fontSize: 12, color: C.textMid, fontWeight: '600' }} numberOfLines={1}>{d}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default OverallMapView;