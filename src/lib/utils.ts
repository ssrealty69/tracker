import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 5) return phone;
  return phone.slice(0, 5) + 'XXXXX';
}

export function getISTDateString(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    return parts;
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '—';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = get('day');
    const month = get('month');
    const year = get('year');
    const hour = get('hour');
    const minute = get('minute');
    const dayPeriod = (get('dayPeriod') || '').toLowerCase();

    return `${day}/${month}/${year}, ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return '—';
  }
}

export function isToday(date: Date | string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

export function isTomorrow(date: Date | string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  );
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

export const DISPOSITION_LABELS: Record<string, string> = {
  INTERESTED_FOLLOW_UP: 'Interested (Follow-up)',
  SITE_VISIT_SCHEDULED: 'Site Visit Scheduled',
  BUDGET_MISMATCH: 'Budget Mismatch',
  LOCATION_MISMATCH: 'Location Mismatch',
  NOT_INTERESTED: 'Not Interested',
  JUNK_BROKER: 'Junk / Broker',
  NOT_CONNECTED: 'Not Connected',
};

export const NOT_CONNECTED_REASON_LABELS: Record<string, string> = {
  CALL_NOT_PICKED: 'Call Not Picked',
  SWITCHED_OFF: 'Switched Off / Not Reachable',
  BUSY: 'Busy',
  WRONG_NUMBER: 'Wrong Number',
  DISCONNECTED: 'Disconnected',
};

export const REQUIREMENT_LABELS: Record<string, string> = {
  BHK_1: '1 BHK',
  BHK_2: '2 BHK',
  BHK_3: '3 BHK',
  INDEPENDENT_FLOOR: 'Independent Floor',
  PLOT: 'Plot',
};

export const BUDGET_LABELS: Record<string, string> = {
  UNDER_25L: 'Under 25L',
  L25_35: '25L - 35L',
  L35_50: '35L - 50L',
  L50_75: '50L - 75L',
  L75_PLUS: '75L+',
};

export const VISIT_STATUS_LABELS: Record<string, string> = {
  NONE: '—',
  SCHEDULED: 'Scheduled',
  RESCHEDULED: 'Rescheduled',
  VISIT_DONE: 'Completed',
};

export const VISIT_STATUS_COLORS: Record<string, string> = {
  NONE: 'text-slate-400',
  SCHEDULED: 'text-blue-400',
  RESCHEDULED: 'text-amber-400',
  VISIT_DONE: 'text-emerald-400',
};
