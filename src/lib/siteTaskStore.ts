import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

export interface TaskPhoto {
  id: string;
  url: string; // WebP format image
  caption: string;
  timestamp: string;
  timeStr: string;
  cameraFacing: 'environment'; // Back camera verified
}

export interface SiteDailyTaskData {
  id: string;
  dateKey: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "15 Oct 2026"
  employeeName: string;
  projectName: string;

  // Morning Task Planning
  morningSubmittedAt?: string;
  morningTimeStr?: string;
  tasks?: string[]; // e.g. ["Plastering (प्लास्टर)", "POP Work (पीओपी)"]
  tasksDescription?: string;
  morningPhotos: TaskPhoto[];

  // Evening Completion Proof
  eveningSubmittedAt?: string;
  eveningTimeStr?: string;
  completionStatus?: 'COMPLETED' | 'PARTIAL' | 'IN_PROGRESS';
  completionNotes?: string;
  eveningPhotos: TaskPhoto[];
}

const LOCAL_STORE_FILE = path.join(process.cwd(), 'src', 'lib', 'siteTasksStore.json');

// In-memory cache for fast session response
const inMemoryTasks: Map<string, SiteDailyTaskData> = new Map();

function getDiskTasks(): SiteDailyTaskData[] {
  try {
    if (fs.existsSync(LOCAL_STORE_FILE)) {
      const content = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading disk tasks store:', err);
  }
  return [];
}

function saveDiskTasks(tasks: SiteDailyTaskData[]) {
  try {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch {
    // Vercel serverless read-only mode notice
  }
}

export async function getSiteTask(
  dateKey: string,
  employeeName: string,
  projectName: string
): Promise<SiteDailyTaskData | null> {
  const compositeKey = `${dateKey}_${employeeName}_${projectName}`;
  
  // 1. Check in-memory
  if (inMemoryTasks.has(compositeKey)) {
    return inMemoryTasks.get(compositeKey)!;
  }

  // 2. Check PostgreSQL
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SiteDailyTask" WHERE "dateKey" = $1 AND "employeeName" = $2 AND "projectName" = $3 LIMIT 1`,
      dateKey,
      employeeName,
      projectName
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      const parsedTasks = r.tasks ? JSON.parse(r.tasks) : { categories: [], description: '' };
      const parsedMorningPhotos = r.morningPhotos ? JSON.parse(r.morningPhotos) : [];
      const parsedEveningPhotos = r.eveningPhotos ? JSON.parse(r.eveningPhotos) : [];

      const data: SiteDailyTaskData = {
        id: r.id,
        dateKey: r.dateKey,
        formattedDate: r.formattedDate,
        employeeName: r.employeeName,
        projectName: r.projectName,
        morningSubmittedAt: r.morningSubmittedAt ? new Date(r.morningSubmittedAt).toISOString() : undefined,
        morningTimeStr: r.morningTimeStr ?? undefined,
        tasks: parsedTasks.categories || [],
        tasksDescription: parsedTasks.description || '',
        morningPhotos: parsedMorningPhotos,
        eveningSubmittedAt: r.eveningSubmittedAt ? new Date(r.eveningSubmittedAt).toISOString() : undefined,
        eveningTimeStr: r.eveningTimeStr ?? undefined,
        completionStatus: r.completionStatus ?? undefined,
        completionNotes: r.completionNotes ?? '',
        eveningPhotos: parsedEveningPhotos,
      };

      inMemoryTasks.set(compositeKey, data);
      return data;
    }
  } catch (err) {
    console.warn('PostgreSQL getSiteTask notice:', err);
  }

  // 3. Check Disk Store
  const disk = getDiskTasks();
  const match = disk.find(
    (t) => t.dateKey === dateKey && t.employeeName === employeeName && t.projectName === projectName
  );
  if (match) {
    inMemoryTasks.set(compositeKey, match);
    return match;
  }

  return null;
}

export async function getAllSiteTasks(): Promise<SiteDailyTaskData[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SiteDailyTask" ORDER BY "createdAt" DESC LIMIT 500`
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const parsedTasks = r.tasks ? JSON.parse(r.tasks) : { categories: [], description: '' };
        return {
          id: r.id,
          dateKey: r.dateKey,
          formattedDate: r.formattedDate,
          employeeName: r.employeeName,
          projectName: r.projectName,
          morningSubmittedAt: r.morningSubmittedAt ? new Date(r.morningSubmittedAt).toISOString() : undefined,
          morningTimeStr: r.morningTimeStr ?? undefined,
          tasks: parsedTasks.categories || [],
          tasksDescription: parsedTasks.description || '',
          morningPhotos: r.morningPhotos ? JSON.parse(r.morningPhotos) : [],
          eveningSubmittedAt: r.eveningSubmittedAt ? new Date(r.eveningSubmittedAt).toISOString() : undefined,
          eveningTimeStr: r.eveningTimeStr ?? undefined,
          completionStatus: r.completionStatus ?? undefined,
          completionNotes: r.completionNotes ?? '',
          eveningPhotos: r.eveningPhotos ? JSON.parse(r.eveningPhotos) : [],
        };
      });
    }
  } catch (err) {
    console.warn('PostgreSQL getAllSiteTasks notice:', err);
  }

  return getDiskTasks();
}

