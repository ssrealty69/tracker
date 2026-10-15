import { NextRequest, NextResponse } from 'next/server';
import {
  getSiteTask,
  getAllSiteTasks,
  saveMorningTaskPlan,
  saveEveningTaskReport,
} from '@/lib/siteTaskStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateKey = searchParams.get('dateKey');
    const employeeName = searchParams.get('employeeName');
    const projectName = searchParams.get('projectName');

    if (dateKey && employeeName && projectName) {
      const task = await getSiteTask(dateKey, employeeName, projectName);
      return NextResponse.json({ success: true, task });
    }

    const all = await getAllSiteTasks();
    return NextResponse.json({ success: true, tasks: all });
  } catch (err: unknown) {
    console.error('Error in GET /api/attendance/tasks:', err);
    return NextResponse.json({ success: false, message: 'Failed to fetch site tasks' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type, // 'MORNING_PLAN' | 'EVENING_REPORT'
      dateKey,
      formattedDate,
      employeeName,
      projectName,
      tasks,
      tasksDescription,
      morningPhotos,
      completionStatus,
      completionNotes,
      eveningPhotos,
    } = body;

    if (!dateKey || !employeeName || !projectName) {
      return NextResponse.json(
        { success: false, message: 'Date, Employee aur Project zaroori hain.' },
        { status: 400 }
      );
    }

    if (type === 'MORNING_PLAN') {
      if (!morningPhotos || !Array.isArray(morningPhotos) || morningPhotos.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Kripya back camera se kam se kam ek live site photo zaroor lein.' },
          { status: 400 }
        );
      }

      const finalTasks =
        Array.isArray(tasks) && tasks.length > 0
          ? tasks
          : tasksDescription
          ? [String(tasksDescription).trim()]
          : [];

      const updated = await saveMorningTaskPlan({
        dateKey,
        formattedDate: formattedDate || dateKey,
        employeeName,
        projectName,
        tasks: finalTasks,
        tasksDescription: tasksDescription || '',
        morningPhotos,
      });

      return NextResponse.json({
        success: true,
        message: 'Subah ka task plan aur photos safalta-purvak save ho gaye!',
        task: updated,
      });
    }

    if (type === 'EVENING_REPORT') {
      if (!eveningPhotos || !Array.isArray(eveningPhotos) || eveningPhotos.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Kripya shaam ke kaam ki live photo (Back camera) zaroor lein.' },
          { status: 400 }
        );
      }

      const updated = await saveEveningTaskReport({
        dateKey,
        formattedDate: formattedDate || dateKey,
        employeeName,
        projectName,
        completionStatus: completionStatus || 'COMPLETED',
        completionNotes: completionNotes || '',
        eveningPhotos,
      });

      return NextResponse.json({
        success: true,
        message: 'Shaam ki kaam pragati report aur photos record ho gayi!',
        task: updated,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid task submission type' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Error in POST /api/attendance/tasks:', err);
    return NextResponse.json(
      { success: false, message: 'Task save karte waqt error aaya: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
