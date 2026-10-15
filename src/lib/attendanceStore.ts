import fs from 'fs';
import path from 'path';
import {
  AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
} from '@/lib/attendanceConfig';

export {
  type AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
};

const ATTENDANCE_STORE_FILE = path.join(process.cwd(), 'src', 'lib', 'attendanceStore.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'attendance');

function ensureDirectories() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function getAttendanceRecords(): AttendanceRecord[] {
  try {
    if (fs.existsSync(ATTENDANCE_STORE_FILE)) {
      const data = fs.readFileSync(ATTENDANCE_STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading attendance store:', err);
  }
  return [];
}

export function saveAttendanceRecord(record: AttendanceRecord): void {
  try {
    const records = getAttendanceRecords();
    // Add new record at the top
    records.unshift(record);
    fs.writeFileSync(ATTENDANCE_STORE_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving attendance record:', err);
  }
}

export async function saveSelfieImage(base64Data: string, id: string): Promise<string> {
  ensureDirectories();
  // Strip header if present (e.g. data:image/jpeg;base64,...)
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  const filename = `selfie_${id}_${Date.now()}.jpg`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/attendance/${filename}`;
}
