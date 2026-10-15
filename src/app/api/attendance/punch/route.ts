import { NextRequest, NextResponse } from 'next/server';
import {
  AttendanceRecord,
  TARGET_SITE_CONFIG,
  calculateDistanceInMeters,
  getIndianTimeStr,
  getIndianFormattedDate,
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

    // Distance calculation (Optional, never blocks punch)
    const userLat = typeof latitude === 'number' ? latitude : TARGET_SITE_CONFIG.latitude;
    const userLng = typeof longitude === 'number' ? longitude : TARGET_SITE_CONFIG.longitude;

    const distanceMeters = calculateDistanceInMeters(
      userLat,
      userLng,
      TARGET_SITE_CONFIG.latitude,
      TARGET_SITE_CONFIG.longitude
    );

    // Exact Indian Standard Time (IST - Asia/Kolkata)
    const now = new Date();
    const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Save image to storage
    const photoUrl = await saveSelfieImage(photoBase64, id);

    const formattedDate = getIndianFormattedDate(now);
    const formattedTime = body.clientTimeStr || getIndianTimeStr(now);

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
      isWithinRadius: true,
      siteLatitude: TARGET_SITE_CONFIG.latitude,
      siteLongitude: TARGET_SITE_CONFIG.longitude,
      allowedRadiusMeters: TARGET_SITE_CONFIG.radiusMeters,
      photoUrl,
      createdAt: now.toISOString(),
    };

    await saveAttendanceRecord(record);

    const punchLabel = record.punchType === 'PUNCH_IN' ? 'Punch In' : 'Punch Out';

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
