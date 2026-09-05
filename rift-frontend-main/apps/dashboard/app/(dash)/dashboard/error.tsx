'use client';
import { Button, Card, Notice } from '@rift/ui';
import { Screen } from '@/components/shell/ScreenHeader';
import { explainError } from '@/lib/api/errors';

/** Errors say what happened, whether Rift recovered, and what to do next. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const code = (error as Error & { riftCode?: string }).riftCode ?? 'unknown';
  const { title, body, recovered } = explainError(code);

  return (
    <Screen>
      <Card className="mx-auto max-w-[620px] p-6">
        <Notice
          tone={recovered ? 'warning' : 'error'}
          icon={recovered ? 'refresh' : 'alert'}
          title={title}
          actions={<>
            <Button size="sm" variant="tonal" icon="refresh" onClick={reset}>Try again</Button>
            <Button size="sm" variant="text">Contact support</Button>
          </>}
        >
          {body}
        </Notice>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11.5px] text-md-on-surface-variant/75">Reference {error.digest}</p>
        ) : null}
      </Card>
    </Screen>
  );
}
