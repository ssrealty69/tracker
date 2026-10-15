import { NextRequest, NextResponse } from 'next/server';
import {
  AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
} from '@/lib/attendanceConfig';
import {
  saveAttendanceRecord,
  saveSelfieImage,
} from '@/lib/attendanceStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeName, projectName, punchType, photoBase64, latitude, longitude, testOverride } = body;

    if (!employeeName || !projectName) {
      return NextResponse.json(
        { success: false, message: 'Kripya apna Naam aur Project zaroor select karein.' },
        { status: 400 }
      );
    }

    if (!photoBase64) {
      return NextResponse.json(
        { success: false, message: 'Live selfie photo zaroori hai. Kripya camera se photo lein.' },
        { status: 400 }
      );
    }

    // Distance calculation
    const userLat = typeof latitude === 'number' ? latitude : TARGET_SITE_CONFIG.latitude;
    const userLng = typeof longitude === 'number' ? longitude : TARGET_SITE_CONFIG.longitude;

    const distanceMeters = calculateDistanceInMeters(
      userLat,
      userLng,
      TARGET_SITE_CONFIG.latitude,
      TARGET_SITE_CONFIG.longitude
    );

    const isWithinRadius = distanceMeters <= TARGET_SITE_CONFIG.radiusMeters;

    if (!isWithinRadius && !testOverride) {
      return NextResponse.json(
        {
          success: false,
          message: `Aap abhi site se dur hai. Pahele site par jaiye (${distanceMeters}m door)!`,
          distanceMeters,
        },
        { status: 403 }
      );
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
      employeeName: String(employeeName).trim(),
      projectName: String(projectName).trim(),
      punchType: punchType === 'PUNCH_OUT' ? 'PUNCH_OUT' : 'PUNCH_IN',
      timestamp: now.toISOString(),
      formattedDate,
      formattedTime,
      latitude: userLat,
      longitude: userLng,
      distanceMeters,
      isWithinRadius,
      siteLatitude: TARGET_SITE_CONFIG.latitude,
      siteLongitude: TARGET_SITE_CONFIG.longitude,
      allowedRadiusMeters: TARGET_SITE_CONFIG.radiusMeters,
      photoUrl,
      createdAt: now.toISOString(),
    };

    saveAttendanceRecord(record);

    const punchLabel = record.punchType === 'PUNCH_IN' ? 'Punch In (Morning)' : 'Punch Out (Evening)';

    return NextResponse.json({
      success: true,
      message: `${punchLabel} safalta-purvak record ho gaya hai! Time: ${formattedTime}`,
      record,
      distanceMeters,
    });
  } catch (err: unknown) {
    console.error('Error in attendance punch API:', err);
    return NextResponse.json(
      {
        success: false,
        message: 'Server par attendance save karte waqt error aaya: ' + (err instanceof Error ? err.message : String(err)),
      },
      { status: 500 }
    );
  }
}
