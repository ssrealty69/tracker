'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
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
type DateFilterOption = 'all' | 'today' | 'tomorrow' | 'yesterday' | 'next-sunday' | 'this-week' | 'this-month' | 'custom';

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
  const yesterdayIST = addDays(todayIST, -1);
  const nextSundayIST = nextSundayStr();

  if (filter === 'today') {
    return leadDateIST === todayIST;
  }
  if (filter === 'tomorrow') {
    return leadDateIST === tomorrowIST;
  }
  if (filter === 'yesterday') {
    return leadDateIST === yesterdayIST;
  }
  if (filter === 'next-sunday') {
    return leadDateIST === nextSundayIST;
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

  // Date filters for Scheduled, Done, and Dropped tabs
  const [scheduledDateFilter, setScheduledDateFilter] = useState<DateFilterOption>('all');
  const [scheduledCustomDate, setScheduledCustomDate] = useState<string>('');

  const [doneDateFilter, setDoneDateFilter] = useState<DateFilterOption>('all');
  const [doneCustomDate, setDoneCustomDate] = useState<string>('');

  const [droppedDateFilter, setDroppedDateFilter] = useState<DateFilterOption>('all');
  const [droppedCustomDate, setDroppedCustomDate] = useState<string>('');

  const stepScheduledDate = (days: number) => {
    const base = scheduledCustomDate || todayStr;
    const next = addDays(base, days);
    setScheduledCustomDate(next);
    setScheduledDateFilter('custom');
  };

  const stepDoneDate = (days: number) => {
    const base = doneCustomDate || todayStr;
    const next = addDays(base, days);
    setDoneCustomDate(next);
    setDoneDateFilter('custom');
  };

  const stepDroppedDate = (days: number) => {
    const base = droppedCustomDate || todayStr;
    const next = addDays(base, days);
    setDroppedCustomDate(next);
    setDroppedDateFilter('custom');
  };

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
    let list = visits;
    if (selectedExecutive !== 'ALL') {
      list = visits.filter((v) => (v.assignedAgent?.name || 'Unassigned') === selectedExecutive);
    }
    // Sort strictly by executive name first, so each executive's visits appear together!
    return [...list].sort((a, b) => {
      const nameA = a.assignedAgent?.name || 'Unassigned';
      const nameB = b.assignedAgent?.name || 'Unassigned';
      const agentComp = nameA.localeCompare(nameB);
      if (agentComp !== 0) return agentComp;
      const dateA = a.visitDate ? new Date(a.visitDate).getTime() : 0;
      const dateB = b.visitDate ? new Date(b.visitDate).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return (a.name || '').localeCompare(b.name || '');
    });
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

  // Grouped Dropped Executives (Filtered by Date & Selected Executive)
  const activeDroppedExecutives = useMemo(() => {
    if (!portfolio?.executives) return [];
    let list = portfolio.executives
      .map((e) => {
        const filteredLeads = (e.droppedVisits || []).filter((l) =>
          matchesDateFilter(l.visitDate, droppedDateFilter, droppedCustomDate)
        );
        return {
          ...e,
          droppedVisits: filteredLeads,
          filteredCount: filteredLeads.length,
        };
      })
      .filter((e) => e.filteredCount > 0);

    if (selectedExecutive !== 'ALL') {
      list = list.filter((e) => e.agentName === selectedExecutive);
    }
    return list;
  }, [portfolio, droppedDateFilter, droppedCustomDate, selectedExecutive]);

  const filteredScheduledLeads = useMemo(() => {
    const list = activeScheduledExecutives.flatMap((e) => e.scheduledVisits || []);
    return list.sort((a, b) => {
      const comp = (a.agentName || 'Unassigned').localeCompare(b.agentName || 'Unassigned');
      if (comp !== 0) return comp;
      const da = a.visitDate ? new Date(a.visitDate).getTime() : 0;
      const db = b.visitDate ? new Date(b.visitDate).getTime() : 0;
      if (da !== db) return da - db;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeScheduledExecutives]);

  const filteredDoneLeads = useMemo(() => {
    const list = activeDoneExecutives.flatMap((e) => e.doneVisits || []);
    return list.sort((a, b) => {
      const comp = (a.agentName || 'Unassigned').localeCompare(b.agentName || 'Unassigned');
      if (comp !== 0) return comp;
      const da = a.visitDate ? new Date(a.visitDate).getTime() : 0;
      const db = b.visitDate ? new Date(b.visitDate).getTime() : 0;
      if (da !== db) return db - da;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDoneExecutives]);

  const filteredDroppedLeads = useMemo(() => {
    const list = activeDroppedExecutives.flatMap((e) => e.droppedVisits || []);
    return list.sort((a, b) => {
      const comp = (a.agentName || 'Unassigned').localeCompare(b.agentName || 'Unassigned');
      if (comp !== 0) return comp;
      const da = a.visitDate ? new Date(a.visitDate).getTime() : 0;
      const db = b.visitDate ? new Date(b.visitDate).getTime() : 0;
      if (da !== db) return db - da;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDroppedExecutives]);

  const completedForSelectedDate = useMemo(() => {
    if (!portfolio?.executives) return 0;
    let allDone = portfolio.executives.flatMap((e) => e.doneVisits || []);
    if (selectedExecutive !== 'ALL') {
      allDone = allDone.filter((l) => l.agentName === selectedExecutive);
    }
    return allDone.filter((l) => matchesDateFilter(l.visitDate || l.updatedAt, 'custom', selectedDate)).length;
  }, [portfolio, selectedExecutive, selectedDate]);

  const loadDate = async (dateStr: string, isSilent = false) => {
    setSelectedDate(dateStr);
    if (!isSilent) setLoading(true);
    try {
      const data = await getVisitsForDate(dateStr);
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

  // Excel (.xlsx) Export Handler
  const exportToExcel = () => {
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

    let dataRows: (string | number)[][] = [];
    let fileNameSuffix = '';

    if (activeTab === 'daily') {
      if (filteredVisits.length === 0) {
        toast.error('No visits to export for this selection');
        return;
      }
      fileNameSuffix = `Daily_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${selectedDate}`;
      dataRows = filteredVisits.map((v, idx) => {
        const statusText =
          v.visitStatus === 'VISIT_DONE'
            ? 'Completed'
            : v.visitStatus === 'RESCHEDULED'
            ? 'Rescheduled'
            : 'Scheduled';
        const execName = v.assignedAgent?.name || 'Unassigned';
        return [
          idx + 1,
          statusText,
          execName,
          v.name || '',
          v.phone ? maskPhone(v.phone) : '',
          formatDate(v.visitDate),
          ((v as any).projectName as string) || '',
          v.requirement ? (REQUIREMENT_LABELS[v.requirement] || String(v.requirement)) : '',
          v.budget ? (BUDGET_LABELS[v.budget] || String(v.budget)) : '',
          v.latestRemark || '',
        ];
      });
    } else if (activeTab === 'all-scheduled') {
      if (filteredScheduledLeads.length === 0) {
        toast.error('No scheduled visits to export');
        return;
      }
      fileNameSuffix = `All_Scheduled_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      dataRows = filteredScheduledLeads.map((l, idx) => [
        idx + 1,
        l.visitStatus || 'Scheduled',
        l.agentName,
        l.name || '',
        l.phone ? maskPhone(l.phone) : '',
        formatDate(l.visitDate),
        l.projectName || '',
        l.requirement ? (REQUIREMENT_LABELS[l.requirement] || String(l.requirement)) : '',
        l.budget ? (BUDGET_LABELS[l.budget] || String(l.budget)) : '',
        l.latestRemark || '',
      ]);
    } else if (activeTab === 'all-done') {
      if (filteredDoneLeads.length === 0) {
        toast.error('No completed visits to export');
        return;
      }
      fileNameSuffix = `All_Done_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      dataRows = filteredDoneLeads.map((l, idx) => [
        idx + 1,
        'Completed',
        l.agentName,
        l.name || '',
        l.phone ? maskPhone(l.phone) : '',
        formatDate(l.visitDate || l.updatedAt),
        l.projectName || '',
        l.requirement ? (REQUIREMENT_LABELS[l.requirement] || String(l.requirement)) : '',
        l.budget ? (BUDGET_LABELS[l.budget] || String(l.budget)) : '',
        l.latestRemark || '',
      ]);
    } else {
      if (filteredDroppedLeads.length === 0) {
        toast.error('No dropped visits to export');
        return;
      }
      fileNameSuffix = `All_Dropped_${selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_')}_${getISTDateString()}`;
      dataRows = filteredDroppedLeads.map((l, idx) => [
        idx + 1,
        'Dropped',
        l.agentName,
        l.name || '',
        l.phone ? maskPhone(l.phone) : '',
        formatDate(l.visitDate),
        l.projectName || '',
        l.requirement ? (REQUIREMENT_LABELS[l.requirement] || String(l.requirement)) : '',
        l.budget ? (BUDGET_LABELS[l.budget] || String(l.budget)) : '',
        l.latestRemark || '',
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 14 }, // Status
      { wch: 16 }, // Executive
      { wch: 22 }, // Customer Name
      { wch: 18 }, // Mobile Number (Masked)
      { wch: 22 }, // Scheduled Visit Date
      { wch: 18 }, // Project
      { wch: 18 }, // Configuration
      { wch: 16 }, // Budget
      { wch: 38 }, // Agent Notes / Remark
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visits Report');
    XLSX.writeFile(wb, `Site_Visits_${fileNameSuffix}.xlsx`);
    toast.success('Excel workbook (.xlsx) downloaded successfully!');
  };

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
              {filteredScheduledLeads.length}
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
              {filteredDoneLeads.length}
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
              {filteredDroppedLeads.length}
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
                <p className="text-2xl font-black text-slate-900">{filteredVisits.length + completedForSelectedDate}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scheduled</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{completedForSelectedDate}</p>
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Visited</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-amber-600">{filteredVisits.length}</p>
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
                    const currentAgent = visit.assignedAgent?.name || 'Unassigned';
                    const prevAgent = idx > 0 ? (filteredVisits[idx - 1].assignedAgent?.name || 'Unassigned') : null;
                    const isNewAgentGroup = selectedExecutive === 'ALL' && (idx === 0 || currentAgent !== prevAgent);
                    const agentVisitsCount = filteredVisits.filter(
                      (v) => (v.assignedAgent?.name || 'Unassigned') === currentAgent
                    ).length;

                    return (
                      <Fragment key={visit.id}>
                        {isNewAgentGroup && (
                          <tr className="bg-gradient-to-r from-slate-100 via-indigo-50/50 to-slate-100 border-y border-slate-200">
                            <td colSpan={9} className="py-2 px-3.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white font-black text-[11px] inline-flex items-center justify-center shadow-2xs">
                                    {currentAgent[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-900 text-xs tracking-tight">
                                    {currentAgent}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    Executive
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  {agentVisitsCount} {agentVisitsCount === 1 ? 'Visit' : 'Visits'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr
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
                    </Fragment>
                  );
                })}
              </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ALL SCHEDULED VISITS (DATE FILTER + UNIFIED TABLE)             */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-scheduled' && (
        <div className="space-y-4">
          {/* Date Navigation & Controls Bar (Identical style to Daily Schedule) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('all');
                    setScheduledCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scheduledDateFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('today');
                    setScheduledCustomDate(todayStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scheduledDateFilter === 'today'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('tomorrow');
                    setScheduledCustomDate(addDays(todayStr, 1));
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scheduledDateFilter === 'tomorrow'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('next-sunday');
                    setScheduledCustomDate(nextSundayStr());
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scheduledDateFilter === 'next-sunday'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Next Sunday
                </button>
              </div>

              {/* Date picker with arrows */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => stepScheduledDate(-1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer">
                    <Calendar size={13} className="text-emerald-600 shrink-0" />
                    <span>
                      {scheduledDateFilter === 'custom' && scheduledCustomDate
                        ? formatDisplayDDMMYY(scheduledCustomDate)
                        : scheduledDateFilter === 'all'
                        ? 'Pick Date'
                        : scheduledDateFilter === 'tomorrow'
                        ? formatDisplayDDMMYY(addDays(todayStr, 1))
                        : formatDisplayDDMMYY(todayStr)}
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
                    title="Select Date (dd/mmm/yy)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => stepScheduledDate(1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => loadPortfolio()}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer ml-0.5"
                  title="Refresh"
                >
                  <RefreshCcw size={13} className={portfolioLoading ? 'animate-spin text-emerald-600' : ''} />
                </button>
              </div>

              {scheduledDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduledDateFilter('all');
                    setScheduledCustomDate('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  ✕ Clear Date Filter
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredScheduledLeads.length} scheduled {filteredScheduledLeads.length === 1 ? 'visit' : 'visits'}
              {scheduledDateFilter === 'all' ? (
                <> across <strong className="text-slate-800 font-bold">{activeScheduledExecutives.length} executives</strong></>
              ) : (
                <> for <strong className="text-slate-800 font-bold">{scheduledCustomDate ? formatDisplayDDMMYY(scheduledCustomDate) : scheduledDateFilter}</strong></>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {scheduledDateFilter === 'all'
                    ? 'All Upcoming Scheduled Visits'
                    : scheduledDateFilter === 'today'
                    ? "Today's Scheduled Visits"
                    : scheduledDateFilter === 'tomorrow'
                    ? "Tomorrow's Scheduled Visits"
                    : scheduledDateFilter === 'next-sunday'
                    ? "Next Sunday's Scheduled Visits"
                    : scheduledCustomDate
                    ? `Scheduled Visits for ${formatDisplayDDMMYY(scheduledCustomDate)}`
                    : 'Filtered Scheduled Visits'}
                </h2>
                {selectedExecutive !== 'ALL' && (
                  <span className="text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                    Filtered: {selectedExecutive}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {scheduledDateFilter === 'all'
                  ? 'All future & active client visits grouped agent-wise without mixing names'
                  : scheduledCustomDate
                  ? `${new Date(scheduledCustomDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })} • ${formatDisplayDDMMYY(scheduledCustomDate)}`
                  : 'Filtered view across all executives'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{filteredScheduledLeads.length}</p>
                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Scheduled</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-800">{activeScheduledExecutives.length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Executives</p>
              </div>
            </div>
          </div>

          {/* Unified Single Table */}
          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-emerald-600" />
              Loading scheduled visits...
            </div>
          ) : filteredScheduledLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <Calendar size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-800">
                {scheduledDateFilter !== 'all'
                  ? 'No scheduled visits found for this date filter'
                  : 'No scheduled visits found'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {scheduledDateFilter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScheduledDateFilter('all');
                      setScheduledCustomDate('');
                    }}
                    className="text-emerald-600 font-bold hover:underline cursor-pointer"
                  >
                    View all upcoming scheduled visits
                  </button>
                ) : (
                  'Visits scheduled from calling forms will appear here grouped under their executive name.'
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
                  {filteredScheduledLeads.map((lead, idx) => {
                    const currentAgent = lead.agentName || 'Unassigned';
                    const prevAgent = idx > 0 ? (filteredScheduledLeads[idx - 1].agentName || 'Unassigned') : null;
                    const isNewAgentGroup = selectedExecutive === 'ALL' && (idx === 0 || currentAgent !== prevAgent);
                    const agentVisitsCount = filteredScheduledLeads.filter(
                      (l) => (l.agentName || 'Unassigned') === currentAgent
                    ).length;

                    return (
                      <Fragment key={lead.id}>
                        {isNewAgentGroup && (
                          <tr className="bg-gradient-to-r from-slate-100 via-emerald-50/50 to-slate-100 border-y border-slate-200">
                            <td colSpan={9} className="py-2 px-3.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-600 text-white font-black text-[11px] inline-flex items-center justify-center shadow-2xs">
                                    {currentAgent[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-900 text-xs tracking-tight">
                                    {currentAgent}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Executive
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  {agentVisitsCount} {agentVisitsCount === 1 ? 'Visit' : 'Visits'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-white border-l-4 border-l-emerald-500 hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">{statusBadge(lead.visitStatus || 'SCHEDULED')}</td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-[10px] inline-flex items-center justify-center shadow-2xs">
                                {currentAgent[0]}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                {currentAgent}
                              </span>
                            </div>
                          </td>
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
                                {REQUIREMENT_LABELS[lead.requirement] || lead.requirement}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                            {lead.budget ? BUDGET_LABELS[lead.budget] || String(lead.budget) : '—'}
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
                                  title="Mark visit completed (moves to Visit Done)"
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
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: VISIT DONE (COMPLETED VISITS - DATE FILTER + UNIFIED TABLE)    */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-done' && (
        <div className="space-y-4">
          {/* Date Navigation & Controls Bar (Identical style to Daily Schedule) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('all');
                    setDoneCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    doneDateFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Completed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('today');
                    setDoneCustomDate(todayStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    doneDateFilter === 'today'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('this-week');
                    setDoneCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    doneDateFilter === 'this-week'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('this-month');
                    setDoneCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    doneDateFilter === 'this-month'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  This Month
                </button>
              </div>

              {/* Date picker with arrows */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => stepDoneDate(-1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer">
                    <Calendar size={13} className="text-blue-600 shrink-0" />
                    <span>
                      {doneDateFilter === 'custom' && doneCustomDate
                        ? formatDisplayDDMMYY(doneCustomDate)
                        : doneDateFilter === 'today'
                        ? formatDisplayDDMMYY(todayStr)
                        : doneDateFilter === 'all'
                        ? 'Pick Date'
                        : doneDateFilter}
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
                    title="Select Date (dd/mmm/yy)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => stepDoneDate(1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => loadPortfolio()}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer ml-0.5"
                  title="Refresh"
                >
                  <RefreshCcw size={13} className={portfolioLoading ? 'animate-spin text-blue-600' : ''} />
                </button>
              </div>

              {doneDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setDoneDateFilter('all');
                    setDoneCustomDate('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  ✕ Clear Date Filter
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredDoneLeads.length} completed {filteredDoneLeads.length === 1 ? 'visit' : 'visits'}
              {doneDateFilter === 'all' ? (
                <> across <strong className="text-slate-800 font-bold">{activeDoneExecutives.length} executives</strong></>
              ) : (
                <> for <strong className="text-slate-800 font-bold">{doneCustomDate ? formatDisplayDDMMYY(doneCustomDate) : doneDateFilter}</strong></>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {doneDateFilter === 'all'
                    ? 'All Completed Site Visits'
                    : doneDateFilter === 'today'
                    ? "Today's Completed Visits"
                    : doneDateFilter === 'this-week'
                    ? "This Week's Completed Visits"
                    : doneDateFilter === 'this-month'
                    ? "This Month's Completed Visits"
                    : doneCustomDate
                    ? `Completed Visits for ${formatDisplayDDMMYY(doneCustomDate)}`
                    : 'Filtered Completed Visits'}
                </h2>
                {selectedExecutive !== 'ALL' && (
                  <span className="text-[11px] bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-md font-bold">
                    Filtered: {selectedExecutive}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {doneDateFilter === 'all'
                  ? 'Verified on-ground completed visits grouped agent-wise without mixing names'
                  : doneCustomDate
                  ? `${new Date(doneCustomDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })} • ${formatDisplayDDMMYY(doneCustomDate)}`
                  : 'Filtered completion history across all executives'}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-blue-600">{filteredDoneLeads.length}</p>
                <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Completed</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-800">{activeDoneExecutives.length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Executives</p>
              </div>
            </div>
          </div>

          {/* Unified Single Table */}
          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-blue-600" />
              Loading completed visits...
            </div>
          ) : filteredDoneLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-slate-300" />
              <p className="text-base font-bold text-slate-800">
                {doneDateFilter !== 'all'
                  ? 'No completed visits match the selected date filter'
                  : 'No completed visits recorded yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                When site visits are confirmed by clicking &quot;Done&quot;, they will automatically shift here under each executive.
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
                    <th className="py-3 px-3.5">Visit Date</th>
                    <th className="py-3 px-3.5">Project &amp; Config</th>
                    <th className="py-3 px-3.5">Budget</th>
                    <th className="py-3 px-3.5">Agent Notes / Remark</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDoneLeads.map((lead, idx) => {
                    const currentAgent = lead.agentName || 'Unassigned';
                    const prevAgent = idx > 0 ? (filteredDoneLeads[idx - 1].agentName || 'Unassigned') : null;
                    const isNewAgentGroup = selectedExecutive === 'ALL' && (idx === 0 || currentAgent !== prevAgent);
                    const agentVisitsCount = filteredDoneLeads.filter(
                      (l) => (l.agentName || 'Unassigned') === currentAgent
                    ).length;

                    return (
                      <Fragment key={lead.id}>
                        {isNewAgentGroup && (
                          <tr className="bg-gradient-to-r from-slate-100 via-blue-50/50 to-slate-100 border-y border-slate-200">
                            <td colSpan={9} className="py-2 px-3.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-black text-[11px] inline-flex items-center justify-center shadow-2xs">
                                    {currentAgent[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-900 text-xs tracking-tight">
                                    {currentAgent}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                    Executive
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  {agentVisitsCount} {agentVisitsCount === 1 ? 'Visit' : 'Visits'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-white border-l-4 border-l-blue-500 hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Completed
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-[10px] inline-flex items-center justify-center shadow-2xs">
                                {currentAgent[0]}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                {currentAgent}
                              </span>
                            </div>
                          </td>
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
                                {REQUIREMENT_LABELS[lead.requirement] || lead.requirement}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                            {lead.budget ? BUDGET_LABELS[lead.budget] || String(lead.budget) : '—'}
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
                              title={lead.latestRemark || ''}
                            >
                              {lead.latestRemark || '—'}
                            </p>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-bold">
                              <CheckCircle2 size={13} className="text-emerald-600" /> Completed
                            </span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: ALL DROPPED VISITS (DATE FILTER + UNIFIED TABLE)               */}
      {/* ────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'all-dropped' && (
        <div className="space-y-4">
          {/* Date Navigation & Controls Bar (Identical style to Daily Schedule) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDroppedDateFilter('all');
                    setDroppedCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    droppedDateFilter === 'all'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Dropped
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDroppedDateFilter('yesterday');
                    setDroppedCustomDate(addDays(todayStr, -1));
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    droppedDateFilter === 'yesterday'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDroppedDateFilter('this-week');
                    setDroppedCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    droppedDateFilter === 'this-week'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDroppedDateFilter('this-month');
                    setDroppedCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    droppedDateFilter === 'this-month'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  This Month
                </button>
              </div>

              {/* Date picker with arrows */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => stepDroppedDate(-1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="relative inline-flex items-center">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer">
                    <Calendar size={13} className="text-rose-600 shrink-0" />
                    <span>
                      {droppedDateFilter === 'custom' && droppedCustomDate
                        ? formatDisplayDDMMYY(droppedCustomDate)
                        : droppedDateFilter === 'yesterday'
                        ? formatDisplayDDMMYY(addDays(todayStr, -1))
                        : droppedDateFilter === 'all'
                        ? 'Pick Date'
                        : droppedDateFilter}
                    </span>
                  </div>
                  <input
                    type="date"
                    value={droppedCustomDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDroppedCustomDate(e.target.value);
                        setDroppedDateFilter('custom');
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Select Date (dd/mmm/yy)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => stepDroppedDate(1)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => loadPortfolio()}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 transition-all cursor-pointer ml-0.5"
                  title="Refresh"
                >
                  <RefreshCcw size={13} className={portfolioLoading ? 'animate-spin text-rose-600' : ''} />
                </button>
              </div>

              {droppedDateFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setDroppedDateFilter('all');
                    setDroppedCustomDate('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
                >
                  ✕ Clear Date Filter
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredDroppedLeads.length} dropped {filteredDroppedLeads.length === 1 ? 'visit' : 'visits'}
              {droppedDateFilter === 'all' ? (
                <> across <strong className="text-slate-800 font-bold">{activeDroppedExecutives.length} executives</strong></>
              ) : (
                <> for <strong className="text-slate-800 font-bold">{droppedCustomDate ? formatDisplayDDMMYY(droppedCustomDate) : droppedDateFilter}</strong></>
              )}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {droppedDateFilter === 'all'
                    ? 'All Dropped Visits Analysis'
                    : droppedDateFilter === 'yesterday'
                    ? "Yesterday's Dropped Visits"
                    : droppedDateFilter === 'this-week'
                    ? "This Week's Dropped Visits"
                    : droppedDateFilter === 'this-month'
                    ? "This Month's Dropped Visits"
                    : droppedCustomDate
                    ? `Dropped Visits for ${formatDisplayDDMMYY(droppedCustomDate)}`
                    : 'Filtered Dropped Visits'}
                </h2>
                {selectedExecutive !== 'ALL' && (
                  <span className="text-[11px] bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-md font-bold">
                    Filtered: {selectedExecutive}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Past scheduled visits without confirmation. Grouped agent-wise for re-dialing &amp; rescheduling.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-black text-rose-600">{filteredDroppedLeads.length}</p>
                <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Dropped</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-slate-800">{activeDroppedExecutives.length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Executives</p>
              </div>
            </div>
          </div>

          {/* Unified Single Table */}
          {portfolioLoading ? (
            <div className="text-center py-16 text-slate-400">
              <RefreshCcw size={28} className="animate-spin mx-auto mb-3 text-rose-600" />
              Loading dropped visits...
            </div>
          ) : filteredDroppedLeads.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-xs">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-bold text-slate-800">
                {selectedExecutive !== 'ALL'
                  ? `Zero dropped visits for ${selectedExecutive}!`
                  : 'Zero dropped visits found!'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                All scheduled visits are on track or have been marked completed.
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
                    <th className="py-3 px-3.5">Past Scheduled Date</th>
                    <th className="py-3 px-3.5">Project &amp; Config</th>
                    <th className="py-3 px-3.5">Budget</th>
                    <th className="py-3 px-3.5">Agent Notes / Remark</th>
                    <th className="py-3 px-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDroppedLeads.map((lead, idx) => {
                    const currentAgent = lead.agentName || 'Unassigned';
                    const prevAgent = idx > 0 ? (filteredDroppedLeads[idx - 1].agentName || 'Unassigned') : null;
                    const isNewAgentGroup = selectedExecutive === 'ALL' && (idx === 0 || currentAgent !== prevAgent);
                    const agentVisitsCount = filteredDroppedLeads.filter(
                      (l) => (l.agentName || 'Unassigned') === currentAgent
                    ).length;

                    return (
                      <Fragment key={lead.id}>
                        {isNewAgentGroup && (
                          <tr className="bg-gradient-to-r from-slate-100 via-rose-50/50 to-slate-100 border-y border-slate-200">
                            <td colSpan={9} className="py-2 px-3.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-rose-700 to-amber-600 text-white font-black text-[11px] inline-flex items-center justify-center shadow-2xs">
                                    {currentAgent[0]}
                                  </span>
                                  <span className="font-extrabold text-slate-900 text-xs tracking-tight">
                                    {currentAgent}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    Executive
                                  </span>
                                </div>
                                <span className="text-[11px] font-mono font-bold text-slate-500">
                                  {agentVisitsCount} {agentVisitsCount === 1 ? 'Visit' : 'Visits'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className="bg-white border-l-4 border-l-rose-500 hover:bg-rose-50/30 transition-colors">
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500 text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Dropped
                            </span>
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white font-bold text-[10px] inline-flex items-center justify-center shadow-2xs">
                                {currentAgent[0]}
                              </span>
                              <span className="font-bold text-slate-900 text-xs">
                                {currentAgent}
                              </span>
                            </div>
                          </td>
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
                                {REQUIREMENT_LABELS[lead.requirement] || lead.requirement}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                            {lead.budget ? BUDGET_LABELS[lead.budget] || String(lead.budget) : '—'}
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
                                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Reschedule and revive visit to scheduled"
                                >
                                  <RotateCcw size={12} className="text-amber-700" /> Reschedule Date
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkDone(lead.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Mark visit completed"
                                >
                                  <Check size={12} className="text-emerald-700" /> Done
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
