'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  SlidersHorizontal,
  Users,
  Building2,
  Layers,
  Wallet,
  HelpCircle,
  UserPlus,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RotateCcw,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import {
  addAgent,
  toggleAgent,
  updateAgent,
  deleteAgent,
  addProjectAction,
  deleteProjectAction,
  addConfigAction,
  deleteConfigAction,
  addBudgetAction,
  deleteBudgetAction,
  addReasonAction,
  deleteReasonAction,
  saveFormConfigAction,
  resetFormConfigAction,
} from './settingsActions';
import type { FormConfig } from '@/lib/formConfig';

interface Agent {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  createdAt: Date;
}

interface Props {
  initialAgents: Agent[];
  initialConfig: FormConfig;
}

export default function SettingsClient({ initialAgents, initialConfig }: Props) {
  const [activeTab, setActiveTab] = useState<'agents' | 'projects' | 'configs' | 'budgets' | 'reasons'>('agents');

  // ─── AGENTS STATE ─────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [addingAgent, setAddingAgent] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentEmail, setEditAgentEmail] = useState('');

  // ─── FORM CONFIG STATE ───────────────────────────────────────────────────
  const [config, setConfig] = useState<FormConfig>(initialConfig);

  // New item inputs
  const [newProject, setNewProject] = useState('');
  const [newConfigItem, setNewConfigItem] = useState('');
  const [newBudgetItem, setNewBudgetItem] = useState('');
  const [newReasonItem, setNewReasonItem] = useState('');

  // Editing items
  const [editingItem, setEditingItem] = useState<{
    type: 'project' | 'config' | 'budget' | 'reason';
    index: number;
    value: string;
  } | null>(null);

  // ─── AGENT ACTIONS ────────────────────────────────────────────────────────
  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAgentName.trim();
    if (!trimmed) return toast.error('Please enter executive name');

    setAddingAgent(true);
    try {
      const res = await addAgent(trimmed, newAgentEmail);
      if (res.success && res.agent) {
        setAgents((prev) => [...prev, res.agent as Agent]);
        setNewAgentName('');
        setNewAgentEmail('');
        toast.success(`Executive "${trimmed}" added! Now live in Calling Form.`);
      } else {
        toast.error((res as { message?: string }).message || 'Failed to add executive');
      }
    } finally {
      setAddingAgent(false);
    }
  };

  const handleToggleAgent = async (agentId: string, currentStatus: boolean) => {
    const res = await toggleAgent(agentId, !currentStatus);
    if (res.success) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, isActive: !currentStatus } : a))
      );
      toast.success(currentStatus ? 'Executive deactivated' : 'Executive activated');
    }
  };

  const startEditAgent = (agent: Agent) => {
    setEditingAgentId(agent.id);
    setEditAgentName(agent.name);
    setEditAgentEmail(agent.email || '');
  };

  const cancelEditAgent = () => {
    setEditingAgentId(null);
    setEditAgentName('');
    setEditAgentEmail('');
  };

  const saveEditAgent = async (agentId: string) => {
    const trimmed = editAgentName.trim();
    if (!trimmed) return toast.error('Name cannot be empty');

    const res = await updateAgent(agentId, trimmed, editAgentEmail);
    if (res.success) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, name: trimmed, email: editAgentEmail || null } : a))
      );
      toast.success('Executive updated successfully!');
      cancelEditAgent();
    }
  };

  const handleDeleteAgent = async (agentId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove executive "${name}"?`)) return;
    const res = await deleteAgent(agentId);
    if (res.success) {
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      toast.success(`Executive "${name}" removed`);
    }
  };

  // ─── PROJECTS ACTIONS ─────────────────────────────────────────────────────
  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newProject.trim();
    if (!val) return toast.error('Please enter project name');
    const res = await addProjectAction(val);
    if (res.success && res.config) {
      setConfig(res.config);
      setNewProject('');
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (config.projects.length <= 1) {
      return toast.error('You must keep at least one project.');
    }
    const res = await deleteProjectAction(name);
    if (res.success && res.config) {
      setConfig(res.config);
      toast.success(`Project "${name}" removed`);
    }
  };

  // ─── CONFIGURATIONS ACTIONS ───────────────────────────────────────────────
  const handleAddConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newConfigItem.trim();
    if (!val) return toast.error('Please enter configuration name');
    const res = await addConfigAction(val);
    if (res.success && res.config) {
      setConfig(res.config);
      setNewConfigItem('');
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteConfig = async (name: string) => {
    if (config.configurations.length <= 1) {
      return toast.error('You must keep at least one configuration.');
    }
    const res = await deleteConfigAction(name);
    if (res.success && res.config) {
      setConfig(res.config);
      toast.success(`Configuration "${name}" removed`);
    }
  };

  // ─── BUDGETS ACTIONS ──────────────────────────────────────────────────────
  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newBudgetItem.trim();
    if (!val) return toast.error('Please enter budget bracket');
    const res = await addBudgetAction(val);
    if (res.success && res.config) {
      setConfig(res.config);
      setNewBudgetItem('');
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteBudget = async (name: string) => {
    if (config.budgets.length <= 1) {
      return toast.error('You must keep at least one budget bracket.');
    }
    const res = await deleteBudgetAction(name);
    if (res.success && res.config) {
      setConfig(res.config);
      toast.success(`Budget "${name}" removed`);
    }
  };

  // ─── NOT INTERESTED REASONS ACTIONS ───────────────────────────────────────
  const handleAddReason = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newReasonItem.trim();
    if (!val) return toast.error('Please enter reason text');
    const res = await addReasonAction(val);
    if (res.success && res.config) {
      setConfig(res.config);
      setNewReasonItem('');
      toast.success(res.message);
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteReason = async (name: string) => {
    if (config.notInterestedReasons.length <= 1) {
      return toast.error('You must keep at least one reason.');
    }
    const res = await deleteReasonAction(name);
    if (res.success && res.config) {
      setConfig(res.config);
      toast.success('Reason removed');
    }
  };

  // ─── INLINE EDIT MODAL/SAVE FOR ANY FIELD ─────────────────────────────────
  const saveInlineEdit = async () => {
    if (!editingItem) return;
    const newVal = editingItem.value.trim();
    if (!newVal) return toast.error('Value cannot be empty');

    let updatedConfig = { ...config };
    if (editingItem.type === 'project') {
      const list = [...config.projects];
      list[editingItem.index] = newVal;
      updatedConfig.projects = list;
    } else if (editingItem.type === 'config') {
      const list = [...config.configurations];
      list[editingItem.index] = newVal;
      updatedConfig.configurations = list;
    } else if (editingItem.type === 'budget') {
      const list = [...config.budgets];
      list[editingItem.index] = newVal;
      updatedConfig.budgets = list;
    } else if (editingItem.type === 'reason') {
      const list = [...config.notInterestedReasons];
      list[editingItem.index] = newVal;
      updatedConfig.notInterestedReasons = list;
    }

    const res = await saveFormConfigAction(updatedConfig);
    if (res.success && res.config) {
      setConfig(res.config);
      setEditingItem(null);
      toast.success('Updated successfully! Live in Calling Form.');
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Are you sure you want to reset all projects, configurations, budgets and reasons to defaults?')) return;
    const res = await resetFormConfigAction();
    if (res.success && res.config) {
      setConfig(res.config);
      toast.success('Reset to defaults successfully!');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Form &amp; Master Settings
                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Sync
                </span>
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Yaha se aap Executive ke naye naam, Projects, Configurations aur Budgets add ya edit kar sakte hain. Save karte hi ye Calling Form me turant live ho jate hain.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="Open Calling Form in new tab"
          >
            <PhoneCall size={13} className="text-emerald-600" />
            <span>Open Calling Form</span>
            <ExternalLink size={12} className="text-slate-400" />
          </Link>
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold transition-all cursor-pointer"
            title="Reset form fields to default"
          >
            <RotateCcw size={12} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'agents'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={14} />
          <span>Executives (Calling Team)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'agents' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {agents.filter(a => a.isActive).length} active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'projects'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 size={14} />
          <span>Projects Master</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'projects' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {config.projects.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('configs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'configs'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>Configurations (2BHK, 3BHK)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'configs' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {config.configurations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('budgets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'budgets'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wallet size={14} />
          <span>Budget Brackets</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'budgets' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {config.budgets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reasons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'reasons'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <HelpCircle size={14} />
          <span>Not Interested Reasons</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${activeTab === 'reasons' ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {config.notInterestedReasons.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: AGENTS MANAGEMENT ───────────────────────────────────────── */}
      {activeTab === 'agents' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Add Agent Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <UserPlus size={16} className="text-indigo-600" />
              Naya Sales Executive Add Karein
            </h2>
            <form onSubmit={handleAddAgent} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Executive Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="form-input text-xs py-2"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. rahul@ssrealty.org"
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  className="form-input text-xs py-2"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={addingAgent}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Plus size={15} />
                  <span>{addingAgent ? 'Adding...' : 'Add Executive (Live Now)'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Agents List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Active Sales Executives List ({agents.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Calling form ke dropdown me wahi executive dikhenge jinka status <strong>Active</strong> hai.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <div key={agent.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  {editingAgentId === agent.id ? (
                    <div className="flex-1 flex flex-wrap gap-2 items-center">
                      <input
                        type="text"
                        value={editAgentName}
                        onChange={(e) => setEditAgentName(e.target.value)}
                        className="form-input text-xs py-1.5 max-w-xs font-bold"
                        placeholder="Executive name"
                      />
                      <input
                        type="email"
                        value={editAgentEmail}
                        onChange={(e) => setEditAgentEmail(e.target.value)}
                        className="form-input text-xs py-1.5 max-w-xs"
                        placeholder="Email"
                      />
                      <button
                        onClick={() => saveEditAgent(agent.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer text-xs font-bold flex items-center gap-1 px-2.5"
                      >
                        <Check size={13} /> Save
                      </button>
                      <button
                        onClick={cancelEditAgent}
                        className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer text-xs font-bold flex items-center gap-1 px-2"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                        {agent.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-sm text-slate-900">{agent.name}</p>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            agent.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {agent.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          {agent.email || `${agent.name.toLowerCase().replace(/\s+/g, '')}@ssrealty.org`}
                        </p>
                      </div>
                    </div>
                  )}

                  {editingAgentId !== agent.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAgent(agent.id, agent.isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          agent.isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {agent.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => startEditAgent(agent)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                        title="Edit executive name"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id, agent.name)}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer transition-colors"
                        title="Delete executive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROJECTS MASTER ─────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-indigo-600" />
              Naya SS Realty Project Add Karein
            </h2>
            <form onSubmit={handleAddProject} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="e.g. Grand Vista, Nirvana II, Amaryllis Tower..."
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="form-input text-xs py-2 font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Add Project (Live in Form)</span>
              </button>
            </form>
          </div>

          {/* Projects Cards Grid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Currently Active SS Realty Projects ({config.projects.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Calling Form ke "SS Realty Project" dropdown me ye sabhi projects live available rahenge.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {config.projects.map((proj, idx) => (
                <div
                  key={proj}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between group hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Building2 size={14} />
                    </div>
                    <span className="font-extrabold text-xs text-slate-800 truncate">{proj}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => setEditingItem({ type: 'project', index: idx, value: proj })}
                      className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer"
                      title="Edit project name"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CONFIGURATIONS ──────────────────────────────────────────── */}
      {activeTab === 'configs' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <Layers size={16} className="text-indigo-600" />
              Nayi Property Configuration Add Karein
            </h2>
            <form onSubmit={handleAddConfig} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="e.g. 1BHK, 5BHK Penthouse, Studio, Commercial Shop..."
                  value={newConfigItem}
                  onChange={(e) => setNewConfigItem(e.target.value)}
                  className="form-input text-xs py-2 font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Add Configuration (Live in Form)</span>
              </button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Active Configurations ({config.configurations.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Calling Form me Property Configuration ke options me ye show honge.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {config.configurations.map((cfg, idx) => (
                <div
                  key={cfg}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between group hover:border-indigo-300 transition-all"
                >
                  <span className="font-extrabold text-xs text-slate-800">{cfg}</span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => setEditingItem({ type: 'config', index: idx, value: cfg })}
                      className="p-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteConfig(cfg)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: BUDGETS ─────────────────────────────────────────────────── */}
      {activeTab === 'budgets' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <Wallet size={16} className="text-indigo-600" />
              Naya Budget Bracket Add Karein
            </h2>
            <form onSubmit={handleAddBudget} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="e.g. ₹50–60 Lakh, ₹3–4 Crore, ₹5 Crore+..."
                  value={newBudgetItem}
                  onChange={(e) => setNewBudgetItem(e.target.value)}
                  className="form-input text-xs py-2 font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Add Budget Bracket</span>
              </button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Active Budget Brackets ({config.budgets.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Calling Form me customer budget select karte waqt ye options show honge.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {config.budgets.map((b, idx) => (
                <div
                  key={b}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between group hover:border-indigo-300 transition-all"
                >
                  <span className="font-extrabold text-xs text-slate-800">{b}</span>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => setEditingItem({ type: 'budget', index: idx, value: b })}
                      className="p-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(b)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: NOT INTERESTED REASONS ───────────────────────────────────── */}
      {activeTab === 'reasons' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <HelpCircle size={16} className="text-indigo-600" />
              Not Interested Ka Naya Reason Add Karein
            </h2>
            <form onSubmit={handleAddReason} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="e.g. Distance too far from hospital / school..."
                  value={newReasonItem}
                  onChange={(e) => setNewReasonItem(e.target.value)}
                  className="form-input text-xs py-2 font-semibold"
                  required
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Plus size={15} />
                <span>Add Reason</span>
              </button>
            </form>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Reasons for Not Interested ({config.notInterestedReasons.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Jab executive call me "Not Interested" select karega, tab ye dropdown me aayenge.
              </p>
            </div>

            <div className="space-y-2">
              {config.notInterestedReasons.map((r, idx) => (
                <div
                  key={r}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between group hover:border-indigo-300 transition-all"
                >
                  <span className="font-semibold text-xs text-slate-800">{r}</span>
                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 shrink-0">
                    <button
                      onClick={() => setEditingItem({ type: 'reason', index: idx, value: r })}
                      className="p-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteReason(r)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INLINE EDIT MODAL ──────────────────────────────────────────────── */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">
                Edit {editingItem.type.toUpperCase()}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Updated Name / Text:
              </label>
              <input
                type="text"
                value={editingItem.value}
                onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
                className="form-input text-xs py-2 font-bold"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveInlineEdit}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white cursor-pointer shadow-xs"
              >
                Save &amp; Update Live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
