'use client';

import { useState, useEffect, Fragment } from 'react';
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
} from 'lucide-react';
import { getDashboardStats } from '@/lib/leadActions';
import type { DashboardStatsResult } from '@/lib/leadActions';

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

function getDateRange(filter: string): { start?: Date; end?: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000 - 1) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: y, end: new Date(y.getTime() + 86400000 - 1) };
    }
    case 'week': {
      const w = new Date(today);
      w.setDate(w.getDate() - w.getDay());
      return { start: w, end: now };
    }
    case 'month': {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    }
    default:
      return {};
  }
}

const formatToDDMMYY = (dateInput: string | Date | null | undefined) => {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
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
  const [agentSubTab, setAgentSubTab] = useState<{ [agentId: string]: 'all' | 'visits' | 'followup' | 'other' }>({});

  const applyFilter = async (filter: string, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const { start, end } = getDateRange(filter);
      const newStats = await getDashboardStats(start, end);
      setStats(newStats);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Live Auto-Sync every 8 seconds & on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        applyFilter(activeFilter, true);
      }
    }, 8000);

    const handleFocus = () => {
      applyFilter(activeFilter, true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [activeFilter]);


  const applyCustomRange = async () => {
    if (!customStart || !customEnd) return;
    setLoading(true);
    try {
      const newStats = await getDashboardStats(new Date(customStart), new Date(customEnd + 'T23:59:59'));
      setStats(newStats);
      setActiveFilter('custom');
    } finally {
      setLoading(false);
    }
  };

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
      badge: 'Deduplicated',
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
            onClick={() => applyFilter(activeFilter)}
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
            onClick={() => applyFilter(f.value)}
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
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="form-input py-1 px-2.5 text-xs w-32"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="form-input py-1 px-2.5 text-xs w-32"
          />
          <button
            onClick={applyCustomRange}
            className="px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
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
                          const visitLeadsList = agent.visitLeads || [];
                          const followUpLeadsList = allLeadsList.filter(
                            (l) => l.disposition === 'INTERESTED_FOLLOW_UP' || (l.followUpDate && !l.visitDate)
                          );
                          const otherLeadsList = allLeadsList.filter(
                            (l) =>
                              l.callOutcome === 'NOT_CONNECTED' ||
                              l.disposition === 'NOT_INTERESTED' ||
                              l.disposition === 'BUDGET_MISMATCH' ||
                              l.disposition === 'LOCATION_MISMATCH' ||
                              l.disposition === 'JUNK_BROKER'
                          );

                          const activeSub = agentSubTab[agent.id] || 'all';
                          const displayLeads =
                            activeSub === 'visits'
                              ? visitLeadsList
                              : activeSub === 'followup'
                              ? followUpLeadsList
                              : activeSub === 'other'
                              ? otherLeadsList
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
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'all' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'all'
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        All Leads ({allLeadsList.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'visits' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'visits'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        Site Visits ({visitLeadsList.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'followup' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'followup'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        Follow-Ups ({followUpLeadsList.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAgentSubTab((prev) => ({ ...prev, [agent.id]: 'other' }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                          activeSub === 'other'
                                            ? 'bg-slate-700 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        Other Outcomes ({otherLeadsList.length})
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
                                            <th className="py-2.5 px-3">Call / Visit Status</th>
                                            <th className="py-2.5 px-3">Customer &amp; Mobile</th>
                                            <th className="py-2.5 px-3">Action Date</th>
                                            <th className="py-2.5 px-3">Project &amp; Requirement</th>
                                            <th className="py-2.5 px-3">Budget</th>
                                            <th className="py-2.5 px-3">Agent Remark</th>
                                            <th className="py-2.5 px-3">Last Updated</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {displayLeads.map((vLead) => {
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

                                                {/* Customer Name & Phone */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                  <div className="font-bold text-slate-900">{vLead.name}</div>
                                                  <a
                                                    href={`tel:${vLead.phone}`}
                                                    className="text-[11px] text-indigo-600 hover:underline font-mono"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    {vLead.phone}
                                                  </a>
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
          </table>
        </div>
      </div>
    </div>
  );
}
