'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Button, Card, CardBody, CardHeader, Chip, Confidence, Icon, Notice, Toggle, cn } from '@rift/ui';
import { setTechnologyCategory, restoreRiftRecommendation } from '@/app/actions';
import type { ConsentCategory, TechnologyConfiguration } from '@/lib/api/types';

/**
 * Manual configuration exists, but it is secondary by design.
 *
 * Every row shows Rift's recommendation beside the company's decision. Turning
 * on custom behaviour tints the row with the tertiary container and marks it —
 * an override should look deliberately different, never wrong — and always
 * offers a path back.
 */
export function OverrideGrid({
  siteId,
  technologies,
  categories,
}: {
  siteId: string;
  technologies: TechnologyConfiguration[];
  /** The site's own consent categories. Never a hard-coded list — a site is
   *  offered the categories its configuration actually has. */
  categories: ConsentCategory[];
}) {
  // Keyed by category **id**, because that is what a write sends. The label is
  // only ever rendered.
  const [overrides, setOverrides] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      technologies
        .filter((t) => t.overridden && t.configuredCategoryId)
        .map((t) => [t.technologyId, t.configuredCategoryId!]),
    ),
  );
  const [, start] = React.useTransition();

  const labelFor = (id: string | null) =>
    (id ? categories.find((c) => c.id === id)?.name : null) ?? id ?? '—';

  /** Where a row starts when custom behaviour is switched on. */
  const startingCategory = (t: TechnologyConfiguration) =>
    t.recommendedCategoryId ??
    categories.find((c) => !c.alwaysActive)?.id ??
    categories[0]?.id ??
    null;

  // Side effects stay OUT of the state updater — React may run an updater
  // more than once, which would fire the server action twice.
  function toggle(t: TechnologyConfiguration) {
    const isOn = Boolean(overrides[t.technologyId]);

    if (isOn) {
      const next = { ...overrides };
      delete next[t.technologyId];
      setOverrides(next);
      start(() => { void restoreRiftRecommendation(siteId, t.technologyId); });
      toast('Restored Rift’s recommendation', {
        description: t.recommendedCategory
          ? `${t.name} is back to ${t.recommendedCategory}.`
          : `${t.name} is back to being left unclassified.`,
      });
      return;
    }

    const next = startingCategory(t);
    if (!next) {
      toast('No consent categories yet', {
        description: 'Accept a Rift configuration first — there is nothing to assign this to.',
      });
      return;
    }

    setOverrides({ ...overrides, [t.technologyId]: next });
    start(() => { void setTechnologyCategory(siteId, t.technologyId, next); });
    toast('Override applied', {
      description: `${t.name} is now ${labelFor(next)}. Rift will keep your choice.`,
    });
  }

  function choose(t: TechnologyConfiguration, categoryId: string) {
    setOverrides((prev) => ({ ...prev, [t.technologyId]: categoryId }));
    start(() => { void setTechnologyCategory(siteId, t.technologyId, categoryId); });
  }

  function restoreAll() {
    Object.keys(overrides).forEach((id) => start(() => { void restoreRiftRecommendation(siteId, id); }));
    setOverrides({});
    toast('All settings restored', { description: 'Every technology is following Rift’s recommendation again.' });
  }

  const count = Object.keys(overrides).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-[620px]">
          <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
            Technologies
          </h2>
          <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
            Rift has already configured all of these. Change one only if you know something Rift doesn&rsquo;t — every
            change is labelled as yours and can be restored.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {count > 0 ? <Chip tone="tertiary">{count} override{count === 1 ? '' : 's'}</Chip> : <Chip tone="success" glyph="check">All Rift defaults</Chip>}
          <Button variant="outlined" icon="restore" disabled={count === 0} onClick={restoreAll}>
            Restore all recommendations
          </Button>
        </div>
      </div>

      {count > 0 ? (
        <Notice
          tone="warning"
          icon="user"
          title={count === 1 ? '1 setting overrides Rift’s recommendation' : `${count} settings override Rift’s recommendations`}
        >
          Overridden settings are kept exactly as you set them. Rift will not change them on future scans, and it will
          not warn you again about the technologies below.
        </Notice>
      ) : null}

      <Card className="overflow-hidden rounded-2xl">
        <div className="hidden gap-4 bg-md-surface-container px-7 py-4 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant lg:grid lg:grid-cols-[minmax(0,1.5fr)_180px_220px_170px]">
          <span>Technology</span>
          <span>Rift recommendation</span>
          <span>Company configuration</span>
          <span className="text-right">Custom behaviour</span>
        </div>

        {technologies.map((t) => {
          const custom = Boolean(overrides[t.technologyId]);
          const valueId = overrides[t.technologyId] ?? t.recommendedCategoryId ?? null;
          return (
            <div
              key={t.technologyId}
              className={cn(
                'border-b border-md-outline-variant/40 transition-colors duration-[--md-duration-base] ease-md last:border-0',
                custom && 'border-l-4 border-l-md-tertiary bg-md-tertiary-container/40',
              )}
            >
              <div className="grid grid-cols-1 items-center gap-4 px-7 py-5 lg:grid-cols-[minmax(0,1.5fr)_180px_220px_170px]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn(
                    'inline-flex size-10 shrink-0 items-center justify-center rounded-full text-body-medium font-medium',
                    custom ? 'bg-md-tertiary-container text-md-on-tertiary-container' : 'bg-md-secondary-container text-md-on-secondary-container',
                  )}>
                    {t.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-md-on-surface">{t.name}</span>
                    <span className="block truncate font-mono text-label-small text-md-on-surface-variant">{t.host}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={cn('text-body-medium', custom ? 'text-md-on-surface-variant line-through' : 'text-md-on-surface-variant')}>
                    {t.recommendedCategory ?? '—'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {custom ? (
                    categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => choose(t, c.id)}
                        className={cn(
                          'h-8 rounded-full px-3 text-label-small font-medium transition-all duration-[--md-duration-fast] ease-md active:scale-95',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
                          valueId === c.id
                            ? 'bg-md-tertiary text-md-on-tertiary'
                            : 'bg-md-surface text-md-on-surface-variant hover:bg-md-primary/10',
                        )}
                      >
                        {c.name}
                      </button>
                    ))
                  ) : (
                    <span className="inline-flex h-9 items-center rounded-full bg-md-surface-variant px-4 text-body-medium text-md-on-surface-variant">
                      {labelFor(valueId)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-start gap-3 lg:justify-end">
                  <span className={cn('text-label-medium', custom ? 'font-medium text-md-on-tertiary-container' : 'text-md-on-surface-variant')}>
                    {custom ? 'Custom' : 'Rift'}
                  </span>
                  <Toggle checked={custom} onCheckedChange={() => toggle(t)} aria-label={`Use custom behaviour for ${t.name}`} />
                </div>
              </div>

              {custom ? (
                <div className="mx-7 mb-5 flex flex-wrap items-center gap-4 rounded-xl bg-md-surface p-4 motion-safe:animate-[md-fade_300ms_var(--md-ease)]">
                  <Icon name="user" size={20} className="shrink-0 text-md-tertiary" />
                  <span className="min-w-0 flex-1 text-label-medium leading-relaxed text-md-on-surface-variant">
                    <span className="font-medium text-md-on-surface">Configuration changed manually.</span>{' '}
                    {t.recommendedCategory
                      ? `This setting overrides Rift’s recommendation of ${t.recommendedCategory}.`
                      : 'Rift could not classify this one, so there was no recommendation to override.'}
                  </span>
                  <Button size="sm" variant="outlined" icon="restore" onClick={() => toggle(t)}>
                    Restore Rift recommendation
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
