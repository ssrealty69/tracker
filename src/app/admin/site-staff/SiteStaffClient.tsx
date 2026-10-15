'use client';

import { useState, useEffect } from 'react';
import {
  HardHat,
  Users,
  Building2,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Phone,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Briefcase,
  Layers,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import type { SiteStaffMember } from '@/lib/siteConfig';

const ROLE_OPTIONS = [
  'Site Supervisor',
  'Site Manager',
  'Civil Engineer',
  'Site Foreman',
  'Mason / Rajmistri',
  'Electrician',
  'Plumber',
  'General Site Staff',
];

export default function SiteStaffClient() {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'PROJECTS'>('STAFF');

  const [staffList, setStaffList] = useState<SiteStaffMember[]>([]);
  const [projectList, setProjectList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Staff Form States
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState(ROLE_OPTIONS[0]);
  const [customRole, setCustomRole] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');

  // Add Project Form States
  const [projectName, setProjectName] = useState('');
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/site-config', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff || []);
        setProjectList(data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching site config:', err);
      toast.error('Data load nahi ho saka.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Add Staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = staffName.trim();
    if (!finalName) {
      toast.error('Kripya Staff ka naam likhein!');
      return;
    }

    const finalRole = staffRole === 'Other' ? (customRole.trim() || 'Site Staff') : staffRole;
    setIsSubmittingStaff(true);
    const toastId = toast.loading('Staff add ho raha hai...');

    try {
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_STAFF',
          name: finalName,
          role: finalRole,
          phone: staffPhone.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message, { id: toastId });
        setStaffName('');
        setStaffPhone('');
        setCustomRole('');
        fetchData();
      } else {
        toast.error(data.message || 'Staff add nahi ho saka.', { id: toastId });
      }
    } catch {
      toast.error('Network error aaya.', { id: toastId });
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Handle Delete Staff
  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (!confirm(`Kya aap sach me "${name}" ko site staff list se hatana chahte hain?`)) {
      return;
    }

    const toastId = toast.loading('Staff delete ho raha hai...');
    try {
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_STAFF',
          idOrName: staffId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`"${name}" ko hata diya gaya!`, { id: toastId });
        fetchData();
      } else {
        toast.error(data.message || 'Staff delete nahi ho saka.', { id: toastId });
      }
    } catch {
      toast.error('Delete karte waqt error aaya.', { id: toastId });
    }
  };

  // Handle Add Project
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalProj = projectName.trim();
    if (!finalProj) {
      toast.error('Kripya Project / Site ka naam likhein!');
      return;
    }

    setIsSubmittingProject(true);
    const toastId = toast.loading('Project add ho raha hai...');

    try {
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_PROJECT',
          name: finalProj,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message, { id: toastId });
        setProjectName('');
        fetchData();
      } else {
        toast.error(data.message || 'Project add nahi ho saka.', { id: toastId });
      }
    } catch {
      toast.error('Network error aaya.', { id: toastId });
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // Handle Delete Project
  const handleDeleteProject = async (projName: string) => {
    if (projName === 'Other / Custom Site') {
      toast.error('Default custom site option ko delete nahi kiya ja sakta.');
      return;
    }

    if (!confirm(`Kya aap sach me project "${projName}" ko hatana chahte hain?`)) {
      return;
    }

    const toastId = toast.loading('Project delete ho raha hai...');
    try {
      const res = await fetch('/api/site-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_PROJECT',
          name: projName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Project "${projName}" hata diya gaya!`, { id: toastId });
        fetchData();
      } else {
        toast.error(data.message || 'Project delete nahi ho saka.', { id: toastId });
      }
    } catch {
      toast.error('Delete karte waqt error aaya.', { id: toastId });
    }
  };

  // Filtered lists
  const filteredStaff = staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
      (s.role && s.role.toLowerCase().includes(staffSearch.toLowerCase())) ||
      (s.phone && s.phone.includes(staffSearch))
  );

  const filteredProjects = projectList.filter((p) =>
    p.toLowerCase().includes(projectSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Toaster position="top-center" />

      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <HardHat className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Site Staff &amp; Construction Projects
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                Admin Master
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Yahan se aap site par kaam karne wale staff members aur construction projects ko add ya remove kar sakte hain. Ye direct Attendance App me live update hote hain.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/attendance"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
          >
            <span>Punch App Test</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('STAFF')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'STAFF'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>👷 Site Staff Members ({staffList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PROJECTS')}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'PROJECTS'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>🏗️ Construction Projects / Sites ({projectList.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: SITE STAFF MANAGEMENT                                            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'STAFF' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Staff Form Card */}
          <div className="lg:col-span-1">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 sticky top-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-slate-900">Naya Site Staff Add Karein</h3>
              </div>

              <form onSubmit={handleAddStaff} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Staff Ka Poora Naam <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Designation / Role
                  </label>
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="Other">Other / Custom Designation</option>
                  </select>

                  {staffRole === 'Other' && (
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="Role likhein (e.g. Safety Officer)"
                      className="mt-2 w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={staffPhone}
                    onChange={(e) => setStaffPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmittingStaff ? 'Adding...' : 'Add Staff to Attendance System'}</span>
                </button>
              </form>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Jaise hi aap yahan staff add karenge, unka naam Attendance punch page ke dropdown me turant live show hone lagega!
                </p>
              </div>
            </div>
          </div>

          {/* Current Staff List Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>Active Site Staff Members</span>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      Total: {filteredStaff.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ye sabhi workers Attendance Portal aur Site Reports me register hain.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    placeholder="Search staff by name or role..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {filteredStaff.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Koi Staff Member Nahi Mila</p>
                  <p className="text-xs text-slate-400 mt-1">Left side wale form se naya staff add karein.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredStaff.map((staff, idx) => (
                    <div
                      key={staff.id || staff.name}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-50 to-slate-100 border border-slate-200 flex items-center justify-center font-black text-sm text-indigo-700 shrink-0 shadow-2xs">
                          {staff.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-900">{staff.name}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Active
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1 font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                              <Briefcase className="w-3 h-3 text-slate-400" /> {staff.role || 'Site Staff'}
                            </span>
                            {staff.phone && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                <Phone className="w-3 h-3 text-slate-400" /> {staff.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(staff.id, staff.name)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="Delete this staff member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: CONSTRUCTION PROJECTS / SITES MANAGEMENT                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'PROJECTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Project Form Card */}
          <div className="lg:col-span-1">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 sticky top-6">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-black text-sm text-slate-900">Naya Project / Site Add Karein</h3>
              </div>

              <form onSubmit={handleAddProject} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Project / Site Ka Naam <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Green Glen Heights (Site 2)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingProject}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmittingProject ? 'Adding...' : 'Add Project to Tracker'}</span>
                </button>
              </form>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  Yahan add kiya gaya har project Attendance punch form me workers ke liye selection option ban jaata hai.
                </p>
              </div>
            </div>
          </div>

          {/* Current Projects Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>Active Construction Projects &amp; Sites</span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      Total: {filteredProjects.length}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Workers in sites par haajiri aur site task photos submit kar sakte hain.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search site name..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProjects.map((proj) => (
                  <div
                    key={proj}
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-slate-900 truncate" title={proj}>
                        {proj}
                      </span>
                    </div>

                    {proj !== 'Other / Custom Site' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(proj)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title={`Delete ${proj}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
