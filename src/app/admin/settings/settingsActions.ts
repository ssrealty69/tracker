'use server';

import {
  getAllAgents as fetchAllAgents,
  addAgentToStore,
  updateAgentInStore,
  toggleAgentInStore,
  deleteAgentFromStore,
} from '@/lib/leadActions';
import {
  getFormConfigSync,
  saveFormConfigSync,
  DEFAULT_FORM_CONFIG,
  type FormConfig,
} from '@/lib/formConfig';
import { revalidatePath } from 'next/cache';

// ─── AGENTS SERVER ACTIONS ───────────────────────────────────────────────────
export async function getAllAgents() {
  return await fetchAllAgents();
}

export async function addAgent(name: string, email?: string) {
  return await addAgentToStore(name, email);
}

export async function toggleAgent(agentId: string, isActive: boolean) {
  return await toggleAgentInStore(agentId, isActive);
}

export async function updateAgent(agentId: string, name: string, email?: string) {
  return await updateAgentInStore(agentId, name, email);
}

export async function deleteAgent(agentId: string) {
  return await deleteAgentFromStore(agentId);
}

// ─── FORM CONFIG SERVER ACTIONS ──────────────────────────────────────────────
export async function getFormConfigAction(): Promise<FormConfig> {
  return getFormConfigSync();
}

export async function saveFormConfigAction(config: FormConfig) {
  const updated = await saveFormConfigSync(config);
  revalidatePath('/');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  revalidatePath('/admin/leads');
  revalidatePath('/admin/visits');
  return { success: true, message: 'Form fields updated successfully!', config: updated };
}

export async function addProjectAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Project name is required' };
  const current = getFormConfigSync();
  if (current.projects.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, message: `Project "${trimmed}" already exists.` };
  }
  const updated = await saveFormConfigSync({
    ...current,
    projects: [...current.projects, trimmed],
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Project "${trimmed}" added!`, config: updated };
}

export async function deleteProjectAction(name: string) {
  const current = getFormConfigSync();
  const updated = await saveFormConfigSync({
    ...current,
    projects: current.projects.filter((p) => p !== name),
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Project removed`, config: updated };
}

export async function addConfigAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Configuration name is required' };
  const current = getFormConfigSync();
  if (current.configurations.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, message: `Configuration "${trimmed}" already exists.` };
  }
  const updated = await saveFormConfigSync({
    ...current,
    configurations: [...current.configurations, trimmed],
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Configuration "${trimmed}" added!`, config: updated };
}

export async function deleteConfigAction(name: string) {
  const current = getFormConfigSync();
  const updated = await saveFormConfigSync({
    ...current,
    configurations: current.configurations.filter((c) => c !== name),
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Configuration removed`, config: updated };
}

export async function addBudgetAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Budget bracket is required' };
  const current = getFormConfigSync();
  if (current.budgets.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, message: `Budget bracket "${trimmed}" already exists.` };
  }
  const updated = await saveFormConfigSync({
    ...current,
    budgets: [...current.budgets, trimmed],
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Budget "${trimmed}" added!`, config: updated };
}

export async function deleteBudgetAction(name: string) {
  const current = getFormConfigSync();
  const updated = await saveFormConfigSync({
    ...current,
    budgets: current.budgets.filter((b) => b !== name),
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Budget removed`, config: updated };
}

export async function addReasonAction(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Reason is required' };
  const current = getFormConfigSync();
  if (current.notInterestedReasons.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, message: `Reason already exists.` };
  }
  const updated = await saveFormConfigSync({
    ...current,
    notInterestedReasons: [...current.notInterestedReasons, trimmed],
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Reason added!`, config: updated };
}

export async function deleteReasonAction(name: string) {
  const current = getFormConfigSync();
  const updated = await saveFormConfigSync({
    ...current,
    notInterestedReasons: current.notInterestedReasons.filter((r) => r !== name),
  });
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: `Reason removed`, config: updated };
}

export async function resetFormConfigAction() {
  const updated = await saveFormConfigSync(DEFAULT_FORM_CONFIG);
  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { success: true, message: 'Reset to default form fields', config: updated };
}
