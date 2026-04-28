'use strict';
/**
 * socketHandler.js  — FIXED VERSION
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixes applied:
 *   1. locationUpdate now broadcasts BOTH 'vanLocationUpdate' AND 'driverLocationUpdate'
 *      so every frontend event name works.
 *   2. routeStarted is handled server-side: when backend emits it, the socket
 *      handler forwards it into the ride room AND route room so transporter sees it.
 *   3. rideUpdated now forwards encodedPolyline + dropOffLocation to all rooms.
 *   4. routeUpdate persists polyline to BOTH Route AND Trip collections.
 *   5. vanLocationUpdate payload always includes both rideId AND tripId fields.
 *   6. Transporter joins route room via joinRoute — location is broadcast there too.
 *   7. New event: 'startRoute' from driver triggers routeStarted to all rooms.
 *
 * Rooms:
 *   ride_<rideId>   — driver + passengers + transporter for one trip
 *   route_<routeId> — transporter overview room
 *   user_<userId>   — personal notifications
 */

const Trip  = require('./models/Trip');
const Route = require('./models/Route');

// ── In-memory state ──────────────────────────────────────────────────────────
const onboardingState = {};     // [rideId][stopId] = { passengerConfirmed, driverConfirmed }
const locationCache   = {};     // [rideId] = { latitude, longitude, updatedAt }
const polylineCache   = {};     // [rideId] = encodedPolyline string

// ── Helper ───────────────────────────────────────────────────────────────────
function getOnboardEntry(rideId, stopId) {
  if (!onboardingState[rideId]) onboardingState[rideId] = {};
  if (!onboardingState[rideId][stopId])
    onboardingState[rideId][stopId] = { passengerConfirmed: false, driverConfirmed: false };
  return onboardingState[rideId][stopId];
}

