'use server';

import { prisma } from '@/lib/prisma';
import {
  CallOutcome,
  Disposition,
  NotConnectedReason,
  Requirement,
  Budget,
  VisitStatus,
  type Agent,
  type Lead,
  type ActivityLog,
} from '@prisma/client';
import { revalidatePath } from 'next/cache';

export interface LeadFormData {
  agentId: string;
  phone: string;
  name: string;
  alternatePhone?: string;
  email?: string;
  customerCity?: string;
  leadSource?: string;
  callOutcome: CallOutcome;
  notConnectedReason?: NotConnectedReason;
  disposition?: Disposition;
  projectName?: string;
  microMarket?: string;
  requirement?: Requirement | string;
  budget?: Budget | string;
  purpose?: string;
  possessionTimeline?: string;
  fundingMode?: string;
  leadPriority?: string;
  followUpDate?: string;
  visitDate?: string;
  visitTimeSlot?: string;
  cabRequired?: boolean;
  pickupLocation?: string;
  accompanyingPerson?: string;
  markVisitDone?: boolean;
  remark?: string;
}

export interface LeadFormResult {
  success: boolean;
  message: string;
  isNew?: boolean;
  interactions?: number;
}

// ─── FILE-BACKED PERSISTENT STORE (PERSISTS ACROSS RELOADS & RESTARTS) ───────────
import {
  getCrmStore,
  saveCrmStore,
  type FallbackAgent,
  type FallbackLead,
  type FallbackLog,
} from '@/lib/crmStore';

// ─── FAST DB PROBE (DETECTS CLOUD POSTGRESQL VS OFFLINE LOCALHOST) ─────────
let isDatabaseAvailable = false;
let lastDbCheck = 0;

async function isDbLive(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl || dbUrl.trim() === '') return false;

  const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const isVercel = process.env.VERCEL === '1';

  // If deployed on Vercel and DATABASE_URL is pointing to localhost, DB is offline
  if (isVercel && isLocalhost) {
    return false;
  }

  const now = Date.now();
  if (!isDatabaseAvailable && now - lastDbCheck < 20000) {
    return false;
  }
  lastDbCheck = now;

  try {
    const timeoutMs = isLocalhost ? 600 : 3500;
    const res = await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    isDatabaseAvailable = !!res;
    return isDatabaseAvailable;
  } catch {
    isDatabaseAvailable = false;
    return false;
  }
}

// ─── CHECK IF PHONE EXISTS ───────────────────────────────────────────────────
export async function checkPhoneExists(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  if (cleanPhone.length !== 10) return null;

  if (await isDbLive()) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { phone: cleanPhone },
        include: { assignedAgent: { select: { id: true, name: true } } },
      });

      if (lead) {
        return {
          name: lead.name,
          totalInteractions: lead.totalInteractions,
          disposition: lead.disposition,
          agentId: lead.assignedAgentId,
          agentName: lead.assignedAgent?.name,
          latestRemark: lead.latestRemark,
          budget: lead.budget,
          requirement: lead.requirement,
        };
      }
    } catch {
      // quiet
    }
  }

  // Database offline, check persistent store
  const store = getCrmStore();
  const memLead = store.leads.find((l) => l.phone === cleanPhone);
  if (memLead) {
    const agent = store.agents.find((a) => a.id === memLead.assignedAgentId);
    return {
      name: memLead.name,
      alternatePhone: memLead.alternatePhone,
      email: memLead.email,
      customerCity: memLead.customerCity,
      leadSource: memLead.leadSource,
      totalInteractions: memLead.totalInteractions,
      disposition: memLead.disposition,
      agentId: memLead.assignedAgentId,
      agentName: agent?.name,
      latestRemark: memLead.latestRemark,
      projectName: memLead.projectName,
      microMarket: memLead.microMarket,
      budget: memLead.budget,
      requirement: memLead.requirement,
      leadPriority: memLead.leadPriority,
    };
  }

  return null;
}

