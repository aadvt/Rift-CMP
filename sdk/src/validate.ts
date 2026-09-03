import { EVENT_LIMITS } from "@rift-cmp/shared";

/**
 * Client-side pre-validation of `track()` input.
 *
 * The API is and remains the authority: it re-checks every one of these bounds,
 * because the code in this file runs in the caller's browser and can simply be
 * skipped. Nothing here weakens the server-side check, and nothing here is
 * evidence of anything.
 *
 * What it buys is a diagnostic. Without it an oversized event is queued, sent,
 * retried, and rejected, and the only trace is a `400` in the network tab long
 * after `track()` returned. Catching it at the call site names the field and the
 * limit while the developer is looking at the line that caused it.
 *
 * Two rules it deliberately follows:
 *
 *  - **It never truncates.** Silently shortening a URL or dropping a property
 *    would send data the caller did not write and did not consent to sending.
 *    An over-limit event is refused, and the caller is told which bound it hit.
 *  - **It holds no numbers of its own.** Every bound comes from `EVENT_LIMITS`
 *    in `shared/`, the same constant the API validates against, so the two
 *    cannot disagree about where the line is.
 */

export type TrackValidation = { ok: true } | { ok: false; reason: string };

const utf8Bytes = (value: string): number =>
  typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(value).length
    : // Node before the global TextEncoder, and any exotic embedder. UTF-16
      // length is an underestimate for non-BMP text, so it is only a fallback.
      value.length;

/** Rejects arrays, null and class instances — `properties` is a JSON object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function validateTrackInput(
  name: unknown,
  properties?: unknown,
): TrackValidation {
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, reason: "event name must be a non-empty string" };
  }

  if (name.length > EVENT_LIMITS.name) {
    return {
      ok: false,
      reason: `event name is ${name.length} characters; the limit is ${EVENT_LIMITS.name}`,
    };
  }

  if (properties === undefined || properties === null) return { ok: true };

  if (!isPlainObject(properties)) {
    return { ok: false, reason: "properties must be a plain object" };
  }

  const keys = Object.keys(properties);

  if (keys.length > EVENT_LIMITS.propertyKeys) {
    return {
      ok: false,
      reason: `properties has ${keys.length} keys; the limit is ${EVENT_LIMITS.propertyKeys}`,
    };
  }

  const overLongKey = keys.find((key) => key.length > EVENT_LIMITS.propertyKeyLength);
  if (overLongKey !== undefined) {
    return {
      ok: false,
      reason: `property key "${overLongKey.slice(0, 32)}…" is ${overLongKey.length} characters; the limit is ${EVENT_LIMITS.propertyKeyLength}`,
    };
  }

  // A BigInt or a circular reference cannot be serialised. The API rejects it,
  // but only after a round trip; failing here says so at the call site.
  let serialised: string;
  try {
    const json = JSON.stringify(properties);
    if (typeof json !== "string") {
      return { ok: false, reason: "properties could not be serialised to JSON" };
    }
    serialised = json;
  } catch (error) {
    return {
      ok: false,
      reason: `properties could not be serialised to JSON (${(error as Error).message})`,
    };
  }

  const bytes = utf8Bytes(serialised);
  if (bytes > EVENT_LIMITS.propertiesBytes) {
    return {
      ok: false,
      reason: `properties serialises to ${bytes} bytes; the limit is ${EVENT_LIMITS.propertiesBytes}`,
    };
  }

  return { ok: true };
}
