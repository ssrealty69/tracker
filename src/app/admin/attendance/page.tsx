'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
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
  Sparkles,
  Timer,
  Share2,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { getAttendanceListAction } from '@/lib/attendanceActions';
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
  };
  punchOut?: {
    id: string;
    time: string;
    photoUrl: string;
    timestamp: string;
  };
  duration: string;
  status: 'COMPLETED' | 'ON_SITE';
}

export default function AdminAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activePhotoModal, setActivePhotoModal] = useState<{ url: string; title: string } | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceListAction();
      setRecords(data);
    } catch (err) {
      console.error('Error loading attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

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
        };
      } else if (r.punchType === 'PUNCH_OUT' && !row.punchOut) {
        row.punchOut = {
          id: r.id,
          time: r.formattedTime,
          photoUrl: r.photoUrl,
          timestamp: r.timestamp,
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

  // Stats for today
  const todayRecords = records.filter((r) => r.formattedDate === todayStr);
  const todayPunchIns = todayRecords.filter((r) => r.punchType === 'PUNCH_IN').length;
  const todayPunchOuts = todayRecords.filter((r) => r.punchType === 'PUNCH_OUT').length;
  const uniqueStaffToday = new Set(todayRecords.map((r) => r.employeeName)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" /> Construction Site Attendance & Geofence
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Daily Attendance & Selfie Punch Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Single-row attendance view with Morning & Evening selfies, timestamps, and total shift duration.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/site-report"
            target="_blank"
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-all shadow-2xs"
            title="Open Public Ledger that requires no login"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-600" /> Public Report (No Login) <ExternalLink className="w-3 h-3 text-emerald-600" />
          </Link>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            href="/attendance"
            target="_blank"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" /> Open Punch Form <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Target Site Details Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <MapPin className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              Configured Site Coordinates: 28.465355, 77.185921
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                50m Geofence Active
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Employees can only punch from inside the 50-meter circle. Live selfie verification is strictly enforced.
            </p>
          </div>
        </div>
        <a
          href={TARGET_SITE_CONFIG.googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all self-start md:self-auto shadow-2xs"
        >
          View Site on Google Maps <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Staff on Site Today</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{uniqueStaffToday}</p>
          <span className="text-[11px] text-slate-400">Unique attendees</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Morning Punch Ins</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{todayPunchIns}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Logged today</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Evening Punch Outs</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{todayPunchOuts}</p>
          <span className="text-[11px] text-rose-600 font-medium">Completed shifts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Staff Logs</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{consolidatedRows.length}</p>
          <span className="text-[11px] text-slate-400">Daily employee records</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee or project..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({consolidatedRows.length})
            </button>
            <button
              onClick={() => setSelectedStatus('COMPLETED')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                selectedStatus === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Completed Shifts
            </button>
            <button
              onClick={() => setSelectedStatus('ON_SITE')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
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

      {/* Consolidated Single-Row Attendance Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-sm font-medium">Loading attendance records...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Koi attendance record nahi mila</p>
            <p className="text-xs text-slate-400 mt-1">
              Jab staff attendance form se punch karenge toh yahan unka arrival aur departure ek hi row mein dikhega.
            </p>
            <Link
              href="/attendance"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-semibold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-xs"
            >
              Selfie Form Kholein <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
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
                  <th className="py-3.5 px-4">Total Shift Hours</th>
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
                        <p className="text-[10px] text-slate-400">Employee Record</p>
                      </td>

                      {/* Project Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          {row.projectName}
                        </span>
                      </td>

                      {/* Morning Punch In (Selfie + Time) */}
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
                              <p className="text-[10px] text-slate-400 mt-0.5">Verified on Site</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No In Record</span>
                        )}
                      </td>

                      {/* Evening Punch Out (Selfie + Time) */}
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
                              <p className="text-[10px] text-slate-400 mt-0.5">Verified on Site</p>
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

                      {/* Status */}
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

      {/* Photo Modal Preview */}
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
