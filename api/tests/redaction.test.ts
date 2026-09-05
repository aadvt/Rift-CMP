/**
 * Redaction, and the copies of a field that a naive redactor misses.
 *
 * The interesting bug in a redactor is never the field it was pointed at — that
 * one works on the first try. It is the second copy: inside an array, under a
 * differently-cased key, in the query string of the same request, in a header,
 * three levels down in a nested object, or repeated twice in one query string.
 * A redactor that handles the top level and nothing else is worse than none,
 * because the operator now believes the field is gone.
 *
 * So most of this file is alternate representations of the same leak, and one
 * test at the end walks every serialisation the outcome exposes to check that
 * the original value is not reachable through any of them.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_DEPTH,
  redact,
  validateRedactionConfig,
  type RedactionConfig,
} from "@rift-cmp/shared/redaction";

const EMAIL = "someone@example.com";

const config: RedactionConfig = {
  rules: [
    { id: "email", field: "email", match: "name", strategy: "remove" },
    { id: "phone", field: "phone", match: "name", strategy: "mask" },
  ],
};

function paths(outcome: ReturnType<typeof redact>): string[] {
  return outcome.applied.map((a) => a.path);
}

// ─── Structure ───────────────────────────────────────────────────────────────

describe("finding every copy of a field", () => {
  it("redacts a top-level field", () => {
    const out = redact({ url: "/collect", body: { email: EMAIL, id: 7 } }, config);
    expect(out.body).toEqual({ id: 7 });
    expect(paths(out)).toEqual(["email"]);
  });

  it("redacts inside a nested object", () => {
    const out = redact({ url: "/collect", body: { user: { profile: { email: EMAIL } } } }, config);
    expect(out.body).toEqual({ user: { profile: {} } });
    expect(paths(out)).toEqual(["user.profile.email"]);
  });

  it("redacts inside every element of an array", () => {
    // One hit and two misses is the classic version of this bug.
    const out = redact(
      { url: "/collect", body: { users: [{ email: "a@x.com" }, { email: "b@x.com" }] } },
      config,
    );
    expect(out.body).toEqual({ users: [{}, {}] });
    expect(paths(out)).toEqual(["users[0].email", "users[1].email"]);
  });

  it("redacts through arrays of arrays", () => {
    const out = redact({ url: "/c", body: { rows: [[{ email: EMAIL }]] } }, config);
    expect(out.body).toEqual({ rows: [[{}]] });
  });

  it("redacts several different sensitive fields in one pass", () => {
    const out = redact(
      { url: "/c", body: { email: EMAIL, phone: "+44 7000 000000", city: "Leeds" } },
      config,
    );
    expect(out.body).toEqual({ phone: "[redacted]", city: "Leeds" });
    expect(out.applied).toHaveLength(2);
  });

  it("does nothing when the field is absent", () => {
    const out = redact({ url: "/c", body: { id: 7 } }, config);
    expect(out.body).toEqual({ id: 7 });
    expect(out.applied).toEqual([]);
  });

  it("leaves unrelated fields exactly as they were", () => {
    // The failure mode on this side is a redactor that is too eager and quietly
    // breaks a customer's integration.
    const body = { emailPreferences: "weekly", telephone: "x", id: 7, nested: { emails: 3 } };
    const out = redact({ url: "/c", body }, config);
    expect(out.body).toEqual(body);
    expect(out.applied).toEqual([]);
  });

  it("does not mutate the caller's payload", () => {
    const body = { email: EMAIL };
    redact({ url: "/c", body }, config);
    expect(body.email).toBe(EMAIL);
  });

  it("does not descend into a field it has already removed", () => {
    // Reporting a second hit inside a subtree that is already gone would be
    // double-counting something that no longer exists.
    const out = redact(
      { url: "/c", body: { email: { address: EMAIL, alternate: EMAIL } } },
      config,
    );
    expect(out.body).toEqual({});
    expect(paths(out)).toEqual(["email"]);
  });
});

// ─── Matching ────────────────────────────────────────────────────────────────

describe("matching", () => {
  it("matches a field name case-insensitively by default", () => {
    const out = redact({ url: "/c", body: { Email: EMAIL, EMAIL: EMAIL } }, config);
    expect(out.body).toEqual({});
    expect(out.applied).toHaveLength(2);
  });

  it("respects case when the operator asks it to", () => {
    const strict: RedactionConfig = {
      rules: [{ id: "e", field: "email", match: "name", strategy: "remove", caseSensitive: true }],
    };
    const out = redact({ url: "/c", body: { email: EMAIL, Email: EMAIL } }, strict);
    expect(out.body).toEqual({ Email: EMAIL });
  });

  it("targets one path when the same name appears in two places", () => {
    // `location` is a warehouse on one site and a person on another. A path rule
    // is how an operator says which one they mean.
    const scoped: RedactionConfig = {
      rules: [{ id: "l", field: "user.location", match: "path", strategy: "remove" }],
    };
    const out = redact(
      { url: "/c", body: { user: { location: "Leeds" }, warehouse: { location: "Leeds" } } },
      scoped,
    );
    expect(out.body).toEqual({ user: {}, warehouse: { location: "Leeds" } });
  });

  it("lets a path rule stand for every array index", () => {
    const scoped: RedactionConfig = {
      rules: [{ id: "l", field: "users[].email", match: "path", strategy: "remove" }],
    };
    const out = redact(
      { url: "/c", body: { users: [{ email: "a@x" }, { email: "b@x" }], email: "keep@x" } },
      scoped,
    );
    expect(out.body).toEqual({ users: [{}, {}], email: "keep@x" });
  });

  it("applies a rule only where the operator scoped it", () => {
    const bodyOnly: RedactionConfig = {
      rules: [
        { id: "e", field: "email", match: "name", locations: ["body"], strategy: "remove" },
      ],
    };
    const out = redact({ url: "/c?email=a@x.com", body: { email: EMAIL } }, bodyOnly);
    expect(out.body).toEqual({});
    expect(out.url).toContain("email=");
  });
});

// ─── Strategies ──────────────────────────────────────────────────────────────

describe("strategies", () => {
  it("removes the key entirely", () => {
    const out = redact({ url: "/c", body: { email: EMAIL } }, config);
    expect(Object.keys(out.body as object)).not.toContain("email");
  });

  it("masks in place, so a downstream schema still validates", () => {
    const out = redact({ url: "/c", body: { phone: "+44" } }, config);
    expect(out.body).toEqual({ phone: "[redacted]" });
  });

  it("honours a custom mask token", () => {
    const out = redact({ url: "/c", body: { phone: "+44" } }, { ...config, maskToken: "***" });
    expect(out.body).toEqual({ phone: "***" });
  });

  it("hashes consistently, so downstream correlation still works", () => {
    const hashed: RedactionConfig = {
      rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }],
      hashSalt: "a-real-salt",
    };
    const a = redact({ url: "/c", body: { email: EMAIL } }, hashed).body as { email: string };
    const b = redact({ url: "/c", body: { email: EMAIL } }, hashed).body as { email: string };

    expect(a.email).toBe(b.email);
    expect(a.email).not.toContain("example.com");
  });

  it("produces a different digest under a different salt", () => {
    const one = redact(
      { url: "/c", body: { email: EMAIL } },
      { rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }], hashSalt: "one" },
    ).body as { email: string };
    const two = redact(
      { url: "/c", body: { email: EMAIL } },
      { rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }], hashSalt: "two" },
    ).body as { email: string };

    expect(one.email).not.toBe(two.email);
  });

  it("removes rather than hashing when no salt was configured", () => {
    // An unsalted digest of a low-entropy value is the value. Falling back to
    // removal is the only safe direction to fail in.
    const out = redact(
      { url: "/c", body: { email: EMAIL } },
      { rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }] },
    );
    expect(out.body).toEqual({});
  });
});

// ─── Other locations ─────────────────────────────────────────────────────────

describe("query strings and headers", () => {
  it("redacts a query parameter", () => {
    const out = redact({ url: "https://v.example/c?email=a%40x.com&id=7" }, config);
    expect(out.url).not.toContain("a%40x.com");
    expect(out.url).toContain("id=7");
  });

  it("redacts every copy of a repeated query parameter", () => {
    // Removing only the first leaves the value in the request, which is the
    // whole failure.
    const out = redact({ url: "/c?email=a%40x.com&email=b%40x.com" }, config);
    expect(out.url).not.toContain("a%40x.com");
    expect(out.url).not.toContain("b%40x.com");
  });

  it("masks a query parameter in place", () => {
    const out = redact({ url: "/c?phone=%2B44" }, config);
    expect(out.url).toContain("phone=");
    expect(out.url).not.toContain("%2B44");
  });

  it("keeps a relative URL relative", () => {
    const out = redact({ url: "/collect?email=a%40x.com&id=7" }, config);
    expect(out.url.startsWith("/collect")).toBe(true);
  });

  it("redacts a header the operator named", () => {
    const headerRule: RedactionConfig = {
      rules: [{ id: "h", field: "X-Email", match: "name", locations: ["header"], strategy: "remove" }],
    };
    const out = redact({ url: "/c", headers: { "X-Email": EMAIL, "X-Id": "7" } }, headerRule);
    expect(out.headers).toEqual({ "X-Id": "7" });
    expect(out.applied[0]?.location).toBe("header");
  });

  it("does not guess that X-Email is the email rule", () => {
    // Inferring header names from a body field name is the over-eager direction:
    // it would also strip `X-Email-Verified` and any header a customer happened
    // to prefix. The operator names the header they mean.
    const out = redact({ url: "/c", headers: { "X-Email": EMAIL } }, config);
    expect(out.headers).toEqual({ "X-Email": EMAIL });
    expect(out.applied).toEqual([]);
  });

  it("redacts a JSON string body and gives it back as a string", () => {
    const out = redact({ url: "/c", body: JSON.stringify({ email: EMAIL, id: 7 }) }, config);
    expect(typeof out.body).toBe("string");
    expect(out.body).not.toContain("example.com");
    expect(JSON.parse(out.body as string)).toEqual({ id: 7 });
  });

  it("leaves a body it cannot parse alone rather than guessing", () => {
    // A half-understood format edited by regex is how a redactor corrupts a
    // payload. Better to report that nothing was redacted.
    const body = "email=someone@example.com&id=7";
    const out = redact({ url: "/c", body }, config);
    expect(out.body).toBe(body);
    expect(out.applied).toEqual([]);
  });
});

// ─── Refusal ─────────────────────────────────────────────────────────────────

describe("payloads it refuses", () => {
  it("refuses a payload nested past the depth ceiling", () => {
    let deep: Record<string, unknown> = { email: EMAIL };
    for (let i = 0; i < MAX_DEPTH + 5; i += 1) deep = { level: deep };

    const out = redact({ url: "/c", body: deep }, config);
    expect(out.refused).toBe(true);
    expect(out.refusedReason).toMatch(/nests deeper/i);
    // Refusing means the caller must not send it. It does not mean sending the
    // original, and the caller is told which happened.
    expect(out.applied).toEqual([]);
  });

  it("handles a null and an empty body without complaint", () => {
    expect(redact({ url: "/c", body: null }, config).refused).toBe(false);
    expect(redact({ url: "/c" }, config).refused).toBe(false);
  });

  it("handles a body that is a bare array", () => {
    const out = redact({ url: "/c", body: [{ email: EMAIL }] }, config);
    expect(out.body).toEqual([{}]);
  });
});

// ─── Configuration ───────────────────────────────────────────────────────────

describe("validating a rule set", () => {
  it("accepts a good configuration", () => {
    expect(validateRedactionConfig(config)).toEqual([]);
  });

  it("rejects a rule with no id", () => {
    const problems = validateRedactionConfig({
      rules: [{ id: "", field: "email", match: "name", strategy: "remove" }],
    });
    expect(problems[0]?.message).toMatch(/non-empty id/i);
  });

  it("rejects two rules sharing an id", () => {
    const problems = validateRedactionConfig({
      rules: [
        { id: "e", field: "email", match: "name", strategy: "remove" },
        { id: "e", field: "phone", match: "name", strategy: "remove" },
      ],
    });
    expect(problems.some((p) => /share this id/i.test(p.message))).toBe(true);
  });

  it("rejects an unknown strategy", () => {
    const problems = validateRedactionConfig({
      rules: [
        { id: "e", field: "email", match: "name", strategy: "shred" as never },
      ],
    });
    expect(problems.some((p) => /Unknown strategy/i.test(p.message))).toBe(true);
  });

  it("rejects an unknown location", () => {
    const problems = validateRedactionConfig({
      rules: [
        { id: "e", field: "email", match: "name", strategy: "remove", locations: ["cookie" as never] },
      ],
    });
    expect(problems.some((p) => /Unknown location/i.test(p.message))).toBe(true);
  });

  it("refuses a hash rule with no salt", () => {
    const problems = validateRedactionConfig({
      rules: [{ id: "e", field: "email", match: "name", strategy: "hash" }],
    });
    expect(problems[0]?.message).toMatch(/reversible/i);
  });

  it("rejects an empty field", () => {
    const problems = validateRedactionConfig({
      rules: [{ id: "e", field: "  ", match: "name", strategy: "remove" }],
    });
    expect(problems.some((p) => /field to match is empty/i.test(p.message))).toBe(true);
  });
});

// ─── The whole point ─────────────────────────────────────────────────────────

describe("nothing sensitive escapes", () => {
  it("reports what rule ran without repeating the value", () => {
    // Proving redaction happened by logging what was redacted would defeat the
    // exercise, and it is exactly the kind of well-meaning debug line that ends
    // up in a log aggregator forever.
    const out = redact({ url: "/c", body: { email: EMAIL } }, config);
    expect(JSON.stringify(out.applied)).not.toContain("example.com");
    expect(JSON.stringify(out.applied)).not.toContain("someone");
    expect(out.applied[0]).toEqual({
      ruleId: "email",
      location: "body",
      path: "email",
      strategy: "remove",
    });
  });

  it("leaves the value unreachable through any serialisation of the outcome", () => {
    // The same value planted in every place the walk covers, then the entire
    // outcome flattened and searched. If any route missed it, this finds it.
    const out = redact(
      {
        url: "/collect?email=someone%40example.com",
        body: {
          email: EMAIL,
          nested: { email: EMAIL },
          list: [{ email: EMAIL }, { deeper: { email: EMAIL } }],
        },
        headers: { email: EMAIL, "X-Other": "fine" },
      },
      config,
    );

    const everything = JSON.stringify({
      url: out.url,
      body: out.body,
      headers: out.headers,
      applied: out.applied,
    });

    expect(everything).not.toContain("someone@example.com");
    expect(everything).not.toContain("someone%40example.com");
    expect(everything).toContain("fine");
  });
});