// ── Main export ───────────────────────────────────────────────────────────────
module.exports = function attachSocket(io) {

  const seenEvents = new WeakMap();

  io.on('connection', (socket) => {
    seenEvents.set(socket, new Set());
    const seen   = () => seenEvents.get(socket);
    const isDupe = (key) => { const s = seen(); if (s.has(key)) return true; s.add(key); return false; };

    // ── JOIN ROOMS ──────────────────────────────────────────────────────────

    socket.on('joinRide', ({ rideId, userId, role } = {}) => {
      if (!rideId) return;
      socket.join(`ride_${rideId}`);
      socket.data.rideId = rideId;
      socket.data.userId = userId;
      socket.data.role   = role || 'unknown';

      // Push cached location immediately so new joiners don't wait
      if (locationCache[rideId]) {
        socket.emit('vanLocationUpdate', { ...locationCache[rideId], rideId, tripId: rideId });
        socket.emit('driverLocationUpdate', { ...locationCache[rideId], rideId, tripId: rideId });
      }
      // Push cached polyline immediately
      if (polylineCache[rideId]) {
        socket.emit('routeUpdate', { rideId, routeId: null, encodedPolyline: polylineCache[rideId], timestamp: Date.now() });
      }
    });

    // Legacy joinTrip (passengers use this)
    socket.on('joinTrip', ({ tripId, userId } = {}) => {
      if (!tripId) return;
      socket.join(`ride_${tripId}`);
      socket.data.rideId = tripId;
      socket.data.userId = userId;
      if (locationCache[tripId]) {
        socket.emit('vanLocationUpdate', { ...locationCache[tripId], tripId, rideId: tripId });
        socket.emit('driverLocationUpdate', { ...locationCache[tripId], tripId, rideId: tripId });
      }
      if (polylineCache[tripId]) {
        socket.emit('routeUpdate', { rideId: tripId, routeId: null, encodedPolyline: polylineCache[tripId], timestamp: Date.now() });
      }
    });

    // Transporter overview room
    socket.on('joinRoute', ({ routeId, userId } = {}) => {
      if (!routeId) return;
      socket.join(`route_${routeId}`);
      socket.data.routeId = routeId;
    });

    // Personal notification room
    socket.on('joinUser', ({ userId } = {}) => {
      if (!userId) return;
      socket.join(`user_${userId}`);
    });

    // ── DRIVER: LIVE LOCATION ───────────────────────────────────────────────
    /**
     * Payload: { rideId, tripId, routeId, latitude, longitude, speed?, heading? }
     * Broadcasts as BOTH 'vanLocationUpdate' AND 'driverLocationUpdate' for
     * cross-compatibility with all frontend listeners.
     *
     * NOTE: Some driver clients emit BOTH 'locationUpdate' AND 'driverLocationUpdate'
     * directly. We handle BOTH here so the server always re-broadcasts to all rooms.
     */
    let locCallCount = 0;

    // ── Shared location broadcast logic ─────────────────────────────────────
    async function _handleLocationUpdate(data) {
      const rideId = data?.rideId || data?.tripId;
      if (!rideId || data?.latitude == null || data?.longitude == null) return;

      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // Validate coordinate ranges (lat: -90..90, lng: -180..180)
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        console.warn('[Socket] _handleLocationUpdate: swapped or out-of-range coordinates', { lat, lng });
        return;
      }

      locationCache[rideId] = { latitude: lat, longitude: lng, updatedAt: new Date() };

      const payload = {
        rideId,
        tripId:    rideId,
        routeId:   data.routeId || null,
        latitude:  lat,
        longitude: lng,
        speed:     data.speed   ?? null,
        heading:   data.heading ?? null,
        timestamp: Date.now(),
      };

      // Broadcast to ride room (all passengers + transporter who joined via joinRide/joinTrip)
      socket.to(`ride_${rideId}`).emit('vanLocationUpdate',    payload);
      socket.to(`ride_${rideId}`).emit('driverLocationUpdate', payload);

      // Also broadcast to transporter route room
      if (data.routeId) {
        io.to(`route_${data.routeId}`).emit('vanLocationUpdate',    payload);
        io.to(`route_${data.routeId}`).emit('driverLocationUpdate', payload);
      }

      // Throttled DB persist (every 3rd call ≈ every 21s at 7s interval)
      locCallCount++;
      if (locCallCount % 3 === 0) {
        try {
          await Trip.findByIdAndUpdate(rideId, {
            'currentLocation.latitude':  lat,
            'currentLocation.longitude': lng,
            speed:     data.speed ?? undefined,
            updatedAt: new Date(),
          });
        } catch (e) {
          console.warn('[Socket] DB location save error:', e.message);
        }
      }
    }

    // Primary listener: driver emits 'locationUpdate'
    socket.on('locationUpdate', async (data) => {
      await _handleLocationUpdate(data);
    });

    // Alias listener: some driver clients ALSO emit 'driverLocationUpdate' directly.
    // Re-broadcast it so all passengers/transporters receive it regardless of event name.
    socket.on('driverLocationUpdate', async (data) => {
      await _handleLocationUpdate(data);
    });

    /* ── OLD body removed — delegated to _handleLocationUpdate ── */

    // ── DRIVER: START ROUTE (client-side trigger) ───────────────────────────
    /**
     * Driver dashboard emits 'startRoute' after hitting Start button.
     * Payload: { rideId, routeId, encodedPolyline, passengers, destination,
     *            destinationLat, destinationLng, driverName, vehicleType }
     * Server forwards as 'routeStarted' to all rooms.
     */
    socket.on('startRoute', async (data) => {
      const { rideId, routeId, encodedPolyline } = data || {};
      if (!rideId) return;

      if (encodedPolyline) polylineCache[rideId] = encodedPolyline;

      const payload = {
        ...data,
        rideId,
        tripId:    rideId,
        timestamp: Date.now(),
      };

      io.to(`ride_${rideId}`).emit('routeStarted', payload);
      if (routeId) {
        io.to(`route_${routeId}`).emit('routeStarted', payload);
      }

      // Persist polyline if provided
      if (encodedPolyline) {
        try {
          await Trip.findByIdAndUpdate(rideId, { encodedPolyline, updatedAt: new Date() });
          if (routeId) await Route.findByIdAndUpdate(routeId, { encodedPolyline, updatedAt: new Date() });
        } catch (e) {
          console.warn('[Socket] startRoute polyline persist error:', e.message);
        }
      }
    });

    // ── DRIVER: ROUTE UPDATE (polyline broadcast) ───────────────────────────
    /**
     * Payload: { rideId, routeId, encodedPolyline, waypointCoords,
     *            dropOffLocation?: { latitude, longitude, name } }
     * Passengers + Transporter reuse this polyline — no re-fetching.
     */
    socket.on('routeUpdate', async (data) => {
      const { rideId, routeId, encodedPolyline, waypointCoords, dropOffLocation } = data || {};
      if (!rideId || !encodedPolyline) return;

      polylineCache[rideId] = encodedPolyline;

      const outPayload = {
        rideId, routeId, encodedPolyline, waypointCoords,
        dropOffLocation: dropOffLocation || null,
        timestamp: Date.now(),
      };

      // Send to ride room (passengers) — exclude sender
      socket.to(`ride_${rideId}`).emit('routeUpdate', outPayload);
      // Send to transporter route room
      if (routeId) io.to(`route_${routeId}`).emit('routeUpdate', outPayload);

      // Persist to both Route and Trip
      try {
        const updateData = { encodedPolyline, updatedAt: new Date() };
        if (routeId) await Route.findByIdAndUpdate(routeId, updateData);
        await Trip.findByIdAndUpdate(rideId, { encodedPolyline, updatedAt: new Date() });
      } catch (e) {
        console.warn('[Socket] routeUpdate persist error:', e.message);
      }
    });

    // ── DRIVER: ARRIVED AT STOP ─────────────────────────────────────────────
    socket.on('arrivedAtStop', async (data) => {
      const { rideId, stopId, passengerId, stopName, routeId } = data || {};
      if (!rideId || !stopId || !passengerId) return;

      const entry = getOnboardEntry(rideId, stopId);
      entry.passengerConfirmed = false;
      entry.driverConfirmed    = false;

      io.to(`user_${passengerId}`).emit('boardingRequest', {
        rideId, stopId, passengerId, stopName: stopName || 'Your stop',
      });
      io.to(`ride_${rideId}`).emit('rideStateChange', {
        rideId, state: 'WAITING_BOARDING', stopId, passengerId,
      });

      try {
        if (routeId) await Route.findByIdAndUpdate(routeId, { simulationPaused: true });
        await Trip.findByIdAndUpdate(rideId, { simulationPaused: true });
      } catch (e) {
        console.warn('[Socket] arrivedAtStop DB error:', e.message);
      }
    });

    // ── PASSENGER: CONFIRM BOARDING ─────────────────────────────────────────
    socket.on('passengerConfirmBoarding', async (data) => {
      const { rideId, stopId, passengerId } = data || {};
      if (!rideId || !stopId || !passengerId) return;

      const key = `pax_${rideId}_${stopId}`;
      if (isDupe(key)) return;

      const entry = getOnboardEntry(rideId, stopId);
      entry.passengerConfirmed = true;

      io.to(`ride_${rideId}`).emit('passengerReady', {
        rideId, stopId, passengerId,
        passengerConfirmed: true,
        driverConfirmed: entry.driverConfirmed,
      });

      if (entry.driverConfirmed) {
        await _finalizeBothConfirmed(io, rideId, stopId, passengerId);
      }
    });

    // ── DRIVER: CONFIRM BOARDING ────────────────────────────────────────────
    socket.on('driverConfirmBoarding', async (data) => {
      const { rideId, stopId, passengerId, routeId } = data || {};
      if (!rideId || !stopId || !passengerId) return;

      const key = `drv_${rideId}_${stopId}`;
      if (isDupe(key)) return;

      const entry = getOnboardEntry(rideId, stopId);
      entry.driverConfirmed = true;

      if (entry.passengerConfirmed) {
        await _finalizeBothConfirmed(io, rideId, stopId, passengerId, routeId);
      } else {
        io.to(`user_${passengerId}`).emit('boardingRequest', {
          rideId, stopId, passengerId,
          message: 'Driver is waiting for your boarding confirmation',
        });
      }
    });

    // ── DRIVER: ALL PASSENGERS PICKED — GOING TO DESTINATION ───────────────
    socket.on('goingToDestination', async (data) => {
      const { rideId, routeId, destinationLat, destinationLng, destinationName, encodedPolyline, dropOffLocation } = data || {};
      if (!rideId) return;

      if (encodedPolyline) polylineCache[rideId] = encodedPolyline;

      const statePayload = {
        rideId, tripId: rideId,
        state:           'GOING_TO_DESTINATION',
        destinationLat,
        destinationLng,
        destinationName: destinationName || 'Destination',
        encodedPolyline: encodedPolyline || null,
        dropOffLocation: dropOffLocation || { latitude: destinationLat, longitude: destinationLng, name: destinationName },
        timestamp:       Date.now(),
      };

      io.to(`ride_${rideId}`).emit('rideStateChange', statePayload);
      if (routeId) io.to(`route_${routeId}`).emit('rideStateChange', statePayload);

      // Also emit routeUpdate so all clients re-render polyline
      if (encodedPolyline) {
        io.to(`ride_${rideId}`).emit('routeUpdate', {
          rideId, routeId, encodedPolyline,
          dropOffLocation: statePayload.dropOffLocation,
          timestamp: Date.now(),
        });
        if (routeId) io.to(`route_${routeId}`).emit('routeUpdate', {
          rideId, routeId, encodedPolyline,
          dropOffLocation: statePayload.dropOffLocation,
          timestamp: Date.now(),
        });
      }

      try {
        await Trip.findByIdAndUpdate(rideId, {
          status: 'going_to_destination', updatedAt: new Date(),
          ...(encodedPolyline ? { encodedPolyline } : {}),
        });
        if (routeId) {
          await Route.findByIdAndUpdate(routeId, {
            status: 'going_to_destination',
            ...(encodedPolyline ? { encodedPolyline } : {}),
          });
        }
      } catch (e) {
        console.warn('[Socket] goingToDestination DB error:', e.message);
      }
    });

    // ── DRIVER: COMPLETE RIDE ───────────────────────────────────────────────
    socket.on('completeRide', async (data) => {
      const { rideId, routeId } = data || {};
      if (!rideId) return;

      const payload = { rideId, routeId, timestamp: Date.now() };
      io.to(`ride_${rideId}`).emit('rideCompleted', payload);
      if (routeId) io.to(`route_${routeId}`).emit('rideCompleted', payload);
      io.to(`ride_${rideId}`).emit('routeCompleted', payload);
      io.to(`ride_${rideId}`).emit('statsRefresh',   payload);

      // Cleanup in-memory caches
      delete onboardingState[rideId];
      delete locationCache[rideId];
      delete polylineCache[rideId];

      try {
        await Trip.findByIdAndUpdate(rideId, {
          status: 'completed', endTime: new Date(), updatedAt: new Date(),
        });
        if (routeId) await Route.findByIdAndUpdate(routeId, { status: 'completed' });
      } catch (e) {
        console.warn('[Socket] completeRide DB error:', e.message);
      }
    });

    // ── DRIVER: CHAT ────────────────────────────────────────────────────────
    socket.on('rideChat', (data) => {
      const { tripId, rideId } = data || {};
      socket.to(`ride_${tripId || rideId}`).emit('rideChat', data);
    });

    // ── 10-MIN ALERT ────────────────────────────────────────────────────────
    socket.on('tenMinAlert', (data) => {
      const { rideId, passengerId } = data || {};
      if (!rideId || !passengerId) return;
      io.to(`user_${passengerId}`).emit('tenMinAlert', data);
      io.to(`ride_${rideId}`).emit('tenMinAlert', data);
    });

    // ── PASSENGER: NOT GOING ─────────────────────────────────────────────────
    // Passenger pressed 'NO, I'm Not Going' during boarding confirmation.
    // The HTTP route already emits this server-side. We also forward the
    // client-emitted copy so the driver receives it immediately.
    socket.on('passengerNotGoing', (data) => {
      const { rideId, routeId, passengerId } = data || {};
      if (!rideId || !passengerId) return;
      // Forward to all in the ride room (driver + transporter)
      socket.to(`ride_${rideId}`).emit('passengerNotGoing', data);
      if (routeId) io.to(`route_${routeId}`).emit('passengerNotGoing', data);
    });

    // ── GENERIC: rideUpdated — broadcast any state/location/polyline change ─
    /**
     * Payload: { rideId, routeId, encodedPolyline?, dropOffLocation?, ...rest }
     * Used for any arbitrary state sync. Forwards polyline and dropOffLocation
     * so all clients can update their map immediately.
     */
    socket.on('rideUpdated', async (data) => {
      const { rideId, routeId, encodedPolyline, ...rest } = data || {};
      if (!rideId) return;

      if (encodedPolyline) polylineCache[rideId] = encodedPolyline;

      const payload = {
        rideId, routeId,
        ...(encodedPolyline ? { encodedPolyline } : {}),
        ...rest,
        timestamp: Date.now(),
      };

      io.to(`ride_${rideId}`).emit('rideUpdated', payload);
      if (routeId) io.to(`route_${routeId}`).emit('rideUpdated', payload);

      // If polyline included, also emit routeUpdate for clients that only listen to that
      if (encodedPolyline) {
        io.to(`ride_${rideId}`).emit('routeUpdate', {
          rideId, routeId, encodedPolyline,
          dropOffLocation: rest.dropOffLocation || null,
          timestamp: Date.now(),
        });
        if (routeId) io.to(`route_${routeId}`).emit('routeUpdate', {
          rideId, routeId, encodedPolyline,
          dropOffLocation: rest.dropOffLocation || null,
          timestamp: Date.now(),
        });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      seenEvents.delete(socket);
    });
  });

  return io;
};