function submitLeadToStore(
  data: LeadFormData,
  cleanPhone: string,
  visitStatus: VisitStatus,
  visitDateObj: Date | null
): { isNew: boolean; interactionCount: number } {
  const store = getCrmStore();
  const existingIndex = store.leads.findIndex((l) => l.phone === cleanPhone);
  const assignedAgent = store.agents.find((a) => a.id === data.agentId);

  let isNew = false;
  let interactionCount = 1;
  let leadId = `lead-${Date.now()}`;

  if (existingIndex >= 0) {
    const existing = store.leads[existingIndex];
    leadId = existing.id;
    interactionCount = existing.totalInteractions + 1;

    let finalVisitStatus = visitStatus;
    if (
      data.disposition === Disposition.SITE_VISIT_SCHEDULED &&
      visitDateObj &&
      existing.visitDate &&
      !isSameDay(existing.visitDate, visitDateObj) &&
      existing.visitStatus === VisitStatus.SCHEDULED &&
      !data.markVisitDone
    ) {
      finalVisitStatus = ((VisitStatus as any).RESCHEDULED || VisitStatus.SCHEDULED);
    }

    store.leads[existingIndex] = {
      ...existing,
      name: data.name || existing.name,
      alternatePhone: data.alternatePhone || existing.alternatePhone,
      email: data.email || existing.email,
      customerCity: data.customerCity || existing.customerCity,
      leadSource: data.leadSource || existing.leadSource,
      totalInteractions: interactionCount,
      callOutcome: data.callOutcome,
      notConnectedReason: data.notConnectedReason ?? null,
      disposition: data.disposition ?? existing.disposition,
      projectName: data.projectName || existing.projectName,
      microMarket: data.microMarket || existing.microMarket,
      requirement: data.requirement ?? existing.requirement,
      budget: data.budget ?? existing.budget,
      purpose: data.purpose || existing.purpose,
      possessionTimeline: data.possessionTimeline || existing.possessionTimeline,
      fundingMode: data.fundingMode || existing.fundingMode,
      leadPriority: data.leadPriority || existing.leadPriority,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : existing.followUpDate,
      visitDate: visitDateObj !== null ? visitDateObj : existing.visitDate,
      visitTimeSlot: data.visitTimeSlot || existing.visitTimeSlot,
      cabRequired: data.cabRequired !== undefined ? data.cabRequired : existing.cabRequired,
      pickupLocation: data.pickupLocation || existing.pickupLocation,
      accompanyingPerson: data.accompanyingPerson || existing.accompanyingPerson,
      visitStatus: finalVisitStatus !== VisitStatus.NONE ? finalVisitStatus : existing.visitStatus,
      previousVisitDate: existing.visitDate ?? null,
      latestRemark: data.remark || existing.latestRemark,
      assignedAgentId: data.agentId,
      assignedAgent: assignedAgent ? { id: assignedAgent.id, name: assignedAgent.name } : existing.assignedAgent,
      updatedAt: new Date(),
    };
  } else {
    isNew = true;
    store.leads.unshift({
      id: leadId,
      phone: cleanPhone,
      name: data.name,
      alternatePhone: data.alternatePhone,
      email: data.email,
      customerCity: data.customerCity,
      leadSource: data.leadSource,
      totalInteractions: 1,
      callOutcome: data.callOutcome,
      notConnectedReason: data.notConnectedReason ?? null,
      disposition: data.disposition ?? null,
      projectName: data.projectName,
      microMarket: data.microMarket,
      requirement: data.requirement ?? null,
      budget: data.budget ?? null,
      purpose: data.purpose,
      possessionTimeline: data.possessionTimeline,
      fundingMode: data.fundingMode,
      leadPriority: data.leadPriority,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      visitDate: visitDateObj,
      visitTimeSlot: data.visitTimeSlot,
      cabRequired: data.cabRequired,
      pickupLocation: data.pickupLocation,
      accompanyingPerson: data.accompanyingPerson,
      visitStatus,
      previousVisitDate: null,
      latestRemark: data.remark ?? null,
      assignedAgentId: data.agentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedAgent: assignedAgent ? { id: assignedAgent.id, name: assignedAgent.name } : undefined,
    });
  }

  // Always record audit log in persistent store
  store.logs.unshift({
    id: `log-${Date.now()}`,
    leadId,
    agentId: data.agentId,
    callOutcome: data.callOutcome,
    notConnectedReason: data.notConnectedReason ?? null,
    disposition: data.disposition ?? null,
    requirement: data.requirement ?? null,
    budget: data.budget ?? null,
    visitDate: visitDateObj,
    visitStatus,
    remark: data.remark ?? null,
    interactionNumber: interactionCount,
    createdAt: new Date(),
  });

  saveCrmStore(store);

  return { isNew, interactionCount };
}

