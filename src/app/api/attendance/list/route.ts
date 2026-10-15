import { NextResponse } from 'next/server';
import { getAttendanceRecordsAsync, getAttendanceRecords } from '@/lib/attendanceStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getAttendanceRecordsAsync();
    return NextResponse.json(records);
  } catch (err: unknown) {
    console.error('Error fetching attendance records API:', err);
    return NextResponse.json(getAttendanceRecords(), { status: 200 });
  }
}
