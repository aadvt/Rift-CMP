import { describe, expect, it } from "vitest";
import { EVENT_LIMITS } from "@rift-cmp/shared";
// Imported from source so the test exercises the SDK as written, not a stale
// bundle — the same convention as tests/consent-sdk.test.ts.
import { validateTrackInput } from "../../sdk/src/validate";

/**
 * SDK-side pre-validation of `track()` input.
 *
 * These bounds are enforced authoritatively by the API
 * (tests/ingest-limits.test.ts). This layer exists so a developer finds out at
 * the call site rather than from a `400` in the network tab, and so an event
 * that cannot be accepted is never queued, persisted or retried.
 *
 * Every assertion is written against `EVENT_LIMITS` rather than a literal, so
 * the SDK and the API cannot end up with different numbers for the same bound.
 */
describe("SDK track() pre-validation", () => {
  describe("event name", () => {
    it("accepts an ordinary name", () => {
      expect(validateTrackInput("purchase")).toEqual({ ok: true });
    });

    it("accepts a name of exactly the limit", () => {
      expect(validateTrackInput("n".repeat(EVENT_LIMITS.name))).toEqual({ ok: true });
    });

    it("rejects a name one character over the limit", () => {
      const result = validateTrackInput("n".repeat(EVENT_LIMITS.name + 1));
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(String(EVENT_LIMITS.name));
    });

    it("rejects an empty name", () => {
      expect(validateTrackInput("").ok).toBe(false);
    });

    it("rejects a non-string name", () => {
      expect(validateTrackInput(42).ok).toBe(false);
      expect(validateTrackInput(undefined).ok).toBe(false);
      expect(validateTrackInput(null).ok).toBe(false);
    });
  });

  describe("properties", () => {
    it("accepts an absent properties object", () => {
      expect(validateTrackInput("signup")).toEqual({ ok: true });
      expect(validateTrackInput("signup", undefined)).toEqual({ ok: true });
    });

    it("accepts a realistic properties object", () => {
      expect(
        validateTrackInput("purchase", { product_id: "123", value: 499, currency: "INR" }),
      ).toEqual({ ok: true });
    });

    it("accepts nested JSON", () => {
      expect(validateTrackInput("purchase", { items: [{ sku: "a" }, { sku: "b" }] })).toEqual({
        ok: true,
      });
    });

    it("rejects a non-object", () => {
      expect(validateTrackInput("e", "nope" as unknown).ok).toBe(false);
      expect(validateTrackInput("e", 5 as unknown).ok).toBe(false);
    });

    it("rejects an array, which is not a properties object", () => {
      expect(validateTrackInput("e", [1, 2, 3] as unknown).ok).toBe(false);
    });

    it("accepts exactly the maximum number of keys", () => {
      const props = Object.fromEntries(
        Array.from({ length: EVENT_LIMITS.propertyKeys }, (_, i) => [`k${i}`, 1]),
      );
      expect(validateTrackInput("e", props)).toEqual({ ok: true });
    });

    it("rejects one key over the maximum", () => {
      const props = Object.fromEntries(
        Array.from({ length: EVENT_LIMITS.propertyKeys + 1 }, (_, i) => [`k${i}`, 1]),
      );
      const result = validateTrackInput("e", props);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(String(EVENT_LIMITS.propertyKeys));
    });

    it("accepts a key of exactly the maximum length", () => {
      expect(validateTrackInput("e", { ["k".repeat(EVENT_LIMITS.propertyKeyLength)]: 1 })).toEqual({
        ok: true,
      });
    });

    it("rejects a key one character too long", () => {
      const result = validateTrackInput("e", {
        ["k".repeat(EVENT_LIMITS.propertyKeyLength + 1)]: 1,
      });
      expect(result.ok).toBe(false);
    });

    it("rejects an object that serialises over the byte limit", () => {
      const result = validateTrackInput("e", { blob: "x".repeat(EVENT_LIMITS.propertiesBytes) });
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain(String(EVENT_LIMITS.propertiesBytes));
    });

    it("accepts an object just under the byte limit", () => {
      // 20 bytes of headroom for the surrounding `{"blob":"…"}`.
      const props = { blob: "x".repeat(EVENT_LIMITS.propertiesBytes - 20) };
      expect(validateTrackInput("e", props)).toEqual({ ok: true });
    });

    it("counts bytes, not characters, for multi-byte text", () => {
      // "😀" is 4 UTF-8 bytes but 2 UTF-16 code units. A character count would
      // wrongly accept this; a byte count rejects it.
      const emoji = "😀".repeat(Math.ceil(EVENT_LIMITS.propertiesBytes / 4));
      expect(validateTrackInput("e", { blob: emoji }).ok).toBe(false);
    });

    it("rejects values that cannot be serialised", () => {
      expect(validateTrackInput("e", { big: BigInt(1) } as unknown).ok).toBe(false);

      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(validateTrackInput("e", circular).ok).toBe(false);
    });

    it("never mutates or truncates the caller's input", () => {
      const props = { blob: "x".repeat(EVENT_LIMITS.propertiesBytes) };
      const before = props.blob.length;
      validateTrackInput("e", props);
      expect(props.blob.length).toBe(before);
      expect(Object.keys(props)).toEqual(["blob"]);
    });
  });
});
