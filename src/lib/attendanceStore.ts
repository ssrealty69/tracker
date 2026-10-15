import fs from 'fs';
import path from 'path';
import {
  AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
} from '@/lib/attendanceConfig';
import { prisma } from '@/lib/prisma';

export {
  type AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
};

const ATTENDANCE_STORE_FILE = path.join(process.cwd(), 'src', 'lib', 'attendanceStore.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads', 'attendance');

// In-memory cache for fast session retrieval and serverless fallback
const inMemoryRecords: AttendanceRecord[] = [];

function ensureDirectories() {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem on Vercel serverless
  }
}

export function getDiskAttendanceRecords(): AttendanceRecord[] {
  try {
    if (fs.existsSync(ATTENDANCE_STORE_FILE)) {
      const data = fs.readFileSync(ATTENDANCE_STORE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading attendance store file:', err);
  }
  return [];
}

export function getAttendanceRecords(): AttendanceRecord[] {
  const disk = getDiskAttendanceRecords();
  const merged = [...inMemoryRecords];
  disk.forEach((d) => {
    if (!merged.some((m) => m.id === d.id)) {
      merged.push(d);
    }
  });
  return merged;
}

export async function getAttendanceRecordsAsync(): Promise<AttendanceRecord[]> {
  try {
    // 1. Try fetching from PostgreSQL AttendanceRecord table
    let dbRows: any[] = [];
    if ((prisma as any).attendanceRecord) {
      dbRows = await (prisma as any).attendanceRecord.findMany({
        orderBy: { timestamp: 'desc' },
        take: 300,
      });
    } else {
      dbRows = await prisma.$queryRawUnsafe<any[]>(
        'SELECT * FROM "AttendanceRecord" ORDER BY "timestamp" DESC LIMIT 300'
      );
    }

    if (dbRows && dbRows.length > 0) {
      const formatted: AttendanceRecord[] = dbRows.map((r) => ({
        id: r.id,
        employeeName: r.employeeName,
        projectName: r.projectName,
        punchType: r.punchType as 'PUNCH_IN' | 'PUNCH_OUT',
        timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : new Date(r.timestamp).toISOString(),
        formattedDate: r.formattedDate,
        formattedTime: r.formattedTime,
        latitude: r.latitude ?? undefined,
        longitude: r.longitude ?? undefined,
        distanceMeters: r.distanceMeters ?? 0,
        isWithinRadius: r.isWithinRadius,
        siteLatitude: r.siteLatitude ?? undefined,
        siteLongitude: r.siteLongitude ?? undefined,
        allowedRadiusMeters: r.allowedRadiusMeters ?? 50,
        photoUrl: r.photoUrl,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
      }));

      // Merge any seeded disk records that might not be in DB yet
      const disk = getDiskAttendanceRecords();
      disk.forEach((d) => {
        if (!formatted.some((f) => f.id === d.id)) {
          formatted.push(d);
        }
      });
      return formatted;
    }
  } catch (err) {
    console.warn('PostgreSQL fetch notice, falling back to disk/cache:', err);
  }

  return getAttendanceRecords();
}

export async function saveAttendanceRecord(record: AttendanceRecord): Promise<void> {
  // 1. Remove previous matching punch from in-memory cache so only latest selfie is kept
  const existingIdx = inMemoryRecords.findIndex(
    (r) =>
      r.employeeName === record.employeeName &&
      r.formattedDate === record.formattedDate &&
      r.punchType === record.punchType
  );
  if (existingIdx >= 0) {
    inMemoryRecords.splice(existingIdx, 1);
  }
  inMemoryRecords.unshift(record);

  // 2. Save to PostgreSQL database (delete previous punch on same date for this employee)
  try {
    if ((prisma as any).attendanceRecord) {
      await (prisma as any).attendanceRecord.deleteMany({
        where: {
          employeeName: record.employeeName,
          formattedDate: record.formattedDate,
          punchType: record.punchType,
        },
      });

      await (prisma as any).attendanceRecord.create({
        data: {
          id: record.id,
          employeeName: record.employeeName,
          projectName: record.projectName,
          punchType: record.punchType,
          timestamp: new Date(record.timestamp),
          formattedDate: record.formattedDate,
          formattedTime: record.formattedTime,
          latitude: record.latitude ?? null,
          longitude: record.longitude ?? null,
          distanceMeters: record.distanceMeters ?? null,
          isWithinRadius: record.isWithinRadius,
          siteLatitude: record.siteLatitude ?? null,
          siteLongitude: record.siteLongitude ?? null,
          allowedRadiusMeters: record.allowedRadiusMeters ?? 50,
          photoUrl: record.photoUrl,
          createdAt: new Date(record.createdAt),
        },
      });
      return;
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "AttendanceRecord" WHERE "employeeName" = $1 AND "formattedDate" = $2 AND "punchType" = $3`,
        record.employeeName,
        record.formattedDate,
        record.punchType
      );

      await prisma.$executeRawUnsafe(
        `INSERT INTO "AttendanceRecord" ("id", "employeeName", "projectName", "punchType", "timestamp", "formattedDate", "formattedTime", "latitude", "longitude", "distanceMeters", "isWithinRadius", "siteLatitude", "siteLongitude", "allowedRadiusMeters", "photoUrl", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT ("id") DO NOTHING`,
        record.id,
        record.employeeName,
        record.projectName,
        record.punchType,
        new Date(record.timestamp),
        record.formattedDate,
        record.formattedTime,
        record.latitude ?? null,
        record.longitude ?? null,
        record.distanceMeters ?? null,
        record.isWithinRadius,
        record.siteLatitude ?? null,
        record.siteLongitude ?? null,
        record.allowedRadiusMeters ?? 50,
        record.photoUrl,
        new Date(record.createdAt)
      );
      return;
    }
  } catch (dbErr) {
    console.warn('Database save attendance notice:', dbErr);
  }

  // 3. Try saving to disk JSON file if writable (local dev environment)
  try {
    let diskRecords = getDiskAttendanceRecords();
    diskRecords = diskRecords.filter(
      (r) =>
        !(
          r.employeeName === record.employeeName &&
          r.formattedDate === record.formattedDate &&
          r.punchType === record.punchType
        )
    );
    diskRecords.unshift(record);
    fs.writeFileSync(ATTENDANCE_STORE_FILE, JSON.stringify(diskRecords, null, 2), 'utf-8');
  } catch (fsErr) {
    console.warn('Filesystem attendance store write notice (Vercel read-only mode).');
  }
}

export async function saveSelfieImage(base64Data: string, id: string): Promise<string> {
  const isDataUri = base64Data.startsWith('data:image/');

  // Try saving to disk if writable (local development)
  try {
    ensureDirectories();
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    const filename = `selfie_${id}_${Date.now()}.jpg`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/attendance/${filename}`;
  } catch (fsErr) {
    // Vercel serverless functions have a read-only filesystem at /var/task.
    // Instead of failing the user's punch, safely store the compressed photo directly as a data URL!
    console.warn('Filesystem write not permitted (Vercel serverless). Using self-contained photo data URL.');
    if (isDataUri) {
      return base64Data;
    }
    return `data:image/jpeg;base64,${base64Data}`;
  }
}
