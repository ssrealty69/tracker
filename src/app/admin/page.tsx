import { getDashboardStats } from '@/lib/leadActions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  return <DashboardClient initialStats={stats} />;
}
