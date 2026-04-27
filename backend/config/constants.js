'use strict';

const JWT_SECRET = 'fyp_transport_app_2026_super_secure_secret_key';
const NOMINATIM_BASE  = 'https://nominatim.openstreetmap.org';
const SOLVICE_API_KEY = 'dc6ef2c9-6e86-4049-aa96-663750b1ee5a';
const SOLVICE_BASE    = 'https://api.solvice.io';

const ICON_MAP = {
  poll:         'poll',
  route:        'map',
  confirmation: 'checkmark-circle',
  alert:        'warning',
  complaint:    'alert-circle',
  feedback:     'star',
  general:      'notifications',
  request:      'person-add',
};

const COLOR_MAP = {
  poll:         '#2196F3',
  route:        '#A1D826',
  confirmation: '#4CAF50',
  alert:        '#FF9800',
  complaint:    '#F44336',
  feedback:     '#FFD700',
  general:      '#9E9E9E',
  request:      '#9C27B0',
};

module.exports = { JWT_SECRET, NOMINATIM_BASE, SOLVICE_API_KEY, SOLVICE_BASE, ICON_MAP, COLOR_MAP };