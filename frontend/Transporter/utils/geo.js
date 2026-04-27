import { FALLBACK_DEST } from '../constants/fuels';

export function safeNum(val, fallback = 0) {
  const n = parseFloat(val);
  return (!isNaN(n) && isFinite(n)) ? n : fallback;
}

export function isValidGPS(lat, lng) {
  const la = safeNum(lat), ln = safeNum(lng);
  return (la !== 0 || ln !== 0) && Math.abs(la) <= 90 && Math.abs(ln) <= 180;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const la1 = safeNum(lat1), ln1 = safeNum(lng1);
  const la2 = safeNum(lat2), ln2 = safeNum(lng2);
  if (!isValidGPS(la1, ln1) || !isValidGPS(la2, ln2)) return 0;
  const R    = 6371;
  const dLat = (la2 - la1) * Math.PI / 180;
  const dLng = (ln2 - ln1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function centroid(points) {
  const v = points.filter(p => isValidGPS(p.lat, p.lng));
  if (!v.length) return FALLBACK_DEST;
  return {
    lat: v.reduce((s, p) => s + safeNum(p.lat), 0) / v.length,
    lng: v.reduce((s, p) => s + safeNum(p.lng), 0) / v.length,
  };
}

export function isToday(dateVal) {
  if (!dateVal) return false;
  try {
    const d     = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth()    === today.getMonth()    &&
      d.getDate()     === today.getDate()
    );
  } catch (_) { return false; }
}

export function getMostCommonArea(addresses) {
  if (!addresses.length) return 'Area';
  const parts = addresses.map(a => {
    const s = String(a || ''), p = s.split(',');
    return p.length > 1 ? p[1].trim() : p[0].trim();
  }).filter(Boolean);
  const freq = {};
  parts.forEach(p => { freq[p] = (freq[p] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Route';
}