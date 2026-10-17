'use client';

import { useState, useEffect, Fragment } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Users,
  Phone,
  TrendingUp,
  Calendar,
  CheckCircle2,
  PhoneCall,
  PhoneOff,
  Target,
  Award,
  BarChart3,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Radio,
  RotateCcw,
  Check,
} from 'lucide-react';
import { getDashboardStats, rescheduleVisit, markVisitDone } from '@/lib/leadActions';
import type { DashboardStatsResult } from '@/lib/leadActions';

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

function getIstDateRange(filter: string): { start?: Date; end?: Date } {
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = istFormatter.format(new Date()).split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const todayStr = parts.join('-');
  const nowIstDate = new Date(Date.UTC(y, m - 1, d));

  switch (filter) {
    case 'today':
      return {
        start: new Date(`${todayStr}T00:00:00+05:30`),
        end: new Date(`${todayStr}T23:59:59.999+05:30`),
      };
    case 'yesterday': {
      const prev = new Date(nowIstDate);
      prev.setUTCDate(prev.getUTCDate() - 1);
      const py = prev.getUTCFullYear();
      const pm = String(prev.getUTCMonth() + 1).padStart(2, '0');
      const pd = String(prev.getUTCDate()).padStart(2, '0');
      const yStr = `${py}-${pm}-${pd}`;
      return {
        start: new Date(`${yStr}T00:00:00+05:30`),
        end: new Date(`${yStr}T23:59:59.999+05:30`),
      };
    }
    case 'week': {
      const day = nowIstDate.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(nowIstDate);
      monday.setUTCDate(monday.getUTCDate() - diffToMonday);
      const my = monday.getUTCFullYear();
      const mm = String(monday.getUTCMonth() + 1).padStart(2, '0');
      const md = String(monday.getUTCDate()).padStart(2, '0');
      const mondayStr = `${my}-${mm}-${md}`;
      return {
        start: new Date(`${mondayStr}T00:00:00+05:30`),
        end: new Date(`${todayStr}T23:59:59.999+05:30`),
      };
    }
    case 'month': {
      const monthStartStr = `${parts[0]}-${parts[1]}-01`;
      return {
        start: new Date(`${monthStartStr}T00:00:00+05:30`),
        end: new Date(`${todayStr}T23:59:59.999+05:30`),
      };
    }
    default:
      return {};
  }
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

const formatToDDMMYY = (dateInput: string | Date | null | undefined) => {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES_SHORT[d.getMonth()] || String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

function getRankBgColor(idx: number, total: number): string {
  if (total <= 1) return 'rgb(99, 190, 123)';
  const ratio = idx / (total - 1);
  let r: number, g: number, b: number;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = Math.round(99 + (255 - 99) * t);
    g = Math.round(190 + (235 - 190) * t);
    b = Math.round(123 + (132 - 123) * t);
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(255 + (248 - 255) * t);
    g = Math.round(235 + (105 - 235) * t);
    b = Math.round(132 + (107 - 132) * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

interface Props {
  initialStats: DashboardStatsResult;
}

export default function DashboardClient({ initialStats }: Props) {
  const [stats, setStats] = useState<DashboardStatsResult>(initialStats);
  const [activeFilter, setActiveFilter] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [agentSubTab, setAgentSubTab] = useState<{ [agentId: string]: 'scheduled' | 'dropped' | 'done' | 'followup' | 'not_connected' | 'all' }>({});
  const [rescheduleLeadId, setRescheduleLeadId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleInlineReschedule = async (leadId: string) => {
    if (!rescheduleDate) {
      toast.error('Kripya new visit date select karein');
      return;
    }
    setActionLoadingId(leadId);
    try {
      const res = await rescheduleVisit(leadId, rescheduleDate);
      if (res.success) {
        toast.success(`Visit rescheduled to ${formatDisplayDDMMYY(rescheduleDate)}! Status updated.`);
        setRescheduleLeadId(null);
        setRescheduleDate('');
        if (activeFilter === 'custom') {
          await applyCustomRange(true);
        } else {
          await applyFilter(activeFilter, true);
        }
      } else {
        toast.error(res.message || 'Failed to reschedule visit');
      }
    } catch {
      toast.error('Error rescheduling visit');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleInlineMarkDone = async (leadId: string) => {
    setActionLoadingId(leadId);
    try {
      const res = await markVisitDone(leadId);
      if (res.success) {
        toast.success('Site visit marked as completed!');
        if (activeFilter === 'custom') {
          await applyCustomRange(true);
        } else {
          await applyFilter(activeFilter, true);
        }
      } else {
        toast.error(res.message || 'Failed to update visit status');
      }
    } catch {
      toast.error('Error marking visit completed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const applyFilter = async (filter: string, isSilent = false) => {
    setActiveFilter(filter);
    if (!isSilent) setLoading(true);
    try {
      const { start, end } = getIstDateRange(filter);
      const newStats = await getDashboardStats(start, end);
      setStats(newStats);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const handlePresetFilterClick = (filterValue: string) => {
    setCustomStart('');
    setCustomEnd('');
    applyFilter(filterValue);
  };

  const applyCustomRange = async (isSilent = false) => {
    // Condition 1: Only end date selected, but no start date -> do not apply filter!
    if (!customStart && customEnd) {
      if (!isSilent) toast.error('Pehle start date select karein');
      return;
    }

    // Condition 2: Neither selected
    if (!customStart && !customEnd) {
      if (!isSilent) toast.error('Kripya date select karein');
      return;
    }

    // Condition 3: Start date selected; if end date empty, filter for that specific single date!
    let sStr = customStart;
    let eStr = customEnd || customStart;

    if (sStr > eStr) {
      const temp = sStr;
      sStr = eStr;
      eStr = temp;
    }

    if (!isSilent) setLoading(true);
    try {
      const startDate = new Date(`${sStr}T00:00:00+05:30`);
      const endDate = new Date(`${eStr}T23:59:59.999+05:30`);
      const newStats = await getDashboardStats(startDate, endDate);
      setStats(newStats);
      setActiveFilter('custom');
      if (!isSilent) {
        if (sStr === eStr) {
          toast.success(`Date: ${formatDisplayDDMMYY(sStr)} report loaded`);
        } else {
          toast.success(`Range: ${formatDisplayDDMMYY(sStr)} to ${formatDisplayDDMMYY(eStr)} loaded`);
        }
      }
    } catch (err) {
      console.error('Error applying custom date filter:', err);
      if (!isSilent) toast.error('Failed to load stats for selected date');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Live Auto-Sync every 8 seconds & on tab focus (respects activeFilter)
  useEffect(() => {
    const syncCurrentStats = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (activeFilter === 'custom') {
          if (customStart) {
            applyCustomRange(true);
          }
        } else {
          applyFilter(activeFilter, true);
        }
      }
    };

    const interval = setInterval(syncCurrentStats, 8000);
    const handleFocus = () => syncCurrentStats();

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [activeFilter, customStart, customEnd]);

  const nf = new Intl.NumberFormat('en-IN');
  const overallVisitRatio =
    stats.totalLeads > 0
      ? Math.round(((stats.completedVisits || 0) / stats.totalLeads) * 100)
      : 0;

  const kpiCards = [
    {
      label: 'Calls Logged (Dials)',
      value: nf.format(stats.totalCalls),
      icon: Phone,
      color: 'from-blue-600 to-blue-700',
      badge: 'Interactions',
    },
    {
      label: 'Unique Verified Leads',
      value: nf.format(stats.totalLeads),
      icon: Users,
      color: 'from-indigo-600 to-indigo-700',
      badge: 'Unique',
    },
    {
      label: 'Visits Scheduled (Upcoming)',
      value: nf.format(stats.pendingVisits ?? 0),
      icon: Calendar,
      color: 'from-emerald-600 to-emerald-700',
      badge: 'Today & Future',
    },
    {
      label: 'Dropped Scheduled Visits',
      value: nf.format(stats.droppedVisits ?? 0),
      icon: AlertTriangle,
      color: 'from-rose-600 to-rose-700',
      badge: 'Past / Lapsed',
    },
    {
      label: 'Site Visits Done',
      value: nf.format(stats.completedVisits),
      icon: CheckCircle2,
      color: 'from-slate-700 to-slate-800',
      badge: 'Completed',
    },
    {
      label: 'Visit Ratio',
      value: `${overallVisitRatio}%`,
      icon: TrendingUp,
      color: 'from-violet-600 to-violet-700',
      badge: 'Done / Unique',
    },
  ];

  const leaderboardTotals = stats.agentLeaderboard.reduce(
    (acc, curr) => {
      acc.totalLeads += curr.totalLeads || 0;
      acc.connectedCalls += curr.connectedCalls || 0;
      acc.notConnected += curr.notConnected || 0;
      acc.interested += curr.interested || 0;
      acc.notInterested += curr.notInterested || 0;
      acc.visitsUpcoming += curr.visitsUpcoming || 0;
      acc.visitsDropped += curr.visitsDropped || 0;
      acc.visitsDone += curr.visitsDone || 0;
      return acc;
    },
    {
      totalLeads: 0,
      connectedCalls: 0,
      notConnected: 0,
      interested: 0,
      notInterested: 0,
      visitsUpcoming: 0,
      visitsDropped: 0,
      visitsDone: 0,
    }
  );

  const teamTotalVisitRatio =
    leaderboardTotals.totalLeads > 0
      ? Math.round((leaderboardTotals.visitsDone / leaderboardTotals.totalLeads) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 size={24} className="text-indigo-600" />
            Executive CRM Analytics
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time caller velocity &amp; deduplicated pipeline tracking</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Auto-Sync Live
          </div>
          <button
            onClick={() => {
              if (activeFilter === 'custom') {
                applyCustomRange();
              } else {
                applyFilter(activeFilter);
              }
            }}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
          >
            <RefreshCcw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            Refresh Stats
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handlePresetFilterClick(f.value)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === f.value
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto pt-2 sm:pt-0">
          {/* Start Date Picker (Formatted as dd/mm/yy) */}
          <div className="relative inline-flex items-center group">
            <div className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-6 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-2xs group-hover:border-indigo-300 pointer-events-none min-w-[110px]">
              <Calendar size={13} className="text-indigo-600 shrink-0" />
              <span className={customStart ? "text-slate-900 font-bold" : "text-slate-400 font-medium"}>
                {customStart ? formatDisplayDDMMYY(customStart) : "dd/mm/yy"}
              </span>
            </div>
            {customStart && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomStart('');
                }}
                className="absolute right-2 z-10 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Clear start date"
              >
                <X size={12} />
              </button>
            )}
            <input
              type="date"
              lang="en-IN"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Select Start Date (dd/mm/yy)"
            />
          </div>

          <span className="text-slate-400 text-xs font-medium">to</span>

          {/* End Date Picker (Formatted as dd/mm/yy) */}
          <div className="relative inline-flex items-center group">
            <div className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-6 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-2xs group-hover:border-indigo-300 pointer-events-none min-w-[110px]">
              <Calendar size={13} className="text-indigo-600 shrink-0" />
              <span className={customEnd ? "text-slate-900 font-bold" : "text-slate-400 font-medium"}>
                {customEnd ? formatDisplayDDMMYY(customEnd) : "dd/mm/yy"}
              </span>
            </div>
            {customEnd && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomEnd('');
                }}
                className="absolute right-2 z-10 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Clear end date"
              >
                <X size={12} />
              </button>
            )}
            <input
              type="date"
              lang="en-IN"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Select End Date (dd/mm/yy)"
            />
          </div>

          <button
            onClick={() => applyCustomRange()}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'custom'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            Filter
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-xs`}>
                  <Icon size={16} />
                </div>
                <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {card.badge}
                </span>
              </div>
              <p className="text-xl font-black text-slate-900 tracking-tight" suppressHydrationWarning>{loading ? '—' : card.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-semibold leading-tight">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Agent Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50 border-b border-slate-200 flex items-center justify-center">
          <div className="inline-flex items-center gap-2">
            <Award size={18} className="text-amber-500 shrink-0" />
            <h2 className="text-xs sm:text-[13.5px] font-black uppercase tracking-wider text-indigo-950">
              Sales Executive Performance Leaderboard
            </h2>
          </div>
        </div>

        {/* Compact Table for One Screen View without excessive scrolling */}
        <div className="overflow-x-auto">
          <table className="data-table-compact w-full">
            <thead>
              <tr>
                <th className="min-w-[125px] text-left px-2 py-2">Executive</th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Total</div>
                  <div>Leads</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Connected</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Not</div>
                  <div>Connected</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Interested</div>
                  <div>Follow-Up</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Not</div>
                  <div>Interested</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight text-emerald-800">
                  <div>Visits</div>
                  <div>Scheduled</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight text-rose-700">
                  <div>Dropped</div>
                  <div>Scheduled</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight">
                  <div>Visits</div>
                  <div>Done</div>
                </th>
                <th className="text-center px-1.5 py-2 leading-tight min-w-[65px]">
                  <div>Visit</div>
                  <div>Ratio</div>
                </th>
                <th className="w-12 text-center px-1.5 py-2 leading-tight">
                  <div>Rank</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400">Loading metrics...</td>
                </tr>
              ) : stats.agentLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400">No activity logged for this time window</td>
                </tr>
              ) : (
                [...stats.agentLeaderboard]
                  .sort((a, b) => {
                    // Primary: Visits Done (highest first)
                    if (b.visitsDone !== a.visitsDone) {
                      return b.visitsDone - a.visitsDone;
                    }
                    // Secondary: Visit Ratio (visitsDone / totalLeads)
                    const aRatio = a.totalLeads > 0 ? (a.visitsDone / a.totalLeads) : 0;
                    const bRatio = b.totalLeads > 0 ? (b.visitsDone / b.totalLeads) : 0;
                    if (bRatio !== aRatio) {
                      return bRatio - aRatio;
                    }
                    // Tertiary: Visits Upcoming (Scheduled)
                    if ((b.visitsUpcoming ?? 0) !== (a.visitsUpcoming ?? 0)) {
                      return (b.visitsUpcoming ?? 0) - (a.visitsUpcoming ?? 0);
                    }
                    // Quaternary: Total Leads
                    if (b.totalLeads !== a.totalLeads) {
                      return b.totalLeads - a.totalLeads;
                    }
                    // Quinary: Connected Calls
                    return b.connectedCalls - a.connectedCalls;
                  })
                  .map((agent, idx, arr) => {
                    const isExpanded = expandedAgentId === agent.id;
                    const visitRatio = agent.totalLeads > 0 ? Math.round((agent.visitsDone / agent.totalLeads) * 100) : 0;
                    const rankBgColor = getRankBgColor(idx, arr.length);
                    return (
                      <Fragment key={agent.id}>
                        <tr className={`transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}>
                          {/* Executive with Clickable Avatar Character */}
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                                title={`Click to view ${agent.name}'s scheduled and dropped site visits`}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs cursor-pointer transition-all transform hover:scale-110 active:scale-95 shrink-0 ${
                                  isExpanded
                                    ? 'bg-indigo-700 ring-2 ring-indigo-500 ring-offset-1'
                                    : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:ring-2 hover:ring-indigo-400'
                                }`}
                              >
                                {agent.name[0]}
                              </button>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setExpandedAgentId(isExpanded ? null : agent.id)}
                                  className="font-bold text-slate-900 text-xs hover:text-indigo-600 cursor-pointer text-left flex items-center gap-1 truncate"
                                >
                                  <span className="truncate">{agent.name}</span>
                                  {isExpanded ? (
                                    <ChevronUp size={12} className="text-indigo-600 shrink-0" />
                                  ) : (
                                    <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Total Leads */}
                          <td className="text-center">
                            <span className="font-extrabold text-slate-900 text-xs">{agent.totalLeads}</span>
                          </td>

                          {/* Connected */}
                          <td className="text-center">
                            <span className="text-emerald-700 font-bold text-xs">{agent.connectedCalls}</span>
                          </td>

                          {/* Not Connected */}
                          <td className="text-center">
                            <span className="text-rose-600 font-bold text-xs">{agent.notConnected}</span>
                          </td>

                          {/* Interested Follow-Up */}
                          <td className="text-center">
                            <span className="badge badge-indigo text-[11px] px-2 py-0.5">{agent.interested}</span>
                          </td>

                          {/* Not Interested (NEW) */}
                          <td className="text-center">
                            <span className="badge badge-rose text-[11px] px-2 py-0.5">{agent.notInterested ?? 0}</span>
                          </td>

                          {/* Visits Scheduled (Today to Future only) */}
                          <td className="text-center">
                            <span className="badge badge-emerald text-[11px] px-2 py-0.5">
                              {agent.visitsUpcoming ?? 0}
                            </span>
                          </td>

                          {/* Dropped Scheduled (NEW: Past date lapsed visits) */}
                          <td className="text-center">
                            {(agent.visitsDropped ?? 0) > 0 ? (
                              <span className="badge badge-rose font-black text-[11px] px-2.5 py-0.5 ring-1 ring-rose-400 shadow-2xs">
                                {agent.visitsDropped}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs font-bold">0</span>
                            )}
                          </td>

                          {/* Visits Done */}
                          <td className="text-center">
                            <span className="badge badge-slate text-[11px] px-2 py-0.5">{agent.visitsDone}</span>
                          </td>

                          {/* Visit Ratio (Ratio of Visits Done to Total Leads) */}
                          <td className="text-center">
                            <span className={`font-black text-xs ${
                              visitRatio >= 50 ? 'text-emerald-700' :
                              visitRatio > 0 ? 'text-indigo-700' :
                              'text-slate-400'
                            }`}>
                              {visitRatio}%
                            </span>
                          </td>

                          {/* Rank with Excel-like Heatmap Gradient */}
                          <td className="text-center">
                            <div
                              className="w-7 h-7 mx-auto rounded-md flex items-center justify-center font-black text-xs text-slate-900 border border-black/15 shadow-2xs"
                              style={{ backgroundColor: rankBgColor }}
                              title={`Rank #${idx + 1}`}
                            >
                              {idx + 1}
                            </div>
                          </td>
                        </tr>

                        {/* ── EXPANDED AGENT DRILL-DOWN PANEL (ALL LEADS & VISITS LIVE) ── */}
                        {isExpanded && (() => {
                          const allLeadsList = agent.allLeads || [];
                          const scheduledLeadsList = allLeadsList.filter((l) => l.isUpcoming);
                          const droppedLeadsList = allLeadsList.filter((l) => l.isDropped);
                          const doneLeadsList = allLeadsList.filter((l) => l.isDone);
                          const followUpLeadsList = allLeadsList.filter(
                            (l) => l.disposition === 'INTERESTED_FOLLOW_UP' || (l.followUpDate && !l.isUpcoming && !l.isDone)
                          );
                          const notConnectedLeadsList = allLeadsList.filter(
                            (l) => l.callOutcome === 'NOT_CONNECTED'
                          );

                          const activeSub = agentSubTab[agent.id] || 'scheduled';
                          const displayLeads =
                            activeSub === 'scheduled'
                              ? scheduledLeadsList
                              : activeSub === 'dropped'
                              ? droppedLeadsList
                              : activeSub === 'done'
                              ? doneLeadsList
                              : activeSub === 'followup'
                              ? followUpLeadsList
                              : activeSub === 'not_connected'
                              ? notConnectedLeadsList
                              : allLeadsList;

                          return (
                            <tr className="bg-indigo-50/40 border-b-2 border-indigo-200">
                              <td colSpan={11} className="p-3 sm:p-4">
                                <div className="space-y-3">
                                  {/* Sub-tab Navigation */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                      <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                      <span>{agent.name}&apos;s Live Portfolio</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {/* 1. Visit Scheduled */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'scheduled' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'scheduled'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        Visit Scheduled ({scheduledLeadsList.length})
                                      </button>

                                      {/* 2. Visit Dropped */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'dropped' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'dropped'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        Visit Dropped ({droppedLeadsList.length})
                                      </button>

                                      {/* 3. Visit Done */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'done' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'done'
                                            ? 'bg-slate-800 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        Visit Done ({doneLeadsList.length})
                                      </button>

                                      {/* 4. Follow-Up */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'followup' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'followup'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        Follow-Up ({followUpLeadsList.length})
                                      </button>

                                      {/* 5. Not Connected */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'not_connected' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'not_connected'
                                            ? 'bg-rose-700 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        Not Connected ({notConnectedLeadsList.length})
                                      </button>

                                      {/* 6. All Leads (Last) */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'all' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'all'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                      >
                                        All Leads ({allLeadsList.length})
                                      </button>
                                    </div>
                                  </div>

                                  {/* Table of Leads */}
                                  {displayLeads.length === 0 ? (
                                    <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
                                      No leads recorded under this filter for {agent.name}.
                                    </div>
                                  ) : (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="bg-slate-100/90 text-[10.5px] uppercase font-bold text-slate-600 border-b border-slate-200">
                                            <th className="py-2.5 px-3 text-center w-12 font-mono">S.No</th>
                                            <th className="py-2.5 px-3">Call / Visit Status</th>
                                            <th className="py-2.5 px-3">Customer &amp; Mobile</th>
                                            <th className="py-2.5 px-3">Action Date</th>
                                            <th className="py-2.5 px-3">Project &amp; Requirement</th>
                                            <th className="py-2.5 px-3">Budget</th>
                                            <th className="py-2.5 px-3">Agent Remark</th>
                                            <th className="py-2.5 px-3">Last Updated</th>
                                            <th className="py-2.5 px-3 text-center whitespace-nowrap">Action / Update</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {displayLeads.map((vLead, idx) => {
                                            const hasVisit = !!vLead.visitDate || vLead.visitStatus === 'SCHEDULED' || vLead.visitStatus === 'RESCHEDULED' || vLead.visitStatus === 'VISIT_DONE';
                                            return (
                                              <tr
                                                key={vLead.id}
                                                className={`transition-colors ${
                                                  vLead.isDropped
                                                    ? 'bg-rose-50/70 border-l-4 border-l-rose-500 hover:bg-rose-100/50'
                                                    : vLead.isUpcoming
                                                    ? 'bg-emerald-50/50 border-l-4 border-l-emerald-500 hover:bg-emerald-100/50'
                                                    : vLead.isDone
                                                    ? 'bg-blue-50/50 border-l-4 border-l-blue-400 hover:bg-blue-100/50'
                                                    : vLead.disposition === 'INTERESTED_FOLLOW_UP'
                                                    ? 'bg-amber-50/40 border-l-4 border-l-amber-400 hover:bg-amber-100/50'
                                                    : 'bg-white border-l-4 border-l-slate-300 hover:bg-slate-50'
                                                }`}
                                              >
                                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 text-xs">{idx + 1}</td>
                                                {/* Status Badge */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                  {vLead.isDropped ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                      Visit Missed
                                                    </span>
                                                  ) : vLead.isUpcoming ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                      Visit Scheduled
                                                    </span>
                                                  ) : vLead.isDone ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                      Visit Completed
                                                    </span>
                                                  ) : vLead.disposition === 'INTERESTED_FOLLOW_UP' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                      Callback / Follow-up
                                                    </span>
                                                  ) : vLead.callOutcome === 'NOT_CONNECTED' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                      Not Connected
                                                    </span>
                                                  ) : vLead.disposition === 'NOT_INTERESTED' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                      Not Interested
                                                    </span>
                                                  ) : vLead.disposition === 'BUDGET_MISMATCH' || vLead.disposition === 'LOCATION_MISMATCH' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                      Mismatch
                                                    </span>
                                                  ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                      {vLead.disposition || 'Lead Logged'}
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Customer Name & Phone (Masked: Only starting 5 digits visible on Overview Dashboard) */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                  <div className="font-bold text-slate-900">{vLead.name}</div>
                                                  {vLead.phone ? (
                                                    <div className="text-[11px] font-mono font-semibold text-slate-700 inline-flex items-center">
                                                      <span>{vLead.phone.replace(/\D/g, '').slice(0, 5) || vLead.phone.slice(0, 5)}</span>
                                                      <span className="text-slate-400 font-normal tracking-wider">*****</span>
                                                    </div>
                                                  ) : (
                                                    <span className="text-[11px] text-slate-400 font-mono">—</span>
                                                  )}
                                                </td>

                                                {/* Action Date */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-xs">
                                                  {hasVisit && vLead.visitDate ? (
                                                    <span className={vLead.isDropped ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                                                      Visit: {formatToDDMMYY(vLead.visitDate)}
                                                    </span>
                                                  ) : vLead.followUpDate ? (
                                                    <span className="text-amber-700 font-bold">
                                                      Follow: {formatToDDMMYY(vLead.followUpDate)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-500">
                                                      {formatToDDMMYY(vLead.createdAt)}
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Project & Requirement */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                  <span className="font-bold text-slate-900">{vLead.projectName || '—'}</span>
                                                  {vLead.requirement && (
                                                    <span className="text-[11px] text-slate-500 block">
                                                      {vLead.requirement}
                                                    </span>
                                                  )}
                                                </td>

                                                {/* Budget */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                                                  {vLead.budget || '—'}
                                                </td>

                                                {/* Remark */}
                                                <td className="py-2.5 px-3 max-w-[220px]">
                                                  <p
                                                    className="text-[11px] text-slate-600 leading-tight"
                                                    style={{
                                                      display: '-webkit-box',
                                                      WebkitLineClamp: 2,
                                                      WebkitBoxOrient: 'vertical',
                                                      overflow: 'hidden',
                                                    }}
                                                    title={vLead.latestRemark || ''}
                                                  >
                                                    {vLead.latestRemark || '—'}
                                                  </p>
                                                </td>

                                                {/* Last Updated */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-500 text-xs">
                                                  {formatToDDMMYY(vLead.updatedAt || vLead.createdAt)}
                                                </td>

                                                {/* Actions: Reschedule / Done / Call Update */}
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                  {rescheduleLeadId === vLead.id ? (
                                                    <div className="flex items-center gap-1.5 bg-amber-50 p-1 rounded-lg border border-amber-200">
                                                      <div className="relative inline-flex items-center">
                                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono font-bold text-slate-800 shadow-2xs">
                                                          <Calendar size={12} className="text-amber-600 shrink-0" />
                                                          <span className={rescheduleDate ? 'text-slate-900 font-extrabold' : 'text-slate-400 font-medium'}>
                                                            {rescheduleDate ? formatDisplayDDMMYY(rescheduleDate) : 'dd/mm/yy'}
                                                          </span>
                                                        </div>
                                                        <input
                                                          type="date"
                                                          value={rescheduleDate}
                                                          onChange={(e) => setRescheduleDate(e.target.value)}
                                                          min={new Date().toISOString().split('T')[0]}
                                                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                          title="Select Reschedule Date (dd/mm/yy)"
                                                        />
                                                      </div>
                                                      <button
                                                        onClick={() => handleInlineReschedule(vLead.id)}
                                                        disabled={actionLoadingId === vLead.id || !rescheduleDate}
                                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow-xs disabled:opacity-50"
                                                      >
                                                        {actionLoadingId === vLead.id ? '...' : 'Save'}
                                                      </button>
                                                      <button
                                                        onClick={() => {
                                                          setRescheduleLeadId(null);
                                                          setRescheduleDate('');
                                                        }}
                                                        className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 text-[11px]"
                                                      >
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-1.5">
                                                      {(vLead.isDropped || vLead.isUpcoming || hasVisit) && (
                                                        <>
                                                          <button
                                                            onClick={() => {
                                                              setRescheduleLeadId(vLead.id);
                                                              setRescheduleDate('');
                                                            }}
                                                            title="Reschedule to a new visit date"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors shadow-2xs"
                                                          >
                                                            <RotateCcw className="w-3 h-3" />
                                                            Reschedule
                                                          </button>
                                                          <button
                                                            onClick={() => handleInlineMarkDone(vLead.id)}
                                                            disabled={actionLoadingId === vLead.id}
                                                            title="Mark Site Visit Done"
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs disabled:opacity-50"
                                                          >
                                                            <Check className="w-3 h-3" />
                                                            {actionLoadingId === vLead.id ? '...' : 'Done'}
                                                          </button>
                                                        </>
                                                      )}
                                                      {vLead.phone && (
                                                        <Link
                                                          href={`/?phone=${encodeURIComponent(vLead.phone)}`}
                                                          target="_blank"
                                                          title="Open calling form with this customer's details to log new call or change status"
                                                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs"
                                                        >
                                                          <Phone className="w-3 h-3" />
                                                          Update Call
                                                        </Link>
                                                      )}
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
                              </td>
                            </tr>
                          );
                        })()}
                      </Fragment>
                    );
                  })
              )}
            </tbody>
            {stats.agentLeaderboard.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300">
                  {/* Executive Header */}
                  <td className="px-3 py-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block shrink-0 shadow-2xs"></span>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">Total</span>
                    </div>
                  </td>

                  {/* Total Leads */}
                  <td className="text-center px-1.5 py-3">
                    <span className="font-black text-slate-900 text-xs">{leaderboardTotals.totalLeads}</span>
                  </td>

                  {/* Connected */}
                  <td className="text-center px-1.5 py-3">
                    <span className="text-emerald-800 font-black text-xs">{leaderboardTotals.connectedCalls}</span>
                  </td>

                  {/* Not Connected */}
                  <td className="text-center px-1.5 py-3">
                    <span className="text-rose-700 font-black text-xs">{leaderboardTotals.notConnected}</span>
                  </td>

                  {/* Interested Follow-Up */}
                  <td className="text-center px-1.5 py-3">
                    <span className="badge badge-indigo text-[11px] font-black px-2 py-0.5 shadow-2xs">
                      {leaderboardTotals.interested}
                    </span>
                  </td>

                  {/* Not Interested */}
                  <td className="text-center px-1.5 py-3">
                    <span className="badge badge-rose text-[11px] font-black px-2 py-0.5 shadow-2xs">
                      {leaderboardTotals.notInterested}
                    </span>
                  </td>

                  {/* Visits Scheduled */}
                  <td className="text-center px-1.5 py-3">
                    <span className="badge badge-emerald text-[11px] font-black px-2 py-0.5 shadow-2xs">
                      {leaderboardTotals.visitsUpcoming}
                    </span>
                  </td>

                  {/* Dropped Scheduled */}
                  <td className="text-center px-1.5 py-3">
                    {leaderboardTotals.visitsDropped > 0 ? (
                      <span className="badge badge-rose font-black text-[11px] px-2.5 py-0.5 ring-1 ring-rose-400 shadow-2xs">
                        {leaderboardTotals.visitsDropped}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold text-xs">0</span>
                    )}
                  </td>

                  {/* Visits Done */}
                  <td className="text-center px-1.5 py-3">
                    <span className="badge badge-slate text-[11px] font-black px-2 py-0.5 shadow-2xs">
                      {leaderboardTotals.visitsDone}
                    </span>
                  </td>

                  {/* Visit Ratio */}
                  <td className="text-center px-1.5 py-3">
                    <span className={`font-black text-xs ${
                      teamTotalVisitRatio >= 50 ? 'text-emerald-700' :
                      teamTotalVisitRatio > 0 ? 'text-indigo-700' :
                      'text-slate-400'
                    }`}>
                      {teamTotalVisitRatio}%
                    </span>
                  </td>

                  {/* Rank Column */}
                  <td className="text-center px-1.5 py-3">
                    <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded shadow-2xs">
                      ALL
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
