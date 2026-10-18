import { NextRequest, NextResponse } from 'next/server';
import { updateAttendanceRecord } from '@/lib/attendanceStore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      employeeName,
      projectName,
      punchType,
      formattedDate,
      formattedTime,
      photoUrl,
    } = body;

    if (!employeeName || !formattedDate || !formattedTime) {
      return NextResponse.json(
        { success: false, message: 'Employee name, date, and time are required' },
        { status: 400 }
      );
    }

    const record = await updateAttendanceRecord({
      id,
      employeeName,
      projectName: projectName || 'Nivasa II (Site 1)',
      punchType: punchType === 'PUNCH_OUT' ? 'PUNCH_OUT' : 'PUNCH_IN',
      formattedDate,
      formattedTime,
      photoUrl,
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance record updated successfully',
      record,
    });
  } catch (err: unknown) {
    console.error('Error updating attendance record:', err);
    return NextResponse.json(
      {
        success: false,
        message:
          'Failed to update attendance record: ' +
          (err instanceof Error ? err.message : String(err)),
      },
      { status: 500 }
    );
  }
}
