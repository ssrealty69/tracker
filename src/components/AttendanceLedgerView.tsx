'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
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
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  UserX,
  X,
  Sparkles,
  Filter,
  User,
} from 'lucide-react';
import Link from 'next/link';
import type { AttendanceRecord } from '@/lib/attendanceConfig';
import { TARGET_SITE_CONFIG } from '@/lib/attendanceConfig';

export const KNOWN_STAFF = ['Ravi Tanwar', 'Naveen Tanwar', 'Harshit'];

export interface DailyStaffRow {
  key: string;
  date: string; // e.g. "15 Oct 2026"
  dateObj: Date;
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

interface PhotoModalState {
  url: string;
  title: string;
  type: 'PUNCH_IN' | 'PUNCH_OUT';
  time: string;
  date: string;
  employeeName: string;
  distance?: number;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getStaffAvatar = (staffName: string) => {
  if (staffName.startsWith('Ravi')) {
    return { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200' };
  }
  if (staffName.startsWith('Naveen')) {
    return { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200' };
  }
  return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' };
};

export default function AttendanceLedgerView({
  isAdmin = false,
  customHeader = null,
}: {
  isAdmin?: boolean;
  customHeader?: React.ReactNode;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'daily' (Single date live register) vs 'monthly_calendar' (Staff calendar & month timesheet)
  const [viewMode, setViewMode] = useState<'monthly_calendar' | 'daily'>('monthly_calendar');

  // Daily Mode States
  const [dailyDateFilter, setDailyDateFilter] = useState<string>(''); // empty means today
  const [dailySearchTerm, setDailySearchTerm] = useState('');
  const [dailyStatusFilter, setDailyStatusFilter] = useState<string>('ALL');

  // Monthly Calendar States
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-indexed (9 = Oct)
  const [selectedStaff, setSelectedStaff] = useState<string>('All'); // 'All' | 'Ravi Tanwar' | 'Naveen Tanwar' | 'Harshit'
  const [selectedDayDetail, setSelectedDayDetail] = useState<number | null>(null);
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('ALL');

  // Photo Zoom Modal State
  const [activePhotoModal, setActivePhotoModal] = useState<PhotoModalState | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/attendance/list', { cache: 'no-store' });
      if (res.ok) {
        const data: AttendanceRecord[] = await res.json();
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

  // Today string format matching formattedDate
  const todayStr = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  // Parse helper: converts formattedDate (e.g. "15 Oct 2026") or ISO string to standard YYYY-MM-DD
  const parseDateToKey = (dateStr: string, timestamp?: string): string => {
    if (timestamp) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    const parts = dateStr.split(' ');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthIdx = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(parts[1].toLowerCase()));
      const y = parts[2];
      if (monthIdx >= 0) {
        const m = String(monthIdx + 1).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }
    return dateStr;
  };

  // Build Consolidated Daily Rows: 1 Row per (dateKey + employeeName)
  const consolidatedMap = useMemo(() => {
    const map = new Map<string, DailyStaffRow>();

    records.forEach((r) => {
      const dateKey = parseDateToKey(r.formattedDate, r.timestamp);
      const compositeKey = `${dateKey}_${r.employeeName}`;
      let row = map.get(compositeKey);

      if (!row) {
        const dObj = new Date(r.timestamp);
        row = {
          key: compositeKey,
          date: r.formattedDate,
          dateObj: isNaN(dObj.getTime()) ? new Date() : dObj,
          employeeName: r.employeeName,
          projectName: r.projectName,
          duration: 'On Site (In Progress)',
          status: 'ON_SITE',
        };
        map.set(compositeKey, row);
      }

      if (r.punchType === 'PUNCH_IN') {
        if (!row.punchIn || new Date(r.timestamp) < new Date(row.punchIn.timestamp)) {
          row.punchIn = {
            id: r.id,
            time: r.formattedTime,
            photoUrl: r.photoUrl,
            timestamp: r.timestamp,
            distance: r.distanceMeters,
          };
        }
      } else if (r.punchType === 'PUNCH_OUT') {
        if (!row.punchOut || new Date(r.timestamp) > new Date(row.punchOut.timestamp)) {
          row.punchOut = {
            id: r.id,
            time: r.formattedTime,
            photoUrl: r.photoUrl,
            timestamp: r.timestamp,
            distance: r.distanceMeters,
          };
        }
      }

      // Calculate shift duration
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
      }
    });

    return map;
  }, [records]);

  // All Consolidated Rows list sorted newest first
  const allConsolidatedRows = useMemo(() => {
    return Array.from(consolidatedMap.values()).sort(
      (a, b) => new Date(b.punchIn?.timestamp || b.dateObj).getTime() - new Date(a.punchIn?.timestamp || a.dateObj).getTime()
    );
  }, [consolidatedMap]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DAILY REGISTER FILTERED ROWS
  // ─────────────────────────────────────────────────────────────────────────────
  const dailyRows = useMemo(() => {
    const targetDate = dailyDateFilter || todayStr;
    return allConsolidatedRows.filter((r) => {
      const matchesDate = !targetDate || r.date === targetDate;
      const matchesSearch =
        !dailySearchTerm ||
        r.employeeName.toLowerCase().includes(dailySearchTerm.toLowerCase()) ||
        r.projectName.toLowerCase().includes(dailySearchTerm.toLowerCase());
      const matchesStatus =
        dailyStatusFilter === 'ALL' || r.status === dailyStatusFilter;
      return matchesDate && matchesSearch && matchesStatus;
    });
  }, [allConsolidatedRows, dailyDateFilter, todayStr, dailySearchTerm, dailyStatusFilter]);

  // Quick stats for Today's view
  const todayRows = useMemo(() => {
    return allConsolidatedRows.filter((r) => r.date === todayStr);
  }, [allConsolidatedRows, todayStr]);

  const todayCompleted = todayRows.filter((r) => r.status === 'COMPLETED').length;
  const todayOnSite = todayRows.filter((r) => r.status === 'ON_SITE').length;

  // ─────────────────────────────────────────────────────────────────────────────
  // MONTHLY CALENDAR COMPUTATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  const monthInfo = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    // Monday-indexed day of week for 1st day (0 = Mon, 6 = Sun)
    const firstDayJs = new Date(selectedYear, selectedMonth, 1).getDay();
    const firstDayOffset = (firstDayJs + 6) % 7; // Monday = 0, Sun = 6
    return { totalDays, firstDayOffset };
  }, [selectedYear, selectedMonth]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
    setSelectedDayDetail(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
    setSelectedDayDetail(null);
  };

  const handleCurrentMonth = () => {
    const cur = new Date();
    setSelectedYear(cur.getFullYear());
    setSelectedMonth(cur.getMonth());
    setSelectedDayDetail(null);
  };

  // Build Day Calendar Model for Selected Staff & Month
  interface DayCalendarCell {
    dayNum: number;
    dateKey: string;
    formattedDate: string;
    isSunday: boolean;
    isPastOrToday: boolean;
    isToday: boolean;
    isFuture: boolean;
    // Per-staff attendance breakdown for this day
    staffRecords: {
      staffName: string;
      row?: DailyStaffRow;
      isPresent: boolean;
      isOnSite: boolean;
      isAbsent: boolean;
    }[];
    // Aggregated stats for the cell based on selectedStaff
    primaryStatus: 'PRESENT' | 'ON_SITE' | 'ABSENT' | 'FUTURE';
    hoursFormatted: string;
    inTime?: string;
    outTime?: string;
    inPhoto?: string;
    outPhoto?: string;
  }

  const calendarDays = useMemo<DayCalendarCell[]>(() => {
    const cells: DayCalendarCell[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetStaffList =
      selectedStaff === 'All' ? KNOWN_STAFF : [selectedStaff];

    for (let d = 1; d <= monthInfo.totalDays; d++) {
      const cellDate = new Date(selectedYear, selectedMonth, d);
      cellDate.setHours(0, 0, 0, 0);

      const isSunday = cellDate.getDay() === 0;
      const isToday = cellDate.getTime() === today.getTime();
      const isPastOrToday = cellDate <= today;
      const isFuture = cellDate > today;

      const dayStr = String(d).padStart(2, '0');
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dateKey = `${selectedYear}-${mStr}-${dayStr}`;

      const monthShort = MONTH_NAMES[selectedMonth].slice(0, 3);
      const formattedDate = `${dayStr} ${monthShort} ${selectedYear}`;

      const staffRecords = targetStaffList.map((staffName) => {
        const compositeKey = `${dateKey}_${staffName}`;
        const row = consolidatedMap.get(compositeKey);
        const isPresent = !!row && row.status === 'COMPLETED';
        const isOnSite = !!row && row.status === 'ON_SITE';
        // 7-Days working company policy: all days are working days!
        const isAbsent = !row && isPastOrToday;

        return {
          staffName,
          row,
          isPresent,
          isOnSite,
          isAbsent,
        };
      });

      // Compute cell aggregate (7-Days working schedule)
      let primaryStatus: 'PRESENT' | 'ON_SITE' | 'ABSENT' | 'FUTURE' = 'FUTURE';
      let hoursFormatted = '--';
      let inTime: string | undefined;
      let outTime: string | undefined;
      let inPhoto: string | undefined;
      let outPhoto: string | undefined;

      if (isFuture) {
        primaryStatus = 'FUTURE';
      } else {
        if (selectedStaff === 'All') {
          const presentCount = staffRecords.filter((s) => s.isPresent).length;
          const onSiteCount = staffRecords.filter((s) => s.isOnSite).length;
          if (presentCount === targetStaffList.length) {
            primaryStatus = 'PRESENT';
            hoursFormatted = `${presentCount}/${targetStaffList.length} Present`;
          } else if (presentCount > 0 || onSiteCount > 0) {
            primaryStatus = onSiteCount > 0 ? 'ON_SITE' : 'PRESENT';
            hoursFormatted = `${presentCount + onSiteCount}/${targetStaffList.length} Attended`;
          } else {
            primaryStatus = 'ABSENT';
            hoursFormatted = 'All Absent';
          }
        } else {
          // Single Staff View
          const sr = staffRecords[0];
          if (sr.isPresent) {
            primaryStatus = 'PRESENT';
            hoursFormatted = sr.row?.duration || 'Completed';
            inTime = sr.row?.punchIn?.time;
            outTime = sr.row?.punchOut?.time;
            inPhoto = sr.row?.punchIn?.photoUrl;
            outPhoto = sr.row?.punchOut?.photoUrl;
          } else if (sr.isOnSite) {
            primaryStatus = 'ON_SITE';
            hoursFormatted = 'On Site';
            inTime = sr.row?.punchIn?.time;
            inPhoto = sr.row?.punchIn?.photoUrl;
          } else {
            primaryStatus = 'ABSENT';
            hoursFormatted = 'Absent';
          }
        }
      }

      cells.push({
        dayNum: d,
        dateKey,
        formattedDate,
        isSunday,
        isPastOrToday,
        isToday,
        isFuture,
        staffRecords,
        primaryStatus,
        hoursFormatted,
        inTime,
        outTime,
        inPhoto,
        outPhoto,
      });
    }

    return cells;
  }, [selectedYear, selectedMonth, monthInfo.totalDays, selectedStaff, consolidatedMap]);

  // Monthly Aggregate Performance Metrics (for selected staff & selected month)
  const monthlyMetrics = useMemo(() => {
    let workingDaysCount = 0;
    let presentDaysCount = 0;
    let absentDaysCount = 0;
    let onSiteDaysCount = 0;
    let totalMinutesWorked = 0;

    calendarDays.forEach((cell) => {
      if (cell.isPastOrToday) {
        workingDaysCount++;
        if (selectedStaff === 'All') {
          const anyPresent = cell.staffRecords.some((s) => s.isPresent);
          const anyOnSite = cell.staffRecords.some((s) => s.isOnSite);
          if (anyPresent) presentDaysCount++;
          else if (anyOnSite) onSiteDaysCount++;
          else absentDaysCount++;
        } else {
          const sr = cell.staffRecords[0];
          if (sr?.isPresent) presentDaysCount++;
          else if (sr?.isOnSite) onSiteDaysCount++;
          else absentDaysCount++;

          // Sum duration
          if (sr?.row?.punchIn && sr?.row?.punchOut) {
            const inMs = new Date(sr.row.punchIn.timestamp).getTime();
            const outMs = new Date(sr.row.punchOut.timestamp).getTime();
            const diffMin = Math.max(0, Math.floor((outMs - inMs) / 60000));
            totalMinutesWorked += diffMin;
          }
        }
      }
    });

    const totalHours = Math.floor(totalMinutesWorked / 60);
    const totalRemainingMins = totalMinutesWorked % 60;
    const avgMins = presentDaysCount > 0 ? Math.floor(totalMinutesWorked / presentDaysCount) : 0;
    const avgHours = Math.floor(avgMins / 60);
    const avgRemMins = avgMins % 60;

    const attendanceRate =
      workingDaysCount > 0
        ? Math.round(((presentDaysCount + onSiteDaysCount) / workingDaysCount) * 100)
        : 0;

    return {
      workingDaysCount,
      presentDaysCount,
      absentDaysCount,
      onSiteDaysCount,
      hoursStr: `${totalHours}h ${totalRemainingMins}m`,
      avgStr: `${avgHours}h ${avgRemMins}m / day`,
      attendanceRate,
    };
  }, [calendarDays, selectedStaff]);

  // Chronological Day-by-Day Timesheet Table for the selected month
  const monthlyTableRows = useMemo(() => {
    const list: {
      date: string;
      dayNum: number;
      dayOfWeek: string;
      isSunday: boolean;
      employeeName: string;
      projectName: string;
      status: 'PRESENT' | 'ON_SITE' | 'ABSENT';
      punchIn?: { time: string; photoUrl: string; distance: number };
      punchOut?: { time: string; photoUrl: string; distance: number };
      duration: string;
    }[] = [];

    const targetStaffList =
      selectedStaff === 'All' ? KNOWN_STAFF : [selectedStaff];

    // Filter to selected day if user clicked a specific calendar cell
    const daysToInclude = selectedDayDetail
      ? calendarDays.filter((c) => c.dayNum === selectedDayDetail)
      : [...calendarDays].reverse(); // latest first

    daysToInclude.forEach((cell) => {
      const cellDate = new Date(selectedYear, selectedMonth, cell.dayNum);
      const dayOfWeek = cellDate.toLocaleDateString('en-US', { weekday: 'short' });

      targetStaffList.forEach((staffName) => {
        const sr = cell.staffRecords.find((s) => s.staffName === staffName);
        if (cell.isFuture) return;

        if (sr?.isPresent && sr.row) {
          list.push({
            date: cell.formattedDate,
            dayNum: cell.dayNum,
            dayOfWeek,
            isSunday: cell.isSunday,
            employeeName: staffName,
            projectName: sr.row.projectName,
            status: 'PRESENT',
            punchIn: sr.row.punchIn
              ? {
                  time: sr.row.punchIn.time,
                  photoUrl: sr.row.punchIn.photoUrl,
                  distance: sr.row.punchIn.distance,
                }
              : undefined,
            punchOut: sr.row.punchOut
              ? {
                  time: sr.row.punchOut.time,
                  photoUrl: sr.row.punchOut.photoUrl,
                  distance: sr.row.punchOut.distance,
                }
              : undefined,
            duration: sr.row.duration,
          });
        } else if (sr?.isOnSite && sr.row) {
          list.push({
            date: cell.formattedDate,
            dayNum: cell.dayNum,
            dayOfWeek,
            isSunday: cell.isSunday,
            employeeName: staffName,
            projectName: sr.row.projectName,
            status: 'ON_SITE',
            punchIn: sr.row.punchIn
              ? {
                  time: sr.row.punchIn.time,
                  photoUrl: sr.row.punchIn.photoUrl,
                  distance: sr.row.punchIn.distance,
                }
              : undefined,
            duration: 'On Site (Out Pending)',
          });
        } else if (cell.isPastOrToday) {
          list.push({
            date: cell.formattedDate,
            dayNum: cell.dayNum,
            dayOfWeek,
            isSunday: cell.isSunday,
            employeeName: staffName,
            projectName: 'Nivasa II (Site 1)',
            status: 'ABSENT',
            duration: 'No Punch Logged (Absent)',
          });
        }
      });
    });

    return list;
  }, [calendarDays, selectedDayDetail, selectedStaff, selectedYear, selectedMonth]);

  const displayedMonthlyRows = useMemo(() => {
    return monthlyTableRows.filter((r) => {
      if (tableStatusFilter === 'ALL') return true;
      return r.status === tableStatusFilter;
    });
  }, [monthlyTableRows, tableStatusFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white font-sans pb-16">
      {/* Top Header */}
      {customHeader ? (
        customHeader
      ) : (
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
                <p className="text-xs text-slate-500">Construction Attendance, Monthly Timesheet &amp; Verification</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={fetchRecords}
                disabled={loading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
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
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Site Location & Geofence Verification Bar */}
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
                Every punch requires live GPS verification &amp; selfie. Monthly timesheet tracks daily attendance, hours logged, and absent days.
              </p>
            </div>
          </div>
          <a
            href={TARGET_SITE_CONFIG.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all self-start md:self-auto shadow-2xs"
          >
            Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* ─── PRIMARY VIEW MODE SWITCHER ─── */}
        <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setViewMode('monthly_calendar')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'monthly_calendar'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <span>📅 Monthly Staff Calendar &amp; Timesheet</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>📋 Daily Register (Single Day Live)</span>
            </button>
          </div>

          <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time Geofence Tracking</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: MONTHLY STAFF CALENDAR & TIMESHEET                             */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'monthly_calendar' && (
          <div className="space-y-6">
            {/* Filter Toolbar: Staff Selector + Month/Year Picker */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Staff Filter Tabs */}
              <div className="w-full lg:w-auto space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Staff Member / Agent:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => {
                      setSelectedStaff('All');
                      setSelectedDayDetail(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedStaff === 'All'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    All Staff (3)
                  </button>
                  {KNOWN_STAFF.map((staff) => (
                    <button
                      key={staff}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setSelectedDayDetail(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedStaff === staff
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {staff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month & Year Controller */}
              <div className="w-full lg:w-auto space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block lg:text-right">
                  Select Month &amp; Year:
                </span>
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(Number(e.target.value));
                      setSelectedDayDetail(null);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer py-1 px-1.5"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>
                        {name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(Number(e.target.value));
                      setSelectedDayDetail(null);
                    }}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer py-1 px-1.5"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleCurrentMonth}
                    className="ml-1 px-2.5 py-1 text-[11px] font-bold bg-white text-indigo-700 hover:bg-indigo-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    This Month
                  </button>
                </div>
              </div>
            </div>

            {/* Monthly KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Working Days</span>
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1.5">
                  {monthlyMetrics.workingDaysCount}
                </p>
                <span className="text-[11px] text-slate-400">7-Days Schedule (All Days)</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-600 text-xs font-semibold">
                  <span>Days Present</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-1.5">
                  {monthlyMetrics.presentDaysCount}
                </p>
                <span className="text-[11px] text-emerald-600 font-medium">Verified at site</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-rose-600 text-xs font-semibold">
                  <span>Days Absent</span>
                  <UserX className="w-4 h-4 text-rose-600" />
                </div>
                <p className="text-2xl font-black text-rose-600 mt-1.5">
                  {monthlyMetrics.absentDaysCount}
                </p>
                <span className="text-[11px] text-rose-600 font-medium">No punch recorded</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-indigo-600 text-xs font-semibold">
                  <span>Total Hours Logged</span>
                  <Timer className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-black text-indigo-600 mt-1.5">
                  {selectedStaff === 'All' ? '--' : monthlyMetrics.hoursStr}
                </p>
                <span className="text-[11px] text-slate-400">
                  {selectedStaff === 'All' ? 'Select staff for hours' : monthlyMetrics.avgStr}
                </span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs col-span-2 md:col-span-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Attendance Rate</span>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1.5">
                  {monthlyMetrics.attendanceRate}%
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full"
                    style={{ width: `${monthlyMetrics.attendanceRate}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* ─── INTERACTIVE 7-DAY CALENDAR GRID ─── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>
                      {MONTH_NAMES[selectedMonth]} {selectedYear} &mdash; Attendance Calendar
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selectedStaff === 'All' ? 'All 3 Staff Members' : selectedStaff}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any day cell to filter the detailed timesheet below. Both Morning and Evening selfie thumbnails are clickable to zoom.
                  </p>
                </div>

                {/* Calendar Legend */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> On Site
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span> Absent
                  </span>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-slate-100/60">
                {/* Day Header Row (Mon - Sun) */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 mb-2.5 text-center">
                  {WEEKDAY_NAMES.map((name) => (
                    <div
                      key={name}
                      className="py-2 rounded-xl bg-white/90 border border-slate-200/70 text-[11px] sm:text-xs font-black tracking-wider uppercase text-slate-600 shadow-2xs"
                    >
                      {name}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                  {/* Empty Offset Cells */}
                  {Array.from({ length: monthInfo.firstDayOffset }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="min-h-[120px] sm:min-h-[135px] rounded-xl border border-dashed border-slate-200/60 bg-slate-50/40 opacity-40 flex items-center justify-center"
                    >
                      <span className="text-slate-300 text-xs font-mono">&mdash;</span>
                    </div>
                  ))}

                  {/* Day Cells */}
                  {calendarDays.map((cell) => {
                    const isSelected = selectedDayDetail === cell.dayNum;
                    const presentCount = cell.staffRecords.filter((s) => s.isPresent).length;
                    const onSiteCount = cell.staffRecords.filter((s) => s.isOnSite).length;
                    const absentCount = cell.staffRecords.filter((s) => s.isAbsent).length;
                    const hasAbsence = cell.isPastOrToday && absentCount > 0;
                    const allPresent = cell.isPastOrToday && presentCount === cell.staffRecords.length;

                    return (
                      <div
                        key={cell.dayNum}
                        onClick={() =>
                          setSelectedDayDetail(isSelected ? null : cell.dayNum)
                        }
                        className={`min-h-[120px] sm:min-h-[135px] p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between group ${
                          isSelected
                            ? 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/80 shadow-md z-10'
                            : cell.isFuture
                            ? 'bg-slate-50/40 border-slate-200/60 opacity-50 hover:opacity-75'
                            : cell.isToday
                            ? 'bg-white border-indigo-400 ring-2 ring-indigo-200/80 shadow-xs hover:shadow-md'
                            : hasAbsence
                            ? 'bg-white border-rose-200/90 hover:border-rose-300 hover:shadow-md'
                            : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-md'
                        }`}
                      >
                        {/* Top Bar: Day Number + Status Badge */}
                        <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-lg flex items-center justify-center text-xs font-black ${
                                cell.isToday
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-800 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                              }`}
                            >
                              {cell.dayNum}
                            </span>

                            {cell.isToday && (
                              <span className="hidden sm:inline-block text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                                Today
                              </span>
                            )}
                          </div>

                          {/* Day Attendance Status Pill */}
                          {!cell.isFuture && (
                            selectedStaff === 'All' ? (
                              allPresent ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                  <span className="hidden md:inline">All</span> 3/3
                                </span>
                              ) : hasAbsence ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                  <UserX className="w-2.5 h-2.5 text-rose-600" />
                                  <span>{absentCount} Absent</span>
                                </span>
                              ) : onSiteCount > 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  <span>On Site</span>
                                </span>
                              ) : null
                            ) : (
                              /* Single staff status */
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold shrink-0 ${
                                  cell.primaryStatus === 'PRESENT'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : cell.primaryStatus === 'ON_SITE'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 font-black'
                                }`}
                              >
                                {cell.primaryStatus === 'PRESENT'
                                  ? 'Present'
                                  : cell.primaryStatus === 'ON_SITE'
                                  ? 'On Site'
                                  : 'Absent'}
                              </span>
                            )
                          )}
                        </div>

                        {/* Content inside cell */}
                        <div className="py-1.5 my-auto">
                          {cell.isFuture ? (
                            <div className="text-center py-2">
                              <span className="text-[11px] font-mono text-slate-300">&mdash;</span>
                            </div>
                          ) : selectedStaff === 'All' ? (
                            /* Multi-staff summary inside cell with avatar and badge */
                            <div className="space-y-1">
                              {cell.staffRecords.map((sr) => {
                                const firstName = sr.staffName.split(' ')[0];
                                const initial = firstName.charAt(0);
                                const avatar = getStaffAvatar(sr.staffName);

                                return (
                                  <div
                                    key={sr.staffName}
                                    className={`flex items-center justify-between px-1.5 py-1 rounded-lg transition-colors border ${
                                      sr.isPresent
                                        ? 'bg-slate-50/80 hover:bg-emerald-50/60 border-slate-100 text-slate-800'
                                        : sr.isOnSite
                                        ? 'bg-amber-50/60 hover:bg-amber-50 border-amber-100 text-amber-950'
                                        : 'bg-rose-50/60 hover:bg-rose-50 border-rose-100 text-rose-950'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${avatar.bg} ${avatar.text}`}
                                      >
                                        {initial}
                                      </span>
                                      <span className="font-bold text-[10.5px] sm:text-[11px] truncate text-slate-800">
                                        {firstName}
                                      </span>
                                    </div>

                                    {/* Status Chip */}
                                    {sr.isPresent ? (
                                      <span className="text-[9px] font-black text-emerald-700 bg-white/90 border border-emerald-200 px-1 py-0.2 rounded shadow-2xs shrink-0">
                                        P
                                      </span>
                                    ) : sr.isOnSite ? (
                                      <span className="text-[9px] font-black text-amber-800 bg-white/90 border border-amber-200 px-1 py-0.2 rounded shadow-2xs shrink-0">
                                        In
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-black text-rose-700 bg-white/90 border border-rose-200 px-1 py-0.2 rounded shadow-2xs shrink-0">
                                        A
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Single Staff Detail with Timings & Total */
                            <div>
                              {cell.primaryStatus === 'PRESENT' ? (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono">
                                    <span className="text-slate-500 font-semibold">Total:</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      {cell.hoursFormatted}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-mono space-y-0.5 bg-slate-50/80 p-1.5 rounded-lg border border-slate-100">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">In:</span>
                                      <span className="font-bold text-slate-800">
                                        {cell.inTime?.replace(/:\d\d\s/, ' ')}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-400">Out:</span>
                                      <span className="font-bold text-slate-800">
                                        {cell.outTime?.replace(/:\d\d\s/, ' ')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : cell.primaryStatus === 'ON_SITE' ? (
                                <div className="space-y-1 bg-amber-50/50 p-1.5 rounded-lg border border-amber-100">
                                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800">
                                    <Clock className="w-3 h-3 text-amber-600" /> In Progress
                                  </span>
                                  <div className="text-[10px] font-mono text-slate-700">
                                    In:{' '}
                                    <span className="font-bold">
                                      {cell.inTime?.replace(/:\d\d\s/, ' ')}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-2 bg-rose-50/50 rounded-lg border border-rose-100">
                                  <span className="text-[11px] font-extrabold text-rose-700 block">
                                    Absent
                                  </span>
                                  <span className="text-[9.5px] text-rose-500 block">
                                    No Punch Logged
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Bottom Selfie Preview Badges (Single Staff View) */}
                        {selectedStaff !== 'All' && (cell.inPhoto || cell.outPhoto) && (
                          <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100 mt-1">
                            {cell.inPhoto && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePhotoModal({
                                    url: cell.inPhoto!,
                                    title: `Morning Punch In - ${cell.formattedDate}`,
                                    type: 'PUNCH_IN',
                                    time: cell.inTime || '',
                                    date: cell.formattedDate,
                                    employeeName: selectedStaff,
                                  });
                                }}
                                title="View Morning Punch In Selfie"
                                className="relative w-6 h-6 rounded-md overflow-hidden border border-emerald-400 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                              >
                                <img
                                  src={cell.inPhoto}
                                  alt="Morning Punch In"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              </button>
                            )}
                            {cell.outPhoto && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePhotoModal({
                                    url: cell.outPhoto!,
                                    title: `Evening Punch Out - ${cell.formattedDate}`,
                                    type: 'PUNCH_OUT',
                                    time: cell.outTime || '',
                                    date: cell.formattedDate,
                                    employeeName: selectedStaff,
                                  });
                                }}
                                title="View Evening Punch Out Selfie"
                                className="relative w-6 h-6 rounded-md overflow-hidden border border-rose-400 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                              >
                                <img
                                  src={cell.outPhoto}
                                  alt="Evening Punch Out"
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              </button>
                            )}
                            <span className="text-[10px] text-slate-400 ml-auto font-mono">Zoom</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ─── DAY-BY-DAY MONTHLY TIMESHEET REGISTER TABLE ─── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/70">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>
                      {selectedDayDetail
                        ? `Detailed Timesheet: ${selectedDayDetail} ${MONTH_NAMES[selectedMonth]} ${selectedYear}`
                        : `Complete Monthly Timesheet: ${MONTH_NAMES[selectedMonth]} ${selectedYear}`}
                    </span>
                    {selectedDayDetail && (
                      <button
                        onClick={() => setSelectedDayDetail(null)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer ml-2"
                      >
                        Show All Days
                      </button>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing daily punch arrival/departure times, verified selfies, duration, and absence alerts.
                  </p>
                </div>

                {/* ── Filter Toolbar: Employee Dropdown + Status Filter + Counter ── */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* 1. Employee Dropdown Filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Employee:</span>
                    <select
                      id="timesheet-staff-dropdown"
                      value={selectedStaff}
                      onChange={(e) => {
                        setSelectedStaff(e.target.value);
                        setSelectedDayDetail(null);
                      }}
                      className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="All">All Employees (3)</option>
                      {KNOWN_STAFF.map((staff) => (
                        <option key={staff} value={staff}>
                          {staff}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Status Dropdown Filter */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Status:</span>
                    <select
                      id="timesheet-status-dropdown"
                      value={tableStatusFilter}
                      onChange={(e) => setTableStatusFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
                    >
                      <option value="ALL">All Status</option>
                      <option value="PRESENT">Present (Completed)</option>
                      <option value="ABSENT">Absent</option>
                      <option value="ON_SITE">On Site (In Progress)</option>
                    </select>
                  </div>

                  {/* 3. Total Count Pill */}
                  <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-800 shadow-2xs whitespace-nowrap">
                    Total Entries: <span className="font-black text-indigo-950">{displayedMonthlyRows.length}</span>
                  </div>
                </div>
              </div>

              {displayedMonthlyRows.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CalendarIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">No attendance data matching filter</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try selecting a different employee, status, or month above.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4 whitespace-nowrap">Date &amp; Day</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Staff Member</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                        <th className="py-3.5 px-4 min-w-[210px]">🟢 Morning Punch In (Selfie &amp; Time)</th>
                        <th className="py-3.5 px-4 min-w-[210px]">🔴 Evening Punch Out (Selfie &amp; Time)</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Shift Duration</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Project / Site</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {displayedMonthlyRows.map((row, idx) => (
                        <tr
                          key={`${row.date}_${row.employeeName}_${idx}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            row.status === 'ABSENT'
                              ? 'bg-rose-50/30'
                              : 'bg-white'
                          }`}
                        >
                          {/* Date & Day */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{row.date}</div>
                            <span className="text-[11px] font-medium text-slate-400">
                              {row.dayOfWeek}
                            </span>
                          </td>

                          {/* Staff Member */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{row.employeeName}</div>
                            <span className="text-[11px] text-slate-500">Site Staff</span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.status === 'PRESENT' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Present
                              </span>
                            ) : row.status === 'ON_SITE' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                On Site
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <UserX className="w-3.5 h-3.5 text-rose-600" />
                                Absent
                              </span>
                            )}
                          </td>

                          {/* Morning Punch In (Selfie & Time) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.punchIn ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActivePhotoModal({
                                      url: row.punchIn!.photoUrl,
                                      title: `Morning Punch In - ${row.date}`,
                                      type: 'PUNCH_IN',
                                      time: row.punchIn!.time,
                                      date: row.date,
                                      employeeName: row.employeeName,
                                      distance: row.punchIn!.distance,
                                    })
                                  }
                                  className="group relative w-11 h-11 rounded-xl overflow-hidden border-2 border-emerald-400 bg-slate-900 shadow-2xs hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer shrink-0"
                                >
                                  <img
                                    src={row.punchIn.photoUrl}
                                    alt="Morning Punch In"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </button>
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs font-mono">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>In: {row.punchIn.time}</span>
                                  </div>
                                  <span className="text-[10px] text-emerald-700 font-semibold block">
                                    Verified at Site ({row.punchIn.distance}m)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>

                          {/* Evening Punch Out (Selfie & Time) */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.punchOut ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActivePhotoModal({
                                      url: row.punchOut!.photoUrl,
                                      title: `Evening Punch Out - ${row.date}`,
                                      type: 'PUNCH_OUT',
                                      time: row.punchOut!.time,
                                      date: row.date,
                                      employeeName: row.employeeName,
                                      distance: row.punchOut!.distance,
                                    })
                                  }
                                  className="group relative w-11 h-11 rounded-xl overflow-hidden border-2 border-rose-400 bg-slate-900 shadow-2xs hover:ring-2 hover:ring-rose-500 transition-all cursor-pointer shrink-0"
                                >
                                  <img
                                    src={row.punchOut.photoUrl}
                                    alt="Evening Punch Out"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </button>
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs font-mono">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    <span>Out: {row.punchOut.time}</span>
                                  </div>
                                  <span className="text-[10px] text-rose-700 font-semibold block">
                                    Verified at Site ({row.punchOut.distance}m)
                                  </span>
                                </div>
                              </div>
                            ) : row.status === 'ON_SITE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Out Pending (On Site)
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>

                          {/* Shift Duration */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-xs">
                            {row.status === 'PRESENT' ? (
                              <span className="font-bold text-indigo-700 flex items-center gap-1">
                                <Timer className="w-3.5 h-3.5" />
                                {row.duration}
                              </span>
                            ) : row.status === 'ON_SITE' ? (
                              <span className="text-amber-700 font-semibold">{row.duration}</span>
                            ) : (
                              <span className="text-slate-400">{row.duration}</span>
                            )}
                          </td>

                          {/* Project / Site */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{row.projectName}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: DAILY REGISTER (SINGLE DAY LIVE VIEW)                          */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'daily' && (
          <div className="space-y-6">
            {/* Daily KPI Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Staff on Site Today</span>
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-1.5">{todayRows.length}</p>
                <span className="text-[11px] text-slate-400">Attendees logged today</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Completed Shifts</span>
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-1.5">{todayCompleted}</p>
                <span className="text-[11px] text-emerald-600 font-medium">Both In &amp; Out done</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Currently On Site</span>
                  <ArrowUpRight className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-black text-amber-600 mt-1.5">{todayOnSite}</p>
                <span className="text-[11px] text-amber-600 font-medium">Working on site right now</span>
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

            {/* Filter and Search Bar for Daily View */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={dailySearchTerm}
                    onChange={(e) => setDailySearchTerm(e.target.value)}
                    placeholder="Search staff name or project..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 pl-1.5">Date:</span>
                  <input
                    type="date"
                    value={
                      dailyDateFilter
                        ? parseDateToKey(dailyDateFilter)
                        : new Date().toISOString().split('T')[0]
                    }
                    onChange={(e) => {
                      if (!e.target.value) {
                        setDailyDateFilter('');
                      } else {
                        const parts = e.target.value.split('-');
                        const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                        const formatted = dObj.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        });
                        setDailyDateFilter(formatted);
                      }
                    }}
                    className="px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                  {dailyDateFilter && dailyDateFilter !== todayStr && (
                    <button
                      onClick={() => setDailyDateFilter('')}
                      className="px-2 py-0.5 text-[10.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                    >
                      Reset to Today
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs w-full sm:w-auto justify-between sm:justify-start">
                  <button
                    onClick={() => setDailyStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      dailyStatusFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({dailyRows.length})
                  </button>
                  <button
                    onClick={() => setDailyStatusFilter('COMPLETED')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      dailyStatusFilter === 'COMPLETED'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    Completed Shift
                  </button>
                  <button
                    onClick={() => setDailyStatusFilter('ON_SITE')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      dailyStatusFilter === 'ON_SITE'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    On Site (Working)
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                  <p className="text-sm font-medium text-slate-600">Loading daily site ledger...</p>
                </div>
              ) : dailyRows.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">No attendance records found for this date</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Staff punch records will appear here as soon as they log in with selfie &amp; GPS.
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
                        <th className="py-3.5 px-4 min-w-[200px]">🟢 Morning Punch In (Selfie &amp; Time)</th>
                        <th className="py-3.5 px-4 min-w-[200px]">🔴 Evening Punch Out (Selfie &amp; Time)</th>
                        <th className="py-3.5 px-4">Shift Duration</th>
                        <th className="py-3.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {dailyRows.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-50/80 transition-colors bg-white">
                          <td className="py-3.5 px-4 font-mono font-medium whitespace-nowrap text-slate-900">
                            {row.date}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{row.employeeName}</div>
                            <span className="text-[11px] text-slate-400">Daily Attendance</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-100">
                              <Building2 className="w-3.5 h-3.5" />
                              {row.projectName}
                            </span>
                          </td>
                          {/* Morning Punch In */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {row.punchIn ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActivePhotoModal({
                                      url: row.punchIn!.photoUrl,
                                      title: `Morning Punch In - ${row.date}`,
                                      type: 'PUNCH_IN',
                                      time: row.punchIn!.time,
                                      date: row.date,
                                      employeeName: row.employeeName,
                                      distance: row.punchIn!.distance,
                                    })
                                  }
                                  className="group relative w-12 h-12 rounded-xl overflow-hidden border-2 border-emerald-400 bg-slate-900 shadow-2xs hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer shrink-0"
                                >
                                  <img
                                    src={row.punchIn.photoUrl}
                                    alt="Morning Punch In"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </button>
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs font-mono">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>In: {row.punchIn.time}</span>
                                  </div>
                                  <span className="text-[10px] text-emerald-700 font-semibold block">
                                    Verified at Site ({row.punchIn.distance}m)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          {/* Evening Punch Out */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {row.punchOut ? (
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActivePhotoModal({
                                      url: row.punchOut!.photoUrl,
                                      title: `Evening Punch Out - ${row.date}`,
                                      type: 'PUNCH_OUT',
                                      time: row.punchOut!.time,
                                      date: row.date,
                                      employeeName: row.employeeName,
                                      distance: row.punchOut!.distance,
                                    })
                                  }
                                  className="group relative w-12 h-12 rounded-xl overflow-hidden border-2 border-rose-400 bg-slate-900 shadow-2xs hover:ring-2 hover:ring-rose-500 transition-all cursor-pointer shrink-0"
                                >
                                  <img
                                    src={row.punchOut.photoUrl}
                                    alt="Evening Punch Out"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                </button>
                                <div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs font-mono">
                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                    <span>Out: {row.punchOut.time}</span>
                                  </div>
                                  <span className="text-[10px] text-rose-700 font-semibold block">
                                    Verified at Site ({row.punchOut.distance}m)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Out Pending (On Site)
                              </span>
                            )}
                          </td>

                          {/* Shift Duration */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                            {row.status === 'COMPLETED' ? (
                              <span className="font-bold text-indigo-700 flex items-center gap-1">
                                <Timer className="w-3.5 h-3.5" />
                                {row.duration}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold">{row.duration}</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {row.status === 'COMPLETED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                On Site
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─── FULL HIGH-RESOLUTION PHOTO PREVIEW MODAL ─── */}
      {activePhotoModal && (
        <div
          onClick={() => setActivePhotoModal(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    activePhotoModal.type === 'PUNCH_IN' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{activePhotoModal.title}</h4>
                  <p className="text-[11px] text-slate-500">
                    {activePhotoModal.employeeName} &bull; {activePhotoModal.date} ({activePhotoModal.time})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex flex-col items-center">
              <div className="relative w-full max-h-[380px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={activePhotoModal.url}
                  alt={activePhotoModal.title}
                  className="w-full h-auto max-h-[380px] object-contain"
                />
              </div>

              <div className="w-full mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification Type:</span>
                  <span className="font-bold text-slate-900">
                    {activePhotoModal.type === 'PUNCH_IN' ? 'Morning Entry (Punch In)' : 'Evening Exit (Punch Out)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Staff Member:</span>
                  <span className="font-bold text-slate-900">{activePhotoModal.employeeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Site Coordinates:</span>
                  <span className="font-mono text-slate-700">28.465355, 77.185921</span>
                </div>
                {activePhotoModal.distance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Geofence Distance:</span>
                    <span className="font-bold text-emerald-700">
                      {activePhotoModal.distance}m &le; 50m (Verified at site)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActivePhotoModal(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
