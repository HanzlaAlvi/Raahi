import {
  PK_FUEL, FALLBACK_DEST, DEST_CLUSTER_RADIUS_KM, MIN_ROUTE_PASSENGERS,
  MAX_MERGE_RADIUS_KM, SOLO_MERGE_RADIUS_KM, CAR_MAX_SPREAD_KM,
  SOLVICE_API_KEY, SOLVICE_BASE, NOMINATIM,
} from '../constants/fuels';
import { VEHICLE_CAPS } from '../constants/vehicles';
import { safeNum, isValidGPS, haversineKm, centroid, getMostCommonArea } from '../utils/geo';
import { fmtKm, fmtTime, fmtLitres, fmtPKR } from '../utils/formatters';

// ─── PASSENGER NORMALIZATION ─────────────────────────────────────────────────

export function normalizePassenger(raw, idx) {
  return {
    id:                raw.id ?? raw._id?.$oid ?? raw._id ?? `p_${idx}`,
    name:              raw.name ?? raw.passengerName ?? `Passenger ${idx + 1}`,
    pickupLat:         safeNum(raw.pickupLat  ?? raw.latitude             ?? raw.pickupLocation?.lat),
    pickupLng:         safeNum(raw.pickupLng  ?? raw.longitude            ?? raw.pickupLocation?.lng),
    pickupAddress:     raw.pickupAddress ?? raw.pickupPoint ?? raw.address ?? '',
    dropLat:           safeNum(raw.dropLat    ?? raw.destinationLatitude  ?? raw.dropLocation?.lat),
    dropLng:           safeNum(raw.dropLng    ?? raw.destinationLongitude ?? raw.dropLocation?.lng),
    dropAddress:       raw.dropAddress ?? raw.destination ?? raw.destinationAddress ?? '',
    vehiclePreference: raw.vehiclePreference ?? null,
    timeSlot:          raw.selectedTimeSlot ?? raw.timeSlot ?? null,
  };
}

// ─── VEHICLE PREFERENCE ENGINE ───────────────────────────────────────────────

export function canMergeByPreference(pA, pB) {
  const a = pA.vehiclePreference;
  const b = pB.vehiclePreference;
  if (a === 'car' && b === 'car') return true;
  if (a === 'car' || b === 'car') return false;
  return true;
}

export function resolveVehicleForGroup(passengers, preferredType = null) {
  const prefs  = passengers.map(p => p.vehiclePreference).filter(Boolean);
  const unique = [...new Set(prefs)];
  if (unique.length && unique.every(p => p === 'car')) return 'car';
  if (unique.length && unique.every(p => p === 'bus')) return 'bus';
  if (unique.length && unique.every(p => p === 'van')) return passengers.length <= VEHICLE_CAPS.van ? 'van' : 'bus';
  if (preferredType && preferredType !== 'car') {
    const count = passengers.length;
    if (preferredType === 'bus') return 'bus';
    if (preferredType === 'van') return count <= VEHICLE_CAPS.van ? 'van' : 'bus';
  }
  const count = passengers.length;
  if (count <= VEHICLE_CAPS.car) return 'car';
  if (count <= VEHICLE_CAPS.van) return 'van';
  return 'bus';
}

export function carPassengersWithinSpread(passengers) {
  for (let i = 0; i < passengers.length; i++) {
    for (let j = i + 1; j < passengers.length; j++) {
      const dist = haversineKm(
        passengers[i].pickupLat, passengers[i].pickupLng,
        passengers[j].pickupLat, passengers[j].pickupLng,
      );
      if (dist > CAR_MAX_SPREAD_KM) return false;
    }
  }
  return true;
}

