// ══════════════════════════════════════════════════════════════════
// GEMINI-POWERED ROUTE OPTIMIZATION ENGINE
// Replaces all hardcoded algorithms with Gemini AI
// Drop this file into your project and import `optimizer`
// ══════════════════════════════════════════════════════════════════

const GEMINI_API_KEY = 'AIzaSyDVGL0eZBEztg1X-P6hGMTq9ygJ-y39VA4';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Pakistan fuel constants (still used for fallback display) ────
const PK_FUEL = {
  consumption:   { car: 12,  van: 15,  bus: 30  },
  fuelType:      { car: 'petrol', van: 'diesel', bus: 'diesel' },
  pricePerLitre: { petrol: 278, diesel: 283 },
  avgSpeedKmh:   { car: 28,  van: 23,  bus: 20  },
  minRouteKm:    { car: 8,   van: 12,  bus: 20  },
  minFuelLitres: { car: 1.0, van: 2.0, bus: 6.0 },
};

const VEHICLE_CAPS = { car: 4, van: 12, bus: 30 };

const fmtTime   = (m) => { const mm = Math.round(m); if (mm < 60) return `${mm} min`; const h = Math.floor(mm/60), r = mm%60; return r===0?`${h}h`:`${h}h ${r}m`; };
const fmtKm     = (km) => km < 1 ? `${Math.round(km*1000)} m` : `${parseFloat(km).toFixed(1)} km`;
const fmtLitres = (l)  => `${parseFloat(l).toFixed(1)} L`;
const fmtPKR    = (r)  => `Rs. ${Math.round(r).toLocaleString('en-PK')}`;

// ─── Haversine (used only for rough passenger grouping before Gemini) ─
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const a1 = parseFloat(lat1), o1 = parseFloat(lng1);
  const a2 = parseFloat(lat2), o2 = parseFloat(lng2);
  if (!a1||!o1||!a2||!o2||isNaN(a1)||isNaN(o1)||isNaN(a2)||isNaN(o2)) return 0;
  const dLat = (a2-a1)*Math.PI/180;
  const dLng = (o2-o1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(a1*Math.PI/180)*Math.cos(a2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Centroid helper ──────────────────────────────────────────────
function centroid(points) {
  const v = points.filter(p => p.lat && p.lng);
  if (!v.length) return { lat: 33.6135, lng: 73.1998 };
  return {
    lat: v.reduce((s,p) => s+parseFloat(p.lat), 0) / v.length,
    lng: v.reduce((s,p) => s+parseFloat(p.lng), 0) / v.length,
  };
}

// ─── Reverse geocode via Nominatim ────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'TransporterApp/1.0' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.display_name) {
      const addr  = data.address || {};
      const parts = [
        addr.road || addr.pedestrian || addr.footway || addr.hamlet,
        addr.suburb || addr.neighbourhood || addr.village || addr.quarter,
        addr.city || addr.town || addr.county || addr.state,
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : data.display_name.split(',').slice(0,3).join(', ');
    }
  } catch (e) {
    console.warn(`reverseGeocode failed (${lat},${lng}):`, e.message);
  }
  return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
}

// ══════════════════════════════════════════════════════════════════
// ─── GEMINI ROUTE OPTIMIZER ───────────────────────────────────────
// Sends passenger pickup locations + destination to Gemini.
// Gemini returns:
//   - Optimal pickup ORDER (sorted stops)
//   - Road distance between each consecutive stop (km)
//   - Drive time between each stop (minutes)  <-- Pakistan traffic conditions
//   - Total route distance (km)
//   - Total route time (minutes)
//   - Fuel litres needed
//   - Fuel cost in PKR
//   - Optimization score (0-100)
//   - Any warnings
// ══════════════════════════════════════════════════════════════════

async function callGemini(prompt) {
  const body = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,       // Low temp for deterministic route calculations
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    }
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');

  // Strip markdown code fences if present
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  return JSON.parse(clean);
}

