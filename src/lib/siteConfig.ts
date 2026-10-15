import fs from 'fs';
import path from 'path';

export interface SiteStaffMember {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export interface SiteConfigData {
  staff: SiteStaffMember[];
  projects: string[];
}

export const DEFAULT_SITE_CONFIG: SiteConfigData = {
  staff: [
    {
      id: 'staff_1',
      name: 'Ravi Tanwar',
      role: 'Site Supervisor',
      phone: '+91 98110 00001',
      active: true,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'staff_2',
      name: 'Naveen Tanwar',
      role: 'Site Manager',
      phone: '+91 98110 00002',
      active: true,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'staff_3',
      name: 'Harshit',
      role: 'Civil Engineer',
      phone: '+91 98110 00003',
      active: true,
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ],
  projects: [
    'Nivasa II (Site 1)',
    'Nirvana',
    'Orchid',
    'Velora',
    'The Arch',
    'Vasundhara',
    'Amaryllis',
    'Floria',
    'Other / Custom Site',
  ],
};

const SITE_CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'siteConfig.json');

function initSiteConfig(): SiteConfigData {
  try {
    if (fs.existsSync(SITE_CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(SITE_CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        staff: Array.isArray(parsed.staff) && parsed.staff.length ? parsed.staff : [...DEFAULT_SITE_CONFIG.staff],
        projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : [...DEFAULT_SITE_CONFIG.projects],
      };
    }
  } catch (err) {
    console.error('Error reading site config file:', err);
  }
  return {
    staff: [...DEFAULT_SITE_CONFIG.staff],
    projects: [...DEFAULT_SITE_CONFIG.projects],
  };
}

// Global persistent cache across serverless warm requests
const globalSiteStore = ((global as unknown as { __SS_SITE_CONFIG__?: SiteConfigData }).__SS_SITE_CONFIG__ ??= initSiteConfig());

export function getSiteConfigSync(): SiteConfigData {
  return {
    staff: [...globalSiteStore.staff],
    projects: [...globalSiteStore.projects],
  };
}

export function saveSiteConfigSync(newData: SiteConfigData): SiteConfigData {
  globalSiteStore.staff = [...newData.staff];
  globalSiteStore.projects = [...newData.projects];

  try {
    fs.writeFileSync(SITE_CONFIG_FILE_PATH, JSON.stringify(globalSiteStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write siteConfig.json to disk (read-only environment):', err);
  }

  return getSiteConfigSync();
}

// Staff Mutators
export function addSiteStaff(name: string, role?: string, phone?: string): { success: boolean; message: string; staff?: SiteStaffMember } {
  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, message: 'Staff ka naam likhna zaroori hai.' };

  const current = getSiteConfigSync();
  if (current.staff.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
    return { success: false, message: `"${trimmedName}" pehle se hi staff list me maujood hai.` };
  }

  const newStaff: SiteStaffMember = {
    id: `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: trimmedName,
    role: role?.trim() || 'Site Staff',
    phone: phone?.trim() || '',
    active: true,
    createdAt: new Date().toISOString(),
  };

  saveSiteConfigSync({
    ...current,
    staff: [...current.staff, newStaff],
  });

  return { success: true, message: `Staff "${trimmedName}" safalta-purvak add ho gaye!`, staff: newStaff };
}

export function deleteSiteStaff(staffIdOrName: string): { success: boolean; message: string } {
  const current = getSiteConfigSync();
  const exists = current.staff.some((s) => s.id === staffIdOrName || s.name === staffIdOrName);
  if (!exists) return { success: false, message: 'Staff nahi mila.' };

  saveSiteConfigSync({
    ...current,
    staff: current.staff.filter((s) => s.id !== staffIdOrName && s.name !== staffIdOrName),
  });

  return { success: true, message: 'Staff hata diya gaya.' };
}

// Project Mutators
export function addSiteProject(name: string): { success: boolean; message: string; project?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: 'Project / Site ka naam zaroori hai.' };

  const current = getSiteConfigSync();
  if (current.projects.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
    return { success: false, message: `Project "${trimmed}" pehle se maujood hai.` };
  }

  const updatedProjects = [...current.projects];
  // Insert before 'Other / Custom Site' if present
  const otherIdx = updatedProjects.indexOf('Other / Custom Site');
  if (otherIdx !== -1) {
    updatedProjects.splice(otherIdx, 0, trimmed);
  } else {
    updatedProjects.push(trimmed);
  }

  saveSiteConfigSync({
    ...current,
    projects: updatedProjects,
  });

  return { success: true, message: `Project "${trimmed}" safalta-purvak add ho gaya!`, project: trimmed };
}

export function deleteSiteProject(name: string): { success: boolean; message: string } {
  const current = getSiteConfigSync();
  saveSiteConfigSync({
    ...current,
    projects: current.projects.filter((p) => p !== name),
  });

  return { success: true, message: `Project "${name}" hata diya gaya.` };
}
