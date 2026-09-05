import { BannerPreview } from '@/components/BannerPreview';
import { getConfiguration } from '@/lib/api/endpoints';
import { requireSiteId } from '@/lib/current-site';

export const metadata = { title: 'Consent banner preview' };

/** Reads the site's live configuration, so there is nothing to prerender. */
export const dynamic = 'force-dynamic';

/**
 * Design preview for the visitor-facing components. They ship inside the SDK —
 * nothing here persists anything or writes a cookie.
 */
export default async function BannerPreviewPage() {
  const config = await getConfiguration(await requireSiteId());
  return <BannerPreview config={config} />;
}
