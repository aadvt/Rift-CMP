'use client';
import * as React from 'react';
import { Button, Chip, Drawer, DrawerSection, DefRow, Notice } from '@rift/ui';
import { fetchConsentReceipt } from '@/app/actions';
import type * as W from '@/lib/api/backend';

/**
 * Shows the receipt for one consent decision.
 *
 * `VerifyProofButton` beside this checks a proof; this fetches the thing being
 * checked. Both endpoints have existed for a while and only the checker had a
 * caller, which left the product able to say "this verifies" without being able
 * to show anybody *what* verified.
 *
 * ## Why the fields are listed rather than summarised
 *
 * A receipt is evidence handed to somebody who was not there — a regulator, an
 * auditor, the visitor themselves. Its value is that the fields are the ones
 * the platform actually attested, in the platform's own words. Paraphrasing
 * them into a friendlier sentence would produce a nicer screen and a weaker
 * document.
 *
 * ## The caveat is not fine print
 *
 * The platform returns it and it bounds what the receipt establishes: that Rift
 * recorded this decision with these fields at this time. It does not attest
 * that the visitor understood the notice, and a screen that omitted it would
 * be overstating the product's strongest claim.
 */
export function ReceiptButton({ recordId }: { recordId: string }) {
  const [open, setOpen] = React.useState(false);
  const [proof, setProof] = React.useState<W.WireConsentProof | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function show() {
    setOpen(true);
    setProof(null);
    setError(null);
    start(async () => {
      const outcome = await fetchConsentReceipt(recordId);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setProof(outcome.proof);
    });
  }

  const e = proof?.evidence;

  return (
    <>
      <Button size="sm" variant="text" onClick={show}>
        Receipt
      </Button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        eyebrow="Consent receipt"
        title={pending ? 'Fetching…' : e ? `${e.purpose_code} · ${e.status}` : 'Consent receipt'}
        sub={<span className="break-all font-mono text-label-medium">{recordId}</span>}
      >
        {error ? (
          <Notice tone="error" icon="alert" title="The receipt could not be fetched">
            {error}
          </Notice>
        ) : null}

        {pending ? (
          <p className="text-body-medium text-md-on-surface-variant">
            Rebuilding the receipt from the stored record.
          </p>
        ) : null}

        {proof && e ? (
          <>
            <DrawerSection title="What was decided">
              <div className="rounded-lg bg-md-surface-container px-5 py-2">
                <DefRow label="Purpose"><span className="font-mono text-label-medium">{e.purpose_code}</span></DefRow>
                <DefRow label="Decision">
                  <Chip tone={e.status === 'GRANTED' ? 'success' : e.status === 'WITHDRAWN' ? 'warning' : 'neutral'}>
                    {e.status}
                  </Chip>
                </DefRow>
                <DefRow label="Decided at">
                  {new Date(e.decided_at).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </DefRow>
                <DefRow label="Expressed via">{e.mechanism ?? 'Not recorded'}</DefRow>
                <DefRow label="Source"><span className="font-mono text-label-medium">{e.source}</span></DefRow>
              </div>
            </DrawerSection>

            <DrawerSection title="What was in force">
              <div className="rounded-lg bg-md-surface-container px-5 py-2">
                <DefRow label="Notice">
                  {e.notice_id
                    ? <span className="break-all font-mono text-label-medium">{e.notice_id}</span>
                    : <span className="text-md-on-surface-variant">Not recorded</span>}
                </DefRow>
                <DefRow label="Policy version">
                  {e.policy_version_id
                    ? <span className="break-all font-mono text-label-medium">{e.policy_version_id}</span>
                    : <span className="text-md-on-surface-variant">Not recorded</span>}
                </DefRow>
                <DefRow label="Configuration">
                  {e.policy_config_version
                    ? <span className="break-all font-mono text-label-medium">{e.policy_config_version}</span>
                    : <span className="text-md-on-surface-variant">Not recorded</span>}
                </DefRow>
                <DefRow label="Jurisdictions">
                  {e.jurisdictions.length > 0 ? (
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {e.jurisdictions.map((j) => <Chip key={j} tone="neutral">{j}</Chip>)}
                    </span>
                  ) : (
                    // Never inferred from anything. A decision with none recorded
                    // is still a decision, and guessing would defeat the receipt.
                    <span className="text-md-on-surface-variant">None recorded</span>
                  )}
                </DefRow>
                <DefRow label="Vendors named">
                  {e.vendors.length > 0 ? (
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {e.vendors.map((v) => <Chip key={v} tone="neutral">{v}</Chip>)}
                    </span>
                  ) : (
                    <span className="text-md-on-surface-variant">None</span>
                  )}
                </DefRow>
              </div>
            </DrawerSection>

            <DrawerSection title="The proof">
              <p className="break-all rounded-lg bg-md-surface-container px-4 py-3 font-mono text-label-medium text-md-on-surface">
                {proof.proof}
              </p>
              <p className="mt-2 text-body-small leading-relaxed text-md-on-surface-variant">
                {proof.key_id
                  ? <>Signed with key <span className="font-mono">{proof.key_id}</span>. The identifier travels with the receipt; the key never does.</>
                  : <>No signing key is recorded against this proof. Integrity can still be checked by recomputing the hash.</>}
              </p>
            </DrawerSection>

            <DrawerSection title="What this receipt establishes">
              <p className="text-body-small leading-relaxed text-md-on-surface-variant">{proof.caveat}</p>
            </DrawerSection>
          </>
        ) : null}
      </Drawer>
    </>
  );
}
