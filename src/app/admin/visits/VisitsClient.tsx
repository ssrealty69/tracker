'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { getVisitsForDate, markVisitDone, rescheduleVisit } from '@/lib/leadActions';
import {
  maskPhone,
  formatDate,
  REQUIREMENT_LABELS,
  BUDGET_LABELS,
  VISIT_STATUS_LABELS,
} from '@/lib/utils';

type Visit = Awaited<ReturnType<typeof getVisitsForDate>>[number];

const KNOWN_EXECUTIVES = ['Ayaan', 'Bhavishya', 'Gulshan', 'Nihal', 'Nikhil', 'Vikas'];

function getLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

function nextSundayStr(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  return getLocalDateString(d);
}

function friendlyDateLabel(dateStr: string): string {
  const todayStr = getLocalDateString(new Date());
  const tomorrowStr = addDays(todayStr, 1);
  if (dateStr === todayStr) return "Today's Scheduled Visits";
  if (dateStr === tomorrowStr) return "Tomorrow's Scheduled Visits";
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

interface Props {
  initialVisits: Visit[];
  initialDate: string;
}

export default function VisitsClient({ initialVisits, initialDate }: Props) {
  const todayStr = getLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [loading, setLoading] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('ALL');

  const allExecutiveNames = useMemo(() => {
    const set = new Set<string>(KNOWN_EXECUTIVES);
    visits.forEach((v) => {
      if (v.assignedAgent?.name) set.add(v.assignedAgent.name);
    });
    return Array.from(set).sort();
  }, [visits]);

  const filteredVisits = useMemo(() => {
    if (selectedExecutive === 'ALL') return visits;
    return visits.filter((v) => (v.assignedAgent?.name || 'Unassigned') === selectedExecutive);
  }, [visits, selectedExecutive]);

  const loadDate = async (dateStr: string) => {
    setSelectedDate(dateStr);
    setLoading(true);
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const data = await getVisitsForDate(d);
      setVisits(data);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (visitId: string) => {
    const result = await markVisitDone(visitId);
    if (result.success) {
      toast.success('Visit marked as completed!');
      await loadDate(selectedDate);
    } else {
      toast.error(result.message);
    }
  };

  const handleReschedule = async (visitId: string) => {
    if (!newDate) return toast.error('Select a new visit date');
    const result = await rescheduleVisit(visitId, newDate);
    if (result.success) {
      toast.success(result.message);
      setRescheduleId(null);
      setNewDate('');
      await loadDate(selectedDate);
    } else {
      toast.error(result.message);
    }
  };

  const exportToExcel = () => {
    if (filteredVisits.length === 0) {
      toast.error('No visits to export for this selection');
      return;
    }

    const headers = [
      'Status',
      'Executive',
      'Customer Name',
      'Mobile Number',
      'Scheduled Visit Date',
      'Project',
      'Configuration',
      'Budget',
      'Agent Notes / Remark',
    ];

    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = filteredVisits.map((v) => {
      const statusText =
        v.visitStatus === 'VISIT_DONE'
          ? 'Completed'
          : v.visitStatus === 'RESCHEDULED'
          ? 'Rescheduled'
          : 'Scheduled';
      const execName = v.assignedAgent?.name || 'Unassigned';
      const custName = v.name;
      const phone = v.phone;
      const visitDate = formatDate(v.visitDate);
      const project = ((v as any).projectName as string) || '';
      const config = v.requirement ? (REQUIREMENT_LABELS[v.requirement] || String(v.requirement)) : '';
      const budget = v.budget ? (BUDGET_LABELS[v.budget] || String(v.budget)) : '';
      const remark = v.latestRemark || '';

      return [
        escapeCsv(statusText),
        escapeCsv(execName),
        escapeCsv(custName),
        escapeCsv(phone),
        escapeCsv(visitDate),
        escapeCsv(project),
        escapeCsv(config),
        escapeCsv(budget),
        escapeCsv(remark),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileNameSuffix = selectedExecutive === 'ALL' ? 'All_Executives' : selectedExecutive.replace(/\s+/g, '_');
    link.setAttribute('download', `Site_Visits_${fileNameSuffix}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(
      `Excel report downloaded for ${selectedExecutive === 'ALL' ? 'All Executives' : selectedExecutive}!`
    );
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <MapPin size={24} className="text-indigo-600" />
            Site Visit Operations Center
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Coordinate, track and confirm client on-ground site visits</p>
        </div>
      </div>

      {/* Date Navigation & Controls Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Quick Date Pills & Date Picker */}
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
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => loadDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 border-0 focus:ring-0 p-1 w-32 cursor-pointer"
            />
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

        {/* Right side: Executive Filter + Excel Report Download */}
        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          {/* Executive Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Filter size={13} className="text-indigo-600 shrink-0" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">Executive:</span>
            <select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-900 border-0 focus:ring-0 cursor-pointer pr-4"
            >
              <option value="ALL">All Executives ({visits.length})</option>
              {allExecutiveNames.map((name) => {
                const count = visits.filter((v) => (v.assignedAgent?.name || 'Unassigned') === name).length;
                return (
                  <option key={name} value={name}>
                    {name} {count > 0 ? `(${count})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Excel Report Download Button */}
          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0"
            title={`Download Excel report for ${selectedExecutive === 'ALL' ? 'all executives' : selectedExecutive}`}
          >
            <FileSpreadsheet size={15} className="text-white shrink-0" />
            <span>
              {selectedExecutive === 'ALL' ? 'Download Excel Report' : `Export ${selectedExecutive}'s Report`}
            </span>
          </button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900">{friendlyDateLabel(selectedDate)}</h2>
            {selectedExecutive !== 'ALL' && (
              <span className="text-[11px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                Filtered: {selectedExecutive}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
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

      {/* Visits Table (Row Layout matching Overview Dashboard) */}
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
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 text-[10.5px] uppercase font-bold text-slate-600 border-b border-slate-200">
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
              {filteredVisits.map((visit) => {
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
                    {/* Status Badge */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {statusBadge(visit.visitStatus)}
                    </td>

                    {/* Assigned Executive (BEFORE Customer & Mobile) */}
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

                    {/* Customer & Mobile (Full unmasked phone number) */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{visit.name}</div>
                      <a
                        href={`tel:${visit.phone}`}
                        className="text-[11px] text-indigo-600 hover:underline font-mono font-bold"
                      >
                        {visit.phone}
                      </a>
                    </td>

                    {/* Scheduled Visit Date */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-700 text-xs">
                      {formatDate(visit.visitDate)}
                    </td>

                    {/* Project & Config */}
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

                    {/* Budget */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-medium text-slate-700">
                      {visit.budget ? (BUDGET_LABELS[visit.budget] || String(visit.budget)) : '—'}
                    </td>

                    {/* Agent Notes / Remark (Capped to max 2 lines) */}
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

                    {/* Action */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-center">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 border border-emerald-200 text-xs font-bold">
                          <CheckCircle2 size={13} className="text-emerald-600" /> Completed
                        </span>
                      ) : rescheduleId === visit.id ? (
                        <div className="flex items-center justify-center gap-1.5 animate-fade-in-up">
                          <input
                            type="date"
                            value={newDate}
                            min={todayStr}
                            onChange={(e) => setNewDate(e.target.value)}
                            className="form-input text-xs py-1 px-2 w-32"
                          />
                          <button
                            type="button"
                            onClick={() => handleReschedule(visit.id)}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-all cursor-pointer shadow-2xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRescheduleId(null); setNewDate(''); }}
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
                            onClick={() => { setRescheduleId(visit.id); setNewDate(''); }}
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
  );
}