// ─── SUBMIT LEAD (UPSERT WITH FULL DEDUPLICATION BUSINESS LOGIC) ─────────────
export async function submitLead(data: LeadFormData): Promise<LeadFormResult> {
  const cleanPhone = data.phone.replace(/\D/g, '').slice(0, 10);

  if (cleanPhone.length !== 10) {
    return { success: false, message: 'Invalid phone number. Must be 10 digits.' };
  }

  if (!data.agentId) {
    return { success: false, message: 'Please select an executive.' };
  }

  // Determine visit status & dates
  let visitStatus: VisitStatus = VisitStatus.NONE;
  let visitDateObj: Date | null = null;

  if (data.callOutcome === CallOutcome.CONNECTED) {
    if (data.disposition === Disposition.SITE_VISIT_SCHEDULED) {
      if (!data.visitDate && !data.markVisitDone) {
        return { success: false, message: 'Please select a site visit date from the calendar.' };
      }
      visitDateObj = data.visitDate ? new Date(data.visitDate) : new Date();
      if (data.markVisitDone) {
        visitStatus = VisitStatus.VISIT_DONE;
      } else {
        visitStatus = VisitStatus.SCHEDULED;
      }
    } else if (data.markVisitDone) {
      visitStatus = VisitStatus.VISIT_DONE;
      visitDateObj = data.visitDate ? new Date(data.visitDate) : new Date();
    }
  }

  const prismaReq = (function mapPrismaRequirement(req?: Requirement | string): Requirement | null {
    if (!req) return null;
    if (req === '2BHK') return Requirement.BHK_2;
    if (req === '3BHK') return Requirement.BHK_3;
    if (req === '4BHK' || req === 'Duplex') return Requirement.INDEPENDENT_FLOOR;
    if (req === 'Plot/Villa') return Requirement.PLOT;
    if (Object.values(Requirement).includes(req as Requirement)) return req as Requirement;
    return null;
  })(data.requirement);

  const prismaBudget = (function mapPrismaBudget(b?: Budget | string): Budget | null {
    if (!b) return null;
    if (b.includes('75 Lakh') || b.includes('Below')) return Budget.L50_75;
    if (b.includes('Crore') || b.includes('Above')) return Budget.L75_PLUS;
    if (Object.values(Budget).includes(b as Budget)) return b as Budget;
    return null;
  })(data.budget);

  let isNew = false;
  let interactionCount = 1;

  if (await isDbLive()) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingLead = await tx.lead.findUnique({
          where: { phone: cleanPhone },
        });

        const previousVisitDate: Date | null = existingLead?.visitDate ?? null;
        let finalVisitStatus = visitStatus;

        if (
          data.disposition === Disposition.SITE_VISIT_SCHEDULED &&
          visitDateObj &&
          existingLead?.visitDate &&
          !isSameDay(existingLead.visitDate, visitDateObj) &&
          existingLead.visitStatus === VisitStatus.SCHEDULED &&
          !data.markVisitDone
        ) {
          finalVisitStatus = ((VisitStatus as any).RESCHEDULED || VisitStatus.SCHEDULED);
        }

        let lead: Lead;
        let isNewLocal = false;
        let interactionCountLocal = 1;

        if (existingLead) {
          interactionCountLocal = existingLead.totalInteractions + 1;
          lead = await tx.lead.update({
            where: { phone: cleanPhone },
            data: {
              name: data.name || existingLead.name,
              totalInteractions: interactionCountLocal,
              callOutcome: data.callOutcome,
              notConnectedReason: data.notConnectedReason ?? null,
              disposition: data.disposition ?? existingLead.disposition,
              requirement: prismaReq ?? existingLead.requirement,
              budget: prismaBudget ?? existingLead.budget,
              visitDate: visitDateObj !== null ? visitDateObj : existingLead.visitDate,
              visitStatus:
                finalVisitStatus !== VisitStatus.NONE ? finalVisitStatus : existingLead.visitStatus,
              previousVisitDate: previousVisitDate,
              latestRemark: data.remark || existingLead.latestRemark,
              assignedAgentId: data.agentId,
            },
          });
        } else {
          isNewLocal = true;
          lead = await tx.lead.create({
            data: {
              phone: cleanPhone,
              name: data.name,
              totalInteractions: 1,
              callOutcome: data.callOutcome,
              notConnectedReason: data.notConnectedReason ?? null,
              disposition: data.disposition ?? null,
              requirement: prismaReq ?? null,
              budget: prismaBudget ?? null,
              visitDate: visitDateObj,
              visitStatus: finalVisitStatus,
              previousVisitDate: null,
              latestRemark: data.remark ?? null,
              assignedAgentId: data.agentId,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            leadId: lead.id,
            agentId: data.agentId,
            callOutcome: data.callOutcome,
            notConnectedReason: data.notConnectedReason ?? null,
            disposition: data.disposition ?? null,
            requirement: (data.requirement as any) ?? null,
            budget: (data.budget as any) ?? null,
            visitDate: visitDateObj,
            visitStatus: finalVisitStatus,
            remark: data.remark ?? null,
            interactionNumber: interactionCountLocal,
          },
        });

        return { isNew: isNewLocal, interactionCount: interactionCountLocal };
      });

      isNew = result.isNew;
      interactionCount = result.interactionCount;
    } catch {
      // quiet fallback
    }
  }

  // Always update persistent store on disk
  const storeRes = submitLeadToStore(data, cleanPhone, visitStatus, visitDateObj);
  isNew = storeRes.isNew;
  interactionCount = storeRes.interactionCount;

  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/admin/visits');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/settings');

  return {
    success: true,
    message: isNew
      ? `✅ New lead created for ${data.name}`
      : `✅ Lead updated (${interactionCount}x interaction)`,
    isNew,
    interactions: interactionCount,
  };
}

