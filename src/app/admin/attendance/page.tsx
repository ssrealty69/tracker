'use client';

import AttendanceLedgerView from '@/components/AttendanceLedgerView';
import { Camera, Share2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function AdminAttendancePage() {
  const adminHeader = (
    <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-base tracking-tight text-slate-900">
            Site Attendance &amp; Biometric Ledger
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            Admin View
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Real-time GPS geofenced attendance logs, monthly timesheet calendar, and selfie verification for site staff.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <Link
          href="/site-report"
          target="_blank"
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-600" />
          <span>Public Report</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Link>
        <Link
          href="/attendance"
          target="_blank"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Punch Form</span>
        </Link>
      </div>
    </div>
  );

  return <AttendanceLedgerView isAdmin={true} customHeader={adminHeader} />;
}
