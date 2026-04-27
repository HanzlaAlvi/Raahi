// frontend/utils/validation.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared validation rules — used by ALL profile edit screens and register screens
// Import: import { validate, RULES } from '../utils/validation';
// ─────────────────────────────────────────────────────────────────────────────

// ── Individual validators ────────────────────────────────────────────────────
export const RULES = {

  name: (v) => {
    const s = (v || '').trim();
    if (!s)                         return 'Full name is required.';
    if (s.length < 3)               return 'Name must be at least 3 characters.';
    if (/\d/.test(s))               return 'Name must not contain numbers.';
    if (!/^[a-zA-Z\s]+$/.test(s))  return 'Name can only contain letters and spaces.';
    return null;
  },

  phone: (v) => {
    const s = (v || '').trim();
    if (!s)                         return 'Phone number is required.';
    if (!/^\d+$/.test(s))          return 'Phone must contain digits only.';
    if (s.length !== 11)            return 'Phone must be exactly 11 digits (e.g. 03XXXXXXXXX).';
    if (!s.startsWith('03'))        return 'Phone must start with 03 (Pakistan format).';
    return null;
  },

  company: (v) => {
    const s = (v || '').trim();
    if (!s)                              return 'Company name is required.';
    if (/^\d+$/.test(s))                return 'Company name cannot be only numbers.';
    if (!/^[a-zA-Z0-9\s.,\-&]+$/.test(s)) return 'Only letters, numbers, spaces and . , - & are allowed.';
    return null;
  },

  license: (v) => {
    const s = (v || '').trim();
    if (!s)  return 'License number is required.';
    // Accept digits-only OR digits-with-dashes (CNIC format: XXXXX-XXXXXXX-X = 15 chars with dashes)
    // Also accept free-form license up to 30 chars
    const stripped = s.replace(/-/g, '');
    if (!/^\d+$/.test(stripped)) return 'License must contain digits only (dashes allowed).';
    if (stripped.length < 5)     return 'License number is too short.';
    if (stripped.length > 30)    return 'License number is too long.';
    return null;
  },

  country: (v) => {
    const s = (v || '').trim();
    if (!s)                        return 'Country is required.';
    if (/\d/.test(s))              return 'Country must not contain numbers.';
    if (!/^[a-zA-Z\s]+$/.test(s)) return 'Country can only contain letters.';
    return null;
  },

  city: (v) => {
    const s = (v || '').trim();
    if (!s)                        return 'City is required.';
    if (/\d/.test(s))              return 'City must not contain numbers.';
    if (!/^[a-zA-Z\s]+$/.test(s)) return 'City can only contain letters.';
    return null;
  },

  zone: (v) => {
    const s = (v || '').trim();
    if (!s)                           return 'Zone/Region is required.';
    if (!/^[a-zA-Z0-9\s\-]+$/.test(s)) return 'Zone can contain letters, numbers, spaces and hyphens (e.g. I-10).';
    return null;
  },

  address: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Address is required. Please select from the map.';
    if (s.length < 5) return 'Please select a valid address from the map.';
    return null;
  },

  // Driver-specific
  vehicleNo: (v) => {
    const s = (v || '').trim();
    if (!s)           return 'Vehicle number is required.';
    if (s.length < 4) return 'Please enter a valid vehicle number.';
    return null;
  },

  experience: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Experience is required.';
    return null;
  },

  // Passenger-specific
  pickupPoint: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Pickup point is required.';
    return null;
  },

  destination: (v) => {
    const s = (v || '').trim();
    if (!s) return 'Destination is required.';
    return null;
  },
};

// ── Validate a map of { fieldKey: value } against a set of rule keys ─────────
// Usage:
//   const errs = validate(editData, ['name','phone','company']);
//   if (Object.keys(errs).length) { setErrors(errs); return; }
export function validate(data, fields) {
  const errs = {};
  for (const key of fields) {
    if (RULES[key]) {
      const msg = RULES[key](data[key]);
      if (msg) errs[key] = msg;
    }
  }
  return errs;
}