// ─── MARK VISIT DONE ──────────────────────────────────────────────────────────
export async function markVisitDone(leadId: string, agentId?: string): Promise<LeadFormResult> {
  try {
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { visitStatus: VisitStatus.VISIT_DONE },
    });

    await prisma.activityLog.create({
      data: {
        leadId,
        agentId: agentId ?? null,
        visitStatus: VisitStatus.VISIT_DONE,
        visitDate: lead.visitDate,
        remark: 'Visit marked as completed',
        interactionNumber: lead.totalInteractions,
      },
    });

    revalidatePath('/admin/visits');
    revalidatePath('/admin');

    return { success: true, message: 'Visit marked as completed.' };
  } catch {
    // Fallback persistent store
    const store = getCrmStore();
    const targetLead = store.leads.find((l) => l.id === leadId);
    if (targetLead) {
      targetLead.visitStatus = VisitStatus.VISIT_DONE;
      targetLead.updatedAt = new Date();
      store.logs.unshift({
        id: `log-${Date.now()}`,
        leadId,
        agentId: agentId ?? null,
        callOutcome: CallOutcome.CONNECTED,
        notConnectedReason: null,
        disposition: Disposition.SITE_VISIT_SCHEDULED,
        requirement: targetLead.requirement,
        budget: targetLead.budget,
        visitDate: targetLead.visitDate,
        visitStatus: VisitStatus.VISIT_DONE,
        remark: 'Visit marked as completed',
        interactionNumber: targetLead.totalInteractions,
        createdAt: new Date(),
      });
      saveCrmStore(store);
      revalidatePath('/admin/visits');
      revalidatePath('/admin');
      revalidatePath('/admin/leads');
      return { success: true, message: 'Visit marked as completed.' };
    }
    return { success: false, message: 'Failed to update visit status.' };
  }
}

// ─── RESCHEDULE VISIT ─────────────────────────────────────────────────────────
export async function rescheduleVisit(
  leadId: string,
  newDate: string,
  agentId?: string
): Promise<LeadFormResult> {
  const newDateObj = new Date(newDate);

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, message: 'Lead not found.' };

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        previousVisitDate: lead.visitDate,
        visitDate: newDateObj,
        visitStatus: VisitStatus.RESCHEDULED,
      },
    });

    await prisma.activityLog.create({
      data: {
        leadId,
        agentId: agentId ?? null,
        visitStatus: VisitStatus.RESCHEDULED,
        visitDate: newDateObj,
        remark: `Visit rescheduled from ${lead.visitDate?.toISOString().split('T')[0] ?? 'unknown'} to ${newDate}`,
        interactionNumber: lead.totalInteractions,
      },
    });

    revalidatePath('/admin/visits');
    revalidatePath('/admin');
    revalidatePath('/admin/leads');

    return { success: true, message: `Visit rescheduled to ${newDate}.` };
  } catch {
    // Fallback persistent store
    const store = getCrmStore();
    const targetLead = store.leads.find((l) => l.id === leadId);
    if (targetLead) {
      targetLead.previousVisitDate = targetLead.visitDate;
      targetLead.visitDate = newDateObj;
      targetLead.visitStatus = VisitStatus.RESCHEDULED;
      targetLead.updatedAt = new Date();

      store.logs.unshift({
        id: `log-${Date.now()}`,
        leadId,
        agentId: agentId ?? null,
        callOutcome: CallOutcome.CONNECTED,
        notConnectedReason: null,
        disposition: Disposition.SITE_VISIT_SCHEDULED,
        requirement: targetLead.requirement,
        budget: targetLead.budget,
        visitDate: newDateObj,
        visitStatus: VisitStatus.RESCHEDULED,
        remark: `Visit rescheduled to ${newDate}`,
        interactionNumber: targetLead.totalInteractions,
        createdAt: new Date(),
      });
      saveCrmStore(store);

      revalidatePath('/admin/visits');
      revalidatePath('/admin');
      revalidatePath('/admin/leads');
      return { success: true, message: `Visit rescheduled to ${newDate}.` };
    }
    return { success: false, message: 'Failed to reschedule visit.' };
  }
}

// ─── GET AGENTS (for form dropdowns) ─────────────────────────────────────────
export async function getActiveAgents() {
  if (await isDbLive()) {
    try {
      const agents = await prisma.agent.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      if (agents && agents.length > 0) return agents;
    } catch {
      // Database offline
    }
  }
  const store = getCrmStore();
  return store.agents.filter((a) => a.isActive !== false);
}

export async function getAllAgents() {
  if (await isDbLive()) {
    try {
      const agents = await prisma.agent.findMany({
        orderBy: { name: 'asc' },
      });
      if (agents && agents.length > 0) return agents;
    } catch {
      // Database offline
    }
  }
  const store = getCrmStore();
  return store.agents;
}