export function splitCarPassengersByDistance(carPassengers) {
  if (!carPassengers.length) return [];
  const groups    = [];
  const remaining = [...carPassengers];
  while (remaining.length > 0) {
    const group = [remaining.splice(0, 1)[0]];
    let changed  = true;
    while (changed && remaining.length > 0) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const candidate = remaining[i];
        const fitsGroup = group.every(gp =>
          haversineKm(gp.pickupLat, gp.pickupLng, candidate.pickupLat, candidate.pickupLng) <= CAR_MAX_SPREAD_KM,
        );
        if (fitsGroup && group.length < VEHICLE_CAPS.car) {
          group.push(remaining.splice(i, 1)[0]);
          changed = true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// ─── ROUTE OPTIMIZATION ALGORITHMS ──────────────────────────────────────────

export function nearestNeighborSort(passengers) {
  if (passengers.length <= 1) return [...passengers];
  const sorted    = [];
  const remaining = [...passengers];
  let cur         = remaining.splice(0, 1)[0];
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

export function twoOptImprove(stops) {
  if (stops.length <= 2) return stops;
  let improved = true, best = [...stops];
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const p1 = best[i], p2 = best[(i + 1) % best.length];
        const p3 = best[j], p4 = best[(j + 1) % best.length];
        const before = haversineKm(p1.lat, p1.lng, p2.lat, p2.lng)
                     + haversineKm(p3.lat, p3.lng, p4?.lat ?? best[0].lat, p4?.lng ?? best[0].lng);
        const after  = haversineKm(p1.lat, p1.lng, p3.lat, p3.lng)
                     + haversineKm(p2.lat, p2.lng, p4?.lat ?? best[0].lat, p4?.lng ?? best[0].lng);
        if (after < before - 0.01) {
          best     = [...best.slice(0, i + 1), ...best.slice(i + 1, j + 1).reverse(), ...best.slice(j + 1)];
          improved = true;
        }
      }
    }
  }
  return best;
}

export function detectOutliers(passengers) {
  if (passengers.length <= 1) return { inliers: passengers, outliers: [] };
  const cent      = centroid(passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
  const distances = passengers.map(p => ({ p, dist: haversineKm(cent.lat, cent.lng, p.pickupLat, p.pickupLng) }));
  const sorted    = [...distances].sort((a, b) => a.dist - b.dist);
  const q3        = sorted[Math.floor(sorted.length * 0.75)]?.dist || 18;
  const threshold = Math.max(q3 * 1.8, 18);
  return {
    inliers:  distances.filter(d => d.dist <= threshold).map(d => d.p),
    outliers: distances.filter(d => d.dist >  threshold).map(d => d.p),
  };
}

export function groupPassengersByDestination(passengers) {
  const groups = [];
  for (const p of passengers) {
    const dLat = safeNum(p.dropLat) || FALLBACK_DEST.lat;
    const dLng = safeNum(p.dropLng) || FALLBACK_DEST.lng;
    let matched = null;
    for (const g of groups) {
      if (haversineKm(g.destLat, g.destLng, dLat, dLng) <= DEST_CLUSTER_RADIUS_KM) { matched = g; break; }
    }
    if (matched) {
      matched.passengers.push(p);
      const n = matched.passengers.length;
      matched.destLat = (matched.destLat * (n - 1) + dLat) / n;
      matched.destLng = (matched.destLng * (n - 1) + dLng) / n;
      if (!matched.destAddress || matched.destAddress === FALLBACK_DEST.address)
        matched.destAddress = p.dropAddress || matched.destAddress;
    } else {
      groups.push({ destLat: dLat, destLng: dLng, destAddress: p.dropAddress || FALLBACK_DEST.address, passengers: [p] });
    }
  }
  return groups;
}

export function clarkWrightSavings(passengers, depot, maxCap) {
  if (!passengers.length) return [];
  let routes  = passengers.map((p, i) => ({ id: `r_${i}`, passengers: [p] }));
  const savings = [];
  for (let i = 0; i < passengers.length; i++) {
    for (let j = i + 1; j < passengers.length; j++) {
      const pi = passengers[i], pj = passengers[j];
      if (!canMergeByPreference(pi, pj)) continue;
      const di  = haversineKm(depot.lat, depot.lng, pi.pickupLat, pi.pickupLng);
      const dj  = haversineKm(depot.lat, depot.lng, pj.pickupLat, pj.pickupLng);
      const dij = haversineKm(pi.pickupLat, pi.pickupLng, pj.pickupLat, pj.pickupLng);
      savings.push({ i, j, saving: di + dj - dij });
    }
  }
  savings.sort((a, b) => b.saving - a.saving);
  for (const { i, j } of savings) {
    const rI = routes.find(r => r.passengers.some(p => p.id === passengers[i].id));
    const rJ = routes.find(r => r.passengers.some(p => p.id === passengers[j].id));
    if (!rI || !rJ || rI.id === rJ.id) continue;
    if (rI.passengers.length + rJ.passengers.length > maxCap) continue;
    if (!rI.passengers.every(a => rJ.passengers.every(b => canMergeByPreference(a, b)))) continue;
    const cI = centroid(rI.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    const cJ = centroid(rJ.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    if (haversineKm(cI.lat, cI.lng, cJ.lat, cJ.lng) > MAX_MERGE_RADIUS_KM) continue;
    routes = routes.filter(r => r.id !== rI.id && r.id !== rJ.id);
    routes.push({ id: rI.id, passengers: [...rI.passengers, ...rJ.passengers] });
  }
  return routes.map(r => r.passengers);
}

export function mergeSmallRoutes(routes) {
  let changed = true;
  let result  = routes.map(r => ({ ...r, passengers: [...r.passengers] }));
  while (changed) {
    changed         = false;
    const smallIdx  = result.findIndex(r => r.passengers.length < MIN_ROUTE_PASSENGERS);
    if (smallIdx === -1) break;
    const small     = result[smallIdx];
    const isCarGrp  = small.passengers.every(p => p.vehiclePreference === 'car');
    const smallCent = centroid(small.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
    let bestIdx = -1, bestDist = Infinity;
    result.forEach((target, idx) => {
      if (idx === smallIdx) return;
      const allCompat = small.passengers.every(sp => target.passengers.every(tp => canMergeByPreference(sp, tp)));
      if (!allCompat) return;
      const merged    = [...target.passengers, ...small.passengers];
      const vForMerge = resolveVehicleForGroup(merged);
      if (merged.length > VEHICLE_CAPS[vForMerge]) return;
      if (isCarGrp || target.passengers.every(p => p.vehiclePreference === 'car')) {
        if (!carPassengersWithinSpread(merged)) return;
      }
      const tCent = centroid(target.passengers.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
      const dist  = haversineKm(smallCent.lat, smallCent.lng, tCent.lat, tCent.lng);
      const rad   = small.passengers.length === 1 ? SOLO_MERGE_RADIUS_KM : MAX_MERGE_RADIUS_KM;
      if (dist < rad && dist < bestDist) { bestDist = dist; bestIdx = idx; }
    });
    if (bestIdx !== -1) {
      const target = result[bestIdx];
      const mergedPax = [...target.passengers, ...small.passengers];
      const mergedForced = (target.forced === 'car' || small.forced === 'car')
        ? 'car'
        : resolveVehicleForGroup(mergedPax, target.forced || small.forced);
      result[bestIdx] = {
        ...target,
        passengers:  mergedPax,
        forced:      mergedForced,
        mergedFrom:  (target.mergedFrom || 0) + small.passengers.length,
      };
      result.splice(smallIdx, 1);
      changed = true;
    } else break;
  }
  return result;
}

export function splitOversizedRoutes(routes) {
  const result = [];
  for (const route of routes) {
    const vType = route.forced || resolveVehicleForGroup(route.passengers);
    const cap   = VEHICLE_CAPS[vType];
    if (route.passengers.length <= cap) {
      result.push(route);
    } else {
      const sorted = nearestNeighborSort(route.passengers);
      for (let i = 0; i < sorted.length; i += cap)
        result.push({ ...route, passengers: sorted.slice(i, i + cap) });
    }
  }
  return result;
}

// ─── FUEL CALCULATION ────────────────────────────────────────────────────────

export function calculateFuel(distanceKm, vehicleType) {
  const consumption = PK_FUEL.consumption[vehicleType] || 15;
  const fuelType    = PK_FUEL.fuelType[vehicleType] || 'diesel';
  const pricePerL   = PK_FUEL.pricePerLitre[fuelType];
  const minFuel     = PK_FUEL.minFuelLitres[vehicleType] || 2.0;
  const rawFuel     = (distanceKm * consumption) / 100;
  const fuelLitres  = Math.max(rawFuel, minFuel);
  return {
    fuelLitres:  parseFloat(fuelLitres.toFixed(2)),
    fuelCostPKR: Math.round(fuelLitres * pricePerL),
    fuelType,
    consumption,
  };
}

// ─── REVERSE GEOCODING ───────────────────────────────────────────────────────

export async function reverseGeocode(lat, lng) {
  try {
    const url  = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'TransporterApp/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.display_name) {
      const addr  = data.address || {};
      const parts = [
        addr.road || addr.pedestrian || addr.footway || addr.hamlet,
        addr.suburb || addr.neighbourhood || addr.village || addr.quarter,
        addr.city || addr.town || addr.county || addr.state,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
    }
  } catch (e) { console.warn(`reverseGeocode failed (${lat},${lng}):`, e.message); }
  return `${safeNum(lat).toFixed(4)}, ${safeNum(lng).toFixed(4)}`;
}

// ─── SOLVICE ROUTE MATRIX ────────────────────────────────────────────────────

export async function getSolviceRoute(waypoints, destination) {
  try {
    const allPts    = [...waypoints, destination];
    const locations = allPts.map((p, i) => ({ id: `loc_${i}`, lat: safeNum(p.lat), lng: safeNum(p.lng) }));
    const res = await fetch(`${SOLVICE_BASE}/v2/matrix`, {
      method:  'POST',
      headers: { 'Authorization': SOLVICE_API_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sources: locations.map(l => l.id), destinations: locations.map(l => l.id), locations, profile: 'car' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.distances && data?.durations) {
      let distM = 0, durS = 0;
      for (let i = 0; i < allPts.length - 1; i++) {
        distM += data.distances?.[i]?.[i + 1] || 0;
        durS  += data.durations?.[i]?.[i + 1]  || 0;
      }
      if (distM > 0 && distM < 500000)
        return { distanceKm: distM / 1000, durationMins: Math.max(10, Math.round(durS / 60)), source: 'solvice' };
    }
  } catch (e) { console.warn('[Solvice] matrix:', e.message); }
  return null;
}

// ─── SMART DRIVER ASSIGNMENT SCORER ─────────────────────────────────────────

export function scoreDriversForRoute(route, driversList) {
  const { VEHICLE_INFO } = require('../constants/vehicles');
  const routeVehicle  = route.vehicleType || 'van';
  const routePaxCount = route.passengers?.length || 0;
  const routePaxPrefs = (route.passengers || []).map(p => p.vehiclePreference).filter(Boolean);
  const hasCarPaxOnly = routePaxPrefs.length > 0 && routePaxPrefs.every(p => p === 'car');

  return driversList.map(driver => {
    let score        = 0;
    const reasons    = [];
    const dVehicle   = driver.vehicleType || driver.vehicle || 'van';
    const dCap       = VEHICLE_CAPS[dVehicle] || driver.capacity || 8;
    const dFill      = driver.passengers?.length || 0;
    const dAvailable = dCap - dFill;

    if (dVehicle === routeVehicle) {
      score += 50; reasons.push(`Vehicle match (${VEHICLE_INFO[dVehicle]?.label || dVehicle})`);
    } else if (dAvailable >= routePaxCount) {
      score += 15; reasons.push('Different vehicle but sufficient capacity');
    } else {
      score -= 20; reasons.push('Vehicle type mismatch');
    }
    if (dAvailable >= routePaxCount) {
      score += 20; reasons.push(`Capacity sufficient (${dAvailable} seats free)`);
    } else {
      score -= 30; reasons.push('Insufficient capacity');
    }
    if (hasCarPaxOnly && dVehicle !== 'car') { score -= 40; reasons.push('Passengers require a car'); }
    if (hasCarPaxOnly && dVehicle === 'car') { score += 20; reasons.push('Matches car-only requirement'); }
    if (driver.status === 'active') { score += 15; reasons.push('Driver is active'); }
    else { score -= 10; reasons.push('Driver is not active'); }
    if (dFill === 0)      { score += 10; reasons.push('No current passengers'); }
    else if (dFill <= 2)  { score += 5;  reasons.push('Light load'); }

    return { driver, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

// ─── MAIN ROUTE OPTIMIZATION ENGINE ─────────────────────────────────────────

class RouteOptimizationEngine {
  async optimize(allPassengers, onProgress) {
    const passengers = allPassengers.map((r, i) => normalizePassenger(r, i));
    const valid      = passengers.filter(p => isValidGPS(p.pickupLat, p.pickupLng));
    const invalid    = passengers.filter(p => !isValidGPS(p.pickupLat, p.pickupLng));

    onProgress?.(`Validating ${passengers.length} passengers...`);
    if (invalid.length) console.warn('[VRP] No GPS:', invalid.map(p => p.name));

    onProgress?.('Fetching pickup addresses...');
    for (let i = 0; i < valid.length; i++) {
      const p = valid[i];
      if ((!p.pickupAddress || p.pickupAddress === 'Pickup Point') && p.pickupLat && p.pickupLng) {
        valid[i] = { ...p, pickupAddress: await reverseGeocode(p.pickupLat, p.pickupLng) };
        onProgress?.(`Geocoding ${i + 1}/${valid.length}: ${valid[i].pickupAddress}`);
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    onProgress?.('Clustering passengers by destination...');
    const destGroups = groupPassengersByDestination(valid);
    onProgress?.(`Found ${destGroups.length} destination group(s)`);

    let allRouteGroups = [];

    for (const destGroup of destGroups) {
      const { destLat, destLng, destAddress, passengers: destPax } = destGroup;
      const depot = { lat: destLat, lng: destLng };
      onProgress?.(`Optimizing routes to: ${destAddress} (${destPax.length} pax)`);

      const carStrict  = destPax.filter(p => p.vehiclePreference === 'car');
      const busStrict  = destPax.filter(p => p.vehiclePreference === 'bus');
      const vanStrict  = destPax.filter(p => p.vehiclePreference === 'van');
      const autoAssign = destPax.filter(p => !p.vehiclePreference);

      const processSubgroup = (paxList, maxCap, forced) => {
        if (!paxList.length) return;
        const { inliers, outliers } = detectOutliers(paxList);
        let routes = inliers.length > 0 ? clarkWrightSavings(inliers, depot, maxCap) : [];
        for (const outlier of outliers) {
          let merged = false;
          for (let i = 0; i < routes.length; i++) {
            if (routes[i].length >= maxCap) continue;
            if (!routes[i].every(p => canMergeByPreference(p, outlier))) continue;
            const c = centroid(routes[i].map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
            if (haversineKm(c.lat, c.lng, outlier.pickupLat, outlier.pickupLng) <= SOLO_MERGE_RADIUS_KM) {
              routes[i].push(outlier); merged = true; break;
            }
          }
          if (!merged) routes.push([outlier]);
        }
        routes.forEach(r => allRouteGroups.push({ passengers: r, forced, destLat, destLng, destAddress }));
      };

      if (carStrict.length > 0) {
        const carClusters = splitCarPassengersByDistance(carStrict);
        carClusters.forEach(cluster => processSubgroup(cluster, VEHICLE_CAPS.car, 'car'));
      }
      const flexGroup = [...vanStrict, ...busStrict];
      if (flexGroup.length > 0) {
        const merged = [...vanStrict, ...busStrict];
        if (merged.length <= VEHICLE_CAPS.van) {
          processSubgroup(merged, VEHICLE_CAPS.van, vanStrict.length >= busStrict.length ? 'van' : 'bus');
        } else {
          processSubgroup(vanStrict, VEHICLE_CAPS.van, 'van');
          processSubgroup(busStrict, VEHICLE_CAPS.bus, 'bus');
        }
      }
      processSubgroup(autoAssign, VEHICLE_CAPS.bus, null);
    }

    onProgress?.('Merging small routes...');
    allRouteGroups = mergeSmallRoutes(allRouteGroups);
    allRouteGroups = splitOversizedRoutes(allRouteGroups);

    if (invalid.length > 0) {
      for (let i = 0; i < invalid.length; i += VEHICLE_CAPS.van)
        allRouteGroups.push({
          passengers:  invalid.slice(i, i + VEHICLE_CAPS.van),
          forced:      null,
          warning:     'No GPS coordinates — manual pickup required',
          destLat:     FALLBACK_DEST.lat,
          destLng:     FALLBACK_DEST.lng,
          destAddress: FALLBACK_DEST.address,
        });
    }

    if (!allRouteGroups.length) return [];
    onProgress?.(`Computing road distances for ${allRouteGroups.length} route(s)...`);

    const { VEHICLE_INFO } = require('../constants/vehicles');

    const routeResults = await Promise.allSettled(
      allRouteGroups.map(async ({ passengers: paxList, forced, warning, destLat, destLng, destAddress }, idx) => {
        const vType = forced || resolveVehicleForGroup(paxList);
        const cap   = VEHICLE_CAPS[vType];
        const dest  = { lat: safeNum(destLat, FALLBACK_DEST.lat), lng: safeNum(destLng, FALLBACK_DEST.lng), address: destAddress || FALLBACK_DEST.address };
        const nnSorted  = nearestNeighborSort(paxList);
        const optimized = twoOptImprove(nnSorted.map(p => ({ ...p, lat: p.pickupLat, lng: p.pickupLng })));
        const waypoints = optimized
          .map(p => ({ lat: safeNum(p.pickupLat || p.lat), lng: safeNum(p.pickupLng || p.lng) }))
          .filter(w => isValidGPS(w.lat, w.lng));

        let distanceKm = 0, durationMins = 0;
        if (waypoints.length > 0) {
          const solvice = await getSolviceRoute(waypoints, dest);
          if (solvice && solvice.distanceKm > 0 && solvice.distanceKm < 300) {
            distanceKm   = Math.max(solvice.distanceKm, PK_FUEL.minRouteKm[vType] || 12);
            durationMins = solvice.durationMins;
          } else {
            let straight = 0;
            for (let i = 0; i < waypoints.length - 1; i++)
              straight += haversineKm(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
            straight   += haversineKm(waypoints[waypoints.length - 1].lat, waypoints[waypoints.length - 1].lng, dest.lat, dest.lng);
            const roadKm  = straight * (PK_FUEL.roadFactor[vType] || 1.32);
            distanceKm    = Math.max(roadKm, PK_FUEL.minRouteKm[vType] || 12);
            durationMins  = Math.max(10, Math.round((distanceKm / (PK_FUEL.avgSpeedKmh[vType] || 23)) * 60));
          }
        } else {
          distanceKm   = PK_FUEL.minRouteKm[vType] || 12;
          durationMins = Math.round((distanceKm / (PK_FUEL.avgSpeedKmh[vType] || 23)) * 60);
        }

        const { fuelLitres, fuelCostPKR, fuelType, consumption } = calculateFuel(distanceKm, vType);
        const areaLabel   = getMostCommonArea(paxList.map(p => p.pickupAddress));
        const hasCarPref  = paxList.some(p => p.vehiclePreference === 'car');
        const hasFlexPref = paxList.some(p => p.vehiclePreference === 'van' || p.vehiclePreference === 'bus');
        const stops = [
          ...optimized.map(p => ({
            name:    p.name,
            address: p.pickupAddress || `${safeNum(p.pickupLat).toFixed(4)}, ${safeNum(p.pickupLng).toFixed(4)}`,
            lat:     safeNum(p.pickupLat || p.lat),
            lng:     safeNum(p.pickupLng || p.lng),
            type:    'pickup',
          })),
          { name: 'Destination', address: dest.address, lat: dest.lat, lng: dest.lng, type: 'dropoff' },
        ];

        return {
          id:              `route_${Date.now()}_${idx}`,
          vehicleType:     vType,
          passengerCount:  paxList.length,
          capacity:        cap,
          passengers:      paxList,
          stops,
          destination:     dest.address,
          destinationLat:  dest.lat,
          destinationLng:  dest.lng,
          estimatedKm:     fmtKm(distanceKm),
          estimatedTime:   fmtTime(durationMins),
          estimatedFuel:   fmtLitres(fuelLitres),
          fuelCostPKR:     fmtPKR(fuelCostPKR),
          fuelType,
          consumption:     `${consumption.toFixed(1)} L/100km`,
          fuelRatePerKm:   parseFloat((fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3)),
          rawDistanceKm:   parseFloat(distanceKm.toFixed(2)),
          rawDurationMins: durationMins,
          rawFuelLitres:   fuelLitres,
          rawFuelCostPKR:  fuelCostPKR,
          preferenceGroup: hasCarPref || hasFlexPref,
          areaLabel,
          warning:         warning || null,
          warnings:        warning ? [warning] : [],
        };
      }),
    );

    const final = routeResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    final.sort((a, b) => {
      const aHasCar = a.passengers.some(p => p.vehiclePreference === 'car');
      const bHasCar = b.passengers.some(p => p.vehiclePreference === 'car');
      if (aHasCar && !bHasCar) return -1;
      if (!aHasCar && bHasCar) return 1;
      if (a.preferenceGroup && !b.preferenceGroup) return -1;
      if (!a.preferenceGroup && b.preferenceGroup) return 1;
      return b.passengerCount - a.passengerCount;
    });
    return final;
  }
}

export const optimizer = new RouteOptimizationEngine();
export default RouteOptimizationEngine;