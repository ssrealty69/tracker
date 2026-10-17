'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  TableProperties,
  Search,
  Download,
  Filter,
  ChevronDown,
  RefreshCcw,
  Phone,
  User,
  Calendar,
  CalendarCheck,
  Clock,
  ArrowUpDown,
  Building,
  Copy,
  Check,
} from 'lucide-react';
import { getAllLeads, getActiveAgents } from '@/lib/leadActions';
import {
  formatDate,
  formatDateTime,
  DISPOSITION_LABELS,
  NOT_CONNECTED_REASON_LABELS,
  REQUIREMENT_LABELS,
  BUDGET_LABELS,
  VISIT_STATUS_LABELS,
} from '@/lib/utils';

type Lead = Awaited<ReturnType<typeof getAllLeads>>[number];
type Agent = Awaited<ReturnType<typeof getActiveAgents>>[number];

const DISPOSITIONS_OPTIONS = [
  { value: '', label: 'All Dispositions' },
  { value: 'SITE_VISIT_SCHEDULED', label: 'Site Visit Scheduled' },
  { value: 'INTERESTED_FOLLOW_UP', label: 'Interested (Follow-up)' },
  { value: 'BUDGET_MISMATCH', label: 'Budget Mismatch' },
  { value: 'LOCATION_MISMATCH', label: 'Location Mismatch' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'JUNK_BROKER', label: 'Junk / Broker' },
  { value: 'NOT_CONNECTED', label: 'Not Connected' },
];

