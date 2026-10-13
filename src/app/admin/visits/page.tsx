import { getVisitsForDate } from '@/lib/leadActions';
import { getISTDateString } from '@/lib/utils';
import VisitsClient from './VisitsClient';

export const dynamic = 'force-dynamic';

export default async function VisitsPage() {
  const today = new Date();
  const visits = await getVisitsForDate(today);
  const istDateStr = getISTDateString(today);
  return <VisitsClient initialVisits={visits} initialDate={istDateStr} />;
}
