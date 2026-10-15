'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Building2,
  PhoneOff,
  PhoneCall,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Send,
  Calendar,
  CalendarCheck,
  Sparkles,
  Camera,
} from 'lucide-react';
import {
  submitLead,
  checkPhoneExists,
  getActiveAgents,
} from '@/lib/leadActions';
import { getFormConfigAction } from '@/app/admin/settings/settingsActions';
import type { LeadFormData } from '@/lib/leadActions';
import CustomSelect from '@/components/CustomSelect';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
}

// ─── SS REALTY PROJECTS (CLEAN PROJECT NAMES) ─────────────────────────────────
const SS_REALTY_PROJECTS = [
  'Nirvana',
  'Nivasa II',
  'Orchid',
  'Velora',
  'The Arch',
  'Vasundhara',
  'Amaryllis',
  'Floria',
  'Other',
];

const NOT_CONNECTED_REASONS = [
  { value: 'CALL_NOT_PICKED', label: 'Call Not Picked / Ringing' },
  { value: 'SWITCHED_OFF', label: 'Switched Off / Not Reachable' },
  { value: 'BUSY', label: 'Busy / On Another Call' },
  { value: 'WRONG_NUMBER', label: 'Wrong Number' },
  { value: 'DISCONNECTED', label: 'Disconnected / Invalid Number' },
];

// Clean text without icons
const DISPOSITIONS = [
  { value: 'SITE_VISIT_SCHEDULED', label: 'Site Visit Scheduled' },
  { value: 'INTERESTED_FOLLOW_UP', label: 'Interested (Follow-Up / Callback)' },
  { value: 'BUDGET_MISMATCH', label: 'Budget Mismatch' },
  { value: 'LOCATION_MISMATCH', label: 'Location Mismatch' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'JUNK_BROKER', label: 'Junk / Broker / Channel Partner' },
];

// Reasons for Not Interested
const NOT_INTERESTED_REASONS = [
  'Already Purchased / Bought Elsewhere',
  'Dropped Property Buying Plan',
  'Financial / Budget Constraints',
  'Looking in Another City / Region',
  'Project Location / Connectivity Not Liked',
  'Casual Enquiry / Not Serious Buyer',
  'Other Reason',
];

// Configurations
const CONFIGURATIONS = [
  '2BHK',
  '3BHK',
  '4BHK',
  'Duplex',
  'Plot/Villa',
];

// Budgets
const BUDGETS = [
  'Below ₹75 Lakh',
  '₹75 Lakh–₹1 Crore',
  '₹1–1.5 Crore',
  '₹1.5–2 Crore',
  '₹2-2.5 Crore',
  'Above ₹2.5 Crore',
];

const VISIT_TIME_SLOTS = [
  'Morning (10:00 AM – 12:00 PM)',
  'Afternoon (12:00 PM – 03:00 PM)',
  'Evening (03:00 PM – 06:00 PM)',
];

