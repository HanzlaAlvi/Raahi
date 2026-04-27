'use strict';
const axios = require('axios');
const { SOLVICE_API_KEY, SOLVICE_BASE } = require('../config/constants');

const ALPHA = 0.7, BETA = 0.3;
const VEHICLE_CAPS = { car: 4, van: 12, bus: 30 };
const PAKISTAN_FUEL = {
  consumption:   { car: 10, van: 14, bus: 28 },
  fuelType:      { car: 'petrol', van: 'diesel', bus: 'diesel' },
  pricePerLitre: { petrol: 278, diesel: 283, cng: 130 },
  roadFactor:    { car: 1.30, van: 1.28, bus: 1.25 },
};

function haversineMeters(a, b) {
  const R = 6371000, d2r = Math.PI/180;
  const dLat = (b.lat-a.lat)*d2r, dLon = (b.lng-a.lng)*d2r;
  const x = Math.sin(dLat/2)**2 + Math.cos(a.lat*d2r)*Math.cos(b.lat*d2r)*Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(x));
}
function calculatePakistanFuel(straightLineKm, vehicleType = 'van') {
  const vt = vehicleType.toLowerCase();
  const actualRoadKm        = straightLineKm * (PAKISTAN_FUEL.roadFactor[vt] || 1.30);
  const consumptionPer100km = PAKISTAN_FUEL.consumption[vt] || 14;
  const fuelLitres          = (actualRoadKm * consumptionPer100km) / 100;
  const fType               = PAKISTAN_FUEL.fuelType[vt] || 'petrol';
  return { fuelLitres: parseFloat(fuelLitres.toFixed(2)), fuelCostPKR: Math.round(fuelLitres * PAKISTAN_FUEL.pricePerLitre[fType]), fuelType: fType, actualRoadKm: parseFloat(actualRoadKm.toFixed(1)), consumptionPer100km, pricePerLitre: PAKISTAN_FUEL.pricePerLitre[fType] };
}
async function getMatrix(locations) {
  const v = locations.map(l => ({ lat: typeof l.lat==='number'?l.lat:33.6844, lng: typeof l.lng==='number'?l.lng:73.0479 }));
  try {
    const locs = v.map((l, i) => ({ id: `loc_${i}`, lat: l.lat, lng: l.lng }));
    const { data } = await axios.post(`${SOLVICE_BASE}/v2/matrix`, { sources: locs.map(l => l.id), destinations: locs.map(l => l.id), locations: locs, profile: 'car' }, { headers: { Authorization: SOLVICE_API_KEY, 'Content-Type': 'application/json' }, timeout: 10000 });
    if (data?.distances && data?.durations) return { durations: data.durations, distances: data.distances, source: 'solvice' };
  } catch (e) { console.warn('[Solvice] getMatrix:', e.message); }
  const n = v.length;
  const D = Array.from({length:n}, () => Array(n).fill(0));
  const T = Array.from({length:n}, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i!==j) { const d=haversineMeters(v[i],v[j]); D[i][j]=d; T[i][j]=d/8.33; }
  return { durations: T, distances: D, source: 'haversine' };
}
function routeCost(dur, dist) { return ALPHA*dur + BETA*dist; }
function bestInsertionCost(matrix, route, pi, di) {
  if (route.length < 2) return { cost: (matrix.durations[route[0]]?.[pi]||0)+(matrix.durations[pi]?.[di]||0), position: 1 };
  let best = Infinity, pos = 1;
  for (let i = 0; i < route.length-1; i++) {
    const a = route[i], b = route[i+1];
    const c = routeCost((matrix.durations[a]?.[pi]||0)+(matrix.durations[pi]?.[di]||0)+(matrix.durations[di]?.[b]||0)-(matrix.durations[a]?.[b]||0),(matrix.distances[a]?.[pi]||0)+(matrix.distances[pi]?.[di]||0)+(matrix.distances[di]?.[b]||0)-(matrix.distances[a]?.[b]||0));
    if (c < best) { best = c; pos = i+1; }
  }
  return { cost: best, position: pos };
}
function summariseRoute(route, matrix, vehicleType='van') {
  let distM = 0, durS = 0;
  for (let i = 1; i < route.length; i++) { distM += matrix.distances[route[i-1]]?.[route[i]]||0; durS += matrix.durations[route[i-1]]?.[route[i]]||0; }
  const fuel = calculatePakistanFuel(distM/1000, vehicleType), mins = Math.round(durS/60);
  return { estimatedKm: `${fuel.actualRoadKm.toFixed(1)} km`, estimatedTime: mins<60?`${mins} min`:`${Math.floor(mins/60)}h ${mins%60}m`, estimatedFuel: `${fuel.fuelLitres.toFixed(1)} L`, fuelCostPKR: `Rs. ${fuel.fuelCostPKR}`, fuelType: fuel.fuelType, fuelRatePerKm: parseFloat((fuel.fuelLitres/Math.max(fuel.actualRoadKm,0.1)).toFixed(3)) };
}
function pickBestVehicle(count) { return count<=4?'car':count<=12?'van':'bus'; }

