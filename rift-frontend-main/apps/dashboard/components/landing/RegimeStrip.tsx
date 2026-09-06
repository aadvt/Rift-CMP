'use client';
import * as React from 'react';
import { Card, Chip, Icon, cn } from '@rift/ui';
import { Reveal } from '@/components/motion/Reveal';
import { shouldAnimate, withGsap } from '@/components/motion/gsap';

/**
 * One configuration, every market.
 *
 * ## Why this section exists at all
 *
 * The question a buyer actually has is not "does it do GDPR" — everything
 * claims that — it is "do I need a second product for India". Naming the
 * regimes the matrix carries answers it in one glance, and naming DPDP
 * specifically answers it for the market this is being built in.
 *
 * ## What is claimed here, precisely
 *
 * That these regimes are in Rift's requirements matrix with cited sources, and
 * that one configuration is resolved against whichever applies to a given
 * visitor. Not that any of them is fully covered — `docs/regulations/matrix/
 * coverage.md` publishes the per-topic gaps, and a landing page that rounded
 * those up to "compliant" would be making the exact claim that document exists
 * to avoid. So the wording is "reads", "resolves" and "in the matrix", and the
 * page footer says it is not legal advice.
 */

const REGIMES: Array<{ name: string; where: string; highlight?: boolean }> = [
  { name: 'DPDP Act', where: 'India', highlight: true },
  { name: 'DPDP Rules', where: 'India', highlight: true },
  { name: 'GDPR', where: 'EU' },
  { name: 'ePrivacy', where: 'EU' },
  { name: 'CCPA', where: 'California' },
  { name: 'LGPD', where: 'Brazil' },
  { name: 'US state model', where: 'US' },
];

export function RegimeStrip() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate()) return;

    const gsap = withGsap();
    const ctx = gsap.context(() => {
      // A slow travelling highlight along the row. It draws the eye across the
      // list once rather than animating each item, which at seven items would
      // read as a queue of things demanding attention.
      gsap.fromTo(
        '[data-regime="row"]',
        { backgroundPositionX: '-40%' },
        {
          backgroundPositionX: '140%',
          duration: 3.2,
          repeat: -1,
          repeatDelay: 2.4,
          ease: 'power1.inOut',
        },
      );
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <section className="px-5 py-16 md:px-8 md:py-20">
      <div ref={ref} className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
        <Reveal>
          <p className="text-label-small font-medium uppercase tracking-[0.08em] text-md-primary">
            One configuration
          </p>
          <h2 className="mt-3 max-w-[20ch] text-headline-medium font-normal leading-tight tracking-[-0.01em] text-md-on-surface">
            Every market you sell to
          </h2>
          <p className="mt-4 max-w-[46ch] text-body-large leading-relaxed text-md-on-surface-variant">
            Declare your markets once. Rift resolves which regime applies to each
            visitor and configures consent accordingly — including India&rsquo;s DPDP
            Act, from the same place as the rest.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Chip tone="neutral" glyph="file">
              102 sourced requirements
            </Chip>
            <Chip tone="neutral" glyph="layers">
              7 regimes
            </Chip>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Card tone="low" className="overflow-hidden rounded-2xl">
            <ul className="divide-y divide-md-outline-variant">
              {REGIMES.map((r) => (
                <li
                  key={r.name}
                  data-regime={r.highlight ? 'row' : undefined}
                  className={cn(
                    'flex items-center gap-4 px-6 py-4 transition-colors duration-[--md-duration-base]',
                    r.highlight
                      ? // The gradient is the track the highlight above slides
                        // along; without motion it is a flat tint, which is a
                        // perfectly good way to mark these two rows.
                        'bg-[linear-gradient(100deg,transparent_0%,var(--md-secondary-container)_45%,transparent_90%)] bg-[length:220%_100%]'
                      : 'hover:bg-md-surface-container',
                  )}
                >
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-md-secondary-container text-md-on-secondary-container">
                    <Icon name="check" size={16} strokeWidth={2.2} />
                  </span>
                  <span className="text-body-medium font-medium text-md-on-surface">{r.name}</span>
                  <span className="ml-auto text-label-medium text-md-on-surface-variant">{r.where}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>
    </section>
  );
}
