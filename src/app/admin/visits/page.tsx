import { getVisitsForDate } from '@/lib/leadActions';
import VisitsClient from './VisitsClient';

export const dynamic = 'force-dynamic';

export default async function VisitsPage() {
  const today = new Date();
  const visits = await getVisitsForDate(today);
  return <VisitsClient initialVisits={visits} initialDate={today.toISOString().split('T')[0]} />;
}
