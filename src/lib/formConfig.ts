import fs from 'fs';
import path from 'path';

export interface FormConfig {
  projects: string[];
  configurations: string[];
  budgets: string[];
  notInterestedReasons: string[];
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  projects: [
    'Nirvana',
    'Nivasa II',
    'Orchid',
    'Velora',
    'The Arch',
    'Vasundhara',
    'Amaryllis',
    'Floria',
    'Other',
  ],
  configurations: [
    '2BHK',
    '3BHK',
    '4BHK',
    'Duplex',
    'Plot/Villa',
  ],
  budgets: [
    'Below ₹75 Lakh',
    '₹75 Lakh–₹1 Crore',
    '₹1–1.5 Crore',
    '₹1.5–2 Crore',
    '₹2-2.5 Crore',
    'Above ₹2.5 Crore',
  ],
  notInterestedReasons: [
    'Already Purchased / Bought Elsewhere',
    'Dropped Property Buying Plan',
    'Financial / Budget Constraints',
    'Looking in Another City / Region',
    'Project Location / Connectivity Not Liked',
    'Casual Enquiry / Not Serious Buyer',
    'Other Reason',
  ],
};

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'formConfig.json');

function initConfig(): FormConfig {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      return {
        projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : [...DEFAULT_FORM_CONFIG.projects],
        configurations: Array.isArray(parsed.configurations) && parsed.configurations.length ? parsed.configurations : [...DEFAULT_FORM_CONFIG.configurations],
        budgets: Array.isArray(parsed.budgets) && parsed.budgets.length ? parsed.budgets : [...DEFAULT_FORM_CONFIG.budgets],
        notInterestedReasons: Array.isArray(parsed.notInterestedReasons) && parsed.notInterestedReasons.length ? parsed.notInterestedReasons : [...DEFAULT_FORM_CONFIG.notInterestedReasons],
      };
    }
  } catch (err) {
    console.error('Error reading form config file:', err);
  }
  return {
    projects: [...DEFAULT_FORM_CONFIG.projects],
    configurations: [...DEFAULT_FORM_CONFIG.configurations],
    budgets: [...DEFAULT_FORM_CONFIG.budgets],
    notInterestedReasons: [...DEFAULT_FORM_CONFIG.notInterestedReasons],
  };
}

// Global persistent cache in Node process
const globalConfigStore = ((global as unknown as { __SS_FORM_CONFIG__?: FormConfig }).__SS_FORM_CONFIG__ ??= initConfig());

export function getFormConfigSync(): FormConfig {
  return {
    projects: [...globalConfigStore.projects],
    configurations: [...globalConfigStore.configurations],
    budgets: [...globalConfigStore.budgets],
    notInterestedReasons: [...globalConfigStore.notInterestedReasons],
  };
}

export async function saveFormConfigSync(newConfig: FormConfig): Promise<FormConfig> {
  globalConfigStore.projects = [...newConfig.projects];
  globalConfigStore.configurations = [...newConfig.configurations];
  globalConfigStore.budgets = [...newConfig.budgets];
  globalConfigStore.notInterestedReasons = [...newConfig.notInterestedReasons];

  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(globalConfigStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing form config file:', err);
  }

  return getFormConfigSync();
}
