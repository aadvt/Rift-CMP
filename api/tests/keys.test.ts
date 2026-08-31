import { describe, expect, it } from "vitest";
import {
  generatePublicKey,
  generateSecretKey,
  hashSecretKey,
  isPublicKeyFormat,
  isSecretKeyFormat,
} from "database";

describe("key separation", () => {
  it("mints distinguishable public and secret keys", () => {
    expect(generatePublicKey()).toMatch(/^pk_[0-9a-f]{32}$/);
    expect(generateSecretKey()).toMatch(/^sk_[0-9a-f]{64}$/);
  });

  it("never classifies a key as belonging to both planes", () => {
    const publicKey = generatePublicKey();
    const secretKey = generateSecretKey();

    expect(isPublicKeyFormat(publicKey)).toBe(true);
    expect(isSecretKeyFormat(publicKey)).toBe(false);

    expect(isSecretKeyFormat(secretKey)).toBe(true);
    expect(isPublicKeyFormat(secretKey)).toBe(false);
  });

  it("rejects bare prefixes with no entropy", () => {
    expect(isPublicKeyFormat("pk_")).toBe(false);
    expect(isSecretKeyFormat("sk_")).toBe(false);
  });

  it("hashes secret keys deterministically and irreversibly", () => {
    const secretKey = generateSecretKey();
    const digest = hashSecretKey(secretKey);

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecretKey(secretKey)).toBe(digest);
    expect(digest).not.toContain(secretKey.slice(3));
    expect(hashSecretKey(generateSecretKey())).not.toBe(digest);
  });

  it("generates unique keys across calls", () => {
    const keys = new Set(Array.from({ length: 100 }, generatePublicKey));
    expect(keys.size).toBe(100);
  });
});
