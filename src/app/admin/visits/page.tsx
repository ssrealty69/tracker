import { getVisitsForDate, getAllExecutiveVisitsGrouped } from '@/lib/leadActions';
import { getISTDateString } from '@/lib/utils';
import VisitsClient from './VisitsClient';

export const dynamic = 'force-dynamic';

export default async function VisitsPage() {
  const today = new Date();
  const istDateStr = getISTDateString(today);
  const [visits, portfolio] = await Promise.all([
    getVisitsForDate(istDateStr),
    getAllExecutiveVisitsGrouped(),
  ]);
  return (
    <VisitsClient
      initialVisits={visits}
      initialDate={istDateStr}
      initialPortfolio={portfolio}
    />
  );
}
