'use server';

import {
  AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
  getAttendanceRecords,
  saveAttendanceRecord,
  saveSelfieImage,
} from '@/lib/attendanceStore';
import { revalidatePath } from 'next/cache';

export interface PunchInput {
  employeeName: string;
  projectName: string;
  punchType: 'PUNCH_IN' | 'PUNCH_OUT';
  photoBase64: string;
  latitude: number;
  longitude: number;
  testOverride?: boolean;
}

export interface PunchResponse {
  success: boolean;
  message: string;
  record?: AttendanceRecord;
  distanceMeters?: number;
}

export async function submitPunchAction(input: PunchInput): Promise<PunchResponse> {
  try {
    const { employeeName, projectName, punchType, photoBase64, latitude, longitude, testOverride } = input;

    if (!employeeName || !projectName) {
      return { success: false, message: 'Kripya apna Naam aur Project zaroor select karein.' };
    }

    if (!photoBase64) {
      return { success: false, message: 'Live selfie photo zaroori hai. Kripya camera se photo lein.' };
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { success: false, message: 'GPS Location verify nahi ho paayi. Kripya phone ki Location on karein.' };
    }

    // Server-side distance check
    const distanceMeters = calculateDistanceInMeters(
      latitude,
      longitude,
      TARGET_SITE_CONFIG.latitude,
      TARGET_SITE_CONFIG.longitude
    );

    const isWithinRadius = distanceMeters <= TARGET_SITE_CONFIG.radiusMeters;

    if (!isWithinRadius && !testOverride) {
      return {
        success: false,
        message: `Aap site location se ${distanceMeters}m door hain. Site par aakar hi attendance lag sakti hai (Allowed: ${TARGET_SITE_CONFIG.radiusMeters}m).`,
        distanceMeters,
      };
    }

    // Authoritative Server Time
    const now = new Date();
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Save image to disk
    const photoUrl = await saveSelfieImage(photoBase64, id);

    const formattedDate = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const record: AttendanceRecord = {
      id,
      employeeName: employeeName.trim(),
      projectName: projectName.trim(),
      punchType,
      timestamp: now.toISOString(),
      formattedDate,
      formattedTime,
      latitude,
      longitude,
      distanceMeters,
      isWithinRadius,
      siteLatitude: TARGET_SITE_CONFIG.latitude,
      siteLongitude: TARGET_SITE_CONFIG.longitude,
      allowedRadiusMeters: TARGET_SITE_CONFIG.radiusMeters,
      photoUrl,
      createdAt: now.toISOString(),
    };

    await saveAttendanceRecord(record);
    revalidatePath('/admin/attendance');

    const punchLabel = punchType === 'PUNCH_IN' ? 'Punch In (Morning)' : 'Punch Out (Evening)';
    return {
      success: true,
      message: `${punchLabel} safalta-purvak record ho gaya hai! Time: ${formattedTime}`,
      record,
      distanceMeters,
    };
  } catch (err: unknown) {
    console.error('Error in submitPunchAction:', err);
    return {
      success: false,
      message: 'Server par attendance save karte waqt error aaya: ' + (err instanceof Error ? err.message : String(err)),
    };
  }
}

export async function getAttendanceListAction(): Promise<AttendanceRecord[]> {
  try {
    return getAttendanceRecords();
  } catch (err) {
    console.error('Error in getAttendanceListAction:', err);
    return [];
  }
}

export async function getTodayEmployeeStatusAction(
  employeeName: string,
  projectName: string
): Promise<{
  punchedInToday: boolean;
  punchedOutToday: boolean;
  inTime?: string;
  outTime?: string;
  lastRecord?: AttendanceRecord;
}> {
  if (!employeeName) return { punchedInToday: false, punchedOutToday: false };

  const records = getAttendanceRecords();
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const todayPunches = records.filter(
    (r) =>
      r.employeeName.toLowerCase() === employeeName.trim().toLowerCase() &&
      r.formattedDate === todayStr &&
      (!projectName || r.projectName.toLowerCase() === projectName.trim().toLowerCase())
  );

  const punchIn = todayPunches.find((p) => p.punchType === 'PUNCH_IN');
  const punchOut = todayPunches.find((p) => p.punchType === 'PUNCH_OUT');

  return {
    punchedInToday: !!punchIn,
    punchedOutToday: !!punchOut,
    inTime: punchIn?.formattedTime,
    outTime: punchOut?.formattedTime,
    lastRecord: todayPunches[0],
  };
}