// ── Private: finalize boarding when both sides confirmed ─────────────────────
async function _finalizeBothConfirmed(io, rideId, stopId, passengerId, routeId) {
  try {
    await Trip.findOneAndUpdate(
      { _id: rideId, 'passengers._id': passengerId },
      {
        $set: {
          'passengers.$.status':    'picked',
          'passengers.$.pickupTime': new Date().toISOString(),
          simulationPaused: false,
          updatedAt: new Date(),
        },
      }
    );

    if (routeId) {
      await Route.findByIdAndUpdate(routeId, { simulationPaused: false, updatedAt: new Date() });
    }

    io.to(`ride_${rideId}`).emit('bothConfirmed', {
      rideId, stopId, passengerId,
      message:   'Passenger is on board — proceeding to next stop',
      timestamp: Date.now(),
    });
    io.to(`ride_${rideId}`).emit('passengerBoarded',      { tripId: rideId, passengerId, stopId });
    io.to(`ride_${rideId}`).emit('passengerStatusUpdate', { passengerId, status: 'picked', tripId: rideId });
    io.to(`user_${passengerId}`).emit('passengerStatusUpdate', { passengerId, status: 'picked', rideId });

    if (onboardingState[rideId]) delete onboardingState[rideId][stopId];
  } catch (e) {
    console.error('[Socket] _finalizeBothConfirmed error:', e.message);
  }
}