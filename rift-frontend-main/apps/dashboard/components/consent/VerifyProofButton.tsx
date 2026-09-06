'use client';
import * as React from 'react';
import { Button, Chip, Drawer, DrawerSection, DefRow, Notice } from '@rift/ui';
import { checkConsentProof } from '@/app/actions';
import type { ProofVerification } from '@/lib/api/endpoints';

/**
 * Checks one consent record's proof.
 *
 * The endpoint has existed since Phase B and nothing has ever called it, so the
 * product's strongest claim — that a consent record can be verified later
 * without trusting the database it came from — was true and unreachable.
 *
 * ## Three verdicts, never one
 *
 * Integrity, signature and chain are reported separately because they fail for
 * different reasons and call for different responses. "The signature is genuine
 * but a decision was removed from the middle of this person's history" is a
 * different problem from "somebody edited this record", and an operator shown a
 * single red cross cannot tell which they have.
 *
 * Each is a string rather than a boolean for the same reason. A signature can
 * be `unsigned` — which is the correct and expected state for every record
 * written before signing existed — or `unknown_key`, or `revoked_key`. A chain
 * can be `unverifiable`, which is not the same as `broken` and is rendered as
 * neutral rather than as a failure. Flattening any of those into "invalid"
 * would manufacture alarm out of a record that is fine.
 *
 * ## Why the caveat is always shown
 *
 * The platform returns one and it is not boilerplate: it bounds what a passing
 * check actually establishes. A verified proof is shown alongside it, never
 * instead of it.
 */
const INTEGRITY_TONE = { valid: 'success', invalid: 'error' } as const;

const SIGNATURE_TONE = {
  valid: 'success',
  invalid: 'error',
  unsigned: 'neutral',
  unknown_key: 'warning',
  revoked_key: 'warning',
} as const;

const CHAIN_TONE = { valid: 'success', broken: 'error', unverifiable: 'neutral' } as const;

const SIGNATURE_MEANING: Record<string, string> = {
  valid: 'Signed with a key Rift holds, and the signature matches.',
  invalid: 'A signature is present and does not match. Treat this record as untrusted.',
  unsigned: 'No signature. Expected for records written before signed proofs existed — integrity still applies.',
  unknown_key: 'Signed with a key this deployment does not hold. Not a failure; it cannot be checked here.',
  revoked_key: 'Signed with a key that has since been revoked. The signature may still be genuine.',
};

const CHAIN_MEANING: Record<string, string> = {
  valid: 'This record sits where it claims in the person’s history, and nothing around it moved.',
  broken: 'The neighbouring record does not line up. A decision may have been removed or reordered.',
  unverifiable: 'There is no neighbouring record to check against — the first decision for a person looks like this.',
};

export function VerifyProofButton({ recordId }: { recordId: string }) {
  const [open, setOpen] = React.useState(false);
  const [result, setResult] = React.useState<ProofVerification | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function verify() {
    setOpen(true);
    setResult(null);
    setError(null);
    start(async () => {
      const outcome = await checkConsentProof(recordId);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      setResult(outcome.verification);
    });
  }

  const r = result?.result;

  return (
    <>
      <Button size="sm" variant="text" onClick={verify}>
        Verify
      </Button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        eyebrow="Proof check"
        title={pending ? 'Checking…' : r ? (r.ok ? 'Proof verified' : 'Proof did not verify') : 'Proof check'}
        sub={<span className="break-all font-mono text-label-medium">{recordId}</span>}
      >
        {error ? (
          <Notice tone="error" icon="alert" title="The check could not be run">
            {error}
          </Notice>
        ) : null}

        {pending ? (
          <p className="text-body-medium text-md-on-surface-variant">
            Re-computing the proof from the record as it stands now.
          </p>
        ) : null}

        {r ? (
          <>
            {r.malformed ? (
              <Notice tone="error" icon="alert" title="The proof document is malformed">
                {r.malformed}
              </Notice>
            ) : null}

            {r.unsupported_version ? (
              <Notice tone="warning" icon="alert" title="Proof version not supported here">
                This proof was written in format <span className="font-mono">{r.version}</span>, which
                this deployment cannot check. That is a limitation of the checker, not a finding about
                the record.
              </Notice>
            ) : null}

            <DrawerSection title="What was checked">
              <div className="rounded-lg bg-md-surface-container px-5 py-2">
                <DefRow label="Integrity">
                  {r.integrity ? (
                    <span className="flex flex-col items-end gap-1 text-right">
                      <Chip tone={INTEGRITY_TONE[r.integrity]}>{r.integrity}</Chip>
                      <span className="text-label-small text-md-on-surface-variant">
                        {r.integrity === 'valid'
                          ? 'The record still hashes to what the proof says it did.'
                          : 'The record no longer matches its proof. Something changed after it was written.'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-md-on-surface-variant">Not checked</span>
                  )}
                </DefRow>

                <DefRow label="Signature">
                  {r.signature ? (
                    <span className="flex flex-col items-end gap-1 text-right">
                      <Chip tone={SIGNATURE_TONE[r.signature]}>{r.signature.replace('_', ' ')}</Chip>
                      <span className="text-label-small text-md-on-surface-variant">
                        {SIGNATURE_MEANING[r.signature]}
                      </span>
                    </span>
                  ) : (
                    <span className="text-md-on-surface-variant">Not checked</span>
                  )}
                </DefRow>

                <DefRow label="Chain">
                  {r.chain ? (
                    <span className="flex flex-col items-end gap-1 text-right">
                      <Chip tone={CHAIN_TONE[r.chain]}>{r.chain}</Chip>
                      <span className="text-label-small text-md-on-surface-variant">
                        {CHAIN_MEANING[r.chain]}
                      </span>
                    </span>
                  ) : (
                    <span className="text-md-on-surface-variant">Not checked</span>
                  )}
                </DefRow>

                <DefRow label="Proof format"><span className="font-mono text-label-medium">{r.version}</span></DefRow>
                {r.key_id ? (
                  <DefRow label="Key"><span className="break-all font-mono text-label-medium">{r.key_id}</span></DefRow>
                ) : null}
              </div>
            </DrawerSection>

            {r.findings.length > 0 ? (
              <DrawerSection title="Findings">
                <ul className="flex flex-col gap-2">
                  {r.findings.map((f) => (
                    <li key={f} className="text-body-small leading-relaxed text-md-on-surface-variant">
                      {f}
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            ) : null}

            {/* Always, including on a pass. It bounds what the pass means. */}
            <DrawerSection title="What this check establishes">
              <p className="text-body-small leading-relaxed text-md-on-surface-variant">
                {result.caveat}
              </p>
            </DrawerSection>
          </>
        ) : null}
      </Drawer>
    </>
  );
}
