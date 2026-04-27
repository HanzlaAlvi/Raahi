export const fmtTime = (m) => {
  const mm = Math.round(m);
  if (mm < 60) return `${mm} min`;
  const h = Math.floor(mm / 60), r = mm % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
};

export const fmtKm = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${parseFloat(km).toFixed(1)} km`;

export const fmtLitres = (l) => `${parseFloat(l).toFixed(2)} L`;

export const fmtPKR = (r) => `Rs. ${Math.round(r).toLocaleString('en-PK')}`;

export const prefLabel = (pref, count) => {
  if (!pref || pref === 'auto') return `${count} Auto-assign`;
  if (pref === 'car') return `${count} Car (strict)`;
  const labels = { van: 'Van', bus: 'Bus' };  
  return `${count} ${labels[pref] || pref} (flexible)`;
};