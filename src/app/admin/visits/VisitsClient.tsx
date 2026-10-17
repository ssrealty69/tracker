'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  MapPin,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  RotateCcw,
  Check,
  User,
  Home,
  IndianRupee,
  Car,
  FileSpreadsheet,
  Filter,
  Users,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  getVisitsForDate,
  markVisitDone,
  rescheduleVisit,
  getAllExecutiveVisitsGrouped,
  type ExecutiveVisitsPortfolioResult,
  type ExecutiveVisitGroup,
  type AgentVisitLead,
} from '@/lib/leadActions';
import {
  maskPhone,
  formatDate,
  getISTDateString,
  REQUIREMENT_LABELS,
  BUDGET_LABELS,
  VISIT_STATUS_LABELS,
} from '@/lib/utils';

type Visit = Awaited<ReturnType<typeof getVisitsForDate>>[number];

const KNOWN_EXECUTIVES = ['Ayaan', 'Bhavishya', 'Gulshan', 'Nihal', 'Nikhil', 'Vikas'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLocalDateString(date: Date): string {
  return getISTDateString(date);
}

const formatDisplayDDMMYY = (isoDate: string) => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const monthIdx = parseInt(m, 10) - 1;
    const monthStr = MONTH_NAMES_SHORT[monthIdx] || m;
    return `${d}/${monthStr}/${y.slice(-2)}`;
  }
  return isoDate;
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return getISTDateString(dt);
}

function nextSundayStr(): string {
  const todayStr = getISTDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  return addDays(todayStr, daysUntilSunday);
}

function friendlyDateLabel(dateStr: string): string {
  const todayStr = getISTDateString();
  const tomorrowStr = addDays(todayStr, 1);
  if (dateStr === todayStr) return "Today's Scheduled Visits";
  if (dateStr === tomorrowStr) return "Tomorrow's Scheduled Visits";
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(dateObj);
  } catch {
    return dateStr;
  }
}

type ViewTab = 'daily' | 'all-scheduled' | 'all-done' | 'all-dropped';
type DateFilterOption = 'all' | 'today' | 'tomorrow' | 'this-week' | 'this-month' | 'custom';