// ─── GROUP PASSENGERS by proximity (before sending to Gemini) ─────
function groupPassengersByProximity(passengers, maxCap, forcedType) {
  if (passengers.length === 0) return [];
  if (passengers.length <= maxCap) return [passengers];

  const groups = [];
  const remaining = [...passengers];

  while (remaining.length > 0) {
    const group = [remaining.shift()];
    const anchor = group[0];

    // Sort remaining by distance to anchor
    remaining.sort((a, b) =>
      haversineKm(anchor.pickupLat, anchor.pickupLng, a.pickupLat, a.pickupLng) -
      haversineKm(anchor.pickupLat, anchor.pickupLng, b.pickupLat, b.pickupLng)
    );

    // Fill group to capacity
    while (group.length < maxCap && remaining.length > 0) {
      const next = remaining[0];
      const dist = haversineKm(anchor.pickupLat, anchor.pickupLng, next.pickupLat, next.pickupLng);
      // Only add if within 15km of group centroid
      const cent = centroid(group.map(p => ({ lat: p.pickupLat, lng: p.pickupLng })));
      const distFromCent = haversineKm(cent.lat, cent.lng, next.pickupLat, next.pickupLng);
      if (distFromCent <= 15) {
        group.push(remaining.shift());
      } else {
        break;
      }
    }

    groups.push(group);
  }

  return groups;
}

// ─── BUILD GEMINI PROMPT FOR ROUTE OPTIMIZATION ───────────────────
function buildRoutePrompt(passengers, destination, vehicleType) {
  const vInfo = {
    car: { label: 'Car (Suzuki/Toyota city car)', fuelType: 'Petrol', pricePerL: 278, consumptionPer100km: 12, capacity: 4 },
    van: { label: 'Van (Toyota HiAce/Shehzore)', fuelType: 'Diesel', pricePerL: 283, consumptionPer100km: 15, capacity: 12 },
    bus: { label: 'Bus (Hino/Isuzu Coach)',       fuelType: 'Diesel', pricePerL: 283, consumptionPer100km: 30, capacity: 30 },
  }[vehicleType] || { label: 'Van', fuelType: 'Diesel', pricePerL: 283, consumptionPer100km: 15, capacity: 12 };

  const passengerList = passengers.map((p, i) => ({
    index: i,
    id: p.id,
    name: p.name,
    pickupLat: p.pickupLat,
    pickupLng: p.pickupLng,
    pickupAddress: p.pickupAddress || `${p.pickupLat}, ${p.pickupLng}`,
  }));

  return `
You are a route optimization AI for a Pakistan-based transport company operating in Islamabad/Rawalpindi.

## Task
Optimize the pickup route for a ${vInfo.label} to collect ${passengers.length} passengers and drop them at the destination.

## Vehicle Details
- Type: ${vehicleType} (${vInfo.label})
- Fuel: ${vInfo.fuelType} @ Rs.${vInfo.pricePerL}/litre
- Consumption: ${vInfo.consumptionPer100km} litres per 100km
- Capacity: ${vInfo.capacity} passengers

## Destination (Drop-off)
- Address: ${destination.address}
- Lat: ${destination.lat}
- Lng: ${destination.lng}

## Passengers to Pick Up
${JSON.stringify(passengerList, null, 2)}

## Instructions
1. Determine the OPTIMAL pickup order to minimize total distance and time.
2. Calculate the ROAD distance (not straight-line) between each consecutive stop using your knowledge of Pakistani roads in Islamabad/Rawalpindi. Roads here are winding with many turns — factor in ~1.3x road multiplier over straight-line distance.
3. Calculate drive TIME between each stop considering:
   - Islamabad/Rawalpindi urban traffic: average 25-30 km/h in residential areas
   - Main roads (Constitution Ave, Murree Road, IJP Road): average 40-50 km/h
   - Include ~2-3 minutes stop time per passenger pickup
4. Calculate total fuel consumed and cost in PKR.
5. Give an optimization score 0-100 based on route efficiency.

## CRITICAL: Respond ONLY with this exact JSON structure (no markdown, no extra text):
{
  "orderedStops": [
    {
      "passengerIndex": 0,
      "passengerId": "string",
      "passengerName": "string",
      "pickupAddress": "string",
      "pickupLat": 0.0,
      "pickupLng": 0.0,
      "distanceFromPreviousStopKm": 0.0,
      "driveTimeFromPreviousStopMins": 0,
      "cumulativeDistanceKm": 0.0,
      "cumulativeTimeMins": 0,
      "segmentNote": "brief description e.g. via Jinnah Ave"
    }
  ],
  "finalLegToDestinationKm": 0.0,
  "finalLegToDestinationMins": 0,
  "totalRouteDistanceKm": 0.0,
  "totalRouteDurationMins": 0,
  "fuelLitres": 0.0,
  "fuelCostPKR": 0,
  "fuelType": "${vInfo.fuelType}",
  "optimizationScore": 0,
  "areaLabel": "short area name e.g. G-9/G-10",
  "routeSummary": "one sentence describing the route",
  "warnings": [],
  "distanceSource": "gemini-ai-estimate",
  "trafficCondition": "normal/heavy/light"
}
`;
}

