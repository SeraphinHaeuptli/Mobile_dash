import Dashboard from '@/components/Dashboard';
import { readConfig } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const config = await readConfig();
  return <Dashboard initial={config} />;
}
