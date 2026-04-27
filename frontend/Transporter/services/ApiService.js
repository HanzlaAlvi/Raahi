import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants/fuels';

class ApiService {
  async getAuthData() {
    try {
      const [token, transporterId, userId, td] = await Promise.all([
        AsyncStorage.getItem('authToken'),
        AsyncStorage.getItem('transporterId'),
        AsyncStorage.getItem('userId'),
        AsyncStorage.getItem('transporterData'),
      ]);
      let parsedData = null;
      try { parsedData = td ? JSON.parse(td) : null; } catch (_) {}
      const resolvedId    = transporterId || userId || parsedData?.id || parsedData?._id || null;
      const resolvedToken = token && token.length > 0 ? token : null;
      return { token: resolvedToken, transporterId: resolvedId, transporterData: parsedData };
    } catch { return { token: null, transporterId: null, transporterData: null }; }
  }

  async call(endpoint, options = {}) {
    const { token } = await this.getAuthData();
    if (!token) throw new Error('Authentication required');
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403)
        throw new Error('Authentication failed — please login again');
      let errMsg = `Server Error ${res.status}`;
      try { const j = JSON.parse(text); errMsg = j.message || j.error || errMsg; } catch {}
      throw new Error(errMsg);
    }
    return text ? JSON.parse(text) : {};
  }

  // ── PROFILE ──────────────────────────────────────────────────────
  async getProfile() {
    const { transporterId } = await this.getAuthData();
    if (!transporterId) {
      // Fallback: fetch own profile via token-based endpoint
      const r = await this.call('/profile');
      return this._normalizeProfile(r.data || r.user || r, '');
    }
    // BUG FIX: was calling /auth/transporter/profile/:id (non-existent route)
    // Correct endpoint is /profile/:id
    const r = await this.call(`/profile/${transporterId}`);
    return this._normalizeProfile(r.data || r.user || r, transporterId);
  }

  _normalizeProfile(p, fallbackId) {
    return {
      id:               p._id || p.id || fallbackId,
      name:             p.name || p.fullName || 'Transporter',
      email:            p.email || '',
      phone:            p.phone || p.phoneNumber || '',
      company:          p.company || p.companyName || '',
      address:          p.address || '',
      license:          p.license || p.licenseNumber || '',
      // Keep as raw value so ProfileSection's fmtD() can format it properly
      registrationDate: p.registrationDate || p.createdAt || null,
      location:         p.location || p.address || '',
      status:           p.status || 'active',
      profileImage:     p.profileImage || null,
      // BUG FIX: these fields were previously omitted — city/country/zone now included
      city:             p.city || '',
      country:          p.country || '',
      zone:             p.zone || '',
    };
  }

  async updateProfile(data) {
    const { transporterId } = await this.getAuthData();
    // BUG FIX: was calling /auth/transporter/profile/:id (non-existent route)
    // Correct endpoint is /profile/:id
    return this.call(`/profile/${transporterId}`, {
      method: 'PUT',
      body:   JSON.stringify(data),
    });
  }

  // ── STATS ─────────────────────────────────────────────────────────
  async getStats() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/dashboard/stats?transporterId=${transporterId}`);
    const s = r.stats || r.data || r;
    return {
      activeDrivers:    +s.activeDrivers    || 0,
      totalPassengers:  +s.totalPassengers  || 0,
      completedTrips:   +s.completedTrips   || 0,
      ongoingTrips:     +s.ongoingTrips     || 0,
      complaints:       +s.complaints       || 0,
      paymentsReceived: +s.paymentsReceived || 0,
      paymentsPending:  +s.paymentsPending  || 0,
    };
  }

  // ── POLLS ─────────────────────────────────────────────────────────
  async getPolls() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/polls?transporterId=${transporterId}`);
    return Array.isArray(r) ? r : (r.polls || r.data || []);
  }

  async createPoll(data) {
    const { transporterId } = await this.getAuthData();
    return this.call('/polls', {
      method: 'POST',
      body:   JSON.stringify({ ...data, transporterId }),
    });
  }

  async deletePoll(id) {
    return this.call(`/polls/${id}`, { method: 'DELETE' });
  }

  // ── DRIVERS ───────────────────────────────────────────────────────
  async getDrivers() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/drivers?transporterId=${transporterId}`);
    return Array.isArray(r) ? r : (r.drivers || r.data || []);
  }

  // Returns drivers merged with availability data for a given date string (YYYY-MM-DD)
  async getDriversWithAvailability(dateStr) {
    const { transporterId } = await this.getAuthData();
    // Always fetch base driver list first
    const drivers = await this.getDrivers();
    try {
      const r = await this.call(
        `/driver-availability?transporterId=${transporterId}&date=${dateStr}`
      );
      const availList = Array.isArray(r) ? r : (r.availability || r.data || []);

      // Build a lookup map: driverId string → availability record
      // FIX: Only mark isAvailable=true if status is 'available' or 'confirmed'
      const availMap = {};
      availList.forEach(a => {
        // Backend populates driverId as an object; handle both object and plain string
        const driverObj = a.driverId;
        const aid =
          (typeof driverObj === 'object'
            ? driverObj?._id?.toString()
            : driverObj?.toString()) || '';
        if (aid) {
          const status = a.status || '';
          const isValidStatus = status === 'available' || status === 'confirmed';
          // Only store if it's a valid (available/confirmed) record
          if (isValidStatus) {
            availMap[aid] = { ...a, _driverObj: driverObj };
          }
        }
      });

      // Merge availability into each driver; also pull extra fields from the
      // populated driverObj (vehicleType, latitude, longitude) if missing on base driver
      return drivers.map(driver => {
        const did   = driver._id?.toString();
        const avail = availMap[did];
        const dObj  = avail?._driverObj;

        return {
          ...driver,
          // Supplement with populated fields from availability record if base driver is missing them
          vehicleType: driver.vehicleType || (typeof dObj === 'object' ? dObj?.vehicleType : null) || '',
          vehicleNo:   driver.vehicleNo   || (typeof dObj === 'object' ? dObj?.vehicleNo   : null) || '',
          latitude:    driver.latitude    || (typeof dObj === 'object' ? dObj?.latitude    : null),
          longitude:   driver.longitude   || (typeof dObj === 'object' ? dObj?.longitude   : null),
          isAvailable:   !!avail,  // true only if a valid available/confirmed record was found
          availableFrom: avail?.startTime || avail?.from || '',
          availableTill: avail?.endTime   || avail?.till || '',
        };
      });
    } catch {
      // Endpoint missing or failed — return all drivers with isAvailable: false
      // AssignSection will still show them under "All Drivers" toggle
      return drivers.map(d => ({
        ...d,
        isAvailable:   false,
        availableFrom: '',
        availableTill: '',
      }));
    }
  }

  // ── ROUTES ────────────────────────────────────────────────────────
  async getRoutes() {
    const { transporterId } = await this.getAuthData();

    // ✅ FIX: transporterId null ho to warn karo — backend req.userId se fallback karega
    if (!transporterId) {
      console.warn('[ApiService] getRoutes: transporterId null in AsyncStorage — using token fallback');
    }

    console.log(`[ApiService] getRoutes: transporterId=${transporterId}`);
    const r = await this.call(`/routes${transporterId ? `?transporterId=${transporterId}` : ''}`);
    const routes = Array.isArray(r) ? r : (r.routes || r.data || []);
    console.log(`[ApiService] getRoutes: received ${routes.length} routes`);
    return routes;
  }

  async saveUnassignedRoute(routeData) {
    const today = new Date(); // ← use today so routes appear in "Today" filter
    const { transporterId: authTid } = await this.getAuthData();

    const stopStrings = (routeData.stops || []).map(s =>
      typeof s === 'string' ? s : (s.address || s.name || 'Stop')
    );

    const passengerList = (routeData.passengers || []).map(p => ({
      passengerId:       p.id || p._id || null,
      passengerName:     p.name || 'Passenger',
      pickupPoint:       p.pickupAddress || p.pickupPoint || 'Pickup',
      destination:       p.dropAddress || p.destination || '',
      destinationLat:    p.dropLat,
      destinationLng:    p.dropLng,
      vehiclePreference: p.vehiclePreference || null,
      status:            'pending',
    }));

    return this.call('/routes', {
      method: 'POST',
      body:   JSON.stringify({
        name:           routeData.routeName,
        routeName:      routeData.routeName,
        pollId:         routeData.pollId,
        startPoint:     routeData.startPoint || stopStrings[0] || 'Multiple Pickup Points',
        destination:    routeData.destination,
        destinationLat: routeData.destinationLat,
        destinationLng: routeData.destinationLng,
        timeSlot:       routeData.timeSlot,
        pickupTime:     routeData.pickupTime || routeData.timeSlot,
        date:           today.toISOString(),
        passengers:     passengerList,
        stops:          stopStrings,
        estimatedTime:  routeData.estimatedTime,
        estimatedFuel:  routeData.estimatedFuel,
        estimatedKm:    routeData.estimatedKm,
        fuelCostPKR:    routeData.fuelCostPKR,
        fuelType:       routeData.fuelType,
        fuelRatePerKm:  routeData.fuelRatePerKm,
        vehicleType:    routeData.vehicleType,
        status:         'unassigned',
        transporterId:  routeData.transporterId || authTid,
      }),
    });
  }

  // ✅ BUG FIXED — was `...` (spread syntax error) before
  async assignDriverToRoute(routeId, driverId) {
    return this.call(`/routes/${routeId}/assign-driver`, {
      method: 'PUT',
      body:   JSON.stringify({ driverId, assignedDriver: driverId }),
    });
  }

  async reassignDriverToRoute(routeId, driverId) {
    return this.call(`/routes/${routeId}/assign-driver`, {
      method: 'PUT',
      body:   JSON.stringify({ driverId, assignedDriver: driverId }),
    });
  }

  // ── JOIN REQUESTS ─────────────────────────────────────────────────
  async getDriverRequests() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/join-requests?type=driver&transporterId=${transporterId}`);
    return (Array.isArray(r) ? r : (r.requests || r.data || [])).filter(x => x.status === 'pending');
  }

  async approveDriverRequest(id) {
    const { transporterId } = await this.getAuthData();
    return this.call(`/join-requests/${id}/accept`, {
      method: 'PUT',
      body:   JSON.stringify({ transporterId }),
    });
  }

  async rejectDriverRequest(id) {
    return this.call(`/join-requests/${id}/reject`, { method: 'PUT' });
  }

  async getPassengerRequests() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/join-requests?type=passenger&transporterId=${transporterId}`);
    return (Array.isArray(r) ? r : (r.requests || r.data || [])).filter(x => x.status === 'pending');
  }

  async approvePassengerRequest(id) {
    const { transporterId } = await this.getAuthData();
    return this.call(`/join-requests/${id}/accept`, {
      method: 'PUT',
      body:   JSON.stringify({ transporterId }),
    });
  }

  async rejectPassengerRequest(id) {
    return this.call(`/join-requests/${id}/reject`, { method: 'PUT' });
  }

  // ── TRIPS ─────────────────────────────────────────────────────────
  async getTrips() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/trips?transporterId=${transporterId}`);
    return Array.isArray(r) ? r : (r.trips || r.data || []);
  }

  // ── COMPLAINTS ────────────────────────────────────────────────────
  async getComplaints() {
    const { transporterId } = await this.getAuthData();
    const r = await this.call(`/complaints?transporterId=${transporterId}`);
    return Array.isArray(r) ? r : (r.complaints || r.data || []);
  }

  // ── NOTIFICATIONS ─────────────────────────────────────────────────
  async getNotifications() {
    const r = await this.call('/notifications');
    return Array.isArray(r) ? r : (r.notifications || r.data || []);
  }

  async markRead(id) {
    return this.call(`/notifications/${id}/read`, { method: 'PUT' });
  }
}

export const api = new ApiService();
export default ApiService;