'use client';
import * as React from 'react';
import { ConsentBanner, PreferenceCentre, PrivacyControl, type ConsentSelection } from '@rift/consent-ui';
import { Button, Card, CardBody, CardHeader, Chip } from '@rift/ui';
import type { RiftConfiguration } from '@/lib/api/types';

export function BannerPreview({ config }: { config: RiftConfiguration }) {
  const categories = config.consent.categories.map((c) => ({
    id: c.id, name: c.name, description: c.description, locked: c.alwaysActive,
  }));

  const initial: ConsentSelection = Object.fromEntries(
    categories.map((c) => [c.id, c.locked ? true : c.id === 'analytics']),
  );

  const [view, setView] = React.useState<'banner' | 'prefs' | 'saved'>('banner');
  const [selection, setSelection] = React.useState<ConsentSelection>(initial);
  const [outcome, setOutcome] = React.useState('');

  const allOn = Object.fromEntries(categories.map((c) => [c.id, true]));
  const noneOn = Object.fromEntries(categories.map((c) => [c.id, c.locked]));

  return (
    <div className="min-h-screen bg-md-background p-5 md:p-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-headline-medium font-semibold tracking-[-0.014em] text-md-on-surface">What your visitors see</h1>
            <p className="mt-1.5 text-[13.5px] text-md-on-surface-variant">
              Generated from your configuration. Nothing here is persisted — this is a preview.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Chip tone="neutral">Preview</Chip>
            <Button size="sm" variant="tonal" icon="restore" onClick={() => { setView('banner'); setSelection(initial); setOutcome(''); }}>
              Reset
            </Button>
          </div>
        </div>

        <div className="relative h-[568px] overflow-hidden rounded-lg border border-md-outline-variant bg-md-surface-container shadow-e1">
          <PageMock />
          <div
            className="pointer-events-none absolute inset-0 transition-colors duration-300"
            style={{ background: view === 'prefs' ? 'rgb(13 36 54 / 0.28)' : 'transparent' }}
          />

          {view === 'banner' ? (
            <div className="absolute inset-x-[18px] bottom-[18px] motion-safe:animate-[md-rise_340ms_var(--md-ease)_both]">
              <ConsentBanner
                copy={{
                  title: config.consent.banner.title,
                  body: config.consent.banner.body,
                  acceptAll: config.consent.banner.acceptAllLabel,
                  rejectNonEssential: config.consent.banner.rejectLabel,
                  managePreferences: config.consent.banner.managePreferencesLabel,
                  privacyNoticeHref: config.consent.banner.privacyNoticeHref,
                }}
                onAcceptAll={() => { setSelection(allOn); setOutcome('All technologies allowed'); setView('saved'); }}
                onRejectNonEssential={() => { setSelection(noneOn); setOutcome('Necessary only'); setView('saved'); }}
                onManagePreferences={() => setView('prefs')}
              />
            </div>
          ) : null}

          {view === 'prefs' ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 motion-safe:animate-[md-fade_200ms_ease_both]">
              <PreferenceCentre
                categories={categories}
                value={selection}
                onChange={setSelection}
                onSave={() => { setOutcome('Preferences saved'); setView('saved'); }}
                onAcceptAll={() => { setSelection(allOn); setOutcome('All technologies allowed'); setView('saved'); }}
                onClose={() => setView(outcome ? 'saved' : 'banner')}
                copy={{
                  title: config.consent.preferenceCentre.title,
                  body: config.consent.preferenceCentre.body,
                  save: config.consent.preferenceCentre.saveLabel,
                }}
              />
            </div>
          ) : null}

          {view === 'saved' ? (
            <>
              <div className="absolute bottom-[18px] left-[18px] motion-safe:animate-[md-rise_280ms_var(--md-ease)_both]">
                <PrivacyControl onClick={() => setView('prefs')} />
              </div>
              <div className="absolute bottom-[18px] right-[18px] flex items-center gap-2.5 rounded-full border border-md-success-container bg-md-success-container px-3.5 py-2.5 text-[12.5px] font-semibold text-md-on-success-container">
                {outcome}
              </div>
            </>
          ) : null}
        </div>

        <Card className="mt-5">
          <CardBody>
            <CardHeader
              title="Held by the SDK, not by your website code"
              sub="Keyboard navigable · focus managed and restored · labelled for screen readers · reduced motion respected · AA contrast · reject given the same weight as accept."
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function PageMock() {
  const bar = (w: string, h: number, strong?: boolean) => (
    <div style={{ width: w, height: h }} className={`rounded ${strong ? 'bg-[#DDE3EB]' : 'bg-md-surface-variant'}`} />
  );
  return (
    <div className="absolute inset-0 p-[26px_30px]">
      <div className="flex items-center justify-between gap-5 border-b border-md-outline-variant/40 pb-4">
        {bar('86px', 14, true)}
        <div className="flex items-center gap-4">{bar('54px', 8)}{bar('44px', 8)}{bar('62px', 8)}</div>
      </div>
      <div className="mt-8 flex max-w-[460px] flex-col gap-3">
        {bar('100%', 22, true)}{bar('78%', 22, true)}{bar('56%', 10)}{bar('64%', 10)}
      </div>
      <div className="mt-9 grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-[120px] rounded-[10px] bg-md-surface-variant" />)}
      </div>
    </div>
  );
}