async function optimiseRoutesLegacy(rawPassengers, rawDrivers) {
  if (!rawPassengers?.length) return [];
  const norm = (c, fLat, fLng) => ({ lat: typeof c?.lat==='number'?c.lat:(parseFloat(c?.latitude)||fLat||33.6844), lng: typeof c?.lng==='number'?c.lng:(parseFloat(c?.longitude)||fLng||73.0479) });
  const passengers  = rawPassengers.map((p,i) => ({ ...p, _i:i, id:p.id||p._id||`p_${i}`, pickupLoc:norm(p.pickupLocation,p.pickupLat,p.pickupLng), dropLoc:norm(p.dropLocation,p.dropLat||p.destinationLatitude,p.dropLng||p.destinationLongitude), vehiclePreference:p.vehiclePreference||null }));
  const drivers     = (rawDrivers||[]).map((d,i) => ({ ...d, _i:i, id:d.id||d._id||`d_${i}`, vehicleType:d.vehicleType||d.vehicle||'van', currentLoc:norm(d.currentLocation,d.lat,d.lng), capacityMax:VEHICLE_CAPS[d.vehicleType||d.vehicle||'van']||8 }));
  const nD=drivers.length, nP=passengers.length;
  const pIdx=i=>nD+i, dIdx=i=>nD+nP+i;
  const matrix = await getMatrix([...drivers.map(d=>d.currentLoc),...passengers.map(p=>p.pickupLoc),...passengers.map(p=>p.dropLoc)]);
  const prefGroups = { car:[], van:[], bus:[], none:[] };
  passengers.forEach(p => { const k=p.vehiclePreference||'none'; (prefGroups[k]||prefGroups.none).push(p); });
  const assignments=[], assignedIds=new Set(), usedDrivers=new Set();
  ['car'].forEach(pref => {
    const group=prefGroups[pref].filter(p=>!assignedIds.has(p.id)); if(!group.length) return;
    const cap=VEHICLE_CAPS[pref], available=drivers.filter(d=>d.vehicleType===pref&&!usedDrivers.has(d._i));
    for (let s=0;s<group.length;s+=cap) { const chunk=group.slice(s,s+cap), driver=available.shift()||null; if(driver) usedDrivers.add(driver._i); assignments.push({driver,passengers:chunk,vehicleType:pref,warnings:driver?[]:[`No ${pref} driver available`],preferenceGroup:true}); chunk.forEach(p=>assignedIds.add(p.id)); }
  });
  const flexGroup=[...prefGroups['van'],...prefGroups['bus']].filter(p=>!assignedIds.has(p.id));
  if (flexGroup.length) {
    for (let s=0;s<flexGroup.length;s+=VEHICLE_CAPS.bus) {
      const chunk=flexGroup.slice(s,s+VEHICLE_CAPS.bus), rt=chunk.length<=VEHICLE_CAPS.van?'van':'bus';
      const avail=drivers.filter(d=>(d.vehicleType===rt||d.vehicleType==='van'||d.vehicleType==='bus')&&!usedDrivers.has(d._i)), driver=avail.shift()||null;
      if(driver) usedDrivers.add(driver._i);
      const warn=[]; if(!driver) warn.push(`No ${rt} driver available`); if(chunk.some(p=>p.vehiclePreference==='van'&&rt==='bus')) warn.push('🔄 Van→Bus upgrade'); if(chunk.some(p=>p.vehiclePreference==='bus'&&rt==='van')) warn.push('🔄 Bus→Van downgrade');
      assignments.push({driver,passengers:chunk,vehicleType:rt,warnings:warn,preferenceGroup:true}); chunk.forEach(p=>assignedIds.add(p.id));
    }
  }
  const remaining=passengers.filter(p=>!assignedIds.has(p.id));
  if (remaining.length) {
    const MERGE_R=10000, clusters=[], clustered=new Set();
    remaining.forEach(p=>{if(clustered.has(p._i)) return; const cl=[p]; clustered.add(p._i); remaining.forEach(q=>{if(!clustered.has(q._i)&&haversineMeters(p.pickupLoc,q.pickupLoc)<=MERGE_R){cl.push(q);clustered.add(q._i);}}); clusters.push(cl);});
    const large=clusters.filter(c=>c.length>1), solos=clusters.filter(c=>c.length===1);
    solos.forEach(s=>{if(large.length){let mn=Infinity,nr=large[0]; large.forEach(cl=>{const d=haversineMeters(s[0].pickupLoc,cl[0].pickupLoc);if(d<mn){mn=d;nr=cl;}}); nr.push(s[0]);} else large.push(s);});
    const freeDrivers=drivers.filter(d=>!usedDrivers.has(d._i));
    (large.length?large:clusters).sort((a,b)=>b.length-a.length).forEach(cluster=>{
      const ideal=pickBestVehicle(cluster.length), cap=VEHICLE_CAPS[ideal];
      for (let s=0;s<cluster.length;s+=cap) {
        const chunk=cluster.slice(s,s+cap), idealType=pickBestVehicle(chunk.length);
        let di2=freeDrivers.findIndex(d=>d.vehicleType===idealType); if(di2===-1) di2=freeDrivers.findIndex(d=>VEHICLE_CAPS[d.vehicleType]>=chunk.length); if(di2===-1&&freeDrivers.length) di2=0;
        const driver=di2>=0?freeDrivers.splice(di2,1)[0]:null, actualType=driver?driver.vehicleType:idealType;
        if(driver) usedDrivers.add(driver._i);
        const warn=[]; if(!driver) warn.push(`No driver for ${idealType}`); if(driver&&driver.vehicleType!==idealType) warn.push(`Using ${driver.vehicleType} instead of ${idealType}`);
        assignments.push({driver,passengers:chunk,vehicleType:actualType,warnings:warn,preferenceGroup:false}); chunk.forEach(p=>assignedIds.add(p.id));
      }
    });
  }
  return assignments.filter(a=>a.passengers.length).map(a=>{
    const routeSeq=a.driver?[a.driver._i]:[pIdx(a.passengers[0]._i)];
    a.passengers.forEach(p=>{
      const pi=pIdx(p._i), di=dIdx(p._i);
      if(routeSeq.length===1){routeSeq.push(pi,di);}
      else {
        const {position}=bestInsertionCost(matrix,routeSeq,pi,di); routeSeq.splice(position,0,pi);
        const pp=routeSeq.indexOf(pi); let bp=pp+1, bc=Infinity;
        for(let j=pp+1;j<=routeSeq.length;j++){const prev=routeSeq[j-1],next=j<routeSeq.length?routeSeq[j]:null; const c=next!==null?routeCost((matrix.durations[prev]?.[di]||0)+(matrix.durations[di]?.[next]||0)-(matrix.durations[prev]?.[next]||0),(matrix.distances[prev]?.[di]||0)+(matrix.distances[di]?.[next]||0)-(matrix.distances[prev]?.[next]||0)):routeCost(matrix.durations[prev]?.[di]||0,matrix.distances[prev]?.[di]||0); if(c<bc){bc=c;bp=j;}}
        routeSeq.splice(bp,0,di);
      }
    });
    const vType=a.vehicleType||'van', {estimatedKm,estimatedTime,estimatedFuel,fuelCostPKR,fuelType,fuelRatePerKm}=summariseRoute(routeSeq,matrix,vType);
    const stopMap={}; a.passengers.forEach(p=>{stopMap[pIdx(p._i)]={name:p.name||'Passenger',address:p.pickupAddress||p.pickupPoint||'Pickup',type:'pickup'};stopMap[dIdx(p._i)]={name:p.name||'Passenger',address:p.dropAddress||p.destination||'Drop-off',type:'dropoff'};});
    const stops=routeSeq.filter(r=>stopMap[r]).map(r=>stopMap[r].address||stopMap[r].name||'Stop');
    const cap=VEHICLE_CAPS[vType]||8, paxCount=a.passengers.length;
    if(paxCount>cap) a.warnings.push(`⚠ ${paxCount} passengers exceed ${vType} capacity (${cap})`);
    return { driverId:a.driver?.id||null, driverName:a.driver?.name||`Needs ${vType.toUpperCase()} Driver`, vehicleType:vType, vehicleCapacity:cap, passengerCount:paxCount, passengers:a.passengers.map(({_i,pickupLoc,dropLoc,...rest})=>rest), stops, estimatedTime, estimatedFuel, estimatedKm, fuelCostPKR, fuelType, fuelRatePerKm, warnings:[...new Set(a.warnings)], isNewRoute:!a.driver, preferenceGroup:a.preferenceGroup||false, matrixSource:matrix.source };
  });
}

module.exports = { optimiseRoutesLegacy };