import Link from 'next/link';
import { Button, Card, CardHeader } from '@rift/ui';
import { ScreenHeader, Screen } from '@/components/shell/ScreenHeader';
import { SitesTable } from '@/components/SitesTable';
import { listSites } from '@/lib/api/endpoints';

export const metadata = { title: 'Sites' };

export default async function SitesPage() {
  const sites = await listSites();
  return (
    <>
      <ScreenHeader
        title="Sites"
        actions={<Link href="/dashboard/sites/new"><Button variant="filled" icon="plus">Add website</Button></Link>}
      />
      <Screen>
        <Card>
          <div className="border-b border-md-outline-variant p-5 md:px-6">
            <CardHeader title="All websites" sub="Select a row to open the site." />
          </div>
          <SitesTable sites={sites} />
        </Card>
      </Screen>
    </>
  );
}
