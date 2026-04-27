/**
 * Always returns a plain string ID (or null) from an assignedDriver field
 * regardless of whether it is a populated object or a raw ObjectId string.
 */
export function getAssignedDriverId(assignedDriver) {
  if (!assignedDriver) return null;
  if (typeof assignedDriver === 'object') {
    return String(assignedDriver._id || assignedDriver.id || '');
  }
  return String(assignedDriver);
}

/**
 * Returns the driver's display name.
 * Tries the populated object first, then falls back to searching the local
 * drivers array by ID, then falls back to the raw string value.
 */
export function getAssignedDriverName(assignedDriver, driversList = []) {
  if (!assignedDriver) return null;
  if (typeof assignedDriver === 'object') {
    return assignedDriver.name || assignedDriver.driverName || 'Assigned Driver';
  }
  const found = driversList.find(
    d => String(d._id || d.id) === String(assignedDriver),
  );
  return found?.name || null;
}

/**
 * Returns the vehicle type string from an assignedDriver field.
 */
export function getAssignedDriverVehicle(assignedDriver, driversList = []) {
  if (!assignedDriver) return null;
  if (typeof assignedDriver === 'object') {
    return assignedDriver.vehicleType || assignedDriver.vehicle || null;
  }
  const found = driversList.find(
    d => String(d._id || d.id) === String(assignedDriver),
  );
  return found?.vehicleType || found?.vehicle || null;
}