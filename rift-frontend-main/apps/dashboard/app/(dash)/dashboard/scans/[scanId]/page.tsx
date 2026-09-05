import { getScan, getSite, listFindings } from '@/lib/api/endpoints';
import { ScanScreen } from '@/components/ScanScreen';
import { scanAtStage } from '@/lib/api/fixtures';
import { USE_FIXTURES } from '@/lib/api/client';

export const metadata = { title: 'Scan' };

export default async function ScanPage({ params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;

  // In fixtures mode a fresh scan starts at stage 1 so the staged progress is
  // visible; `scn_8455` is the partial-results fixture. Against a real backend
  // the first frame is whatever the API reports.
  const scan = USE_FIXTURES && scanId !== 'scn_8455' ? scanAtStage(1, scanId) : await getScan(scanId);
  const [findings, site] = await Promise.all([listFindings(scanId), getSite(scan.siteId)]);

  return <ScanScreen initial={scan} findings={findings} host={site.host} siteId={scan.siteId} />;
}
