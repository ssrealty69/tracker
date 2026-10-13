import { getAllAgents } from './settingsActions';
import { getFormConfigSync } from '@/lib/formConfig';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const agents = await getAllAgents();
  const config = getFormConfigSync();
  return <SettingsClient initialAgents={agents as any} initialConfig={config} />;
}
