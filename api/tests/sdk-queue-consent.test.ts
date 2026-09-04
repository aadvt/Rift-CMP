/**
 * @vitest-environment jsdom
 *
 * What the SDK's queue does when consent is not, or is no longer, a yes.
 *
 * The queue is the part of the SDK where a consent decision and a network
 * request are separated in time. An event is admitted at `track()` and sent up
 * to two seconds later, or at unload, whichever comes first. Everything here is
 * about that gap: who is asked, when, and what happens to a batch that is
 * refused once it is already in flight.
 *
 * These are the client's own manners, not the enforcement. The API re-derives
 * every decision from the append-only log, because code running in a visitor's
 * browser is never evidence of anything. But manners still matter: a site with
 * `analytics_consent_purpose` unset has nothing but these, and a client that
 * retried a refusal forever would be both a leak and a denial-of-service on the
 * operator's own endpoint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsClient } from "../../sdk/src/client";

const SITE_ID = "site_queue";
const PUBLIC_KEY = "pk_queue";
const API_URL = "http://127.0.0.1:9/api-stub";
const STORAGE_KEY = "rift_cmp_pending_events";

/** Long enough for every scheduled flush and its backoff to have fired. */
const WELL_PAST_EVERY_RETRY = 60_000;

function persisted(): unknown[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * One jsdom window is shared by every test in this file, and the client
 * registers `beforeunload` / `visibilitychange` hooks it has no API to remove.
 * Left alone, a client built in one test would still be listening in the next
 * one, read the same `localStorage` queue, and send it - so the unload tests
 * below would be measuring three clients instead of the one under test.
 *
 * The registrations are captured as they happen and torn down afterwards, which
 * keeps each test to exactly the client it created.
 */
const registered: Array<() => void> = [];

function newClient() {
  const targets = [window, document] as const;
  const originals = targets.map((target) => target.addEventListener);

  for (const target of targets) {
    const original = target.addEventListener.bind(target);
    target.addEventListener = ((type: string, handler: EventListener, options?: unknown) => {
      registered.push(() => target.removeEventListener(type, handler, options as never));
      return original(type, handler, options as never);
    }) as typeof target.addEventListener;
  }

  try {
    return new AnalyticsClient(SITE_ID, PUBLIC_KEY, { apiUrl: API_URL });
  } finally {
    targets.forEach((target, index) => {
      target.addEventListener = originals[index];
    });
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(status: number) {
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, statusText: `s${status}` });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  respondWith(202);
});

afterEach(() => {
  while (registered.length > 0) registered.pop()?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a batch the server refuses on consent grounds", () => {
  it("is sent once and then dropped, not retried", async () => {
    respondWith(403);
    const client = newClient();

    await client.track("refused_event");
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    // One attempt. 403 is a final answer about whether these events may be
    // stored at all, so a second attempt could only ever get the same answer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves nothing behind in storage to be re-sent on the next page load", async () => {
    respondWith(403);
    const client = newClient();

    await client.track("refused_event");
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    // The persisted copy is the one that outlives the tab. If a refused batch
    // survived there it would be re-offered on every subsequent visit, which is
    // both an endless refusal loop and personal data retained past a "no".
    expect(persisted()).toHaveLength(0);
  });
});

describe("a batch that fails for a transient reason", () => {
  it("is retried, but a bounded number of times", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const client = newClient();

    await client.track("unlucky_event");
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    // The distinction this suite exists to hold: a network failure is not an
    // answer, so retrying is right - but the budget is finite. Unbounded retry
    // of a permanently failing endpoint is how an SDK becomes a load generator
    // pointed at its own operator.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });
});

describe("consent withdrawn while events sit in the queue", () => {
  it("does not send a batch admitted before the withdrawal", async () => {
    const client = newClient();
    client.setConsentCheck(() => true);
    await client.track("queued_while_allowed");

    // The withdrawal lands inside the flush window, after the event was
    // admitted and before it was sent.
    client.setConsentCheck(() => false);
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards those events rather than holding them for later", async () => {
    const client = newClient();
    client.setConsentCheck(() => true);
    await client.track("queued_while_allowed");
    client.setConsentCheck(() => false);
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    expect(persisted()).toHaveLength(0);
  });

  it("does not let the unload flush carry them out of the page", async () => {
    const client = newClient();
    client.setConsentCheck(() => true);
    await client.track("queued_while_allowed");
    client.setConsentCheck(() => false);

    // Unload is the send most likely to happen just after a withdrawal: the
    // visitor refuses and then closes the tab.
    window.dispatchEvent(new Event("beforeunload"));
    await vi.advanceTimersByTimeAsync(WELL_PAST_EVERY_RETRY);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the gate is a gate, not a wall", () => {
  it("still delivers on unload while consent stands", async () => {
    const client = newClient();
    client.setConsentCheck(() => true);
    await client.track("allowed_event");

    window.dispatchEvent(new Event("beforeunload"));

    // Without this, every assertion above would also pass on an SDK that had
    // simply stopped sending anything.
    expect(fetchMock).toHaveBeenCalled();
  });
});
