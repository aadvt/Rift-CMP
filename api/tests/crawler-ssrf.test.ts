import { describe, expect, it } from "vitest";
import {
  assertNavigable,
  checkUrlShape,
  isBlockedAddress,
  isBlockedHostname,
  MAX_URL_LENGTH,
} from "@rift-cmp/crawler";

/**
 * SSRF protections for the scanner.
 *
 * The crawler navigates a URL a customer typed into a form, from inside our
 * network, with our egress identity. That is a request-forgery primitive unless
 * something stops it, and this is that something.
 *
 * These tests are written adversarially rather than illustratively: each one is
 * a way somebody would actually try to reach `169.254.169.254`.
 */
describe("SSRF: URL shape", () => {
  it("allows an ordinary public URL", () => {
    expect(checkUrlShape("https://example.com/pricing").allowed).toBe(true);
  });

  it.each([
    ["file:///etc/passwd", "unsupported_scheme"],
    ["ftp://example.com/", "unsupported_scheme"],
    ["gopher://example.com/", "unsupported_scheme"],
    ["data:text/html,<script>", "unsupported_scheme"],
    ["javascript:alert(1)", "unsupported_scheme"],
  ])("refuses %s", (url, reason) => {
    const verdict = checkUrlShape(url);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe(reason);
  });

  it("refuses embedded credentials, which leak into logs and confuse parsers", () => {
    const verdict = checkUrlShape("https://user:pass@example.com/");
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("credentials_in_url");
  });

  it("refuses a URL longer than the limit", () => {
    const verdict = checkUrlShape(`https://example.com/${"a".repeat(MAX_URL_LENGTH)}`);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("url_too_long");
  });

  it("refuses well-known internal service ports", () => {
    for (const port of [22, 3306, 5432, 6379, 27017, 2375]) {
      const verdict = checkUrlShape(`https://example.com:${port}/`);
      expect(verdict.allowed, `port ${port}`).toBe(false);
      expect(verdict.reason).toBe("blocked_port");
    }
  });

  it("allows ordinary web ports", () => {
    expect(checkUrlShape("https://example.com:8443/").allowed).toBe(true);
    expect(checkUrlShape("http://example.com:3000/").allowed).toBe(true);
  });
});

describe("SSRF: hostnames refused without resolution", () => {
  it.each([
    "localhost",
    "LOCALHOST",
    "localhost.localdomain",
    "metadata.google.internal",
    "instance-data",
    "api.internal",
    "db.local",
    "server.corp",
    "router", // single label: only meaningful inside a network
  ])("refuses %s", (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it("allows ordinary public names, including a trailing dot", () => {
    expect(isBlockedHostname("example.com")).toBe(false);
    expect(isBlockedHostname("www.example.co.uk")).toBe(false);
    expect(isBlockedHostname("example.com.")).toBe(false);
  });
});

describe("SSRF: reserved address ranges", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["127.1.2.3", "loopback range, not just .0.1"],
    ["0.0.0.0", "this network"],
    ["10.1.2.3", "RFC1918"],
    ["172.16.0.1", "RFC1918"],
    ["172.31.255.254", "RFC1918 upper bound"],
    ["192.168.1.1", "RFC1918"],
    ["169.254.169.254", "AWS/GCP metadata"],
    ["169.254.0.1", "link-local"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "broadcast"],
  ])("blocks %s (%s)", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it("allows ordinary public addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("172.32.0.1")).toBe(false); // just outside RFC1918
    expect(isBlockedAddress("11.0.0.1")).toBe(false);
  });

  it.each([
    ["::1", "IPv6 loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["fc00::1", "unique local"],
    ["fd12:3456::1", "unique local"],
    ["ff02::1", "multicast"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:10.0.0.1", "IPv4-mapped RFC1918"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata endpoint"],
  ])("blocks %s (%s)", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it("allows a public IPv6 address", () => {
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("blocks anything it cannot parse rather than assuming it is safe", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("999.999.999.999")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
  });

  it("blocks octal and overlong forms rather than parsing them loosely", () => {
    // `0177.0.0.1` is 127.0.0.1 to some resolvers. Refusing to interpret it is
    // safer than implementing every legacy notation correctly.
    expect(isBlockedAddress("0177.0.0.1")).toBe(true);
  });
});

describe("SSRF: DNS resolution", () => {
  const resolvesTo = (...addresses: string[]) => async () => addresses;

  it("allows a public name resolving to a public address", async () => {
    const verdict = await assertNavigable("https://example.com/", {
      resolver: resolvesTo("93.184.216.34"),
    });
    expect(verdict.allowed).toBe(true);
  });

  it("blocks a public name that resolves to loopback", async () => {
    // The attack the hostname checks cannot see: the name looks fine.
    const verdict = await assertNavigable("https://totally-normal.example/", {
      resolver: resolvesTo("127.0.0.1"),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("private_address");
  });

  it("blocks a public name that resolves to the cloud metadata endpoint", async () => {
    const verdict = await assertNavigable("https://harmless.example/", {
      resolver: resolvesTo("169.254.169.254"),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("private_address");
  });

  it("blocks when only one of several answers is private", async () => {
    // Which address the browser picks is not ours to control, so one bad
    // answer has to be enough to refuse the whole name.
    const verdict = await assertNavigable("https://mixed.example/", {
      resolver: resolvesTo("93.184.216.34", "10.0.0.5"),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("private_address");
  });

  it("blocks a name resolving to an IPv4-mapped IPv6 private address", async () => {
    const verdict = await assertNavigable("https://sneaky.example/", {
      resolver: resolvesTo("::ffff:192.168.0.1"),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("private_address");
  });

  it("refuses when the name resolves to nothing", async () => {
    const verdict = await assertNavigable("https://empty.example/", {
      resolver: resolvesTo(),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("dns_resolution_failed");
  });

  it("refuses when resolution fails rather than proceeding", async () => {
    const verdict = await assertNavigable("https://broken.example/", {
      resolver: async () => {
        throw new Error("ENOTFOUND");
      },
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("dns_resolution_failed");
  });

  it("judges an IP literal without resolving it at all", async () => {
    let called = false;
    const verdict = await assertNavigable("http://10.0.0.1/", {
      resolver: async () => {
        called = true;
        return ["93.184.216.34"];
      },
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe("private_address");
    // A resolver that "fixed" a literal would be a bypass.
    expect(called).toBe(false);
  });

  it("rejects the shape before spending a DNS lookup", async () => {
    let called = false;
    const verdict = await assertNavigable("file:///etc/passwd", {
      resolver: async () => {
        called = true;
        return [];
      },
    });
    expect(verdict.allowed).toBe(false);
    expect(called).toBe(false);
  });
});
