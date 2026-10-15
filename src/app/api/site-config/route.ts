import { NextResponse } from 'next/server';
import {
  getSiteConfigSync,
  addSiteStaff,
  deleteSiteStaff,
  addSiteProject,
  deleteSiteProject,
} from '@/lib/siteConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getSiteConfigSync();
    return NextResponse.json({
      success: true,
      staff: config.staff,
      projects: config.projects,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Error fetching site config' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'ADD_STAFF') {
      const { name, role, phone } = body;
      const res = addSiteStaff(name, role, phone);
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === 'DELETE_STAFF') {
      const { idOrName } = body;
      const res = deleteSiteStaff(idOrName);
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === 'ADD_PROJECT') {
      const { name } = body;
      const res = addSiteProject(name);
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === 'DELETE_PROJECT') {
      const { name } = body;
      const res = deleteSiteProject(name);
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