function matchesDateFilter(
  dateInput: string | Date | null | undefined,
  filter: DateFilterOption,
  customDate: string
): boolean {
  if (filter === 'all') return true;
  if (!dateInput) return false;

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const leadDateIST = getISTDateString(d);

  const todayIST = getISTDateString();
  const tomorrowIST = addDays(todayIST, 1);

  if (filter === 'today') {
    return leadDateIST === todayIST;
  }
  if (filter === 'tomorrow') {
    return leadDateIST === tomorrowIST;
  }
  if (filter === 'custom') {
    return customDate ? leadDateIST === customDate : true;
  }
  if (filter === 'this-week') {
    const [y, m, dayNum] = todayIST.split('-').map(Number);
    const curr = new Date(Date.UTC(y, m - 1, dayNum));
    const day = curr.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(curr);
    monday.setUTCDate(curr.getUTCDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const [ly, lm, lday] = leadDateIST.split('-').map(Number);
    const leadDt = new Date(Date.UTC(ly, lm - 1, lday));
    return leadDt >= monday && leadDt <= sunday;
  }
  if (filter === 'this-month') {
    const [todayY, todayM] = todayIST.split('-');
    const [leadY, leadM] = leadDateIST.split('-');
    return todayY === leadY && todayM === leadM;
  }
  return true;
}

interface Props {
  initialVisits: Visit[];
  initialDate: string;
  initialPortfolio?: ExecutiveVisitsPortfolioResult;
}

export default function VisitsClient({ initialVisits, initialDate, initialPortfolio }: Props) {
  const todayStr = getLocalDateString(new Date());
  const [activeTab, setActiveTab] = useState<ViewTab>('daily');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [portfolio, setPortfolio] = useState<ExecutiveVisitsPortfolioResult | null>(initialPortfolio || null);
  const [loading, setLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('ALL');

  // Date filters for Scheduled and Done tabs
  const [scheduledDateFilter, setScheduledDateFilter] = useState<DateFilterOption>('all');
  const [scheduledCustomDate, setScheduledCustomDate] = useState<string>('');

  const [doneDateFilter, setDoneDateFilter] = useState<DateFilterOption>('all');
  const [doneCustomDate, setDoneCustomDate] = useState<string>('');

  const allExecutiveNames = useMemo(() => {
    const set = new Set<string>(KNOWN_EXECUTIVES);
    visits.forEach((v) => {
      if (v.assignedAgent?.name) set.add(v.assignedAgent.name);
    });
    if (portfolio?.executives) {
      portfolio.executives.forEach((e) => {
        if (e.agentName) set.add(e.agentName);
      });
    }
    return Array.from(set).sort();
  }, [visits, portfolio]);

  const filteredVisits = useMemo(() => {
    if (selectedExecutive === 'ALL') return visits;
    return visits.filter((v) => (v.assignedAgent?.name || 'Unassigned') === selectedExecutive);
  }, [visits, selectedExecutive]);

  // Grouped Scheduled Executives (Filtered by Date & Selected Executive)
  const activeScheduledExecutives = useMemo(() => {
    if (!portfolio?.executives) return [];
    let list = portfolio.executives
      .map((e) => {
        const filteredLeads = (e.scheduledVisits || []).filter((l) =>
          matchesDateFilter(l.visitDate, scheduledDateFilter, scheduledCustomDate)
        );
        return {
          ...e,
          scheduledVisits: filteredLeads,
          filteredCount: filteredLeads.length,
        };
      })
      .filter((e) => e.filteredCount > 0);

    if (selectedExecutive !== 'ALL') {
      list = list.filter((e) => e.agentName === selectedExecutive);
    }
    return list;
  }, [portfolio, scheduledDateFilter, scheduledCustomDate, selectedExecutive]);

  const totalFilteredScheduled = useMemo(() => {
    return activeScheduledExecutives.reduce((sum, e) => sum + e.filteredCount, 0);
  }, [activeScheduledExecutives]);

  // Grouped Done Executives (Filtered by Date & Selected Executive)
  const activeDoneExecutives = useMemo(() => {
    if (!portfolio?.executives) return [];
    let list = portfolio.executives
      .map((e) => {
        const filteredLeads = (e.doneVisits || []).filter((l) =>
          matchesDateFilter(l.visitDate || l.updatedAt, doneDateFilter, doneCustomDate)
        );
        return {
          ...e,
          doneVisits: filteredLeads,
          filteredCount: filteredLeads.length,
        };
      })
      .filter((e) => e.filteredCount > 0);

    if (selectedExecutive !== 'ALL') {
      list = list.filter((e) => e.agentName === selectedExecutive);
    }
    return list;
  }, [portfolio, doneDateFilter, doneCustomDate, selectedExecutive]);

  const totalFilteredDone = useMemo(() => {
    return activeDoneExecutives.reduce((sum, e) => sum + e.filteredCount, 0);
  }, [activeDoneExecutives]);

  // Grouped Dropped Executives
  const activeDroppedExecutives = useMemo(() => {
    if (!portfolio?.executives) return [];
    let list = portfolio.executives.filter((e) => e.totalDropped > 0);
    if (selectedExecutive !== 'ALL') {
      list = list.filter((e) => e.agentName === selectedExecutive);
    }
    return list;
  }, [portfolio, selectedExecutive]);

  const loadDate = async (dateStr: string, isSilent = false) => {
    setSelectedDate(dateStr);
    if (!isSilent) setLoading(true);
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const data = await getVisitsForDate(d);
      setVisits(data);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const loadPortfolio = async (isSilent = false) => {
    if (!isSilent) setPortfolioLoading(true);
    try {
      const data = await getAllExecutiveVisitsGrouped();
      setPortfolio(data);
    } catch (err) {
      console.error('Failed to load executive portfolio:', err);
    } finally {
      if (!isSilent) setPortfolioLoading(false);
    }
  };

  // Live Auto-Sync every 8 seconds & on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !rescheduleId) {
        if (activeTab === 'daily') {
          loadDate(selectedDate, true);
        } else {
          loadPortfolio(true);
        }
      }
    }, 8000);

    const handleFocus = () => {
      if (!rescheduleId) {
        if (activeTab === 'daily') {
          loadDate(selectedDate, true);
        } else {
          loadPortfolio(true);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [selectedDate, rescheduleId, activeTab]);

  useEffect(() => {
    if (activeTab !== 'daily' && !portfolio) {
      loadPortfolio();
    }
  }, [activeTab, portfolio]);

  const handleMarkDone = async (visitId: string) => {
    const result = await markVisitDone(visitId);
    if (result.success) {
      toast.success('Visit marked as completed!');
      loadDate(selectedDate, true);
      loadPortfolio(true);
    } else {
      toast.error(result.message);
    }
  };

  const handleReschedule = async (visitId: string) => {
    if (!newDate) {
      toast.error('Please pick a new visit date');
      return;
    }
    const result = await rescheduleVisit(visitId, newDate);
    if (result.success) {
      toast.success(`Visit rescheduled to ${formatDisplayDDMMYY(newDate)}!`);
      setRescheduleId(null);
      setNewDate('');
      loadDate(selectedDate, true);
      loadPortfolio(true);
    } else {
      toast.error(result.message);
    }
  };

  // Mask Phone helper: first 5 digits visible, ending 5 digits masked as XXXXX
  const renderMaskedPhone = (phone: string | null | undefined) => {
    if (!phone) return <span className="text-[11px] text-slate-400 font-mono">—</span>;
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length >= 10) {
      const first5 = cleanDigits.slice(0, 5);
      return (
        <div className="text-[11px] font-mono inline-flex items-center tracking-tight">
          <span className="font-bold text-slate-800">{first5}</span>
          <span className="text-slate-400 font-semibold tracking-wider">XXXXX</span>
        </div>
      );
    }
    const firstHalf = phone.slice(0, Math.max(0, phone.length - 5));
    return (
      <div className="text-[11px] font-mono inline-flex items-center tracking-tight">
        <span className="font-bold text-slate-800">{firstHalf}</span>
        <span className="text-slate-400 font-semibold tracking-wider">XXXXX</span>
      </div>
    );
  };

  // Excel Export Handler
  const exportToExcel = () => {
    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'S.No',
      'Status',
      'Executive',
      'Customer Name',
      'Mobile Number (Masked)',
      'Scheduled Visit Date',
      'Project',
      'Configuration',
      'Budget',
      'Agent Notes / Remark',
    ];

    let rows: string[] = [];
    let fileNameSuffix = '';

    if (activeTab === 'daily') {
      if (filteredVisits.length === 0) {
        toast.error('No visits to export for this selection');
        return;
      }
      fileNameSuffix = `Daily_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${selectedDate}`;
      rows = filteredVisits.map((v, idx) => {
        const statusText =
          v.visitStatus === 'VISIT_DONE'
            ? 'Completed'
            : v.visitStatus === 'RESCHEDULED'
            ? 'Rescheduled'
            : 'Scheduled';
        const execName = v.assignedAgent?.name || 'Unassigned';
        return [
          String(idx + 1),
          escapeCsv(statusText),
          escapeCsv(execName),
          escapeCsv(v.name),
          escapeCsv(v.phone ? maskPhone(v.phone) : ''),
          escapeCsv(formatDate(v.visitDate)),
          escapeCsv(((v as any).projectName as string) || ''),
          escapeCsv(v.requirement ? (REQUIREMENT_LABELS[v.requirement] || String(v.requirement)) : ''),
          escapeCsv(v.budget ? (BUDGET_LABELS[v.budget] || String(v.budget)) : ''),
          escapeCsv(v.latestRemark || ''),
        ].join(',');
      });
    } else if (activeTab === 'all-scheduled') {
      const list = activeScheduledExecutives.flatMap((e) => e.scheduledVisits);
      if (list.length === 0) {
        toast.error('No scheduled visits to export');
        return;
      }
      fileNameSuffix = `All_Scheduled_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      rows = list.map((l, idx) => [
        String(idx + 1),
        escapeCsv(l.visitStatus || 'Scheduled'),
        escapeCsv(l.agentName),
        escapeCsv(l.name),
        escapeCsv(l.phone ? maskPhone(l.phone) : ''),
        escapeCsv(formatDate(l.visitDate)),
        escapeCsv(l.projectName || ''),
        escapeCsv(l.requirement || ''),
        escapeCsv(l.budget || ''),
        escapeCsv(l.latestRemark || ''),
      ].join(','));
    } else if (activeTab === 'all-done') {
      const list = activeDoneExecutives.flatMap((e) => e.doneVisits);
      if (list.length === 0) {
        toast.error('No completed visits to export');
        return;
      }
      fileNameSuffix = `All_Done_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      rows = list.map((l, idx) => [
        String(idx + 1),
        escapeCsv('Completed'),
        escapeCsv(l.agentName),
        escapeCsv(l.name),
        escapeCsv(l.phone ? maskPhone(l.phone) : ''),
        escapeCsv(formatDate(l.visitDate || l.updatedAt)),
        escapeCsv(l.projectName || ''),
        escapeCsv(l.requirement || ''),
        escapeCsv(l.budget || ''),
        escapeCsv(l.latestRemark || ''),
      ].join(','));
    } else {
      const list = activeDroppedExecutives.flatMap((e) => e.droppedVisits);
      if (list.length === 0) {
        toast.error('No dropped visits to export');
        return;
      }
      fileNameSuffix = `All_Dropped_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      rows = list.map((l, idx) => [
        String(idx + 1),
        escapeCsv('Dropped'),
        escapeCsv(l.agentName),
        escapeCsv(l.name),
        escapeCsv(l.phone ? maskPhone(l.phone) : ''),
        escapeCsv(formatDate(l.visitDate)),
        escapeCsv(l.projectName || ''),
        escapeCsv(l.requirement || ''),
        escapeCsv(l.budget || ''),
        escapeCsv(l.latestRemark || ''),
      ].join(','));
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Site_Visits_${fileNameSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Excel report downloaded successfully!');
  };

  const done = filteredVisits.filter((v) => v.visitStatus === 'VISIT_DONE').length;
  const pending = filteredVisits.filter((v) => v.visitStatus !== 'VISIT_DONE').length;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'VISIT_DONE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Completed
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Rescheduled
          </span>
        );
      case 'DROPPED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            Dropped
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Scheduled
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
              <MapPin size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                Site Visit Operations Center
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Coordinate, track and confirm client on-ground site visits
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Pulse Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Auto-Sync Live
          </div>
        </div>
      </div>

      {/* ── SEGMENTED VIEW TABS (4 TABS) ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200 shadow-2xs">
          {/* Tab 1: Daily */}
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Calendar size={14} className={activeTab === 'daily' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Daily Schedule (Date-wise)</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
                activeTab === 'daily'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-white/80 text-slate-600 border border-slate-200'
              }`}
            >
              {filteredVisits.length}
            </span>
          </button>

          {/* Tab 2: All Scheduled */}
          <button
            type="button"
            onClick={() => setActiveTab('all-scheduled')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'all-scheduled'
                ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users size={14} className={activeTab === 'all-scheduled' ? 'text-emerald-600' : 'text-slate-400'} />
            <span>All Scheduled (By Executive)</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
                activeTab === 'all-scheduled'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-white/80 text-slate-600 border border-slate-200'
              }`}
            >
              {portfolio?.totalScheduledAll ?? 0}
            </span>
          </button>

          {/* Tab 3: Visit Done */}
          <button
            type="button"
            onClick={() => setActiveTab('all-done')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'all-done'
                ? 'bg-white text-blue-800 shadow-xs border border-blue-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <CheckCircle2 size={14} className={activeTab === 'all-done' ? 'text-blue-600' : 'text-slate-400'} />
            <span>Visit Done (By Executive)</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
                activeTab === 'all-done'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-white/80 text-slate-600 border border-slate-200'
              }`}
            >
              {portfolio?.totalDoneAll ?? 0}
            </span>
          </button>

          {/* Tab 4: All Dropped */}
          <button
            type="button"
            onClick={() => setActiveTab('all-dropped')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'all-dropped'
                ? 'bg-white text-rose-800 shadow-xs border border-rose-200/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <AlertTriangle size={14} className={activeTab === 'all-dropped' ? 'text-rose-600' : 'text-slate-400'} />
            <span>All Dropped (By Executive)</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold ${
                activeTab === 'all-dropped'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-white/80 text-slate-600 border border-slate-200'
              }`}
            >
              {portfolio?.totalDroppedAll ?? 0}
            </span>
          </button>
        </div>

        {/* Global Controls: Executive Filter + Excel Report Download */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Filter size={13} className="text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
              Executive:
            </span>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 border-0 focus:ring-0 cursor-pointer pr-4"
            >
              <option value="ALL">All Executives</option>
              {allExecutiveNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0"
            title="Download Excel report for active view"
          >
            <FileSpreadsheet size={15} className="text-white shrink-0" />
            <span>
              {activeTab === 'daily'
                ? 'Download Daily Report'
                : activeTab === 'all-scheduled'
                ? 'Export Scheduled'
                : activeTab === 'all-done'
                ? 'Export Completed'
                : 'Export Dropped'}
            </span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: DAILY VISITS VIEW                                              */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Date Navigation & Controls Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => loadDate(todayStr)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === todayStr
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => loadDate(addDays(todayStr, 1))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === addDays(todayStr, 1)
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => loadDate(nextSundayStr())}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedDate === nextSundayStr()
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Next Sunday
                </button>
              </div>

              {/* Date picker with arrows */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5">
                <button
                  onClick={() => loadDate(addDays(selectedDate, -1))}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer">
                    <Calendar size={13} className="text-indigo-600 shrink-0" />
                    <span>{formatDisplayDDMMYY(selectedDate)}</span>
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => loadDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Select Date (dd/mmm/yy)"
                  />
                </div>
                <button
                  onClick={() => loadDate(addDays(selectedDate, 1))}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  onClick={() => loadDate(selectedDate)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer ml-0.5"
                  title="Refresh"
                >
                  <RefreshCcw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredVisits.length} visits for{' '}
              <strong className="text-slate-800 font-bold">{formatDisplayDDMMYY(selectedDate)}</strong>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900" suppressHydrationWarning>
                  {friendlyDateLabel(selectedDate)}
                </h2>
                {selectedExecutive !== 'ALL' && (
                  <span className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                    Filtered: {selectedExecutive}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5" suppressHydrationWarning>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long',
                })}{' '}
                • {formatDisplayDDMMYY(selectedDate)}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-slate-900">{filteredVisits.length}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scheduled</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{done}</p>
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Visited</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-amber-600">{pending}</p>
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </div>

          {/* Visits Table */}
          {loading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-indigo-600" />
              Loading visits...
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <Calendar size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-800">
                {selectedExecutive !== 'ALL'
                  ? `No visits found for ${selectedExecutive} on this date`
                  : 'No visits scheduled for this date'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedExecutive !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedExecutive('ALL')}
                    className="text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    Clear filter &amp; view all executives
                  </button>
                ) : (
                  'Select another date or add visits from the calling form'
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table suppressHydrationWarning className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-[10.5px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <th className="py-3 px-3 text-center w-12 font-mono">S.No</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Executive</th>
                    <th className="py-3 px-3.5">Customer &amp; Mobile</th>
                    <th className="py-3 px-3.5">Scheduled Visit Date</th>
                    <th className="py-3 px-3.5">Project &amp; Config</th>
                    <th className="py-3 px-3.5">Budget</th>
                    <th className="py-3 px-3.5">Agent Notes / Remark</th>
                    <th className="py-3 px-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVisits.map((visit, idx) => {
                    const isDone = visit.visitStatus === 'VISIT_DONE';
                    const isRescheduled = visit.visitStatus === 'RESCHEDULED';
                    return (
                      <tr
                        key={visit.id}
                        className={`transition-colors ${
                          isDone
                            ? 'bg-blue-50/20 border-l-4 border-l-blue-400 hover:bg-blue-50/40'
                            : isRescheduled
                            ? 'bg-amber-50/20 border-l-4 border-l-amber-400 hover:bg-amber-50/40'
                            : 'bg-white border-l-4 border-l-emerald-500 hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">{statusBadge(visit.visitStatus)}</td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold text-[10px] inline-flex items-center justify-center shadow-2xs">
                              {(visit.assignedAgent?.name || 'U')[0]}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">
                              {visit.assignedAgent?.name || 'Unassigned'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{visit.name}</div>
                          {renderMaskedPhone(visit.phone)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 text-xs">
                          {formatDate(visit.visitDate)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-900">
                            {((visit as any).projectName as string) || '—'}
                          </span>
                          {visit.requirement && (
                            <span className="text-[11px] text-slate-500 block">
                              {REQUIREMENT_LABELS[visit.requirement] || visit.requirement}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                          {visit.budget ? BUDGET_LABELS[visit.budget] || String(visit.budget) : '—'}
                        </td>
                        <td className="py-3 px-3.5 max-w-[220px]">
                          <p
                            className="text-[11px] text-slate-600 leading-tight"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                            title={visit.latestRemark || ''}
                          >
                            {visit.latestRemark || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-center">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-bold">
                              <CheckCircle2 size={13} className="text-emerald-600" /> Completed
                            </span>
                          ) : rescheduleId === visit.id ? (
                            <div className="flex items-center justify-center gap-1.5 animate-fade-in-up">
                              <div className="relative inline-flex items-center">
                                <div className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs">
                                  <Calendar size={12} className="text-amber-600 shrink-0" />
                                  <span className={newDate ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'}>
                                    {newDate ? formatDisplayDDMMYY(newDate) : 'dd/mmm/yy'}
                                  </span>
                                </div>
                                <input
                                  type="date"
                                  value={newDate}
                                  min={todayStr}
                                  onChange={(e) => setNewDate(e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  title="Select Reschedule Date (dd/mmm/yy)"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleReschedule(visit.id)}
                                disabled={!newDate}
                                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleId(null);
                                  setNewDate('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleMarkDone(visit.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Mark visit completed"
                              >
                                <Check size={12} className="text-emerald-700" /> Done
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleId(visit.id);
                                  setNewDate('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                title="Reschedule visit"
                              >
                                <RotateCcw size={12} className="text-amber-700" /> Reschedule
                              </button>
                            </div>
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
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ALL SCHEDULED VISITS (GROUPED BY AGENT + DATE FILTER)          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-scheduled' && (
        <div className="space-y-5">
          {/* Summary Banner with Quick Date Filters */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                    <Users size={16} />
                  </span>
                  <h2 className="text-base font-black text-emerald-950">
                    All Scheduled Visits Portfolio (Grouped By Executive)
                  </h2>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  Active &amp; upcoming client visits grouped agent-wise. Filter by Tomorrow, Week, or Month below.
                </p>
              </div>

              <div className="flex items-center gap-6 bg-white/90 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                <div className="text-center">
                  <p className="text-2xl font-black text-emerald-700">
                    {totalFilteredScheduled}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    {scheduledDateFilter === 'all'
                      ? 'Total Scheduled'
                      : scheduledDateFilter === 'tomorrow'
                      ? 'Tomorrow Visits'
                      : scheduledDateFilter === 'today'
                      ? 'Today Visits'
                      : 'Filtered Visits'}
                  </p>
                </div>
                <div className="w-px h-8 bg-emerald-200" />
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-800">
                    {activeScheduledExecutives.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Active Executives
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Date Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/80">
              <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider">
                Scheduled Date:
              </span>

              <button
                type="button"
                onClick={() => {
                  setScheduledDateFilter('all');
                  setScheduledCustomDate('');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  scheduledDateFilter === 'all'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200'
                }`}
              >
                All Upcoming
              </button>

              <button
                type="button"
                onClick={() => setScheduledDateFilter('today')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  scheduledDateFilter === 'today'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200'
                }`}
              >
                Today
              </button>

              {/* ⭐ TOMORROW BUTTON - KEY FEATURE */}
              <button
                type="button"
                onClick={() => setScheduledDateFilter('tomorrow')}
                className={`flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  scheduledDateFilter === 'tomorrow'
                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/40'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                }`}
              >
                <span>⭐ Tomorrow ({formatDisplayDDMMYY(addDays(todayStr, 1))})</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduledDateFilter('this-week')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  scheduledDateFilter === 'this-week'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200'
                }`}
              >
                This Week
              </button>

              <button
                type="button"
                onClick={() => setScheduledDateFilter('this-month')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  scheduledDateFilter === 'this-month'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-emerald-900 hover:bg-emerald-100/70 border border-emerald-200'
                }`}
              >
                This Month
              </button>

              {/* Calendar Date Picker Overlay */}
              <div className="relative inline-flex items-center ml-1">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer shadow-2xs ${
                    scheduledDateFilter === 'custom' && scheduledCustomDate
                      ? 'bg-emerald-800 text-white border-emerald-900 ring-2 ring-emerald-500/40'
                      : 'bg-white border-emerald-200 text-emerald-900 hover:bg-emerald-100/60'
                  }`}
                >
                  <Calendar size={13} className={scheduledDateFilter === 'custom' ? 'text-white' : 'text-emerald-700'} />
                  <span>
                    {scheduledDateFilter === 'custom' && scheduledCustomDate
                      ? formatDisplayDDMMYY(scheduledCustomDate)
                      : 'Pick Calendar Date'}
                  </span>
                </div>
                <input
                  type="date"
                  value={scheduledCustomDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setScheduledCustomDate(e.target.value);
                      setScheduledDateFilter('custom');
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Filter by Calendar Date (dd/mmm/yy)"
                />
              </div>

              {scheduledDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('all');
                    setScheduledCustomDate('');
                  }}
                  className="ml-auto px-2.5 py-0.5 text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-100/70 rounded-lg transition-colors cursor-pointer"
                >
                  ✕ Reset Filter
                </button>
              )}
            </div>
          </div>

          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-emerald-600" />
              Loading executive scheduled visits...
            </div>
          ) : activeScheduledExecutives.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <Calendar size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-800">
                {scheduledDateFilter === 'tomorrow'
                  ? 'No visits scheduled for tomorrow across executives'
                  : scheduledDateFilter === 'today'
                  ? 'No visits scheduled for today across executives'
                  : 'No scheduled visits match the selected filter'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {scheduledDateFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledDateFilter('all');
                      setScheduledCustomDate('');
                    }}
                    className="text-emerald-700 font-bold hover:underline cursor-pointer"
                  >
                    View all upcoming scheduled visits
                  </button>
                ) : (
                  'Visits scheduled from calling forms will appear here grouped under their executive name.'
                )}
              </p>
            </div>
          ) : (
            /* RENDER AGENT BY AGENT SEPARATELY - NO MIXING */
            <div className="space-y-6">
              {activeScheduledExecutives.map((exec) => (
                <div
                  key={exec.agentId}
                  className="bg-white rounded-2xl border border-emerald-200 shadow-xs overflow-hidden"
                >
                  {/* Executive Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                        {exec.agentName[0]}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm tracking-tight text-white">
                            {exec.agentName}
                          </span>
                          <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                            Executive
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {exec.scheduledVisits.length} Scheduled Visits{' '}
                          {scheduledDateFilter !== 'all' ? `(${scheduledDateFilter})` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-emerald-300 border border-emerald-400/20">
                        {exec.scheduledVisits.length} Scheduled
                      </span>
                      {exec.totalDone > 0 && (
                        <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-blue-300 border border-blue-400/20">
                          {exec.totalDone} Done
                        </span>
                      )}
                      {exec.totalDropped > 0 && (
                        <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-rose-300 border border-rose-400/20">
                          {exec.totalDropped} Dropped
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Executive Leads Table */}
                  <div className="overflow-x-auto">
                    <table suppressHydrationWarning className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10.5px] uppercase font-bold text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 text-center w-12 font-mono">S.No</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5">Customer &amp; Mobile</th>
                          <th className="py-2.5 px-3.5">Scheduled Visit Date</th>
                          <th className="py-2.5 px-3.5">Project &amp; Config</th>
                          <th className="py-2.5 px-3.5">Budget</th>
                          <th className="py-2.5 px-3.5">Agent Notes / Remark</th>
                          <th className="py-2.5 px-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exec.scheduledVisits.map((lead, idx) => (
                          <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {statusBadge(lead.visitStatus || 'SCHEDULED')}
                            </td>
                            {/* Customer & Masked Mobile (5 digits + XXXXX) */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{lead.name}</div>
                              {renderMaskedPhone(lead.phone)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-mono text-emerald-800 font-bold text-xs">
                              {formatDate(lead.visitDate)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900">
                                {lead.projectName || '—'}
                              </span>
                              {lead.requirement && (
                                <span className="text-[11px] text-slate-500 block">
                                  {lead.requirement}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                              {lead.budget || '—'}
                            </td>
                            <td className="py-3 px-3.5 max-w-[260px]">
                              <p
                                className="text-[11px] text-slate-600 leading-tight"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                                title={lead.latestRemark || ''}
                              >
                                {lead.latestRemark || '—'}
                              </p>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-center">
                              {rescheduleId === lead.id ? (
                                <div className="flex items-center justify-center gap-1.5 animate-fade-in-up">
                                  <div className="relative inline-flex items-center">
                                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs">
                                      <Calendar size={12} className="text-amber-600 shrink-0" />
                                      <span className={newDate ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'}>
                                        {newDate ? formatDisplayDDMMYY(newDate) : 'dd/mmm/yy'}
                                      </span>
                                    </div>
                                    <input
                                      type="date"
                                      value={newDate}
                                      min={todayStr}
                                      onChange={(e) => setNewDate(e.target.value)}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      title="Select Reschedule Date (dd/mmm/yy)"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleReschedule(lead.id)}
                                    disabled={!newDate}
                                    className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRescheduleId(null);
                                      setNewDate('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkDone(lead.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Mark visit completed"
                                  >
                                    <Check size={12} className="text-emerald-700" /> Done
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRescheduleId(lead.id);
                                      setNewDate('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Reschedule visit"
                                  >
                                    <RotateCcw size={12} className="text-amber-700" /> Reschedule
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: VISIT DONE (COMPLETED VISITS GROUPED BY AGENT + DATE FILTER)   */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-done' && (
        <div className="space-y-5">
          {/* Summary Banner with Date Filters */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs">
                    <CheckCircle2 size={16} />
                  </span>
                  <h2 className="text-base font-black text-blue-950">
                    All Completed Site Visits (Grouped By Executive)
                  </h2>
                </div>
                <p className="text-xs text-blue-800 mt-1">
                  Verified client visits completed on-ground. Grouped agent-wise without mixing names.
                </p>
              </div>

              <div className="flex items-center gap-6 bg-white/90 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-blue-200 shadow-2xs">
                <div className="text-center">
                  <p className="text-2xl font-black text-blue-700">
                    {totalFilteredDone}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                    {doneDateFilter === 'all'
                      ? 'Total Completed'
                      : doneDateFilter === 'today'
                      ? 'Completed Today'
                      : 'Filtered Done'}
                  </p>
                </div>
                <div className="w-px h-8 bg-blue-200" />
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-800">
                    {activeDoneExecutives.length}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Executives with Visits
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Date Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200/80">
              <span className="text-[11px] font-extrabold text-blue-900 uppercase tracking-wider">
                Completion Date:
              </span>

              <button
                type="button"
                onClick={() => {
                  setDoneDateFilter('all');
                  setDoneCustomDate('');
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  doneDateFilter === 'all'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-blue-900 hover:bg-blue-100/70 border border-blue-200'
                }`}
              >
                All Completed
              </button>

              <button
                type="button"
                onClick={() => setDoneDateFilter('today')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  doneDateFilter === 'today'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-blue-900 hover:bg-blue-100/70 border border-blue-200'
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => setDoneDateFilter('this-week')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  doneDateFilter === 'this-week'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-blue-900 hover:bg-blue-100/70 border border-blue-200'
                }`}
              >
                This Week
              </button>

              <button
                type="button"
                onClick={() => setDoneDateFilter('this-month')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  doneDateFilter === 'this-month'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-white text-blue-900 hover:bg-blue-100/70 border border-blue-200'
                }`}
              >
                This Month
              </button>

              {/* Calendar Date Picker Overlay */}
              <div className="relative inline-flex items-center ml-1">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer shadow-2xs ${
                    doneDateFilter === 'custom' && doneCustomDate
                      ? 'bg-blue-800 text-white border-blue-900 ring-2 ring-blue-500/40'
                      : 'bg-white border-blue-200 text-blue-900 hover:bg-blue-100/60'
                  }`}
                >
                  <Calendar size={13} className={doneDateFilter === 'custom' ? 'text-white' : 'text-blue-700'} />
                  <span>
                    {doneDateFilter === 'custom' && doneCustomDate
                      ? formatDisplayDDMMYY(doneCustomDate)
                      : 'Pick Calendar Date'}
                  </span>
                </div>
                <input
                  type="date"
                  value={doneCustomDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDoneCustomDate(e.target.value);
                      setDoneDateFilter('custom');
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Filter by Calendar Date (dd/mmm/yy)"
                />
              </div>

              {doneDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('all');
                    setDoneCustomDate('');
                  }}
                  className="ml-auto px-2.5 py-0.5 text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-100/70 rounded-lg transition-colors cursor-pointer"
                >
                  ✕ Reset Filter
                </button>
              )}
            </div>
          </div>

          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-blue-600" />
              Loading completed visits...
            </div>
          ) : activeDoneExecutives.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-800">
                {doneDateFilter !== 'all'
                  ? 'No completed visits match the selected date filter'
                  : 'No completed visits recorded yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                When site visits are confirmed by clicking &quot;Done&quot;, they will appear here grouped under each executive.
              </p>
            </div>
          ) : (
            /* RENDER AGENT BY AGENT SEPARATELY - NO MIXING */
            <div className="space-y-6">
              {activeDoneExecutives.map((exec) => (
                <div
                  key={exec.agentId}
                  className="bg-white rounded-2xl border border-blue-200 shadow-xs overflow-hidden"
                >
                  {/* Executive Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-slate-950 font-black text-sm flex items-center justify-center shadow-xs">
                        {exec.agentName[0]}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm tracking-tight text-white">
                            {exec.agentName}
                          </span>
                          <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                            Executive
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {exec.doneVisits.length} Completed Visits
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-blue-300 border border-blue-400/20">
                        {exec.doneVisits.length} Completed
                      </span>
                      <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-emerald-300 border border-emerald-400/20">
                        {exec.totalScheduled} Scheduled
                      </span>
                    </div>
                  </div>

                  {/* Executive Leads Table */}
                  <div className="overflow-x-auto">
                    <table suppressHydrationWarning className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10.5px] uppercase font-bold text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 text-center w-12 font-mono">S.No</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5">Customer &amp; Mobile</th>
                          <th className="py-2.5 px-3.5">Visit Date</th>
                          <th className="py-2.5 px-3.5">Project &amp; Config</th>
                          <th className="py-2.5 px-3.5">Budget</th>
                          <th className="py-2.5 px-3.5">Agent Notes / Remark</th>
                          <th className="py-2.5 px-3.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exec.doneVisits.map((lead, idx) => (
                          <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <Check size={11} className="text-emerald-700" /> Completed
                              </span>
                            </td>
                            {/* Customer & Masked Mobile (5 digits + XXXXX) */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{lead.name}</div>
                              {renderMaskedPhone(lead.phone)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 font-bold text-xs">
                              {formatDate(lead.visitDate || lead.updatedAt)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900">
                                {lead.projectName || '—'}
                              </span>
                              {lead.requirement && (
                                <span className="text-[11px] text-slate-500 block">
                                  {lead.requirement}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                              {lead.budget || '—'}
                            </td>
                            <td className="py-3 px-3.5 max-w-[260px]">
                              <p
                                className="text-[11px] text-slate-600 leading-tight"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                                title={lead.latestRemark || ''}
                              >
                                {lead.latestRemark || '—'}
                              </p>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-bold">
                                <CheckCircle2 size={13} /> Visit Done
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: ALL DROPPED VISITS (GROUPED BY AGENT)                          */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-dropped' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border border-rose-200 p-5 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-600 text-white rounded-lg shadow-2xs">
                  <AlertTriangle size={16} />
                </span>
                <h2 className="text-base font-black text-rose-950">
                  All Dropped Visits Analysis (Grouped By Executive)
                </h2>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                Clients whose scheduled visit date has passed without confirmation. Grouped agent-wise for fast re-dialing &amp; rescheduling.
              </p>
            </div>

            <div className="flex items-center gap-6 bg-white/80 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-rose-200/80 shadow-2xs">
              <div className="text-center">
                <p className="text-2xl font-black text-rose-700">
                  {portfolio?.totalDroppedAll ?? 0}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                  Total Dropped
                </p>
              </div>
              <div className="w-px h-8 bg-rose-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-800">
                  {activeDroppedExecutives.length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Executives Affected
                </p>
              </div>
            </div>
          </div>

          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-rose-600" />
              Loading dropped visits...
            </div>
          ) : activeDroppedExecutives.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-bold text-slate-800">
                {selectedExecutive !== 'ALL'
                  ? `Zero dropped visits for ${selectedExecutive}!`
                  : 'Zero dropped visits across all executives!'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All scheduled visits are on track or have been marked completed.
              </p>
            </div>
          ) : (
            /* RENDER AGENT BY AGENT SEPARATELY - NO MIXING */
            <div className="space-y-6">
              {activeDroppedExecutives.map((exec) => (
                <div
                  key={exec.agentId}
                  className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden"
                >
                  {/* Executive Header Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 px-4 py-3 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                        {exec.agentName[0]}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm tracking-tight text-white">
                            {exec.agentName}
                          </span>
                          <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
                            Executive
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {exec.totalDropped} Dropped / Missed Visits
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-rose-300 border border-rose-400/20">
                        {exec.totalDropped} Dropped
                      </span>
                      <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg text-emerald-300 border border-emerald-400/20">
                        {exec.totalScheduled} Scheduled
                      </span>
                    </div>
                  </div>

                  {/* Executive Leads Table */}
                  <div className="overflow-x-auto">
                    <table suppressHydrationWarning className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-rose-50/50 text-[10.5px] uppercase font-bold text-rose-900 border-b border-rose-100">
                          <th className="py-2.5 px-3 text-center w-12 font-mono">S.No</th>
                          <th className="py-2.5 px-3.5">Status</th>
                          <th className="py-2.5 px-3.5">Customer &amp; Mobile</th>
                          <th className="py-2.5 px-3.5">Past Scheduled Date</th>
                          <th className="py-2.5 px-3.5">Project &amp; Config</th>
                          <th className="py-2.5 px-3.5">Budget</th>
                          <th className="py-2.5 px-3.5">Agent Notes / Remark</th>
                          <th className="py-2.5 px-3.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {exec.droppedVisits.map((lead, idx) => (
                          <tr key={lead.id} className="hover:bg-rose-50/30 transition-colors">
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Dropped
                              </span>
                            </td>
                            {/* Customer & Masked Mobile (5 digits + XXXXX) */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{lead.name}</div>
                              {renderMaskedPhone(lead.phone)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-mono text-rose-700 font-bold text-xs">
                              {formatDate(lead.visitDate)}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900">
                                {lead.projectName || '—'}
                              </span>
                              {lead.requirement && (
                                <span className="text-[11px] text-slate-500 block">
                                  {lead.requirement}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                              {lead.budget || '—'}
                            </td>
                            <td className="py-3 px-3.5 max-w-[260px]">
                              <p
                                className="text-[11px] text-slate-600 leading-tight"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                                title={lead.latestRemark || ''}
                              >
                                {lead.latestRemark || '—'}
                              </p>
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap text-center">
                              {rescheduleId === lead.id ? (
                                <div className="flex items-center justify-center gap-1.5 animate-fade-in-up">
                                  <div className="relative inline-flex items-center">
                                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs">
                                      <Calendar size={12} className="text-amber-600 shrink-0" />
                                      <span className={newDate ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'}>
                                        {newDate ? formatDisplayDDMMYY(newDate) : 'dd/mmm/yy'}
                                      </span>
                                    </div>
                                    <input
                                      type="date"
                                      value={newDate}
                                      min={todayStr}
                                      onChange={(e) => setNewDate(e.target.value)}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                      title="Select Reschedule Date (dd/mmm/yy)"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleReschedule(lead.id)}
                                    disabled={!newDate}
                                    className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                  >
                                    Save &amp; Revive
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRescheduleId(null);
                                      setNewDate('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRescheduleId(lead.id);
                                      setNewDate('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Reschedule and revive visit to scheduled"
                                  >
                                    <RotateCcw size={12} /> Reschedule Date
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkDone(lead.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                    title="Mark completed if visit was done"
                                  >
                                    <Check size={12} /> Done
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
