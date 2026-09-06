'use client';
import * as React from 'react';
import { Card, CardBody, Confidence, Icon, Notice, RecommendationPair, cn } from '@rift/ui';
import { setTechnologyCategory } from '@/app/actions';
import type { ConsentCategory, Finding } from '@/lib/api/types';

/** The choice that means "we are not deciding this yet". */
const UNRESOLVED = '__unresolved__';

/**
 * Human review (spec §8). Rift interrupts only when the decision is genuinely
 * the company's, and the trail records which of the two made it.
 */
export function ReviewQueue({
  siteId,
  items,
  categories,
}: {
  siteId: string;
  items: Finding[];
  /** The site's own consent categories — never a hard-coded list. */
  categories: ConsentCategory[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
          {items.length} item{items.length === 1 ? '' : 's'} need your attention
        </h2>
        <p className="mt-3 max-w-[560px] text-body-medium leading-relaxed text-md-on-surface-variant">
          Rift handled everything else on its own. These need a decision only you can make.
        </p>
      </div>
      {items.map((f) => (
        <ReviewCard key={f.findingId} siteId={siteId} finding={f} categories={categories} />
      ))}
    </div>
  );
}

function ReviewCard({
  siteId,
  finding,
  categories,
}: {
  siteId: string;
  finding: Finding;
  categories: ConsentCategory[];
}) {
  // Ids drive the state and the write; labels are only rendered. The platform
  // matches a purpose by code, so sending a display name attaches the vendor to
  // a purpose that does not exist.
  const recommendedId = finding.recommendation?.categoryId ?? null;
  const recommended = finding.recommendation?.category ?? null;
  const [choiceId, setChoiceId] = React.useState<string>(recommendedId ?? UNRESOLVED);
  const [, start] = React.useTransition();

  const labelFor = (id: string) =>
    id === UNRESOLVED
      ? 'Leave unresolved'
      : (categories.find((c) => c.id === id)?.name ?? id);

  const overridden = recommendedId !== null && choiceId !== recommendedId;
  const agreed = recommendedId !== null && choiceId === recommendedId;

  function pick(nextId: string) {
    setChoiceId(nextId);
    start(() => {
      void setTechnologyCategory(siteId, finding.findingId, nextId === UNRESOLVED ? null : nextId);
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardBody className="p-7">
        <div className="flex items-start gap-4">
          <span className={cn(
            'inline-flex size-12 shrink-0 items-center justify-center rounded-full',
            recommended ? 'bg-md-warning-container text-md-on-warning-container' : 'bg-md-surface-variant text-md-on-surface-variant',
          )}>
            <Icon name="question" size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-title-large font-medium text-md-on-surface">{finding.name}</span>
              <Confidence level={finding.confidence} />
            </div>
            <div className="mt-1.5 font-mono text-label-medium text-md-on-surface-variant">
              {finding.host} · first seen {new Date(finding.firstSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <p className="mt-3 text-body-medium leading-relaxed text-md-on-surface-variant">
              {recommended
                ? `Rift recognised this from its request pattern, but not with full certainty. It has already been configured as ${recommended} — confirming it, or choosing something else, settles it.`
                : 'Rift has no recommendation here — it could not determine what this technology does. It has not been placed in a category, is not blocked, and Rift has not claimed it requires consent.'}
            </p>
          </div>
        </div>

        {recommended ? (
          <>
            <RecommendationPair
              className="mt-6"
              recommendation={recommended}
              {...(finding.recommendation?.rationale ? { recommendationNote: finding.recommendation.rationale } : {})}
              decision={labelFor(choiceId)}
              decisionNote={overridden ? 'Overrides Rift’s recommendation' : 'Following Rift’s recommendation'}
              overridden={overridden}
              onRestore={() => pick(recommendedId ?? UNRESOLVED)}
            />

            <div className="mt-6">
              <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
                Your decision
              </div>
              <div className="flex flex-wrap gap-2">
                {[...categories.map((c) => c.id), UNRESOLVED].map((id) => {
                  const on = id === choiceId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pick(id)}
                      className={cn(
                        'inline-flex h-10 items-center gap-2 rounded-full px-5 text-label-medium font-medium',
                        'transition-all duration-[--md-duration-fast] ease-md active:scale-95',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
                        on && id === recommendedId ? 'bg-md-secondary-container text-md-on-secondary-container'
                        : on ? 'bg-md-tertiary-container text-md-on-tertiary-container'
                        : 'bg-md-surface-variant text-md-on-surface-variant hover:bg-md-primary/10',
                      )}
                    >
                      {on ? <Icon name="check" size={16} strokeWidth={2.2} /> : null}
                      {labelFor(id)}
                    </button>
                  );
                })}
              </div>
            </div>

            {agreed ? (
              <Notice
                tone="success"
                icon="check"
                title="Confirmed — this matches Rift’s recommendation"
                className="mt-6"

              >
                {finding.name} stays in {recommended}. This was saved when you chose it — there is
                nothing further to confirm, and Rift will keep it there on future scans without
                asking again.
              </Notice>
            ) : null}
          </>
        ) : (
          /* A finding Rift could not recognise still has to be classifiable —
             it is the case most likely to need a person. The two buttons here
             previously did nothing at all, so the findings that most needed a
             decision were the only ones that could not receive one. */
          <div className="mt-6">
            <div className="mb-3 text-label-small font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
              Your decision
            </div>
            <div className="flex flex-wrap gap-2">
              {[...categories.map((c) => c.id), UNRESOLVED].map((id) => {
                const on = id === choiceId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(id)}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full px-5 text-label-medium font-medium',
                      'transition-all duration-[--md-duration-fast] ease-md active:scale-95',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2',
                      on
                        ? 'bg-md-tertiary-container text-md-on-tertiary-container'
                        : 'bg-md-surface-variant text-md-on-surface-variant hover:bg-md-primary/10',
                    )}
                  >
                    {on ? <Icon name="check" size={16} strokeWidth={2.2} /> : null}
                    {labelFor(id)}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-body-small text-md-on-surface-variant">
              Saved as soon as you choose. Rift made no recommendation here, so nothing is assumed
              either way.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