export async function addAgentToStore(name: string, email?: string) {
  const cleanName = name.trim();
  if (!cleanName) return { success: false, message: 'Agent name is required.' };

  let createdAgent: { id: string; name: string; email: string | null; isActive: boolean; createdAt: Date } | null = null;

  if (await isDbLive()) {
    try {
      createdAgent = await prisma.agent.create({
        data: { name: cleanName, email: email?.trim() || null, isActive: true },
      });
    } catch (e) {
      console.error('Prisma agent create fallback:', e);
    }
  }

  if (!createdAgent) {
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    createdAgent = {
      id: `agent-${slug}-${Date.now().toString().slice(-4)}`,
      name: cleanName,
      email: email?.trim() || `${slug}@ssrealty.org`,
      isActive: true,
      createdAt: new Date(),
    };
  }

  const store = getCrmStore();
  const existingIdx = store.agents.findIndex(
    (a) => a.id === createdAgent!.id || a.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (existingIdx >= 0) {
    store.agents[existingIdx] = {
      ...store.agents[existingIdx],
      name: cleanName,
      isActive: true,
      updatedAt: new Date(),
    };
  } else {
    store.agents.push({
      id: createdAgent.id,
      name: cleanName,
      email: createdAgent.email || '',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  saveCrmStore(store);

  revalidatePath('/');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/visits');

  return { success: true, agent: createdAgent };
}

export async function updateAgentInStore(agentId: string, name: string, email?: string) {
  const cleanName = name.trim();
  if (!cleanName) return { success: false, message: 'Agent name is required.' };

  if (await isDbLive()) {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: { name: cleanName, email: email?.trim() || null },
      });
    } catch {}
  }

  const store = getCrmStore();
  const agent = store.agents.find((a) => a.id === agentId);
  if (agent) {
    agent.name = cleanName;
    if (email !== undefined) agent.email = email.trim();
    agent.updatedAt = new Date();
    saveCrmStore(store);
  }

  revalidatePath('/');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/visits');

  return { success: true };
}

export async function toggleAgentInStore(agentId: string, isActive: boolean) {
  if (await isDbLive()) {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: { isActive },
      });
    } catch {}
  }

  const store = getCrmStore();
  const agent = store.agents.find((a) => a.id === agentId);
  if (agent) {
    agent.isActive = isActive;
    agent.updatedAt = new Date();
    saveCrmStore(store);
  }

  revalidatePath('/');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/visits');

  return { success: true };
}

export async function deleteAgentFromStore(agentId: string) {
  if (await isDbLive()) {
    try {
      await prisma.agent.delete({
        where: { id: agentId },
      });
    } catch {}
  }

  const store = getCrmStore();
  store.agents = store.agents.filter((a) => a.id !== agentId);
  saveCrmStore(store);

  revalidatePath('/');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/visits');

  return { success: true };
}

// ─── AGENT STAT ROW TYPE ──────────────────────────────────────────────────────
export interface AgentVisitLead {
  id: string;
  phone: string;
  name: string;
  agentId: string;
  agentName: string;
  projectName: string;
  budget: string | null;
  requirement: string | null;
  visitDate: string | null;
  visitTimeSlot?: string | null;
  visitStatus: string;
  callOutcome?: string;
  disposition?: string | null;
  followUpDate?: string | null;
  updatedAt: string;
  createdAt: string;
  latestRemark: string | null;
  isDropped: boolean;
  isUpcoming: boolean;
  isDone: boolean;
}

export interface AgentStatRow {
  id: string;
  name: string;
  totalLeads: number;
  totalDials: number;
  connectedCalls: number;
  notConnected: number;
  contactRate: number;
  interested: number;
  notInterested: number;
  visitsUpcoming: number;
  visitsDropped: number;
  visitsDone: number;
  visitLeads: AgentVisitLead[];
  allLeads: AgentVisitLead[];
}

export interface DashboardStatsResult {
  totalLeads: number;
  totalCalls: number;
  contactRatio: number;
  pendingVisits: number;
  droppedVisits: number;
  completedVisits: number;
  agentLeaderboard: AgentStatRow[];
}

