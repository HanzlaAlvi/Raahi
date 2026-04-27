// ─────────────────────────────────────────────────────────────────────────────
// LOCATION SERVICE
// Google Maps / Expo Location utilities
// ─────────────────────────────────────────────────────────────────────────────

import * as Location from 'expo-location';
import axios from 'axios';
import { GOOGLE_MAPS_API_KEY } from '../constants/api';

/**
 * Request location permission and return current coordinates + address
 */
export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
  });

  const coordinates = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  };

  try {
    const res = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.latitude},${coordinates.longitude}&key=${GOOGLE_MAPS_API_KEY}`
    );
    if (res.data.status === 'OK' && res.data.results.length > 0) {
      return {
        coordinates,
        address: res.data.results[0].formatted_address,
      };
    }
  } catch {}

  // Fallback to raw coords
  return {
    coordinates,
    address: `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
  };
};

/**
 * Search for location predictions using Places Autocomplete
 */
export const searchLocations = async (query) => {
  if (!query || query.trim().length < 3) return [];
  const res = await axios.get(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&components=country:pk`
  );
  return res.data.status === 'OK' ? res.data.predictions : [];
};

/**
 * Get coordinates + address for a Google Place ID
 */
export const getPlaceDetails = async (placeId) => {
  const res = await axios.get(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}`
  );
  if (res.data.status !== 'OK') throw new Error('Place details fetch failed');
  const { lat, lng } = res.data.result.geometry.location;
  return { latitude: lat, longitude: lng };
};

/**
 * Build a Static Maps URL for a given coordinate
 */
export const getStaticMapUrl = (lat, lng, color = 'green', label = 'P') =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=color:${color}%7Clabel:${label}%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

/**
 * Simple ETA estimate based on straight-line distance
 */
export const estimateETA = (driverLocation, passengerLocation) => {
  if (!driverLocation || !passengerLocation) return 'Calculating...';
  const dist = Math.sqrt(
    Math.pow(driverLocation.latitude - passengerLocation.latitude, 2) +
    Math.pow(driverLocation.longitude - passengerLocation.longitude, 2)
  );
  return `${Math.max(1, Math.round(dist * 100 * 2))} min`;
};
