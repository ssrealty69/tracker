import { getAllLeads, getActiveAgents } from '@/lib/leadActions';
import LeadsGridClient from './LeadsGridClient';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const [leads, agents] = await Promise.all([
    getAllLeads(),
    getActiveAgents(),
  ]);
  return <LeadsGridClient initialLeads={leads} agents={agents} />;
}
