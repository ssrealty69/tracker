export interface AttendanceRecord {
  id: string;
  employeeName: string;
  projectName: string;
  punchType: 'PUNCH_IN' | 'PUNCH_OUT';
  timestamp: string; // ISO string
  formattedDate: string;
  formattedTime: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  isWithinRadius: boolean;
  siteLatitude: number;
  siteLongitude: number;
  allowedRadiusMeters: number;
  photoUrl: string;
  deviceInfo?: string;
  createdAt: string;
}

// Site Coordinates provided by user: https://maps.google.com/?q=28.465355,77.185921
export const TARGET_SITE_CONFIG = {
  latitude: 28.465355,
  longitude: 77.185921,
  radiusMeters: 50,
  siteName: 'Site 1 (Gwal Pahari / Project Site)',
  googleMapsUrl: 'https://maps.google.com/?q=28.465355,77.185921',
};

// Haversine formula to calculate exact distance in meters between two GPS coordinates
export function calculateDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Strictly format Indian Standard Time (Asia/Kolkata) on any serverless or local environment
export function getIndianTimeStr(d: Date = new Date()): string {
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function getIndianFormattedDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getIndianDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

export function getIndianHour(d: Date = new Date()): number {
  const str = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(d);
  return parseInt(str, 10);
}
