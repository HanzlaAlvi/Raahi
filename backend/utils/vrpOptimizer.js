'use strict';
/**
 * backend/utils/vrpOptimizer.js
 *
 * ─── FIX IN THIS VERSION ────────────────────────────────────────────────────
 *
 *  BUG: Route 1 had 22 passengers — exceeds van capacity of 12.
 *
 *  ROOT CAUSE (2 places):
 *
 *  1. processGroup(flexible, VCAPS.bus)
 *     The Clarke-Wright savings algorithm was told maxCapacity = 30 (bus cap).
 *     So it happily merged 22 nearby passengers into one group.
 *
 *  2. splitOversizedRoutes() calls resolveVehicleType(g.passengers).
 *     For 22 passengers with no specific preference:
 *       n=22 > VCAPS.van(12) → returns 'bus' → cap=30 → no split needed
 *     So the 22-pax group passed through split unchanged.
 *
 *  FIX:
 *  a) processGroup(flexible, VCAPS.van) — cap CWS at 12, not 30.
 *  b) resolveVehicleType(): when no preference is specified, NEVER return 'bus'
 *     unless there are 'bus' preferences. Default max is 'van' (12).
 *     'bus' type is only returned when passengers explicitly prefer bus/van AND
 *     count exceeds van capacity. For our system (vans), 'bus' should never
 *     auto-trigger just from passenger count.
 *
 *  RESULT with fix:
 *    35 passengers → groups of max 12 → ~4-5 routes per poll (not 5 with 22+4+3+2+4)
 *    E.g.: 12 + 10 + 7 + 4 + 2 = 35 (all routes under cap 12)
 *
 *  NOTE: This affects BOTH manual route optimization AND auto-optimization at
 *  midnight. Both now correctly cap at van capacity (12). This is correct
 *  behaviour for a van-based transport system.
 */

const axios = require('axios');
const { NOMINATIM_BASE, SOLVICE_API_KEY, SOLVICE_BASE } = require('../config/constants');

const VCAPS = { car: 4, van: 12, bus: 30 };
const VCFG  = {
  car: { cap: 4,  minKm: 5,  speedKmh: 28, roadFactor: 1.35, baseL100: 10.0, hwyL100: 7.5,  minFuelL: 0.8 },
  van: { cap: 12, minKm: 8,  speedKmh: 23, roadFactor: 1.32, baseL100: 13.0, hwyL100: 10.0, minFuelL: 1.5 },
  bus: { cap: 30, minKm: 12, speedKmh: 20, roadFactor: 1.28, baseL100: 22.0, hwyL100: 17.0, minFuelL: 4.0 },
};
const DEST_CLUSTER_KM   = 2.5;
const MERGE_RADIUS_KM   = 12;
const SOLO_RADIUS_KM    = 15;
const MIN_PAX_PER_ROUTE = 2;
const DEFAULT_DEST      = { lat: 33.6135, lng: 73.1998, address: 'Default Destination' };