const VISIT_STATUS_OPTIONS = [
  { value: '', label: 'All Visit Status' },
  { value: 'NONE', label: 'None' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RESCHEDULED', label: 'Rescheduled' },
  { value: 'VISIT_DONE', label: 'Completed' },
];

const INTERACTION_FILTERS = [
  { value: 0, label: 'All Leads' },
  { value: 2, label: '2+ Times Touched' },
  { value: 3, label: '3+ Times Touched' },
  { value: 5, label: '5+ Times Touched' },
];

interface Props {
  initialLeads: Lead[];
  agents: Agent[];
}

export default function LeadsGridClient({ initialLeads, agents }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterDisposition, setFilterDisposition] = useState('');
  const [filterVisitStatus, setFilterVisitStatus] = useState('');
  const [filterInteractions, setFilterInteractions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<'updatedAt' | 'createdAt' | 'totalInteractions' | 'name' | 'agent'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const copyToClipboard = (phone: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanDigits = phone.replace(/\D/g, '') || phone;

    const triggerSuccess = () => {
      setCopiedPhone(phone);
      toast.success(`Copied ${cleanDigits}`, {
        id: 'copy-phone',
        duration: 1800,
        icon: '📋',
      });
      setTimeout(() => {
        setCopiedPhone((curr) => (curr === phone ? null : curr));
      }, 1800);
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanDigits).then(triggerSuccess).catch(() => {
        fallbackCopyText(cleanDigits, triggerSuccess);
      });
    } else {
      fallbackCopyText(cleanDigits, triggerSuccess);
    }
  };

  const fallbackCopyText = (text: string, onSuccess: () => void) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        onSuccess();
      } else {
        toast.error('Unable to copy');
      }
    } catch {
      toast.error('Unable to copy');
    }
  };

  const refreshLeads = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await getAllLeads({
        agentId: filterAgent || undefined,
        disposition: filterDisposition || undefined,
        visitStatus: filterVisitStatus || undefined,
        minInteractions: filterInteractions || undefined,
        search: search || undefined,
      });
      setLeads(data);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [filterAgent, filterDisposition, filterVisitStatus, filterInteractions, search]);

  // Live Auto-Sync every 8 seconds & on tab focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshLeads(true);
      }
    }, 8000);

    const handleFocus = () => {
      refreshLeads(true);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refreshLeads]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.assignedAgent?.name || '').toLowerCase().includes(q) ||
          (l.projectName || '').toLowerCase().includes(q)
      );
    }
    if (filterAgent) result = result.filter((l) => l.assignedAgentId === filterAgent);
    if (filterDisposition) result = result.filter((l) => l.disposition === filterDisposition);
    if (filterVisitStatus) result = result.filter((l) => l.visitStatus === filterVisitStatus);
    if (filterInteractions > 0) result = result.filter((l) => l.totalInteractions >= filterInteractions);

    result = [...result].sort((a, b) => {
      let av: string | number | Date = a[sortField as keyof Lead] as string | number | Date;
      let bv: string | number | Date = b[sortField as keyof Lead] as string | number | Date;
      if (sortField === 'updatedAt') {
        av = new Date(a.updatedAt || a.createdAt).getTime();
        bv = new Date(b.updatedAt || b.createdAt).getTime();
      } else if (sortField === 'createdAt') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else if (sortField === 'agent') {
        av = a.assignedAgent?.name || '';
        bv = b.assignedAgent?.name || '';
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, search, filterAgent, filterDisposition, filterVisitStatus, filterInteractions, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const getSerialNumber = (idx: number) => {
    if (sortDir === 'asc') {
      return idx + 1;
    }
    return filteredLeads.length - idx;
  };

  const exportExcel = () => {
    const headers = [
      'S.No.',
      'Punch Timestamp',
      'Executive',
      'Customer Name',
      'Mobile Number',
      'Touches (Dedup)',
      'Call Outcome / Disposition',
      'Project',
      'Requirement',
      'Budget',
      'Visit Date',
      'Visit Status',
      'Follow-Up Date',
      'Latest Remark / Notes',
    ];
    const rows = filteredLeads.map((l, idx) => [
      getSerialNumber(idx),
      formatDateTime(l.createdAt || l.updatedAt),
      l.assignedAgent?.name || '',
      l.name,
      l.phone,
      `${l.totalInteractions}x`,
      l.callOutcome === 'NOT_CONNECTED'
        ? `Not Connected (${NOT_CONNECTED_REASON_LABELS[l.notConnectedReason || ''] || 'Ringing'})`
        : (DISPOSITION_LABELS[l.disposition || ''] || l.disposition || ''),
      l.projectName || '',
      REQUIREMENT_LABELS[l.requirement || ''] || l.requirement || '',
      BUDGET_LABELS[l.budget || ''] || l.budget || '',
      l.visitDate ? formatDate(l.visitDate) : '',
      VISIT_STATUS_LABELS[l.visitStatus] || l.visitStatus,
      l.followUpDate ? formatDate(l.followUpDate) : '',
      l.latestRemark || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 22 }, // Date & Time
      { wch: 16 }, // Agent
      { wch: 22 }, // Customer Name
      { wch: 16 }, // Phone
      { wch: 10 }, // Interactions
      { wch: 22 }, // Disposition
      { wch: 18 }, // Project
      { wch: 18 }, // Requirement
      { wch: 16 }, // Budget
      { wch: 16 }, // Visit Date
      { wch: 16 }, // Visit Status
      { wch: 16 }, // Follow-up Date
      { wch: 38 }, // Remark
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Report');
    XLSX.writeFile(wb, `SS_Realty_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${filteredLeads.length} leads to Excel (.xlsx) successfully`);
  };

  const dispositionBadge = (
    d: string | null | undefined,
    outcome?: string | null,
    ncReason?: string | null
  ) => {
    if (outcome === 'NOT_CONNECTED') {
      const reasonText = ncReason ? (NOT_CONNECTED_REASON_LABELS[ncReason] || ncReason) : 'Not Connected';
      return (
        <span className="badge badge-amber text-[10px] whitespace-nowrap font-medium" title={reasonText}>
          {reasonText}
        </span>
      );
    }
    if (!d) return <span className="text-slate-400">—</span>;
    const colors: Record<string, string> = {
      INTERESTED_FOLLOW_UP: 'badge-indigo',
      SITE_VISIT_SCHEDULED: 'badge-emerald',
      BUDGET_MISMATCH: 'badge-rose',
      LOCATION_MISMATCH: 'badge-rose',
      NOT_INTERESTED: 'badge-slate',
      JUNK_BROKER: 'badge-slate',
      NOT_CONNECTED: 'badge-amber',
    };
    return (
      <span className={`badge ${colors[d] || 'badge-slate'} text-[10px] whitespace-nowrap font-medium`}>
        {DISPOSITION_LABELS[d] || d}
      </span>
    );
  };

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <TableProperties size={24} className="text-indigo-600" />
            Verified Leads &amp; Deduplication Master Grid
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Showing {filteredLeads.length} leads {filteredLeads.length !== leads.length && `(filtered from ${leads.length} total)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Auto-Sync Live
          </div>
          <button
            onClick={() => refreshLeads(false)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
            title="Refresh Leads"
          >
            <RefreshCcw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="form-input pl-9 py-2 text-xs"
              placeholder="Search by customer name, mobile number, executive, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Agent Filter */}
          <div className="relative min-w-40">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="form-input pl-8 pr-8 py-2 text-xs appearance-none cursor-pointer"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
            >
              <option value="">All Sales Executives</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Disposition Filter */}
          <div className="relative min-w-44">
            <select
              className="form-input pr-8 py-2 text-xs appearance-none cursor-pointer"
              value={filterDisposition}
              onChange={(e) => setFilterDisposition(e.target.value)}
            >
              {DISPOSITIONS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Visit Status Filter */}
          <div className="relative min-w-40">
            <select
              className="form-input pr-8 py-2 text-xs appearance-none cursor-pointer"
              value={filterVisitStatus}
              onChange={(e) => setFilterVisitStatus(e.target.value)}
            >
              {VISIT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Interaction Count Filter */}
          <div className="relative min-w-40">
            <select
              className="form-input pr-8 py-2 text-xs appearance-none cursor-pointer"
              value={filterInteractions}
              onChange={(e) => setFilterInteractions(Number(e.target.value))}
            >
              {INTERACTION_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {/* 0. S.No. */}
                <th className="w-12 text-center whitespace-nowrap font-bold text-slate-700">
                  S.No.
                </th>

                {/* 1. Punch Timestamp */}
                <th>
                  <button
                    onClick={() => handleSort('updatedAt')}
                    className="flex items-center gap-1 font-bold cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    <Clock size={11} className="text-indigo-600" /> Punch Time
                    <ArrowUpDown size={10} />
                  </button>
                </th>

                {/* 2. Executive */}
                <th>
                  <button
                    onClick={() => handleSort('agent')}
                    className="flex items-center gap-1 font-bold cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    <User size={11} /> Executive
                    <ArrowUpDown size={10} />
                  </button>
                </th>

                {/* 3. Customer Name */}
                <th>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 font-bold cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    Customer Name
                    <ArrowUpDown size={10} />
                  </button>
                </th>

                {/* 4. Mobile */}
                <th>
                  <span className="flex items-center gap-1 whitespace-nowrap" title="Click any number to copy instantly">
                    <Phone size={11} /> Mobile
                  </span>
                </th>

                {/* 5. Touches */}
                <th>
                  <button
                    onClick={() => handleSort('totalInteractions')}
                    className="flex items-center gap-1 font-bold cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap"
                  >
                    Touches (Dedup)
                    <ArrowUpDown size={10} />
                  </button>
                </th>

                {/* 6. Disposition */}
                <th className="whitespace-nowrap">Disposition</th>

                {/* 7. Project */}
                <th>
                  <span className="flex items-center gap-1 whitespace-nowrap"><Building size={11} /> Project</span>
                </th>

                {/* 8. Requirement */}
                <th className="whitespace-nowrap">Requirement</th>

                {/* 9. Budget */}
                <th className="whitespace-nowrap">Budget</th>

                {/* 10. Visit Date */}
                <th>
                  <span className="flex items-center gap-1 whitespace-nowrap"><Calendar size={11} /> Visit Date</span>
                </th>

                {/* 11. Visit Status */}
                <th className="whitespace-nowrap">Visit Status</th>

                {/* 12. Follow-Up Date */}
                <th>
                  <span className="flex items-center gap-1 whitespace-nowrap"><CalendarCheck size={11} /> Follow-Up</span>
                </th>

                {/* 13. Latest Remark */}
                <th className="whitespace-nowrap">Latest Remark</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-400">
                    <RefreshCcw size={22} className="animate-spin mx-auto mb-2 text-indigo-600" />
                    Loading leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-500 font-medium">
                    No leads match your active filters
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead, idx) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* 0. S.No. (Reverse counting: oldest is #1, newest is on top) */}
                    <td className="text-center font-bold text-slate-600 text-xs whitespace-nowrap">
                      {getSerialNumber(idx)}
                    </td>

                    {/* 1. Punch Timestamp */}
                    <td>
                      <span className="font-bold text-slate-900 text-xs whitespace-nowrap">
                        {formatDateTime(lead.createdAt || lead.updatedAt)}
                      </span>
                    </td>

                    {/* 2. Executive */}
                    <td>
                      {lead.assignedAgent ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {lead.assignedAgent.name[0]}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">{lead.assignedAgent.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* 3. Customer Name */}
                    <td>
                      <span className="font-bold text-slate-900 text-sm block whitespace-nowrap">{lead.name}</span>
                    </td>

                    {/* 4. Mobile (Click to copy) */}
                    <td>
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(lead.phone, e)}
                        className={`group/copy relative font-mono text-xs font-bold px-2 py-1 -mx-2 rounded-lg transition-all duration-150 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 text-left ${
                          copiedPhone === lead.phone
                            ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300'
                            : 'text-slate-800 hover:text-indigo-600 hover:bg-indigo-50/80'
                        }`}
                        title="Click to copy number"
                      >
                        <span>{lead.phone}</span>
                        {copiedPhone === lead.phone ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-bold text-emerald-700 bg-emerald-200/70 px-1 py-0.2 rounded">
                            <Check size={11} className="text-emerald-700" /> Copied
                          </span>
                        ) : (
                          <Copy
                            size={11}
                            className="text-slate-400 opacity-40 group-hover/copy:opacity-100 group-hover/copy:text-indigo-600 transition-opacity"
                          />
                        )}
                      </button>
                    </td>

                    {/* 5. Touches */}
                    <td>
                      <span className={`badge ${lead.totalInteractions > 2 ? 'badge-rose' : lead.totalInteractions > 1 ? 'badge-amber' : 'badge-slate'} text-[11px] whitespace-nowrap`}>
                        {lead.totalInteractions}× calls
                      </span>
                    </td>

                    {/* 6. Disposition */}
                    <td>{dispositionBadge(lead.disposition, lead.callOutcome, lead.notConnectedReason)}</td>

                    {/* 7. Project */}
                    <td>
                      <span className="text-slate-800 text-xs font-semibold whitespace-nowrap">
                        {lead.projectName || '—'}
                      </span>
                    </td>

                    {/* 8. Requirement */}
                    <td>
                      <span className="text-slate-600 text-xs font-medium whitespace-nowrap">
                        {lead.requirement ? REQUIREMENT_LABELS[lead.requirement] || lead.requirement : '—'}
                      </span>
                    </td>

                    {/* 9. Budget */}
                    <td>
                      <span className="text-slate-600 text-xs font-medium whitespace-nowrap">
                        {lead.budget ? BUDGET_LABELS[lead.budget] || lead.budget : '—'}
                      </span>
                    </td>

                    {/* 10. Visit Date */}
                    <td>
                      <span className="text-slate-800 text-xs whitespace-nowrap font-medium">
                        {formatDate(lead.visitDate)}
                      </span>
                    </td>

                    {/* 11. Visit Status */}
                    <td>
                      <span className={`badge ${
                        lead.visitStatus === 'VISIT_DONE' ? 'badge-emerald' :
                        lead.visitStatus === 'SCHEDULED' ? 'badge-indigo' :
                        lead.visitStatus === 'RESCHEDULED' ? 'badge-amber' :
                        'badge-slate'
                      } text-[10px] whitespace-nowrap`}>
                        {VISIT_STATUS_LABELS[lead.visitStatus] || lead.visitStatus}
                      </span>
                    </td>

                    {/* 12. Follow-Up Date */}
                    <td>
                      <span className="text-slate-700 text-xs whitespace-nowrap font-medium">
                        {formatDate(lead.followUpDate)}
                      </span>
                    </td>

                    {/* 13. Latest Remark */}
                    <td>
                      <span className="text-xs text-slate-600 max-w-[220px] block line-clamp-2" title={lead.latestRemark || ''}>
                        {lead.latestRemark || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLeads.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <p className="text-xs text-slate-500 font-medium">
              Showing <strong>{filteredLeads.length}</strong> of {leads.length} total leads
            </p>
            <button
              onClick={exportExcel}
              className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold hover:text-emerald-800 transition-colors cursor-pointer"
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
