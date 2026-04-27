// apiService.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ══════════════════════════════════════════════════════
// ✅ FIXED: API Configuration with correct IP
// ══════════════════════════════════════════════════════
const API_BASE_URL = Platform.select({
  ios: 'http://localhost:3000',
  android: 'https://raahi-q2ur.onrender.com',
  default: 'https://raahi-q2ur.onrender.com'
});

console.log('🌐 API Base URL:', API_BASE_URL);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor - Add auth token to all requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token || token.trim() === '') throw new Error('No token found');
     
      console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
      return config;
    } catch (error) {
      console.error('Error in request interceptor:', error);
      return config;
    }
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response from ${response.config.url}:`, response.status);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`❌ Response Error [${error.response.status}]:`, error.response.data);
    } else if (error.request) {
      console.error('❌ Network Error - No response received');
      error.code = 'NETWORK_ERROR';
      error.message = `Cannot connect to server at ${API_BASE_URL}`;
    } else {
      console.error('❌ Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);


export const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem('authToken', token);
    console.log('✅ Auth token saved');
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
};

export const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const removeAuthToken = async () => {
  try {
    await AsyncStorage.removeItem('authToken');
    console.log('✅ Auth token removed');
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
};

// ══════════════════════════════════════════════════════
// User Data Management
// ══════════════════════════════════════════════════════
export const setUserData = async (userData) => {
  try {
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
    console.log('✅ User data saved');
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserData = async () => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const removeUserData = async () => {
  try {
    await AsyncStorage.removeItem('userData');
    console.log('✅ User data removed');
  } catch (error) {
    console.error('Error removing user data:', error);
  }
};

// ══════════════════════════════════════════════════════
// API Endpoints
// ══════════════════════════════════════════════════════

// Health Check
export const healthAPI = {
  check: () => api.get('/api/health')
};

// Authentication APIs
export const authAPI = {
  // Driver Login
  login: async (email, password) => {
    console.log('🔐 Driver Login Request:', { email, role: 'driver' });
    return api.post('/api/auth/login', {
      email: email.toLowerCase().trim(),
      password: password,
      role: 'driver'
    });
  },

  // Passenger Login
  passengerLogin: async (email, password) => {
    console.log('🔐 Passenger Login Request:', { email, role: 'passenger' });
    return api.post('/api/auth/login', {
      email: email.toLowerCase().trim(),
      password: password,
      role: 'passenger'
    });
  },

  // Transporter Login
  transporterLogin: async (email, password) => {
    console.log('🔐 Transporter Login Request:', { email });
    return api.post('/api/transporter/login', {
      email: email.toLowerCase().trim(),
      password: password
    });
  }
};

// Driver APIs
export const driverAPI = {
  // Register driver request
  register: (driverData) => {
    console.log('📝 Driver Registration Request:', driverData);
    return api.post('/api/driver-requests', driverData);
  },

  // Get driver profile
  getProfile: () => api.get('/api/profile'),

  // Update driver profile
  updateProfile: (profileData) => api.put('/api/profile', profileData),

  // Get driver availability
  getAvailability: (params) => api.get('/api/availability', { params }),

  // Set driver availability
  setAvailability: (availabilityData) => api.post('/api/availability', availabilityData),

  // Get assigned routes
  getRoutes: (params) => api.get('/api/routes', { params }),

  // Start route
  startRoute: (routeId) => api.post(`/api/routes/${routeId}/start`),

  // End route
  endRoute: (routeId) => api.post(`/api/routes/${routeId}/end`),

  // Update location
  updateLocation: (locationData) => api.post('/api/live-tracking/location', locationData),

  // Get trips
  getTrips: (params) => api.get('/api/trips', { params })
};

// Passenger APIs
export const passengerAPI = {
  // Register passenger request
  register: (passengerData) => {
    console.log('📝 Passenger Registration Request:', passengerData);
    return api.post('/api/passenger/request', passengerData);
  },

  // Check request status
  checkRequestStatus: (requestId) => {
    return api.get(`/api/passenger/request-status/${requestId}`);
  },

  // Get active polls
  getActivePolls: () => api.get('/api/polls/active'),

  // Respond to poll
  respondToPoll: (pollId, responseData) => {
    return api.post(`/api/polls/${pollId}/respond`, responseData);
  },

  // Get passenger profile
  getProfile: () => api.get('/api/profile'),

  // Update passenger profile
  updateProfile: (profileData) => api.put('/api/profile', profileData)
};

// Transporter APIs
export const transporterAPI = {
  // Register transporter (with image upload)
  register: async (formData) => {
    console.log('📝 Transporter Registration Request (FormData)');
    return api.post('/api/transporter/register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000
    });
  },

  // Get transporter profile
  getProfile: (transporterId) => {
    return api.get(`/api/transporter/profile/${transporterId}`);
  },

  // Update transporter profile
  updateProfile: (transporterId, profileData) => {
    return api.put(`/api/transporter/profile/${transporterId}`, profileData);
  },

  // Get dashboard stats
  getStats: (transporterId) => {
    return api.get('/api/dashboard/stats', { params: { transporterId } });
  },

  // Get join requests
  getJoinRequests: (params) => {
    return api.get('/api/join-requests', { params });
  },

  // Accept join request
  acceptRequest: (requestId) => {
    return api.put(`/api/join-requests/${requestId}/accept`);
  },

  // Reject join request
  rejectRequest: (requestId) => {
    return api.put(`/api/join-requests/${requestId}/reject`);
  },

  // Create poll
  createPoll: (pollData) => {
    return api.post('/api/polls', pollData);
  },

  // Get polls
  getPolls: (params) => {
    return api.get('/api/polls', { params });
  },

  // Get poll responses
  getPollResponses: (pollId) => {
    return api.get(`/api/polls/${pollId}/responses`);
  },

  // Assign route
  assignRoute: (routeData) => {
    return api.post('/api/routes/assign', routeData);
  },

  // Get drivers
  getDrivers: (params) => {
    return api.get('/api/drivers', { params });
  },

  // Get passengers
  getPassengers: (params) => {
    return api.get('/api/passengers', { params });
  }
};

// Users API
export const usersAPI = {
  // Get all users
  getUsers: (params) => api.get('/api/users', { params }),

  // Get transporters
  getTransporters: () => {
    console.log('📋 Fetching transporters...');
    return api.get('/api/users', { 
      params: { role: 'transporter' } 
    });
  }
};

// Notifications API
export const notificationsAPI = {
  getNotifications: (params) => api.get('/api/notifications', { params }),
  markAsRead: (notificationId) => api.put(`/api/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/api/notifications/mark-all-read')
};

// Complaints API
export const complaintsAPI = {
  create: (complaintData) => api.post('/api/complaints', complaintData),
  getComplaints: (params) => api.get('/api/complaints', { params }),
  reply: (complaintId, replyData) => api.post(`/api/complaints/${complaintId}/reply`, replyData),
  resolve: (complaintId) => api.put(`/api/complaints/${complaintId}/resolve`)
};

// Feedback API
export const feedbackAPI = {
  submit: (feedbackData) => api.post('/api/feedback', feedbackData),
  getFeedback: (params) => api.get('/api/feedback', { params }),
  getDriverSummary: (driverId) => api.get(`/api/feedback/driver/${driverId}/summary`)
};

// Payments API
export const paymentsAPI = {
  getPayments: (params) => api.get('/api/payments', { params }),
  createPayment: (paymentData) => api.post('/api/payments', paymentData)
};

// Export the main api instance for custom requests
export default api;