// ──────────────────────────────────────────────────────────────────
// MAIN GEMINI OPTIMIZER CLASS
// ──────────────────────────────────────────────────────────────────
class RouteOptimizationEngine {
  constructor(config = {}) {
    this.DEFAULT_DEST_LAT  = config.destLat   || 33.6135;
    this.DEFAULT_DEST_LNG  = config.destLng   || 73.1998;
    this.DEFAULT_DEST_ADDR = config.destAddr  || 'Riphah International University, Gulberg Greens, Islamabad';
  }

  getBestVehicleType(count, forced = null) {
    if (forced) return forced;
    if (count <= VEHICLE_CAPS.car) return 'car';
    if (count <= VEHICLE_CAPS.van) return 'van';
    return 'bus';
  }

  // ─── MAIN OPTIMIZE METHOD ───────────────────────────────────────
  async optimize(allPassengers, onProgress) {
    // Step 1: Normalize passenger data
    const passengers = allPassengers.map((r, i) => ({
      id:              r.id || r._id?.$oid || r._id || `p_${i}`,
      name:            r.name || r.passengerName || `Passenger ${i+1}`,
      pickupLat:       parseFloat(r.pickupLat || r.latitude || 0),
      pickupLng:       parseFloat(r.pickupLng || r.longitude || 0),
      pickupAddress:   r.pickupAddress || r.pickupPoint || r.address || '',
      dropLat:         parseFloat(r.dropLat || r.destinationLatitude  || this.DEFAULT_DEST_LAT),
      dropLng:         parseFloat(r.dropLng || r.destinationLongitude || this.DEFAULT_DEST_LNG),
      dropAddress:     r.dropAddress || r.destination || r.destinationAddress || this.DEFAULT_DEST_ADDR,
      vehiclePreference: r.vehiclePreference || null,
      timeSlot:        r.selectedTimeSlot || r.timeSlot || null,
    }));

    const valid   = passengers.filter(p => !(p.pickupLat === 0 && p.pickupLng === 0));
    const invalid = passengers.filter(p => p.pickupLat === 0 && p.pickupLng === 0);

    onProgress?.(`Validating ${passengers.length} passengers...`);

    // Step 2: Reverse geocode missing addresses
    onProgress?.('Fetching pickup addresses from GPS coordinates...');
    for (let i = 0; i < valid.length; i++) {
      const p = valid[i];
      if ((!p.pickupAddress || p.pickupAddress === 'Pickup Point') && p.pickupLat && p.pickupLng) {
        valid[i] = {
          ...p,
          pickupAddress: await reverseGeocode(p.pickupLat, p.pickupLng),
        };
        onProgress?.(`Geocoding ${i+1}/${valid.length}: ${valid[i].pickupAddress}`);
        await new Promise(r => setTimeout(r, 1100)); // Nominatim 1 req/sec
      }
    }

    // Step 3: Group by vehicle preference
    const prefGroups = [
      { passengers: valid.filter(p => p.vehiclePreference === 'car'), forced: 'car' },
      { passengers: valid.filter(p => p.vehiclePreference === 'van'), forced: 'van' },
      { passengers: valid.filter(p => p.vehiclePreference === 'bus'), forced: 'bus' },
      { passengers: valid.filter(p => !p.vehiclePreference),          forced: null  },
    ].filter(g => g.passengers.length > 0);

    onProgress?.(`Building Gemini-optimized routes for ${valid.length} passengers...`);

    const allRouteInputs = [];

    for (const group of prefGroups) {
      const vType  = group.forced || this.getBestVehicleType(group.passengers.length);
      const maxCap = VEHICLE_CAPS[vType];

      // Split into vehicle-sized groups
      const subGroups = groupPassengersByProximity(group.passengers, maxCap, vType);

      for (const subGroup of subGroups) {
        const resolvedType = group.forced || this.getBestVehicleType(subGroup.length);
        allRouteInputs.push({
          passengers: subGroup,
          vehicleType: resolvedType,
          forced: !!group.forced,
        });
      }
    }

    // Add invalid (no GPS) as manual routes
    if (invalid.length > 0) {
      for (let i = 0; i < invalid.length; i += VEHICLE_CAPS.van) {
        allRouteInputs.push({
          passengers: invalid.slice(i, i + VEHICLE_CAPS.van),
          vehicleType: 'van',
          forced: false,
          noGps: true,
        });
      }
    }

    if (!allRouteInputs.length) return [];

    onProgress?.(`Sending ${allRouteInputs.length} route(s) to Gemini AI for optimization...`);

    // Step 4: Call Gemini for each route group
    const routeResults = await Promise.allSettled(
      allRouteInputs.map(async ({ passengers: paxList, vehicleType, forced, noGps }, idx) => {
        const dest = {
          lat:     paxList[0]?.dropLat  || this.DEFAULT_DEST_LAT,
          lng:     paxList[0]?.dropLng  || this.DEFAULT_DEST_LNG,
          address: paxList[0]?.dropAddress || this.DEFAULT_DEST_ADDR,
        };

        onProgress?.(`Gemini optimizing route ${idx+1}/${allRouteInputs.length} (${paxList.length} passengers)...`);

        let geminiResult = null;
        let usedFallback = false;

        if (!noGps && paxList.length > 0) {
          try {
            const prompt = buildRoutePrompt(paxList, dest, vehicleType);
            geminiResult = await callGemini(prompt);
          } catch (err) {
            console.warn(`Gemini failed for route ${idx+1}:`, err.message);
            usedFallback = true;
          }
        } else {
          usedFallback = true;
        }

        // ── Build route from Gemini result ───────────────────────
        let distanceKm, durationMins, fuelLitres, fuelCostPKR, fuelType,
            orderedPassengers, stops, areaLabel, optimizationScore, routeWarnings;

        if (geminiResult && !usedFallback) {
          // Use Gemini data
          distanceKm       = parseFloat(geminiResult.totalRouteDistanceKm) || PK_FUEL.minRouteKm[vehicleType];
          durationMins     = parseInt(geminiResult.totalRouteDurationMins)  || 30;
          fuelLitres       = parseFloat(geminiResult.fuelLitres)            || 2;
          fuelCostPKR      = parseInt(geminiResult.fuelCostPKR)             || 500;
          fuelType         = geminiResult.fuelType                          || PK_FUEL.fuelType[vehicleType];
          areaLabel        = geminiResult.areaLabel                         || 'Route';
          optimizationScore = parseInt(geminiResult.optimizationScore)      || 70;
          routeWarnings    = Array.isArray(geminiResult.warnings) ? geminiResult.warnings : [];

          // Re-order passengers based on Gemini's orderedStops
          const orderedStopData = geminiResult.orderedStops || [];
          const reordered = [];
          const usedIds = new Set();

          for (const stop of orderedStopData) {
            const pax = paxList.find(p =>
              p.id === stop.passengerId ||
              p.name === stop.passengerName ||
              parseInt(stop.passengerIndex) === paxList.indexOf(p)
            );
            if (pax && !usedIds.has(pax.id)) {
              reordered.push({ pax, stopData: stop });
              usedIds.add(pax.id);
            }
          }
          // Add any passengers Gemini missed
          for (const p of paxList) {
            if (!usedIds.has(p.id)) {
              reordered.push({ pax: p, stopData: null });
            }
          }

          orderedPassengers = reordered.map(r => r.pax);

          // Build stops array with Gemini's timing data
          stops = [
            ...reordered.map((r, i) => ({
              name:           r.pax.name,
              address:        r.pax.pickupAddress || `${r.pax.pickupLat?.toFixed(4)}, ${r.pax.pickupLng?.toFixed(4)}`,
              lat:            parseFloat(r.pax.pickupLat),
              lng:            parseFloat(r.pax.pickupLng),
              type:           'pickup',
              stopOrder:      i + 1,
              distFromPrev:   r.stopData ? `${parseFloat(r.stopData.distanceFromPreviousStopKm).toFixed(1)} km` : null,
              timeFromPrev:   r.stopData ? fmtTime(r.stopData.driveTimeFromPreviousStopMins) : null,
              cumulativeDist: r.stopData ? `${parseFloat(r.stopData.cumulativeDistanceKm).toFixed(1)} km` : null,
              cumulativeTime: r.stopData ? fmtTime(r.stopData.cumulativeTimeMins) : null,
              segmentNote:    r.stopData?.segmentNote || null,
            })),
            {
              name:           'Destination',
              address:        dest.address,
              lat:            dest.lat,
              lng:            dest.lng,
              type:           'dropoff',
              distFromPrev:   geminiResult.finalLegToDestinationKm
                                ? `${parseFloat(geminiResult.finalLegToDestinationKm).toFixed(1)} km`
                                : null,
              timeFromPrev:   geminiResult.finalLegToDestinationMins
                                ? fmtTime(geminiResult.finalLegToDestinationMins)
                                : null,
            },
          ];

          if (geminiResult.trafficCondition === 'heavy') {
            routeWarnings.push('Heavy traffic conditions expected — add buffer time');
          }
          if (geminiResult.routeSummary) {
            routeWarnings.unshift(`ℹ️ ${geminiResult.routeSummary}`);
          }

        } else {
          // ── Fallback: basic haversine estimate ───────────────────
          usedFallback = true;
          orderedPassengers = [...paxList];
          const consumption = PK_FUEL.consumption[vehicleType] || 15;
          const fuelTypeFB  = PK_FUEL.fuelType[vehicleType]    || 'diesel';
          const pricePerL   = PK_FUEL.pricePerLitre[fuelTypeFB];
          const minFuel     = PK_FUEL.minFuelLitres[vehicleType] || 2.0;
          const avgSpeed    = PK_FUEL.avgSpeedKmh[vehicleType]   || 25;

          // Simple haversine sum
          let straight = 0;
          for (let i = 0; i < paxList.length - 1; i++) {
            straight += haversineKm(paxList[i].pickupLat, paxList[i].pickupLng, paxList[i+1].pickupLat, paxList[i+1].pickupLng);
          }
          if (paxList.length > 0) {
            straight += haversineKm(paxList[paxList.length-1].pickupLat, paxList[paxList.length-1].pickupLng, dest.lat, dest.lng);
          }
          distanceKm       = Math.max(straight * 1.3, PK_FUEL.minRouteKm[vehicleType] || 12);
          durationMins     = Math.max(10, Math.round((distanceKm / avgSpeed) * 60));
          fuelLitres       = Math.max((distanceKm * consumption) / 100, minFuel);
          fuelCostPKR      = Math.round(fuelLitres * pricePerL);
          fuelType         = fuelTypeFB;
          areaLabel        = 'Route';
          optimizationScore = 50;
          routeWarnings    = noGps
            ? ['No GPS coordinates — manual pickup required']
            : ['Gemini unavailable — using haversine estimate'];

          stops = [
            ...paxList.map((p, i) => ({
              name:    p.name,
              address: p.pickupAddress || `${p.pickupLat?.toFixed(4)}, ${p.pickupLng?.toFixed(4)}`,
              lat:     parseFloat(p.pickupLat),
              lng:     parseFloat(p.pickupLng),
              type:    'pickup',
              stopOrder: i + 1,
            })),
            {
              name:    'Destination',
              address: dest.address,
              lat:     dest.lat,
              lng:     dest.lng,
              type:    'dropoff',
            },
          ];
        }

        // Capacity warning
        const cap = VEHICLE_CAPS[vehicleType];
        if (paxList.length > cap) {
          routeWarnings.push(`Exceeds ${vehicleType} capacity (${paxList.length}/${cap})`);
        }

        return {
          id:                 `route_${Date.now()}_${idx}`,
          vehicleType,
          passengerCount:     paxList.length,
          capacity:           cap,
          passengers:         orderedPassengers,
          stops,
          destination:        dest.address,
          estimatedKm:        fmtKm(distanceKm),
          estimatedTime:      fmtTime(durationMins),
          estimatedFuel:      fmtLitres(fuelLitres),
          fuelCostPKR:        fmtPKR(fuelCostPKR),
          fuelType,
          fuelRatePerKm:      parseFloat((fuelLitres / Math.max(distanceKm, 0.1)).toFixed(3)),
          rawDistanceKm:      parseFloat(distanceKm.toFixed(2)),
          rawDurationMins:    durationMins,
          rawFuelLitres:      fuelLitres,
          rawFuelCostPKR:     fuelCostPKR,
          matrixSource:       usedFallback ? 'haversine' : 'gemini-ai',
          optimizationScore,
          preferenceGroup:    forced,
          areaLabel,
          warnings:           routeWarnings,
          // Gemini extras (available when matrixSource === 'gemini-ai')
          geminiData:         geminiResult || null,
        };
      })
    );

    const final = routeResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    // Sort: preference groups first, then by optimization score
    final.sort((a, b) => {
      if (a.preferenceGroup && !b.preferenceGroup) return -1;
      if (!a.preferenceGroup && b.preferenceGroup) return 1;
      return b.optimizationScore - a.optimizationScore;
    });

    return final;
  }
}

// ── Module-level singleton (same interface as before) ─────────────
const optimizer = new RouteOptimizationEngine();

export { optimizer, RouteOptimizationEngine, PK_FUEL, VEHICLE_CAPS, fmtTime, fmtKm, fmtLitres, fmtPKR };
export default optimizer;