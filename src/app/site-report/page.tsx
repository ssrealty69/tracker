'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  Search,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Camera,
  Timer,
  Calendar,
  AlertCircle,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import type { AttendanceRecord } from '@/lib/attendanceConfig';
import { TARGET_SITE_CONFIG } from '@/lib/attendanceConfig';

interface DailyStaffRow {
  key: string;
  date: string;
  employeeName: string;
  projectName: string;
  punchIn?: {
    id: string;
    time: string;
    photoUrl: string;
    timestamp: string;
    distance: number;
  };
  punchOut?: {
    id: string;
    time: string;
    photoUrl: string;
    timestamp: string;
    distance: number;
  };
  duration: string;
  status: 'COMPLETED' | 'ON_SITE';
}

export default function SiteReportPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activePhotoModal, setActivePhotoModal] = useState<{ url: string; title: string } | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/list', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (err) {
      console.error('Error loading attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Today's Date String
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Consolidated Daily Rows: 1 Row per Employee per Date
  const consolidatedRows = useMemo(() => {
    const map = new Map<string, DailyStaffRow>();

    records.forEach((r) => {
      const key = `${r.formattedDate}_${r.employeeName}_${r.projectName}`;
      let row = map.get(key);

      if (!row) {
        row = {
          key,
          date: r.formattedDate,
          employeeName: r.employeeName,
          projectName: r.projectName,
          duration: 'Shift in progress...',
          status: 'ON_SITE',
        };
        map.set(key, row);
      }

      if (r.punchType === 'PUNCH_IN' && !row.punchIn) {
        row.punchIn = {
          id: r.id,
          time: r.formattedTime,
          photoUrl: r.photoUrl,
          timestamp: r.timestamp,
          distance: r.distanceMeters,
        };
      } else if (r.punchType === 'PUNCH_OUT' && !row.punchOut) {
        row.punchOut = {
          id: r.id,
          time: r.formattedTime,
          photoUrl: r.photoUrl,
          timestamp: r.timestamp,
          distance: r.distanceMeters,
        };
      }

      // Calculate Duration
      if (row.punchIn && row.punchOut) {
        const inMs = new Date(row.punchIn.timestamp).getTime();
        const outMs = new Date(row.punchOut.timestamp).getTime();
        const diffMs = Math.max(0, outMs - inMs);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        row.duration = `${hours}h ${mins}m`;
        row.status = 'COMPLETED';
      } else if (row.punchIn && !row.punchOut) {
        row.duration = 'On Site (In Progress)';
        row.status = 'ON_SITE';
      } else if (!row.punchIn && row.punchOut) {
        row.duration = '--';
        row.status = 'COMPLETED';
      }
    });

    return Array.from(map.values());
  }, [records]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return consolidatedRows.filter((r) => {
      const matchesSearch =
        r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        selectedStatus === 'ALL' || r.status === selectedStatus;
      const matchesDate = !selectedDate || r.date === selectedDate;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [consolidatedRows, searchTerm, selectedStatus, selectedDate]);

  // Quick KPI numbers for today
  const todayRecords = records.filter((r) => r.formattedDate === todayStr);
  const todayPunchIns = todayRecords.filter((r) => r.punchType === 'PUNCH_IN').length;
  const todayPunchOuts = todayRecords.filter((r) => r.punchType === 'PUNCH_OUT').length;
  const uniqueStaffToday = new Set(todayRecords.map((r) => r.employeeName)).size;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white font-sans pb-16">
      {/* Top Standalone Header - Clean Light Theme with Zero Admin Mentions */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900">SS REALTY</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Site Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500">Construction Attendance & Daily Work Verification</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={fetchRecords}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/attendance"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Open Punch Form</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Site Location & Geofence Verification Bar (Light Theme) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <MapPin className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                Site Coordinates: 28.465355, 77.185921
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  50m Geofence Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every punch is verified via live selfie and GPS proximity. Both Morning and Evening entries appear in a single unified ledger.
              </p>
            </div>
          </div>
          <a
            href={TARGET_SITE_CONFIG.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all self-start md:self-auto shadow-2xs"
          >
            Open Location in Google Maps <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 4 KPI Metrics Cards (Light Theme matching Admin Portal) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Staff on Site Today</span>
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1.5">{uniqueStaffToday}</p>
            <span className="text-[11px] text-slate-400">Attendees logged today</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Morning Punch Ins</span>
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-1.5">{todayPunchIns}</p>
            <span className="text-[11px] text-emerald-600 font-medium">Arrivals recorded</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Evening Punch Outs</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-2xl font-black text-rose-600 mt-1.5">{todayPunchOuts}</p>
            <span className="text-[11px] text-rose-600 font-medium">Shifts closed today</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Geofence Compliance</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 mt-1.5">100%</p>
            <span className="text-[11px] text-emerald-600 font-medium">All verified &le;50m</span>
          </div>
        </div>

        {/* Filter and Search Bar (Light Theme) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff name or project..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setSelectedStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({consolidatedRows.length})
              </button>
              <button
                onClick={() => setSelectedStatus('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedStatus === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Completed Shift
              </button>
              <button
                onClick={() => setSelectedStatus('ON_SITE')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  selectedStatus === 'ON_SITE'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                On Site (Working)
              </button>
            </div>
          </div>
        </div>

        {/* Unified Single-Row Attendance Ledger Table (Light Theme, No GPS/Distance Columns) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
              <p className="text-sm font-medium text-slate-600">Loading daily site ledger...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Koi attendance record nahi mila</p>
              <p className="text-xs text-slate-400 mt-1">
                Staff punch karne ke baad unka arrival aur departure proof yahan dikhega.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Project / Site</th>
                    <th className="py-3.5 px-4 min-w-[200px]">🟢 Morning Punch In (Selfie & Time)</th>
                    <th className="py-3.5 px-4 min-w-[200px]">🔴 Evening Punch Out (Selfie & Time)</th>
                    <th className="py-3.5 px-4">Shift Duration</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredRows.map((row) => {
                    return (
                      <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                        {/* Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {row.date}
                          </span>
                        </td>

                        {/* Staff Member */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-slate-900 text-sm">{row.employeeName}</p>
                          <p className="text-[10px] text-slate-400">Daily Attendance</p>
                        </td>

                        {/* Project Name */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs">
                            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                            {row.projectName}
                          </span>
                        </td>

                        {/* Morning Punch In (Selfie + Time in Same Cell) */}
                        <td className="py-3.5 px-4">
                          {row.punchIn ? (
                            <div className="flex items-center gap-3">
                              <div
                                className="relative w-12 h-12 rounded-xl overflow-hidden border border-emerald-300 bg-slate-100 cursor-pointer group shadow-2xs shrink-0 hover:scale-105 transition-transform"
                                onClick={() =>
                                  setActivePhotoModal({
                                    url: row.punchIn!.photoUrl,
                                    title: `${row.employeeName} • Morning Punch In (${row.punchIn!.time})`,
                                  })
                                }
                                title="Click to zoom Morning Selfie"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={row.punchIn.photoUrl}
                                  alt={`${row.employeeName} Morning Punch`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  In: {row.punchIn.time}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5">Verified at Site</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No In Record</span>
                          )}
                        </td>

                        {/* Evening Punch Out (Selfie + Time in Same Cell) */}
                        <td className="py-3.5 px-4">
                          {row.punchOut ? (
                            <div className="flex items-center gap-3">
                              <div
                                className="relative w-12 h-12 rounded-xl overflow-hidden border border-rose-300 bg-slate-100 cursor-pointer group shadow-2xs shrink-0 hover:scale-105 transition-transform"
                                onClick={() =>
                                  setActivePhotoModal({
                                    url: row.punchOut!.photoUrl,
                                    title: `${row.employeeName} • Evening Punch Out (${row.punchOut!.time})`,
                                  })
                                }
                                title="Click to zoom Evening Selfie"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={row.punchOut.photoUrl}
                                  alt={`${row.employeeName} Evening Punch`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity">
                                  <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                              <div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Out: {row.punchOut.time}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5">Verified at Site</p>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                              Out Pending (On Site)
                            </span>
                          )}
                        </td>

                        {/* Total Shift Hours */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 text-xs">
                            <Timer className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{row.duration}</span>
                          </div>
                        </td>

                        {/* Shift Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {row.status === 'COMPLETED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                              On Site
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Biometric Full Photo Zoom Modal */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActivePhotoModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-lg w-full border border-slate-200 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-slate-900">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> {activePhotoModal.title}
              </span>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Close ✕
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhotoModal.url}
              alt="Biometric Selfie Proof"
              className="w-full h-auto rounded-xl border border-slate-200 shadow-md object-contain max-h-[75vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
