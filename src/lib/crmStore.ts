import fs from 'fs';
import path from 'path';
import { CallOutcome, NotConnectedReason, Disposition, Requirement, Budget, VisitStatus } from '@prisma/client';

export interface FallbackAgent {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FallbackLead {
  id: string;
  phone: string;
  name: string;
  alternatePhone?: string;
  email?: string;
  customerCity?: string;
  leadSource?: string;
  totalInteractions: number;
  callOutcome: CallOutcome;
  notConnectedReason: NotConnectedReason | null;
  disposition: Disposition | null;
  projectName?: string;
  microMarket?: string;
  requirement: Requirement | string | null;
  budget: Budget | string | null;
  purpose?: string;
  possessionTimeline?: string;
  fundingMode?: string;
  leadPriority?: string;
  followUpDate?: Date | null;
  visitDate: Date | null;
  visitTimeSlot?: string;
  cabRequired?: boolean;
  pickupLocation?: string;
  accompanyingPerson?: string;
  visitStatus: VisitStatus;
  previousVisitDate: Date | null;
  latestRemark: string | null;
  assignedAgentId: string;
  createdAt: Date;
  updatedAt: Date;
  assignedAgent?: { id: string; name: string };
}

export interface FallbackLog {
  id: string;
  leadId: string;
  agentId: string | null;
  callOutcome: CallOutcome;
  notConnectedReason: NotConnectedReason | null;
  disposition: Disposition | null;
  requirement: Requirement | string | null;
  budget: Budget | string | null;
  visitDate: Date | null;
  visitStatus: VisitStatus;
  remark: string | null;
  interactionNumber: number;
  createdAt: Date;
}

export interface CrmStoreData {
  agents: FallbackAgent[];
  leads: FallbackLead[];
  logs: FallbackLog[];
}

const PRIMARY_STORE_PATH = path.join(process.cwd(), 'src', 'lib', 'crmStore.json');
const TMP_STORE_PATH = path.join('/tmp', 'crmStore.json');

function getActiveFilePath(): string {
  try {
    const dir = path.dirname(PRIMARY_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return PRIMARY_STORE_PATH;
  } catch {
    return TMP_STORE_PATH;
  }
}

function getSeedData(): CrmStoreData {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const agents: FallbackAgent[] = [
    { id: 'agent-nihal', name: 'Nihal', email: 'nihal@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
    { id: 'agent-ayaan', name: 'Ayaan', email: 'ayaan@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
    { id: 'agent-nikhil', name: 'Nikhil', email: 'nikhil@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
    { id: 'agent-bhavishya', name: 'Bhavishya', email: 'bhavishya@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
    { id: 'agent-gulshan', name: 'Gulshan', email: 'gulshan@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
    { id: 'agent-vikas', name: 'Vikas', email: 'vikas@ssrealty.org', isActive: true, createdAt: now, updatedAt: now },
  ];

  const leads: FallbackLead[] = [
    {
      id: 'lead-1',
      phone: '9876543210',
      name: 'Rajesh Sharma',
      totalInteractions: 2,
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_3,
      budget: Budget.L50_75,
      projectName: 'Nivasa II',
      visitDate: new Date(`${todayStr}T11:00:00`),
      visitStatus: VisitStatus.SCHEDULED,
      previousVisitDate: null,
      latestRemark: 'Interested in Nivasa II, Gwal Pahari. Scheduled site visit today.',
      assignedAgentId: 'agent-nihal',
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: now,
      assignedAgent: { id: 'agent-nihal', name: 'Nihal' },
    },
    {
      id: 'lead-2',
      phone: '9811223344',
      name: 'Amit Verma',
      totalInteractions: 1,
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.INTERESTED_FOLLOW_UP,
      requirement: Requirement.BHK_3,
      budget: Budget.L75_PLUS,
      projectName: 'The Arch',
      followUpDate: new Date(Date.now() + 86400000),
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      previousVisitDate: null,
      latestRemark: 'Looking for 3BHK in The Arch, Mandi Road. Callback tomorrow.',
      assignedAgentId: 'agent-ayaan',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: now,
      assignedAgent: { id: 'agent-ayaan', name: 'Ayaan' },
    },
    {
      id: 'lead-3',
      phone: '9822334455',
      name: 'Priya Patel',
      totalInteractions: 3,
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.INDEPENDENT_FLOOR,
      budget: Budget.L75_PLUS,
      projectName: 'Velora',
      visitDate: new Date(`${todayStr}T15:30:00`),
      visitStatus: VisitStatus.VISIT_DONE,
      previousVisitDate: null,
      latestRemark: 'Completed site visit for Velora, Chattarpur. Very positive response.',
      assignedAgentId: 'agent-nikhil',
      createdAt: new Date(Date.now() - 86400000 * 5),
      updatedAt: now,
      assignedAgent: { id: 'agent-nikhil', name: 'Nikhil' },
    },
    {
      id: 'lead-4',
      phone: '9833445566',
      name: 'Sunita Gupta',
      totalInteractions: 1,
      callOutcome: CallOutcome.NOT_CONNECTED,
      notConnectedReason: NotConnectedReason.CALL_NOT_PICKED,
      disposition: null,
      projectName: 'Floria',
      followUpDate: new Date(Date.now() + 86400000 * 2),
      requirement: null,
      budget: null,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      previousVisitDate: null,
      latestRemark: 'Ringing, no response. Will re-dial tomorrow.',
      assignedAgentId: 'agent-bhavishya',
      createdAt: now,
      updatedAt: now,
      assignedAgent: { id: 'agent-bhavishya', name: 'Bhavishya' },
    },
    {
      id: 'lead-5',
      phone: '9844556677',
      name: 'Karan Mehra',
      totalInteractions: 2,
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: '3BHK',
      budget: '₹1–1.5 Crore',
      projectName: 'The Arch',
      visitDate: new Date(Date.now() - 86400000 * 2),
      visitStatus: VisitStatus.SCHEDULED,
      previousVisitDate: null,
      latestRemark: 'Customer requested 3BHK visit on weekend with family for flat inspection.',
      assignedAgentId: 'agent-ayaan',
      createdAt: new Date(Date.now() - 86400000 * 3),
      updatedAt: new Date(Date.now() - 86400000 * 2),
      assignedAgent: { id: 'agent-ayaan', name: 'Ayaan' },
    },
    {
      id: 'lead-6',
      phone: '9855667788',
      name: 'Suresh Singhania',
      totalInteractions: 1,
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.NOT_INTERESTED,
      requirement: '2BHK',
      budget: '₹75 Lakh–₹1 Crore',
      projectName: 'Floria',
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      previousVisitDate: null,
      latestRemark: '[Reason: Financial / Budget Constraints] Dropped property purchase plan.',
      assignedAgentId: 'agent-ayaan',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: now,
      assignedAgent: { id: 'agent-ayaan', name: 'Ayaan' },
    },
  ];

  const logs: FallbackLog[] = [
    {
      id: 'log-1',
      leadId: 'lead-1',
      agentId: 'agent-nihal',
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.BHK_3,
      budget: Budget.L50_75,
      visitDate: new Date(`${todayStr}T11:00:00`),
      visitStatus: VisitStatus.SCHEDULED,
      remark: 'Scheduled site visit today.',
      interactionNumber: 1,
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      id: 'log-2',
      leadId: 'lead-2',
      agentId: 'agent-ayaan',
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.INTERESTED_FOLLOW_UP,
      requirement: Requirement.BHK_2,
      budget: Budget.L35_50,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      remark: 'Looking for 2BHK.',
      interactionNumber: 1,
      createdAt: now,
    },
    {
      id: 'log-3',
      leadId: 'lead-3',
      agentId: 'agent-nikhil',
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: Requirement.INDEPENDENT_FLOOR,
      budget: Budget.L75_PLUS,
      visitDate: new Date(`${todayStr}T15:30:00`),
      visitStatus: VisitStatus.VISIT_DONE,
      remark: 'Visit completed.',
      interactionNumber: 3,
      createdAt: now,
    },
    {
      id: 'log-4',
      leadId: 'lead-4',
      agentId: 'agent-bhavishya',
      callOutcome: CallOutcome.NOT_CONNECTED,
      notConnectedReason: NotConnectedReason.CALL_NOT_PICKED,
      disposition: null,
      requirement: null,
      budget: null,
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      remark: 'Call not picked.',
      interactionNumber: 1,
      createdAt: now,
    },
    {
      id: 'log-5',
      leadId: 'lead-5',
      agentId: 'agent-ayaan',
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.SITE_VISIT_SCHEDULED,
      requirement: '3BHK',
      budget: '₹1–1.5 Crore',
      visitDate: new Date(Date.now() - 86400000 * 2),
      visitStatus: VisitStatus.SCHEDULED,
      remark: 'Customer requested 3BHK visit on weekend with family for flat inspection.',
      interactionNumber: 1,
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: 'log-6',
      leadId: 'lead-6',
      agentId: 'agent-ayaan',
      callOutcome: CallOutcome.CONNECTED,
      notConnectedReason: null,
      disposition: Disposition.NOT_INTERESTED,
      requirement: '2BHK',
      budget: '₹75 Lakh–₹1 Crore',
      visitDate: null,
      visitStatus: VisitStatus.NONE,
      remark: '[Reason: Financial / Budget Constraints] Not interested.',
      interactionNumber: 1,
      createdAt: new Date(Date.now() - 86400000),
    },
  ];

  return { agents, leads, logs };
}

function parseJsonWithDates(raw: string): CrmStoreData | null {
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.leads)) return null;

    const leads: FallbackLead[] = data.leads.map((l: any) => ({
      ...l,
      createdAt: new Date(l.createdAt || Date.now()),
      updatedAt: new Date(l.updatedAt || Date.now()),
      visitDate: l.visitDate ? new Date(l.visitDate) : null,
      previousVisitDate: l.previousVisitDate ? new Date(l.previousVisitDate) : null,
      followUpDate: l.followUpDate ? new Date(l.followUpDate) : null,
    }));

    const agents: FallbackAgent[] = (data.agents || []).map((a: any) => ({
      ...a,
      createdAt: new Date(a.createdAt || Date.now()),
      updatedAt: new Date(a.updatedAt || Date.now()),
    }));

    const logs: FallbackLog[] = (data.logs || []).map((lg: any) => ({
      ...lg,
      createdAt: new Date(lg.createdAt || Date.now()),
      visitDate: lg.visitDate ? new Date(lg.visitDate) : null,
    }));

    return { agents, leads, logs };
  } catch {
    return null;
  }
}

// Global runtime memory cache linked to disk
const globalRef = global as unknown as {
  __CRM_PERSISTENT_STORE__?: CrmStoreData;
  __CRM_STORE_MTIME__?: number;
};

export function getCrmStore(): CrmStoreData {
  const primaryPath = PRIMARY_STORE_PATH;
  const tmpPath = TMP_STORE_PATH;
  const targetPath = fs.existsSync(primaryPath) ? primaryPath : fs.existsSync(tmpPath) ? tmpPath : getActiveFilePath();

  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (
        globalRef.__CRM_PERSISTENT_STORE__ &&
        globalRef.__CRM_STORE_MTIME__ === stat.mtimeMs &&
        globalRef.__CRM_PERSISTENT_STORE__.leads.length > 0
      ) {
        return globalRef.__CRM_PERSISTENT_STORE__;
      }

      const content = fs.readFileSync(targetPath, 'utf-8');
      const parsed = parseJsonWithDates(content);
      if (parsed && parsed.leads && parsed.leads.length > 0) {
        globalRef.__CRM_PERSISTENT_STORE__ = parsed;
        globalRef.__CRM_STORE_MTIME__ = stat.mtimeMs;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading crmStore from disk:', err);
  }

  // If memory already has leads, return memory
  if (globalRef.__CRM_PERSISTENT_STORE__ && globalRef.__CRM_PERSISTENT_STORE__.leads.length > 0) {
    return globalRef.__CRM_PERSISTENT_STORE__;
  }

  // Initialize seed and write to disk
  const seed = getSeedData();
  globalRef.__CRM_PERSISTENT_STORE__ = seed;
  saveCrmStore(seed);
  return seed;
}

export function saveCrmStore(store: CrmStoreData): void {
  globalRef.__CRM_PERSISTENT_STORE__ = store;
  const serialized = JSON.stringify(store, null, 2);

  // Attempt write to primary path first
  try {
    const dir = path.dirname(PRIMARY_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PRIMARY_STORE_PATH, serialized, 'utf-8');
    try {
      const stat = fs.statSync(PRIMARY_STORE_PATH);
      globalRef.__CRM_STORE_MTIME__ = stat.mtimeMs;
    } catch {}
    return;
  } catch (err) {
    console.warn('Primary store write failed, falling back to /tmp:', err);
  }

  // Fallback to /tmp (serverless read-only container)
  try {
    fs.writeFileSync(TMP_STORE_PATH, serialized, 'utf-8');
    try {
      const stat = fs.statSync(TMP_STORE_PATH);
      globalRef.__CRM_STORE_MTIME__ = stat.mtimeMs;
    } catch {}
  } catch (tmpErr) {
    console.error('Error saving crmStore to /tmp:', tmpErr);
  }
}
