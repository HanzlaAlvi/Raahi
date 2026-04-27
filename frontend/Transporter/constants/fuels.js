export const PK_FUEL = {
  consumption:   { car: 12,  van: 15,  bus: 30  },
  fuelType:      { car: 'petrol', van: 'diesel', bus: 'diesel' },
  pricePerLitre: { petrol: 278, diesel: 283 },
  roadFactor:    { car: 1.38, van: 1.32, bus: 1.28 },
  avgSpeedKmh:   { car: 28,  van: 23,  bus: 20  },
  minRouteKm:    { car: 8,   van: 12,  bus: 20  },
  minFuelLitres: { car: 1.0, van: 2.0, bus: 6.0 },
};

export const OPT_WEIGHTS = { distance: 0.35, time: 0.35, fuel: 0.30 };

export const FALLBACK_DEST = { lat: 33.6135, lng: 73.1998, address: 'Destination' };

export const DEST_CLUSTER_RADIUS_KM = 2.5;
export const MIN_ROUTE_PASSENGERS   = 2;
export const MAX_MERGE_RADIUS_KM    = 12;
export const SOLO_MERGE_RADIUS_KM   = 15;
export const CAR_MAX_SPREAD_KM      = 8;

export const NOMINATIM       = 'https://nominatim.openstreetmap.org';
export const SOLVICE_API_KEY = 'dc6ef2c9-6e86-4049-aa96-663750b1ee5a';
export const SOLVICE_BASE    = 'https://api.solvice.io';
export const API_BASE        = 'https://raahi-q2ur.onrender.com/api';