// ─── GET DASHBOARD STATS ───────────────────────────────────────────────────
export async function getDashboardStats(startDate?: Date, endDate?: Date): Promise<DashboardStatsResult> {
  const dateFilter =
    startDate && endDate
      ? { createdAt: { gte: startDate, lte: endDate } }
      : {};

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (await isDbLive()) {
    try {
      const [totalLeads, totalLogs, completedVisits, agentStats] =
        await Promise.all([
          prisma.lead.count({ where: dateFilter }),
          prisma.activityLog.count({ where: dateFilter }),
          prisma.lead.count({
            where: { ...dateFilter, visitStatus: VisitStatus.VISIT_DONE },
          }),
          prisma.agent.findMany({
            where: { isActive: true },
            include: {
              activityLogs: { where: dateFilter },
              leads: { where: dateFilter },
            },
          }),
        ]);

      let pendingVisits = 0;
      let droppedVisits = 0;

      const agentLeaderboard: AgentStatRow[] = agentStats.map(
        (agent: Agent & { activityLogs: ActivityLog[]; leads: Lead[] }) => {
          const logs = agent.activityLogs;
          const totalDials = logs.length;
          const connectedCalls = logs.filter(
            (l: ActivityLog) => l.callOutcome === CallOutcome.CONNECTED
          ).length;
          const notConnected = logs.filter(
            (l: ActivityLog) => l.callOutcome === CallOutcome.NOT_CONNECTED
          ).length;
          const contactRate =
            totalDials > 0 ? Math.round((connectedCalls / totalDials) * 100) : 0;
          const interested = logs.filter(
            (l: ActivityLog) => l.disposition === Disposition.INTERESTED_FOLLOW_UP
          ).length;
          const notInterested = logs.filter(
            (l: ActivityLog) =>
              l.disposition === Disposition.NOT_INTERESTED ||
              l.disposition === Disposition.BUDGET_MISMATCH ||
              l.disposition === Disposition.LOCATION_MISMATCH ||
              l.disposition === Disposition.JUNK_BROKER
          ).length;

          const uniqueLeadIdsFromLogs = new Set(logs.map((l: ActivityLog) => l.leadId));
          const totalLeads = Math.max(agent.leads.length, uniqueLeadIdsFromLogs.size);

          let visitsUpcoming = 0;
          let visitsDropped = 0;
          let visitsDone = 0;

          const allLeads: AgentVisitLead[] = agent.leads
            .map((l: Lead) => {
              const isDone = l.visitStatus === VisitStatus.VISIT_DONE;
              const isScheduled =
                !isDone &&
                (l.visitStatus === VisitStatus.SCHEDULED ||
                  ((VisitStatus as any).RESCHEDULED && l.visitStatus === (VisitStatus as any).RESCHEDULED) ||
                  l.disposition === Disposition.SITE_VISIT_SCHEDULED);
              let isDropped = false;
              let isUpcoming = false;

              if (isScheduled) {
                const vDate = l.visitDate ? new Date(l.visitDate) : new Date(l.createdAt);
                if (vDate >= todayStart) {
                  isUpcoming = true;
                } else {
                  isDropped = true;
                }
              }

              return {
                id: l.id,
                phone: l.phone,
                name: l.name,
                agentId: agent.id,
                agentName: agent.name,
                projectName: (l as any).projectName || 'Nivasa II',
                budget: (l as any).budget ? String((l as any).budget) : null,
                requirement: (l as any).requirement ? String((l as any).requirement) : null,
                visitDate: l.visitDate ? l.visitDate.toISOString() : (isScheduled ? l.createdAt.toISOString() : null),
                visitTimeSlot: (l as any).visitTimeSlot || null,
                visitStatus: isDone ? VisitStatus.VISIT_DONE : (isScheduled ? VisitStatus.SCHEDULED : l.visitStatus),
                callOutcome: (l as any).callOutcome || '',
                disposition: (l as any).disposition || null,
                followUpDate: (l as any).followUpDate ? new Date((l as any).followUpDate).toISOString() : null,
                updatedAt: l.updatedAt.toISOString(),
                createdAt: l.createdAt.toISOString(),
                latestRemark: l.latestRemark,
                isDropped,
                isUpcoming,
                isDone,
              };
            })
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          const visitLeads: AgentVisitLead[] = allLeads.filter(
            (l) =>
              l.visitDate ||
              l.visitStatus === VisitStatus.SCHEDULED ||
              ((VisitStatus as any).RESCHEDULED && l.visitStatus === (VisitStatus as any).RESCHEDULED) ||
              l.visitStatus === VisitStatus.VISIT_DONE ||
              l.disposition === Disposition.SITE_VISIT_SCHEDULED
          );

          visitLeads.forEach((vl) => {
            if (vl.isUpcoming) visitsUpcoming++;
            if (vl.isDropped) visitsDropped++;
            if (vl.isDone) visitsDone++;
          });

          pendingVisits += visitsUpcoming;
          droppedVisits += visitsDropped;

          return {
            id: agent.id,
            name: agent.name,
            totalLeads,
            totalDials,
            connectedCalls,
            notConnected,
            contactRate,
            interested,
            notInterested,
            visitsUpcoming,
            visitsDropped,
            visitsDone,
            visitLeads,
            allLeads,
          };
        }
      );

      const connectedTotal = await prisma.activityLog.count({
        where: { ...dateFilter, callOutcome: CallOutcome.CONNECTED },
      });
      const contactRatio =
        totalLogs > 0 ? Math.round((connectedTotal / totalLogs) * 100) : 0;

      return {
        totalLeads,
        totalCalls: totalLogs,
        contactRatio,
        pendingVisits,
        droppedVisits,
        completedVisits,
        agentLeaderboard,
      };
    } catch {
      // quiet
    }
  }

  // Fallback persistent store calculation
  const store = getCrmStore();
  let baseLeads = store.leads;
  let baseLogs = store.logs;

  if (startDate && endDate) {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    baseLeads = baseLeads.filter((l) => {
      const t = new Date(l.createdAt).getTime();
      return t >= startMs && t <= endMs;
    });
    baseLogs = baseLogs.filter((lg) => {
      const t = new Date(lg.createdAt).getTime();
      return t >= startMs && t <= endMs;
    });
  }

  const totalLeads = baseLeads.length;
  const totalCalls = baseLogs.length;

  let overallPendingVisits = 0;
  let overallDroppedVisits = 0;
  let overallCompletedVisits = 0;

  const agentLeaderboard: AgentStatRow[] = store.agents.map((agent) => {
    const logs = baseLogs.filter((log) => log.agentId === agent.id);
    const totalDials = logs.length;
    const connectedCalls = logs.filter((l) => l.callOutcome === CallOutcome.CONNECTED).length;
    const notConnected = logs.filter((l) => l.callOutcome === CallOutcome.NOT_CONNECTED).length;
    const contactRate = totalDials > 0 ? Math.round((connectedCalls / totalDials) * 100) : 0;
    const interested = logs.filter((l) => l.disposition === Disposition.INTERESTED_FOLLOW_UP).length;
    const notInterested = logs.filter(
      (l) =>
        l.disposition === Disposition.NOT_INTERESTED ||
        l.disposition === Disposition.BUDGET_MISMATCH ||
        l.disposition === Disposition.LOCATION_MISMATCH ||
        l.disposition === Disposition.JUNK_BROKER
    ).length;

    const agentLeads = baseLeads.filter((l) => l.assignedAgentId === agent.id);
    const uniqueLeadIdsFromLogs = new Set(logs.map((l) => l.leadId));
    const agentTotalLeads = Math.max(agentLeads.length, uniqueLeadIdsFromLogs.size);

    let visitsUpcoming = 0;
    let visitsDropped = 0;
    let visitsDone = 0;

    const allLeads: AgentVisitLead[] = agentLeads
      .map((l) => {
        const isDone = l.visitStatus === VisitStatus.VISIT_DONE;
        const isScheduled =
          !isDone &&
          (l.visitStatus === VisitStatus.SCHEDULED ||
            ((VisitStatus as any).RESCHEDULED && l.visitStatus === (VisitStatus as any).RESCHEDULED) ||
            l.disposition === Disposition.SITE_VISIT_SCHEDULED);
        let isDropped = false;
        let isUpcoming = false;

        if (isScheduled) {
          const vDate = l.visitDate ? new Date(l.visitDate) : new Date(l.createdAt);
          if (vDate >= todayStart) {
            isUpcoming = true;
          } else {
            isDropped = true;
          }
        }

        return {
          id: l.id,
          phone: l.phone,
          name: l.name,
          agentId: agent.id,
          agentName: agent.name,
          projectName: l.projectName || 'Nivasa II',
          budget: l.budget ? String(l.budget) : null,
          requirement: l.requirement ? String(l.requirement) : null,
          visitDate: l.visitDate ? l.visitDate.toISOString() : (isScheduled ? l.createdAt.toISOString() : null),
          visitTimeSlot: l.visitTimeSlot || null,
          visitStatus: isDone ? VisitStatus.VISIT_DONE : (isScheduled ? VisitStatus.SCHEDULED : l.visitStatus),
          callOutcome: l.callOutcome,
          disposition: l.disposition,
          followUpDate: l.followUpDate ? l.followUpDate.toISOString() : null,
          updatedAt: l.updatedAt.toISOString(),
          createdAt: l.createdAt.toISOString(),
          latestRemark: l.latestRemark,
          isDropped,
          isUpcoming,
          isDone,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const visitLeads: AgentVisitLead[] = allLeads.filter(
      (l) =>
        l.visitDate ||
        l.visitStatus === VisitStatus.SCHEDULED ||
        ((VisitStatus as any).RESCHEDULED && l.visitStatus === (VisitStatus as any).RESCHEDULED) ||
        l.visitStatus === VisitStatus.VISIT_DONE ||
        l.disposition === Disposition.SITE_VISIT_SCHEDULED
    );

    visitLeads.forEach((vl) => {
      if (vl.isUpcoming) visitsUpcoming++;
      if (vl.isDropped) visitsDropped++;
      if (vl.isDone) visitsDone++;
    });

    overallPendingVisits += visitsUpcoming;
    overallDroppedVisits += visitsDropped;
    overallCompletedVisits += visitsDone;

    return {
      id: agent.id,
      name: agent.name,
      totalLeads: agentTotalLeads,
      totalDials,
      connectedCalls,
      notConnected,
      contactRate,
      interested,
      notInterested,
      visitsUpcoming,
      visitsDropped,
      visitsDone,
      visitLeads,
      allLeads,
    };
  });

  const connectedTotal = baseLogs.filter((l) => l.callOutcome === CallOutcome.CONNECTED).length;
  const contactRatio = totalCalls > 0 ? Math.round((connectedTotal / totalCalls) * 100) : 0;

  return {
    totalLeads,
    totalCalls,
    contactRatio,
    pendingVisits: overallPendingVisits,
    droppedVisits: overallDroppedVisits,
    completedVisits: overallCompletedVisits,
    agentLeaderboard,
  };
}

// ─── GET VISITS FOR DATE ──────────────────────────────────────────────────────
export async function getVisitsForDate(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  if (await isDbLive()) {
    try {
      return await prisma.lead.findMany({
        where: {
          visitDate: { gte: startOfDay, lte: endOfDay },
          visitStatus: {
            in: [VisitStatus.SCHEDULED, VisitStatus.RESCHEDULED, VisitStatus.VISIT_DONE],
          },
        },
        include: { assignedAgent: { select: { name: true, id: true } } },
        orderBy: { visitDate: 'asc' },
      });
    } catch {
      // quiet
    }
  }

  // Fallback persistent store
  const store = getCrmStore();
  return store.leads
    .filter((l) => {
      if (!l.visitDate) return false;
      const v = new Date(l.visitDate);
      return (
        v >= startOfDay &&
        v <= endOfDay &&
        (l.visitStatus === VisitStatus.SCHEDULED ||
          l.visitStatus === VisitStatus.RESCHEDULED ||
          l.visitStatus === VisitStatus.VISIT_DONE)
      );
    })
    .map((l) => {
      const agent = store.agents.find((a) => a.id === l.assignedAgentId);
      return {
        ...l,
        assignedAgent: agent ? { id: agent.id, name: agent.name } : null,
      };
    })
    .sort((a, b) => (new Date(a.visitDate!).getTime() - new Date(b.visitDate!).getTime()));
}

export interface AdminLeadItem {
  id: string;
  phone: string;
  name: string;
  totalInteractions: number;
  callOutcome: CallOutcome;
  notConnectedReason: NotConnectedReason | null;
  disposition: Disposition | null;
  projectName?: string | null;
  requirement: Requirement | string | null;
  budget: Budget | string | null;
  visitDate: Date | null;
  visitStatus: VisitStatus;
  previousVisitDate: Date | null;
  followUpDate?: Date | null;
  latestRemark: string | null;
  assignedAgentId?: string | null;
  assignedAgent?: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── GET ALL LEADS (for admin grid) ───────────────────────────────────────────
export async function getAllLeads(filters?: {
  agentId?: string;
  disposition?: string;
  visitStatus?: string;
  minInteractions?: number;
  search?: string;
}): Promise<AdminLeadItem[]> {
  const where: Record<string, unknown> = {};

  if (filters?.agentId) where.assignedAgentId = filters.agentId;
  if (filters?.disposition) where.disposition = filters.disposition;
  if (filters?.visitStatus) where.visitStatus = filters.visitStatus;
  if (filters?.minInteractions && filters.minInteractions > 1) {
    where.totalInteractions = { gte: filters.minInteractions };
  }
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
    ];
  }

  if (await isDbLive()) {
    try {
      const dbLeads = await prisma.lead.findMany({
        where,
        include: { assignedAgent: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return dbLeads.map((l) => ({
        ...l,
        projectName: (l as any).projectName || 'Other',
        followUpDate: (l as any).followUpDate || null,
      })) as AdminLeadItem[];
    } catch {
      // quiet
    }
  }

  // Fallback persistent store
  const store = getCrmStore();
  let filtered = [...store.leads];

  if (filters?.agentId) {
    filtered = filtered.filter((l) => l.assignedAgentId === filters.agentId);
  }
  if (filters?.disposition) {
    filtered = filtered.filter((l) => l.disposition === filters.disposition);
  }
  if (filters?.visitStatus) {
    filtered = filtered.filter((l) => l.visitStatus === filters.visitStatus);
  }
  if (filters?.minInteractions && filters.minInteractions > 1) {
    filtered = filtered.filter((l) => l.totalInteractions >= filters.minInteractions!);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (l) => l.name.toLowerCase().includes(q) || l.phone.includes(q)
    );
  }

  return filtered
    .map((l) => {
      const agent = store.agents.find((a) => a.id === l.assignedAgentId);
      return {
        ...l,
        projectName: l.projectName || 'Other',
        followUpDate: l.followUpDate || null,
        assignedAgent: agent ? { name: agent.name } : null,
      };
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) as AdminLeadItem[];
}

// ─── HELPER ───────────────────────────────────────────────────────────────────
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}