function safeCoord(val, fallback = 0) {
  const n = parseFloat(val);
  return (!isNaN(n) && isFinite(n)) ? n : fallback;
}
function validGPS(lat, lng) {
  const la = safeCoord(lat), ln = safeCoord(lng);
  return (la !== 0 || ln !== 0) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const la1 = safeCoord(lat1), ln1 = safeCoord(lng1);
  const la2 = safeCoord(lat2), ln2 = safeCoord(lng2);
  if (!validGPS(la1, ln1) || !validGPS(la2, ln2)) return 0;
  const R = 6371, d2r = Math.PI / 180;
  const dLa = (la2 - la1) * d2r, dLn = (ln2 - ln1) * d2r;
  const a = Math.sin(dLa/2)**2 + Math.cos(la1*d2r)*Math.cos(la2*d2r)*Math.sin(dLn/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function normalizePassenger(raw, idx) {
  const pickupLat = safeCoord(raw.pickupLat ?? raw.latitude             ?? raw.pickupLocation?.lat ?? 0);
  const pickupLng = safeCoord(raw.pickupLng ?? raw.longitude            ?? raw.pickupLocation?.lng ?? 0);
  const dropLat   = safeCoord(raw.dropLat   ?? raw.destinationLatitude  ?? raw.dropLocation?.lat   ?? 0);
  const dropLng   = safeCoord(raw.dropLng   ?? raw.destinationLongitude ?? raw.dropLocation?.lng   ?? 0);
  return {
    id:                raw.id ?? raw._id?.toString() ?? `p_${idx}`,
    name:              raw.name ?? raw.passengerName ?? `Passenger ${idx + 1}`,
    pickupLat, pickupLng,
    pickupAddress:     raw.pickupAddress ?? raw.pickupPoint ?? raw.address ?? '',
    dropLat:           dropLat  || DEFAULT_DEST.lat,
    dropLng:           dropLng  || DEFAULT_DEST.lng,
    dropAddress:       raw.dropAddress ?? raw.destination ?? raw.destinationAddress ?? DEFAULT_DEST.address,
    vehiclePreference: raw.vehiclePreference ?? null,
    timeSlot:          raw.selectedTimeSlot  ?? raw.timeSlot ?? null,
    hasGPS:            validGPS(pickupLat, pickupLng),
  };
}
function canMerge(a, b) {
  if (a.vehiclePreference === 'car' && b.vehiclePreference === 'car') return true;
  if (a.vehiclePreference === 'car' || b.vehiclePreference === 'car') return false;
  return true;
}

/**
 * Resolves vehicle type from passenger list.
 *
 * ✅ FIX: Previously, n > 12 with no preference returned 'bus' (cap 30).
 *    This caused splitOversizedRoutes to not split 22-pax groups.
 *    Now: no-preference passengers → always 'van' (cap 12) at most.
 *    'bus' only returned when passengers have explicit 'bus'/'van' preference
 *    AND count exceeds van capacity.
 */
function resolveVehicleType(passengers) {
  const prefs = passengers.map(p => p.vehiclePreference).filter(Boolean);
  const n     = passengers.length;

  // All passengers explicitly want a car → car route
  if (prefs.length && prefs.every(p => p === 'car')) return 'car';

  // Mixed car + others → use car (smaller, respects car passengers)
  if (prefs.includes('car')) return 'car';

  // No explicit preferences → use van (our default vehicle). NEVER 'bus'.
  // ✅ FIX: was: n <= VCAPS.car ? 'car' : n <= VCAPS.van ? 'van' : 'bus'
  //         now: n <= VCAPS.car ? 'car' : 'van'  ← no auto-bus from count
  if (!prefs.length) return n <= VCAPS.car ? 'car' : 'van';

  // Has some van/bus preferences but no car → van unless exceeds van cap
  // (bus type only for genuinely large-group explicit preference)
  return n <= VCAPS.van ? 'van' : 'bus';
}

async function getRouteDistance(waypoints, destination) {
  if (!waypoints.length) return { distanceKm: 0, durationMins: 10, source: 'haversine' };
  const allPts = [...waypoints, destination];
  try {
    const locs = allPts.map((p, i) => ({ id: `loc_${i}`, lat: safeCoord(p.lat), lng: safeCoord(p.lng) }));
    const { data } = await axios.post(
      `${SOLVICE_BASE}/v2/matrix`,
      { sources: locs.map(l => l.id), destinations: locs.map(l => l.id), locations: locs, profile: 'car' },
      { headers: { Authorization: SOLVICE_API_KEY, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    if (data?.distances && data?.durations) {
      let distM = 0, durS = 0;
      for (let i = 0; i < allPts.length - 1; i++) {
        distM += data.distances?.[i]?.[i + 1] || 0;
        durS  += data.durations?.[i]?.[i + 1] || 0;
      }
      if (distM > 0 && distM < 500000)
        return { distanceKm: distM / 1000, durationMins: Math.max(10, Math.round(durS / 60)), source: 'solvice' };
    }
  } catch (e) { console.warn('[Solvice] getRouteDistance:', e.message); }
  let totalKm = 0;
  for (let i = 0; i < allPts.length - 1; i++)
    totalKm += haversineKm(allPts[i].lat, allPts[i].lng, allPts[i+1].lat, allPts[i+1].lng);
  const roadKm = totalKm * 1.32;
  return { distanceKm: roadKm, durationMins: Math.max(10, Math.round((roadKm / 25) * 60)), source: 'haversine' };
}
async function reverseGeocode(lat, lng) {
  try {
    const { data } = await axios.get(
      `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'TransportApp/2.0' }, timeout: 5000 }
    );
    if (data?.display_name) {
      const a = data.address || {};
      const parts = [
        a.road || a.pedestrian || a.hamlet,
        a.suburb || a.neighbourhood || a.village,
        a.city   || a.town          || a.state,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
    }
  } catch (e) { console.warn(`[VRP] revGeo(${lat},${lng}):`, e.message); }
  return `${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}`;
}
let _fuelCache = { price: 268, ts: 0 };
async function getLivePetrolPrice() {
  const now = Date.now();
  if (now - _fuelCache.ts < 6 * 60 * 60 * 1000) return _fuelCache.price;
  const tryParse = html => {
    const pats = [
      /(?:petrol|gasoline|ms|motor spirit)[^\d]*?(?:rs\.?\s*)?(2\d{2}(?:\.\d{1,2})?)/gi,
      /(?:price per litre|per liter)[^\d]*?(2\d{2}(?:\.\d{1,2})?)/gi,
      /(?:rs\.?\s*|pkr\s*)(2[2-9]\d(?:\.\d{1,2})?)/gi,
    ];
    for (const re of pats) {
      re.lastIndex = 0;
      const m = re.exec(html);
      if (m) { const p = parseFloat(m[1]); if (p >= 200 && p <= 450) return p; }
    }
    return null;
  };
  for (const url of ['https://pkpetrolprice.com/', 'https://www.petrolprice.pk/']) {
    try {
      const { data } = await axios.get(url, { timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const price = tryParse(data);
      if (price) { _fuelCache = { price, ts: now }; return price; }
    } catch {}
  }
  _fuelCache.ts = now;
  return _fuelCache.price;
}
function calcFuelForRoute(distanceKm, vehicleType) {
  const cfg = VCFG[vehicleType] || VCFG.van;
  let consumption;
  if (distanceKm <= 10)      consumption = cfg.baseL100;
  else if (distanceKm >= 40) consumption = cfg.hwyL100;
  else consumption = cfg.baseL100 + ((distanceKm - 10) / 30) * (cfg.hwyL100 - cfg.baseL100);
  const litres = Math.max((distanceKm * consumption) / 100, cfg.minFuelL);
  return { litres: +litres.toFixed(2), consumption: +consumption.toFixed(1) };
}
function centroid(points) {
  const v = points.filter(p => validGPS(p.lat, p.lng));
  if (!v.length) return DEFAULT_DEST;
  return { lat: v.reduce((s,p) => s+p.lat, 0)/v.length, lng: v.reduce((s,p) => s+p.lng, 0)/v.length };
}
function nearestNeighborSort(passengers) {
  if (passengers.length <= 1) return [...passengers];
  const remaining = [...passengers], sorted = [];
  let cur = remaining.splice(0, 1)[0];
  sorted.push(cur);
  while (remaining.length) {
    let ni = 0, nd = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(cur.pickupLat, cur.pickupLng, p.pickupLat, p.pickupLng);
      if (d < nd) { nd = d; ni = i; }
    });
    cur = remaining.splice(ni, 1)[0];
    sorted.push(cur);
  }
  return sorted;
}
function twoOptImprove(waypoints) {
  if (waypoints.length <= 2) return waypoints;
  let best = [...waypoints], improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const nxt1 = best[(i+1) % best.length], nxt2 = best[(j+1) % best.length] || best[j];
        const d1 = haversineKm(best[i].lat, best[i].lng, nxt1.lat, nxt1.lng)
                 + haversineKm(best[j].lat, best[j].lng, nxt2.lat, nxt2.lng);
        const d2 = haversineKm(best[i].lat, best[i].lng, best[j].lat, best[j].lng)
                 + haversineKm(nxt1.lat, nxt1.lng, nxt2.lat, nxt2.lng);
        if (d2 < d1 - 0.01) {
          best = [...best.slice(0,i+1), ...best.slice(i+1,j+1).reverse(), ...best.slice(j+1)];
          improved = true;
        }
      }
    }
  }
  return best;
}
function clarkeWrightSavings(passengers, depot, maxCapacity) {
  if (!passengers.length) return [];
  let routes = passengers.map((p, i) => ({ id: `r${i}`, passengers: [p] }));
  const savings = [];
  for (let i = 0; i < passengers.length; i++) {
    for (let j = i + 1; j < passengers.length; j++) {
      if (!canMerge(passengers[i], passengers[j])) continue;
      const di  = haversineKm(depot.lat, depot.lng, passengers[i].pickupLat, passengers[i].pickupLng);
      const dj  = haversineKm(depot.lat, depot.lng, passengers[j].pickupLat, passengers[j].pickupLng);
      const dij = haversineKm(passengers[i].pickupLat, passengers[i].pickupLng, passengers[j].pickupLat, passengers[j].pickupLng);
      savings.push({ i, j, saving: di + dj - dij });
    }
  }
  savings.sort((a, b) => b.saving - a.saving);
  for (const { i, j } of savings) {
    const rI = routes.find(r => r.passengers.some(p => p.id === passengers[i].id));
    const rJ = routes.find(r => r.passengers.some(p => p.id === passengers[j].id));
    if (!rI || !rJ || rI.id === rJ.id) continue;
    if (rI.passengers.length + rJ.passengers.length > maxCapacity) continue;
    if (!rI.passengers.every(a => rJ.passengers.every(b => canMerge(a, b)))) continue;
    const cI = centroid(rI.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    const cJ = centroid(rJ.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    if (haversineKm(cI.lat, cI.lng, cJ.lat, cJ.lng) > MERGE_RADIUS_KM) continue;
    routes = routes.filter(r => r.id !== rI.id && r.id !== rJ.id);
    routes.push({ id: rI.id, passengers: [...rI.passengers, ...rJ.passengers] });
  }
  return routes.map(r => r.passengers);
}
function groupByDestination(passengers) {
  const groups = [];
  for (const p of passengers) {
    const dLat = safeCoord(p.dropLat, DEFAULT_DEST.lat);
    const dLng = safeCoord(p.dropLng, DEFAULT_DEST.lng);
    let matched = false;
    for (const g of groups) {
      if (haversineKm(g.destLat, g.destLng, dLat, dLng) <= DEST_CLUSTER_KM) {
        g.passengers.push(p);
        const n = g.passengers.length;
        g.destLat = (g.destLat*(n-1) + dLat) / n;
        g.destLng = (g.destLng*(n-1) + dLng) / n;
        if (!g.destAddress) g.destAddress = p.dropAddress;
        matched = true; break;
      }
    }
    if (!matched) groups.push({ destLat: dLat, destLng: dLng, destAddress: p.dropAddress || DEFAULT_DEST.address, passengers: [p] });
  }
  return groups;
}
function detectOutliers(passengers) {
  if (passengers.length <= 1) return { inliers: passengers, outliers: [] };
  const c = centroid(passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
  const withDists  = passengers.map(p => ({ p, d: haversineKm(c.lat, c.lng, p.pickupLat, p.pickupLng) }));
  const sorted     = [...withDists].sort((a, b) => a.d - b.d);
  const q3         = sorted[Math.floor(sorted.length * 0.75)]?.d || 18;
  const threshold  = Math.max(q3 * 1.8, 18);
  return {
    inliers:  withDists.filter(x => x.d <= threshold).map(x => x.p),
    outliers: withDists.filter(x => x.d >  threshold).map(x => x.p),
  };
}
function mergeSmallRoutes(routeGroups) {
  let groups = routeGroups.map(g => ({ ...g, passengers: [...g.passengers] }));
  let changed = true;
  while (changed) {
    changed = false;
    const si = groups.findIndex(g => g.passengers.length < MIN_PAX_PER_ROUTE);
    if (si === -1) break;
    const sm = groups[si];
    const sc = centroid(sm.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    let bi = -1, bd = Infinity;
    groups.forEach((tg, idx) => {
      if (idx === si) return;
      if (!sm.passengers.every(sp => tg.passengers.every(tp => canMerge(sp, tp)))) return;
      const merged = [...tg.passengers, ...sm.passengers];
      if (merged.length > VCAPS[resolveVehicleType(merged)]) return;
      const tc = centroid(tg.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
      const d  = haversineKm(sc.lat, sc.lng, tc.lat, tc.lng);
      const r  = sm.passengers.length === 1 ? SOLO_RADIUS_KM : MERGE_RADIUS_KM;
      if (d < r && d < bd) { bd = d; bi = idx; }
    });
    if (bi !== -1) { groups[bi].passengers.push(...sm.passengers); groups.splice(si, 1); changed = true; }
    else break;
  }
  return groups;
}
function splitOversizedRoutes(routeGroups) {
  const output = [];
  for (const g of routeGroups) {
    const vt = resolveVehicleType(g.passengers), cap = VCAPS[vt];
    if (g.passengers.length <= cap) { output.push(g); continue; }
    const sorted = nearestNeighborSort(g.passengers);
    for (let i = 0; i < sorted.length; i += cap)
      output.push({ ...g, passengers: sorted.slice(i, i+cap) });
  }
  return output;
}
function calcOptimizationScore(distanceKm, durationMins, fuelLitres, passengerCount) {
  const N = Math.max(passengerCount, 1);
  return Math.round(
    0.35 * Math.min(100, Math.max(0, 100-(distanceKm/N-2)*8)) +
    0.35 * Math.min(100, Math.max(0, 100-(durationMins/N-3)*4)) +
    0.30 * Math.min(100, Math.max(0, 100-(fuelLitres/N-0.3)*50))
  );
}
function getMostCommonArea(addresses) {
  if (!addresses.length) return 'Route';
  const freq = {};
  addresses.forEach(a => { const p = String(a||'').split(','), k = (p[1]||p[0]).trim(); freq[k] = (freq[k]||0)+1; });
  return Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] || 'Route';
}
async function buildOptimizedRoute(group, routeIndex, petrolPrice) {
  const { passengers, destLat, destLng, destAddress, warning } = group;
  const vehicleType = resolveVehicleType(passengers);
  const cfg         = VCFG[vehicleType];
  const destination = { lat: safeCoord(destLat, DEFAULT_DEST.lat), lng: safeCoord(destLng, DEFAULT_DEST.lng), address: destAddress || DEFAULT_DEST.address };
  const sortedPass   = nearestNeighborSort(passengers);
  const withCoords   = sortedPass.map(p => ({ ...p, lat: p.pickupLat, lng: p.pickupLng }));
  const twoOptSorted = twoOptImprove(withCoords);
  const waypoints    = twoOptSorted.filter(p => validGPS(p.lat, p.lng)).map(p => ({ lat: p.lat, lng: p.lng }));
  let routeResult;
  if (waypoints.length) {
    routeResult = await getRouteDistance(waypoints, destination);
  } else {
    routeResult = { distanceKm: cfg.minKm, durationMins: Math.round((cfg.minKm/cfg.speedKmh)*60), source: 'haversine' };
  }
  const distanceKm   = Math.max(routeResult.distanceKm, cfg.minKm);
  const durationMins = Math.max(routeResult.durationMins, 10);
  const { litres: fuelLitres, consumption } = calcFuelForRoute(distanceKm, vehicleType);
  const fuelCostPKR  = Math.round(fuelLitres * petrolPrice);
  const score        = calcOptimizationScore(distanceKm, durationMins, fuelLitres, passengers.length);
  const warnings     = [];
  if (warning) warnings.push(warning);
  if (passengers.length > cfg.cap) warnings.push(`Exceeds ${vehicleType} capacity (${passengers.length}/${cfg.cap})`);
  const stops = [
    ...twoOptSorted.map(p => ({ name: p.name, address: p.pickupAddress || `${safeCoord(p.pickupLat).toFixed(4)}, ${safeCoord(p.pickupLng).toFixed(4)}`, lat: safeCoord(p.pickupLat), lng: safeCoord(p.pickupLng), type: 'pickup' })),
    { name: 'Destination', address: destination.address, lat: destination.lat, lng: destination.lng, type: 'dropoff' },
  ];
  return {
    id: `route_${routeIndex + 1}`, vehicleType, passengerCount: passengers.length, capacity: cfg.cap,
    passengers, stops, destination: destination.address, destinationLat: destination.lat, destinationLng: destination.lng,
    areaLabel: getMostCommonArea(passengers.map(p => p.pickupAddress)),
    estimatedKm: `${distanceKm.toFixed(1)} km`,
    estimatedTime: durationMins < 60 ? `${durationMins} min` : `${Math.floor(durationMins/60)}h ${durationMins%60}m`,
    estimatedFuel: `${fuelLitres.toFixed(1)} L`, fuelCostPKR: `Rs. ${fuelCostPKR.toLocaleString()}`,
    fuelType: 'petrol', consumption: `${consumption} L/100km`, pricePerLitre: petrolPrice,
    fuelRatePerKm: +(fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3),
    rawDistanceKm: +distanceKm.toFixed(2), rawDurationMins: durationMins,
    rawFuelLitres: fuelLitres, rawFuelCostPKR: fuelCostPKR,
    matrixSource: routeResult.source, optimizationScore: score,
    preferenceGroup: passengers.some(p => p.vehiclePreference === 'car') || passengers.some(p => p.vehiclePreference === 'van' || p.vehiclePreference === 'bus'),
    warnings,
  };
}
async function optimizeRoutes(rawPassengers) {
  if (!rawPassengers?.length) return [];
  const passengers = rawPassengers.map((p, i) => normalizePassenger(p, i));
  const withGPS    = passengers.filter(p => p.hasGPS);
  const withoutGPS = passengers.filter(p => !p.hasGPS);
  for (let i = 0; i < withGPS.length; i++) {
    const p = withGPS[i];
    if (!p.pickupAddress && p.hasGPS) {
      withGPS[i] = { ...p, pickupAddress: await reverseGeocode(p.pickupLat, p.pickupLng) };
      await new Promise(r => setTimeout(r, 1100));
    }
  }
  const petrolPrice = await getLivePetrolPrice();
  const destGroups  = groupByDestination(withGPS);
  let routeGroups   = [];
  for (const dg of destGroups) {
    const depot    = { lat: dg.destLat, lng: dg.destLng };
    const carOnly  = dg.passengers.filter(p => p.vehiclePreference === 'car');
    const flexible = dg.passengers.filter(p => p.vehiclePreference !== 'car');
    const processGroup = (paxList, maxCap) => {
      if (!paxList.length) return;
      const { inliers, outliers } = detectOutliers(paxList);
      let subRoutes = inliers.length ? clarkeWrightSavings(inliers, depot, maxCap) : [];
      for (const outlier of outliers) {
        let attached = false;
        for (const route of subRoutes) {
          if (route.length >= maxCap) continue;
          if (!route.every(p => canMerge(p, outlier))) continue;
          const c = centroid(route.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
          if (haversineKm(c.lat, c.lng, outlier.pickupLat, outlier.pickupLng) <= SOLO_RADIUS_KM) {
            route.push(outlier); attached = true; break;
          }
        }
        if (!attached) subRoutes.push([outlier]);
      }
      subRoutes.forEach(r => routeGroups.push({ passengers: r, destLat: dg.destLat, destLng: dg.destLng, destAddress: dg.destAddress }));
    };
    processGroup(carOnly,  VCAPS.car);
    // ✅ FIX: was VCAPS.bus (30) — changed to VCAPS.van (12) so no route exceeds van capacity
    processGroup(flexible, VCAPS.van);
  }
  routeGroups = mergeSmallRoutes(routeGroups);
  routeGroups = splitOversizedRoutes(routeGroups);  // now also works correctly since resolveVehicleType returns 'van' not 'bus'
  if (withoutGPS.length) {
    for (let i = 0; i < withoutGPS.length; i += VCAPS.van)
      routeGroups.push({ passengers: withoutGPS.slice(i, i+VCAPS.van), destLat: DEFAULT_DEST.lat, destLng: DEFAULT_DEST.lng, destAddress: DEFAULT_DEST.address, warning: '⚠️ No GPS data — manual pickup coordination required' });
  }
  const results     = await Promise.allSettled(routeGroups.map((g, i) => buildOptimizedRoute(g, i, petrolPrice)));
  const validRoutes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  validRoutes.sort((a, b) => {
    if (a.preferenceGroup && !b.preferenceGroup) return -1;
    if (!a.preferenceGroup && b.preferenceGroup) return  1;
    return b.optimizationScore - a.optimizationScore;
  });
  return validRoutes;
}

module.exports = { optimizeRoutes, getLivePetrolPrice, normalizePassenger, safeCoord, validGPS, resolveVehicleType, getMostCommonArea, calcFuelForRoute, DEFAULT_DEST, VCAPS };