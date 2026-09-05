/**
 * Errors carry enough for the UI to say what happened, whether Rift recovered,
 * and what to do next — never a bare "failed".
 */
export interface RiftError extends Error {
  riftCode: string;
  status: number;
}

export function riftError(code: string, message: string, status: number, opts?: { cause?: unknown }): RiftError {
  const err = new Error(message, opts) as RiftError;
  err.name = 'RiftError';
  err.riftCode = code;
  err.status = status;
  return err;
}

/** Operator-facing copy for the codes the UI branches on. */
export function explainError(code: string): { title: string; body: string; recovered: boolean } {
  switch (code) {
    case 'timeout':
      return {
        title: 'Rift is taking longer than usual to respond',
        body: 'Your configuration is unaffected and still live on your website. This screen will load once the connection recovers.',
        recovered: true,
      };
    case 'network_error':
      return {
        title: 'We couldn’t reach Rift',
        body: 'Nothing has changed on your website — the Rift SDK keeps running with the configuration it already has. Try again in a moment.',
        recovered: true,
      };
    case 'site_unreachable':
      return {
        title: 'We couldn’t reach your website',
        body: 'Rift tried several times and got no response. Nothing was scanned, and your existing configuration is untouched.',
        recovered: false,
      };
    case 'not_found':
      return {
        title: 'That isn’t here any more',
        body: 'It may have been removed, or the link may be out of date. Everything else is unaffected.',
        recovered: true,
      };
    default:
      return {
        title: 'Something went wrong on our side',
        body: 'Your website and its configuration are unaffected. We’ve logged this — try again, and contact support if it persists.',
        recovered: true,
      };
  }
}