export async function saveMorningTaskPlan(input: {
  dateKey: string;
  formattedDate: string;
  employeeName: string;
  projectName: string;
  tasks: string[];
  tasksDescription: string;
  morningPhotos: TaskPhoto[];
}): Promise<SiteDailyTaskData> {
  const compositeKey = `${input.dateKey}_${input.employeeName}_${input.projectName}`;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const existing = await getSiteTask(input.dateKey, input.employeeName, input.projectName);
  const id = existing?.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const taskPayload = JSON.stringify({
    categories: input.tasks,
    description: input.tasksDescription,
  });
  const photosPayload = JSON.stringify(input.morningPhotos);

  // 1. Save to PostgreSQL
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteDailyTask" ("id", "dateKey", "formattedDate", "employeeName", "projectName", "morningSubmittedAt", "morningTimeStr", "tasks", "morningPhotos", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT ("dateKey", "employeeName", "projectName")
       DO UPDATE SET
         "morningSubmittedAt" = EXCLUDED."morningSubmittedAt",
         "morningTimeStr" = EXCLUDED."morningTimeStr",
         "tasks" = EXCLUDED."tasks",
         "morningPhotos" = EXCLUDED."morningPhotos",
         "updatedAt" = NOW()`,
      id,
      input.dateKey,
      input.formattedDate,
      input.employeeName,
      input.projectName,
      now,
      timeStr,
      taskPayload,
      photosPayload
    );
  } catch (dbErr) {
    console.error('PostgreSQL saveMorningTaskPlan error:', dbErr);
  }

  const updatedData: SiteDailyTaskData = {
    id,
    dateKey: input.dateKey,
    formattedDate: input.formattedDate,
    employeeName: input.employeeName,
    projectName: input.projectName,
    morningSubmittedAt: now.toISOString(),
    morningTimeStr: timeStr,
    tasks: input.tasks,
    tasksDescription: input.tasksDescription,
    morningPhotos: input.morningPhotos,
    eveningSubmittedAt: existing?.eveningSubmittedAt,
    eveningTimeStr: existing?.eveningTimeStr,
    completionStatus: existing?.completionStatus,
    completionNotes: existing?.completionNotes,
    eveningPhotos: existing?.eveningPhotos || [],
  };

  inMemoryTasks.set(compositeKey, updatedData);

  // Update disk
  const disk = getDiskTasks();
  const idx = disk.findIndex((d) => d.id === id);
  if (idx >= 0) disk[idx] = updatedData;
  else disk.unshift(updatedData);
  saveDiskTasks(disk);

  return updatedData;
}

export async function saveEveningTaskReport(input: {
  dateKey: string;
  formattedDate: string;
  employeeName: string;
  projectName: string;
  completionStatus: 'COMPLETED' | 'PARTIAL' | 'IN_PROGRESS';
  completionNotes: string;
  eveningPhotos: TaskPhoto[];
}): Promise<SiteDailyTaskData> {
  const compositeKey = `${input.dateKey}_${input.employeeName}_${input.projectName}`;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const existing = await getSiteTask(input.dateKey, input.employeeName, input.projectName);
  const id = existing?.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const photosPayload = JSON.stringify(input.eveningPhotos);

  // 1. Save to PostgreSQL
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteDailyTask" ("id", "dateKey", "formattedDate", "employeeName", "projectName", "eveningSubmittedAt", "eveningTimeStr", "completionStatus", "completionNotes", "eveningPhotos", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT ("dateKey", "employeeName", "projectName")
       DO UPDATE SET
         "eveningSubmittedAt" = EXCLUDED."eveningSubmittedAt",
         "eveningTimeStr" = EXCLUDED."eveningTimeStr",
         "completionStatus" = EXCLUDED."completionStatus",
         "completionNotes" = EXCLUDED."completionNotes",
         "eveningPhotos" = EXCLUDED."eveningPhotos",
         "updatedAt" = NOW()`,
      id,
      input.dateKey,
      input.formattedDate,
      input.employeeName,
      input.projectName,
      now,
      timeStr,
      input.completionStatus,
      input.completionNotes,
      photosPayload
    );
  } catch (dbErr) {
    console.error('PostgreSQL saveEveningTaskReport error:', dbErr);
  }

  const updatedData: SiteDailyTaskData = {
    id,
    dateKey: input.dateKey,
    formattedDate: input.formattedDate,
    employeeName: input.employeeName,
    projectName: input.projectName,
    morningSubmittedAt: existing?.morningSubmittedAt,
    morningTimeStr: existing?.morningTimeStr,
    tasks: existing?.tasks || [],
    tasksDescription: existing?.tasksDescription || '',
    morningPhotos: existing?.morningPhotos || [],
    eveningSubmittedAt: now.toISOString(),
    eveningTimeStr: timeStr,
    completionStatus: input.completionStatus,
    completionNotes: input.completionNotes,
    eveningPhotos: input.eveningPhotos,
  };

  inMemoryTasks.set(compositeKey, updatedData);

  // Update disk
  const disk = getDiskTasks();
  const idx = disk.findIndex((d) => d.id === id);
  if (idx >= 0) disk[idx] = updatedData;
  else disk.unshift(updatedData);
  saveDiskTasks(disk);

  return updatedData;
}
