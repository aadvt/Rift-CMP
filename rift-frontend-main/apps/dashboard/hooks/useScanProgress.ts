'use client';
import { useEffect, useRef, useState } from 'react';
import type { Scan } from '@/lib/api/types';

/**
 * Live scan progress.
 *
 * One hook, one transport decision. SSE while it holds; interval polling if
 * the stream is unavailable. Nothing above this line knows which is in use, so
 * swapping to WebSocket later touches only this file.
 */
export function useScanProgress(scanId: string, initial: Scan) {
  const [scan, setScan] = useState<Scan>(initial);
  const [transport, setTransport] = useState<'stream' | 'poll'>('stream');
  const done = scan.status !== 'running' && scan.status !== 'queued';
  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    if (doneRef.current) return;

    const source = new EventSource(`/api/scans/${scanId}/stream`);

    source.onmessage = (e) => {
      try { setScan(JSON.parse(e.data) as Scan); } catch { /* keep the last good frame */ }
    };
    source.onerror = () => { source.close(); setTransport('poll'); };

    return () => source.close();
  }, [scanId]);

  useEffect(() => {
    if (transport !== 'poll' || doneRef.current) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/scans/${scanId}`, { cache: 'no-store' });
        if (res.ok && !cancelled) setScan((await res.json()) as Scan);
      } catch { /* the next tick will retry */ }
    };
    const timer = setInterval(tick, 2500);
    void tick();
    return () => { cancelled = true; clearInterval(timer); };
  }, [transport, scanId]);

  return { scan, transport, done };
}
