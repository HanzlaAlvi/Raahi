// ─────────────────────────────────────────────────────────────────────────────
// HELPERS / UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get initials from a name string
 * e.g. "Ali Hassan" → "AH"
 */
export const getInitials = (name = '') =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

/**
 * Format a date string to a readable date
 * e.g. "2025-01-15T10:30:00Z" → "15 Jan 2025"
 */
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Format a date string to a readable time
 * e.g. "2025-01-15T10:30:00Z" → "10:30 AM"
 */
export const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-PK', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'N/A';
  }
};

/**
 * Format a timestamp relative to now
 * e.g. "2m ago", "3h ago", "5d ago"
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const diff = new Date() - new Date(timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-PK');
  } catch {
    return '';
  }
};

/**
 * Calculate ride delay from scheduled vs actual time
 */
export const calculateDelay = (startTime, actualTime) => {
  if (!startTime || !actualTime) return null;
  try {
    const scheduled = new Date(startTime);
    const actual    = new Date(actualTime);
    const diffMins  = Math.round((actual - scheduled) / (1000 * 60));
    if (isNaN(diffMins)) return null;
    if (Math.abs(diffMins) < 2) return 'On time';
    if (diffMins > 0) return `${diffMins} min late`;
    return `${Math.abs(diffMins)} min early`;
  } catch {
    return null;
  }
};

/**
 * Format call duration seconds to MM:SS
 */
export const formatCallDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Decode JWT payload (no signature verification — client-side only)
 */
export const decodeJwtPayload = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

/**
 * Capitalize first letter of a string
 */
export const capitalize = (str = '') =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Get delay color based on delay string
 */
export const getDelayColor = (delay) => {
  if (!delay || delay === 'On time') return '#A1D826';
  if (delay.includes('late')) return '#FF9800';
  if (delay.includes('early')) return '#2196F3';
  return '#9E9E9E';
};