export default function AgentFormPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('');

  // Track the agent the user actively chose before typing phone
  const userChosenAgentIdRef = useRef<string>('');

  // Contact Info
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  // Dynamic Form Field Options (editable via Admin Settings)
  const [projects, setProjects] = useState<string[]>(SS_REALTY_PROJECTS);
  const [configurations, setConfigurations] = useState<string[]>(CONFIGURATIONS);
  const [budgets, setBudgets] = useState<string[]>(BUDGETS);
  const [notInterestedReasons, setNotInterestedReasons] = useState<string[]>(NOT_INTERESTED_REASONS);

  // Project Selection (Starts unselected)
  const [projectName, setProjectName] = useState('');

  // Call Outcome & Disposition (Starts unselected)
  const [callOutcome, setCallOutcome] = useState<'CONNECTED' | 'NOT_CONNECTED' | ''>('');
  const [notConnectedReason, setNotConnectedReason] = useState('');
  const [disposition, setDisposition] = useState('');
  const [notInterestedReason, setNotInterestedReason] = useState('');

  // Preferences (Starts unselected)
  const [requirement, setRequirement] = useState('');
  const [budget, setBudget] = useState('');

  // Site Visit Coordination & Calendar
  const [visitDate, setVisitDate] = useState('');
  const [visitTimeSlot, setVisitTimeSlot] = useState('');
  const [markVisitDone, setMarkVisitDone] = useState(false);
  const [activeDateChip, setActiveDateChip] = useState<'today' | 'tomorrow' | 'saturday' | 'sunday' | null>(null);

  const visitDateInputRef = useRef<HTMLInputElement>(null);
  const callbackInputRef = useRef<HTMLInputElement>(null);

  // Follow-up Date (for callbacks)
  const [followUpDate, setFollowUpDate] = useState('');

  // Remarks
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Smart Deduplication State
  const [phoneChecking, setPhoneChecking] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState<{
    name: string;
    totalInteractions: number;
    disposition?: string | null;
    agentId?: string | null;
    agentName?: string | null;
    latestRemark?: string | null;
    budget?: string | null;
    projectName?: string | null;
  } | null>(null);

  // State to track if lead belongs to someone else
  const [wasAssignedToOtherAgent, setWasAssignedToOtherAgent] = useState<string | null>(null);

  const phoneCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load agents and live form options on start
  useEffect(() => {
    getActiveAgents().then((list) => {
      setAgents(list);
    });
    getFormConfigAction().then((cfg) => {
      if (cfg) {
        if (cfg.projects && cfg.projects.length > 0) {
          setProjects(cfg.projects);
          setProjectName((prev) => (prev && cfg.projects.includes(prev) ? prev : ''));
        }
        if (cfg.configurations && cfg.configurations.length > 0) {
          setConfigurations(cfg.configurations);
          setRequirement((prev) => (prev && cfg.configurations.includes(prev) ? prev : ''));
        }
        if (cfg.budgets && cfg.budgets.length > 0) {
          setBudgets(cfg.budgets);
          setBudget((prev) => (prev && cfg.budgets.includes(prev) ? prev : ''));
        }
        if (cfg.notInterestedReasons && cfg.notInterestedReasons.length > 0) {
          setNotInterestedReasons(cfg.notInterestedReasons);
          setNotInterestedReason((prev) =>
            prev && cfg.notInterestedReasons.includes(prev) ? prev : ''
          );
        }
      }
    });
  }, []);

  const handleAgentChange = (id: string) => {
    setAgentId(id);
    userChosenAgentIdRef.current = id;
    setWasAssignedToOtherAgent(null);
  };

  // Live Phone Deduplication Lookup
  const checkPhone = useCallback(async (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    if (clean.length === 10) {
      setPhoneChecking(true);
      try {
        const info = await checkPhoneExists(clean);
        setPhoneInfo(info);
        if (info) {
          // 1. Auto-fill Customer Name:
          if (info.name) {
            setName(info.name);
          }

          // 2. Auto-fill Project if available:
          if (info.projectName && projects.includes(info.projectName)) {
            setProjectName(info.projectName);
          }

          // 3. Auto-update Calling Executive Name:
          const currentlySelectedAgentId = userChosenAgentIdRef.current || agentId;
          const currentAgentObj = agents.find((a) => a.id === currentlySelectedAgentId);

          if (info.agentId && agents.some((a) => a.id === info.agentId)) {
            const matchedAgent = agents.find((a) => a.id === info.agentId);
            const isDifferent = currentAgentObj && matchedAgent && currentAgentObj.id !== matchedAgent.id;

            if (isDifferent) {
              setWasAssignedToOtherAgent(matchedAgent.name);
            } else {
              setWasAssignedToOtherAgent(null);
            }
            setAgentId(info.agentId);
          } else if (info.agentName) {
            const matchedByName = agents.find(
              (a) => a.name.toLowerCase() === info.agentName?.toLowerCase()
            );
            if (matchedByName) {
              const isDifferent = currentAgentObj && currentAgentObj.id !== matchedByName.id;
              if (isDifferent) {
                setWasAssignedToOtherAgent(matchedByName.name);
              } else {
                setWasAssignedToOtherAgent(null);
              }
              setAgentId(matchedByName.id);
            }
          }
        } else {
          setWasAssignedToOtherAgent(null);
        }
      } catch {
        // silent catch
      } finally {
        setPhoneChecking(false);
      }
    } else {
      setPhoneInfo(null);
      setWasAssignedToOtherAgent(null);
    }
  }, [agentId, agents, projects]);

  // Support pre-filling phone from query params (e.g. /?phone=9811645856)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryPhone = params.get('phone');
      if (queryPhone) {
        const clean = queryPhone.replace(/\D/g, '').slice(0, 10);
        if (clean.length === 10) {
          setPhone(clean);
          checkPhone(clean);
        }
      }
    }
  }, [checkPhone]);

  const handlePhoneChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setPhone(clean);
    if (phoneCheckTimeout.current) clearTimeout(phoneCheckTimeout.current);
    phoneCheckTimeout.current = setTimeout(() => checkPhone(clean), 300);
  };

  // Calendar quick date shortcuts with active visual state
  const handleQuickDateSelect = (chip: 'today' | 'tomorrow') => {
    const daysAhead = chip === 'today' ? 0 : 1;
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    setVisitDate(`${yr}-${mo}-${da}`);
    setActiveDateChip(chip);
  };

  const handleWeekendSelect = (chip: 'saturday' | 'sunday') => {
    const d = new Date();
    const currentDay = d.getDay(); // 0 is Sunday, 6 is Saturday
    let daysToAdd = 0;
    if (chip === 'sunday') {
      daysToAdd = currentDay === 0 ? 7 : 7 - currentDay;
    } else {
      daysToAdd = currentDay === 6 ? 7 : (6 - currentDay + 7) % 7 || 7;
    }
    d.setDate(d.getDate() + daysToAdd);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    setVisitDate(`${yr}-${mo}-${da}`);
    setActiveDateChip(chip);
  };

  // Called when date is picked directly from calendar (unselects all 4 quick chips)
  const handleCalendarDateChange = (val: string) => {
    setVisitDate(val);
    setActiveDateChip(null);
  };

  const resetForm = () => {
    setAgentId('');
    userChosenAgentIdRef.current = '';
    setPhone('');
    setName('');
    setCallOutcome('');
    setNotConnectedReason('');
    setDisposition('');
    setNotInterestedReason('');
    setProjectName('');
    setRequirement('');
    setBudget('');
    setVisitDate('');
    setVisitTimeSlot('');
    setMarkVisitDone(false);
    setActiveDateChip(null);
    setFollowUpDate('');
    setRemark('');
    setPhoneInfo(null);
    setWasAssignedToOtherAgent(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentId) return toast.error('Please select executive name.');
    if (phone.length !== 10) return toast.error('Please enter valid 10-digit mobile number.');
    if (!name.trim()) return toast.error('Customer name is required.');
    if (!projectName) return toast.error('Please select an SS Realty project.');
    if (!callOutcome) return toast.error('Please choose call outcome (Connected or Not Connected).');

    if (callOutcome === 'NOT_CONNECTED') {
      if (!notConnectedReason) return toast.error('Please select reason call not connected.');
    }

    if (callOutcome === 'CONNECTED') {
      if (!disposition) return toast.error('Please select customer disposition.');
      if (disposition === 'NOT_INTERESTED' && !notInterestedReason) {
        return toast.error('Please select reason for not interested.');
      }
      if (disposition === 'SITE_VISIT_SCHEDULED') {
        if (!visitDate && !markVisitDone) {
          return toast.error('Please select site visit date from the calendar.');
        }
      }
    }

    setSubmitting(true);

    try {
      let finalRemark = remark.trim();
      if (callOutcome === 'CONNECTED' && disposition === 'NOT_INTERESTED') {
        finalRemark = finalRemark
          ? `[Reason: ${notInterestedReason}] ${finalRemark}`
          : `[Reason: ${notInterestedReason}]`;
      }

      const payload: LeadFormData = {
        agentId,
        phone,
        name: name.trim(),
        leadSource: 'CALLING_SHEET',
        callOutcome: callOutcome as LeadFormData['callOutcome'],
        notConnectedReason: callOutcome === 'NOT_CONNECTED' ? (notConnectedReason as LeadFormData['notConnectedReason']) : undefined,
        disposition: callOutcome === 'CONNECTED' ? (disposition as LeadFormData['disposition']) : undefined,
        projectName,
        requirement: callOutcome === 'CONNECTED' && disposition !== 'NOT_INTERESTED' && disposition !== 'JUNK_BROKER' ? (requirement || undefined) : undefined,
        budget: callOutcome === 'CONNECTED' && disposition !== 'NOT_INTERESTED' && disposition !== 'JUNK_BROKER' ? (budget || undefined) : undefined,
        visitDate: callOutcome === 'CONNECTED' && disposition === 'SITE_VISIT_SCHEDULED' ? (visitDate || (markVisitDone ? todayStr : undefined)) : undefined,
        visitTimeSlot: callOutcome === 'CONNECTED' && disposition === 'SITE_VISIT_SCHEDULED' ? (visitTimeSlot || undefined) : undefined,
        cabRequired: false,
        pickupLocation: undefined,
        markVisitDone,
        followUpDate: callOutcome === 'CONNECTED' && disposition === 'INTERESTED_FOLLOW_UP' ? followUpDate || undefined : undefined,
        remark: finalRemark || undefined,
      };

      const result = await submitLead(payload);

      if (result.success) {
        toast.success(result.message, { duration: 4500 });
        const curAgent = agentId;
        resetForm();
        setAgentId(curAgent);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Format YYYY-MM-DD -> DD/MM/YY (e.g. 2026-10-14 -> 14/10/26)
  const formatToDDMMYY = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${d}/${m}/${shortYear}`;
  };

  // Format YYYY-MM-DDTHH:mm -> DD/MM/YY HH:mm (e.g. 2026-10-14T15:30 -> 14/10/26 15:30)
  const formatToDDMMYYTime = (dtStr: string) => {
    if (!dtStr) return '';
    const [datePart, timePart] = dtStr.split('T');
    if (!datePart) return dtStr;
    const [y, m, d] = datePart.split('-');
    if (!y || !m || !d) return dtStr;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${d}/${m}/${shortYear} ${timePart || ''}`.trim();
  };

  // Helper to format date nicely
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 selection:bg-indigo-600 selection:text-white">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 shadow-sm">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[16px] tracking-tight text-slate-900">SS REALTY</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Lead Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Domain: ssrealty.org • Calling & Site Visit Desk</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/attendance"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all shadow-2xs"
            >
              <Camera size={13} className="text-emerald-600" />
              Site Attendance
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
            >
              <Lock size={13} className="text-amber-400" />
              Admin Portal
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN FORM (SINGLE COLUMN: EK KE NICHE EK FIELD) ────────────────── */}
      <main className="max-w-xl mx-auto px-4 pt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-4">
          
          <div className="border-b border-slate-100 pb-3">
            <h1 className="text-lg font-extrabold text-slate-900">Sales Calling & Site Visit Entry</h1>
            <p className="text-xs text-slate-500 mt-0.5">Please fill details below. Smart deduplication updates existing records automatically.</p>
          </div>

          {/* 1. EXECUTIVE NAME */}
          <div className="space-y-1.5">
            <label className="form-label">
              <span>Executive Name <span className="text-rose-500">*</span></span>
            </label>
            <CustomSelect
              value={agentId}
              onChange={handleAgentChange}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="-- Select Executive --"
              required
            />
          </div>

          {/* 2. CUSTOMER MOBILE (10-DIGIT PRIMARY KEY — PARTITIONED CLEAN INPUT) */}
          <div className="space-y-1.5">
            <label className="form-label">
              <span>Customer Mobile (10-Digit) <span className="text-rose-500">*</span></span>
              {phoneChecking && <span className="text-[10px] text-indigo-600 font-bold animate-pulse">Checking records...</span>}
            </label>
            
            {/* Flex Group: Zero text overlap! */}
            <div className="flex rounded-xl border border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 overflow-hidden bg-white shadow-2xs">
              <span className="bg-slate-100 text-slate-700 font-bold px-3.5 py-2.5 flex items-center border-r border-slate-300 text-sm select-none shrink-0">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit number (e.g. 9876543210)"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-base font-mono font-bold text-slate-900 outline-none bg-white tracking-wider"
                required
              />
            </div>

            {/* Smart Deduplication Alert (Directly below mobile) */}
            {phoneInfo && (
              <div className="rounded-xl p-3.5 bg-amber-50 border border-amber-300 text-amber-950 mt-2 space-y-1.5 text-xs animate-fade-in-up">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>Existing Lead: {phoneInfo.name} ({phoneInfo.totalInteractions} past call{phoneInfo.totalInteractions === 1 ? '' : 's'})</span>
                </div>

                {/* If lead belongs to another executive, show alert that it was auto-selected */}
                {wasAssignedToOtherAgent && (
                  <div className="p-2 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-900 font-semibold text-[11px] flex items-center gap-1.5">
                    <span>⚠️ Already registered with Executive: <strong>{wasAssignedToOtherAgent}</strong>. Executive Name has been auto-selected.</span>
                  </div>
                )}

                <div className="text-[11px] text-amber-800 flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                  <span><strong>Assigned Executive:</strong> {phoneInfo.agentName || 'Unassigned'}</span>
                  <span><strong>Last Status:</strong> {phoneInfo.disposition || 'Pending'}</span>
                  {phoneInfo.projectName && <span><strong>Project:</strong> {phoneInfo.projectName}</span>}
                </div>

                {phoneInfo.latestRemark && (
                  <p className="italic text-amber-900 text-[11px] pt-1 border-t border-amber-200">
                    &quot;{phoneInfo.latestRemark}&quot;
                  </p>
                )}
                <p className="text-[11px] font-semibold text-amber-700 pt-0.5 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-amber-600" />
                  Submitting will update this profile & log a new call. No duplicates created.
                </p>
              </div>
            )}

            {!phoneInfo && phone.length === 10 && !phoneChecking && (
              <div className="rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold mt-2 animate-fade-in-up">
                <Sparkles size={14} className="text-emerald-600" />
                <span>✨ Fresh Lead: New client will be added to SS Realty pipeline.</span>
              </div>
            )}
          </div>

          {/* 3. CUSTOMER FULL NAME */}
          <div className="space-y-1.5">
            <label className="form-label">
              <span>Customer Full Name <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              placeholder="e.g. Vikramaditya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* 4. SS REALTY PROJECT (CLEAN NAMES: Nivasa II, The Arch, Floria, Nirvana, etc.) */}
          <div className="space-y-1.5">
            <label className="form-label">
              <span>SS Realty Project <span className="text-rose-500">*</span></span>
            </label>
            <CustomSelect
              value={projectName}
              onChange={setProjectName}
              options={projects}
              placeholder="-- Select Project --"
              required
            />
          </div>

          {/* 5. CALL OUTCOME (CONNECTED VS NOT CONNECTED) */}
          <div className="space-y-2 pt-1">
            <label className="form-label">
              <span>Call Outcome <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-slate-400">Did the customer pick up?</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setCallOutcome('CONNECTED')}
                className={`py-3 px-2 sm:px-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex flex-row items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  callOutcome === 'CONNECTED'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <PhoneCall size={17} className="shrink-0" />
                <span className="whitespace-nowrap">Connected</span>
              </button>

              <button
                type="button"
                onClick={() => setCallOutcome('NOT_CONNECTED')}
                className={`py-3 px-2 sm:px-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex flex-row items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  callOutcome === 'NOT_CONNECTED'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <PhoneOff size={17} className="shrink-0" />
                <span className="whitespace-nowrap">Not Connected</span>
              </button>
            </div>
          </div>

          {/* ── IF NOT CONNECTED: REASON DROPDOWN ──────────────────────────── */}
          {callOutcome === 'NOT_CONNECTED' && (
            <div className="space-y-1.5 p-4 rounded-xl bg-rose-50/70 border border-rose-200 animate-fade-in-up">
              <label className="form-label text-rose-900">
                <span>Reason Call Not Connected <span className="text-rose-500">*</span></span>
              </label>
              <CustomSelect
                value={notConnectedReason}
                onChange={setNotConnectedReason}
                options={NOT_CONNECTED_REASONS}
                placeholder="-- Select Not Connected Reason --"
                triggerClassName="border-rose-300 text-rose-950 font-medium"
              />
            </div>
          )}

          {/* ── IF CONNECTED: DISPOSITION & CONDITIONAL PREFERENCES ────────── */}
          {callOutcome === 'CONNECTED' && (
            <div className="space-y-4 pt-1 animate-fade-in-up">

              {/* 6. CUSTOMER DISPOSITION (NO EMOJIS/ICONS) */}
              <div className="space-y-1.5">
                <label className="form-label">
                  <span>Customer Disposition (Call Result) <span className="text-rose-500">*</span></span>
                </label>
                <CustomSelect
                  value={disposition}
                  onChange={setDisposition}
                  options={DISPOSITIONS}
                  placeholder="-- Select Customer Disposition --"
                  triggerClassName="font-bold text-slate-800"
                />
              </div>

              {/* ── IF NOT INTERESTED: REASON FOR NOT INTERESTED (NO CONFIG / BUDGET) ── */}
              {disposition === 'NOT_INTERESTED' && (
                <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 animate-fade-in-up">
                  <label className="form-label text-slate-800 font-bold">
                    <span>Reason for Not Interested <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] text-slate-400">Select customer reason</span>
                  </label>
                  <CustomSelect
                    value={notInterestedReason}
                    onChange={setNotInterestedReason}
                    options={notInterestedReasons}
                    placeholder="-- Select Reason for Not Interested --"
                    triggerClassName="font-semibold text-slate-800"
                  />
                </div>
              )}

              {/* ── IF INTERESTED / SITE VISIT / MISMATCH: CONFIG & BUDGET ── */}
              {disposition && disposition !== 'NOT_INTERESTED' && disposition !== 'JUNK_BROKER' && (
                <>
                  {/* PROPERTY CONFIGURATION */}
                  <div className="space-y-1.5">
                    <label className="form-label">
                      <span>Property Configuration</span>
                    </label>
                    <CustomSelect
                      value={requirement}
                      onChange={setRequirement}
                      options={configurations}
                      placeholder="-- Select Property Configuration --"
                      triggerClassName="font-medium"
                    />
                  </div>

                  {/* BUDGET BRACKET */}
                  <div className="space-y-1.5">
                    <label className="form-label">
                      <span>Budget</span>
                    </label>
                    <CustomSelect
                      value={budget}
                      onChange={setBudget}
                      options={budgets}
                      placeholder="-- Select Budget Range --"
                      triggerClassName="font-medium"
                    />
                  </div>
                </>
              )}

              {/* ── SITE VISIT CALENDAR & COORDINATION (IF SITE VISIT SCHEDULED) ── */}
              {disposition === 'SITE_VISIT_SCHEDULED' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-emerald-50 border-2 border-emerald-400 shadow-xs space-y-3.5 animate-fade-in-up">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">📅</span>
                      <h3 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">Site Visit Calendar & Booking</h3>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      VIP Visit
                    </span>
                  </div>

                  {/* CALENDAR DATE SELECTOR */}
                  <div className="space-y-2">
                    <label className="form-label text-emerald-950 font-bold">
                      <span>Select Site Visit Date <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-emerald-700">Click below to open calendar</span>
                    </label>

                    {/* Quick Date Shortcuts */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect('today')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeDateChip === 'today'
                            ? 'bg-emerald-700 text-white border-2 border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-white text-emerald-950 border border-emerald-300 hover:bg-emerald-50/80 shadow-2xs'
                        }`}
                      >
                        {activeDateChip === 'today' && <span className="text-sm leading-none font-bold">✓</span>}
                        <span>Today</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect('tomorrow')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeDateChip === 'tomorrow'
                            ? 'bg-emerald-700 text-white border-2 border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-white text-emerald-950 border border-emerald-300 hover:bg-emerald-50/80 shadow-2xs'
                        }`}
                      >
                        {activeDateChip === 'tomorrow' && <span className="text-sm leading-none font-bold">✓</span>}
                        <span>Tomorrow</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWeekendSelect('saturday')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeDateChip === 'saturday'
                            ? 'bg-emerald-700 text-white border-2 border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-white text-emerald-950 border border-emerald-300 hover:bg-emerald-50/80 shadow-2xs'
                        }`}
                      >
                        {activeDateChip === 'saturday' && <span className="text-sm leading-none font-bold">✓</span>}
                        <span>This Saturday</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleWeekendSelect('sunday')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeDateChip === 'sunday'
                            ? 'bg-emerald-700 text-white border-2 border-emerald-700 shadow-sm ring-2 ring-emerald-500/30'
                            : 'bg-white text-emerald-950 border border-emerald-300 hover:bg-emerald-50/80 shadow-2xs'
                        }`}
                      >
                        {activeDateChip === 'sunday' && <span className="text-sm leading-none font-bold">✓</span>}
                        <span>This Sunday</span>
                      </button>
                    </div>

                    {/* Custom Date Input displaying dd/mm/yy */}
                    <div className="relative group">
                      <div
                        onClick={() => {
                          try {
                            visitDateInputRef.current?.showPicker?.();
                          } catch {}
                        }}
                        className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-white flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                          visitDate
                            ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/20'
                            : 'border-emerald-300 hover:border-emerald-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Calendar size={18} className="text-emerald-700 shrink-0" />
                          {visitDate ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-extrabold text-emerald-950 font-mono tracking-wider">
                                {formatToDDMMYY(visitDate)}
                              </span>
                              <span className="text-[11px] font-medium text-emerald-700 hidden sm:inline">
                                ({formatFriendlyDate(visitDate)})
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-slate-400 font-mono tracking-wide">
                              dd/mm/yy
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-1 rounded-md transition-all">
                          <span>Open Calendar 📅</span>
                        </div>
                      </div>

                      {/* Native HTML5 date input placed over with full-width webkit picker indicator */}
                      <input
                        ref={visitDateInputRef}
                        type="date"
                        min={todayStr}
                        value={visitDate}
                        onChange={(e) => handleCalendarDateChange(e.target.value)}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        className="date-picker-overlay"
                        aria-label="Select Site Visit Date"
                      />
                    </div>

                    {/* Friendly Display of Selected Date */}
                    {visitDate && (
                      <div className="rounded-xl p-3 bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs animate-fade-in-up">
                        <div className="flex items-center gap-2">
                          <CalendarCheck size={16} className="text-emerald-700 shrink-0" />
                          <span>Confirmed: <strong className="font-extrabold text-emerald-900">{formatFriendlyDate(visitDate)}</strong> ({formatToDDMMYY(visitDate)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVisitDate('');
                            setActiveDateChip(null);
                          }}
                          className="text-[10px] uppercase font-bold text-rose-600 hover:text-rose-800 bg-white/80 hover:bg-white px-2 py-0.5 rounded-md border border-rose-200 transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PREFERRED TIME SLOT */}
                  <div className="space-y-1.5">
                    <label className="form-label text-emerald-950 font-bold">
                      <span>Preferred Time Slot</span>
                    </label>
                    <CustomSelect
                      value={visitTimeSlot}
                      onChange={setVisitTimeSlot}
                      options={VISIT_TIME_SLOTS}
                      placeholder="-- Select Preferred Time Slot --"
                      triggerClassName="border-emerald-300 text-emerald-950 text-xs font-semibold"
                    />
                  </div>

                  {/* ALREADY COMPLETED CHECKBOX */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={markVisitDone}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setMarkVisitDone(checked);
                          if (checked && !visitDate) {
                            setVisitDate(todayStr);
                            setActiveDateChip('today');
                          }
                        }}
                        className="rounded text-emerald-700 w-4 h-4 cursor-pointer"
                      />
                      <span>Mark this visit as ALREADY COMPLETED (Client visited site today)</span>
                    </label>
                  </div>

                </div>
              )}

              {/* ── NEXT CALLBACK (IF INTERESTED FOLLOW-UP) ── */}
              {disposition === 'INTERESTED_FOLLOW_UP' && (
                <div className="space-y-1.5">
                  <label className="form-label">
                    <span>Next Callback Date & Time (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-mono">Format: dd/mm/yy hh:mm</span>
                  </label>

                  <div className="relative group">
                    <div
                      onClick={() => {
                        try {
                          callbackInputRef.current?.showPicker?.();
                        } catch {}
                      }}
                      className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                        followUpDate
                          ? 'border-indigo-400 ring-1 ring-indigo-400/20 bg-indigo-50/20'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-indigo-600 shrink-0" />
                        {followUpDate ? (
                          <span className="text-sm font-bold text-slate-800 font-mono">
                            {formatToDDMMYYTime(followUpDate)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 font-mono">
                            dd/mm/yy --:--
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        Pick Time 📅
                      </span>
                    </div>

                    <input
                      ref={callbackInputRef}
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          (e.currentTarget as any).showPicker?.();
                        } catch {}
                      }}
                      className="date-picker-overlay"
                      aria-label="Pick Next Callback Date & Time"
                    />
                  </div>
                </div>
              )}

            </div>
          )}

          {/* 6. EXECUTIVE NOTES / REMARKS */}
          <div className="space-y-1.5">
            <label className="form-label">
              <span>Executive Notes / Remarks</span>
            </label>
            <textarea
              rows={3}
              placeholder="Record call highlights, client preferences, specific floor/facing questions..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              className="form-input text-sm resize-y"
            />
          </div>

          {/* 7. SUBMIT BUTTON & RESET */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full sm:flex-1 py-3.5 text-base font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving Lead Record...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Save & Log Lead Record</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetForm}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
