import type {
  ClassifiedComponent,
  DriftFinding,
  FindingSeverity,
  PageCookie,
  PageComponent,
  PageIntelligence,
  ScanResultsResponse,
  ShadowTracker,
  ShadowTrackerReason,
  SiteIntelligence,
  VendorRecommendation,
} from "@rift-cmp/shared";

/**
 * Turning observations into findings.
 *
 * Everything here is a pure function over evidence that has already been
 * gathered: scan results, the approved policy, runtime discovery. No database
 * access and no fetching, so each rule can be tested on a literal and the
 * reasons a finding appeared are the arguments that were passed in.
 *
 * ## The rule this file is written under
 *
 * **Uncertainty stays uncertain.** The scanner's confidence is carried across
 * unchanged, and an unclassified host is reported as unclassified. It is never
 * promoted to "tracker" because it looked suspicious and never treated as
 * requiring consent because that would be the safe-sounding answer. Unknown is
 * not permission — the policy engine already refuses to turn absence into
 * `allow` — and it is not an accusation either.
 *
 * **Severity describes the gap, not the technology.** A blocked vendor still
 * running is critical because a decision is being ignored. An unclassified host
 * is low because nobody has looked at it yet, which is a task rather than a
 * fault. Marking everything high would make the list unreadable and train
 * people to skip it.
 */

/** Actions that mean "this must not run until somebody consents". */
const GATED_ACTIONS = new Set(["require_consent", "block"]);

/** Categories that are infrastructure rather than tracking, per the catalogue. */
const INFRASTRUCTURE = new Set(["cdn", "fonts", "hosting", "security", "consent_management"]);

export interface IntelligenceInput {
  siteId: string;
  scanId: string | null;
  baselineScanId: string | null;
  /** Observations from the most recent completed scan. */
  results: ScanResultsResponse | null;
  /** The scan before it, for drift. Null when this is the first. */
  baseline: ScanResultsResponse | null;
  /** Recommendations from the approved policy version, or none if unapproved. */
  approved: VendorRecommendation[];
  /** The approved version number, for attributing a finding to a decision. */
  policyVersion: number | null;
  /** Hosts seen by the SDK in real browsers, when in-page discovery is running. */
  runtime: ClassifiedComponent[];
  now?: Date;
}

/** Matches an observation to the recommendation covering it, if any. */
function recommendationFor(
  approved: VendorRecommendation[],
  detectorId: string,
  vendorName: string | null,
): VendorRecommendation | null {
  return (
    approved.find((r) => r.detector_id === detectorId) ??
    (vendorName ? (approved.find((r) => r.vendor_name === vendorName) ?? null) : null)
  );
}

function severityFor(reason: ShadowTrackerReason): FindingSeverity {
  switch (reason) {
    // A decision is being ignored. Somebody said "do not load this" and it
    // loaded, which is the only case here where the configuration is actively
    // wrong rather than incomplete.
    case "blocked_but_observed":
      return "critical";
    // Running where consent was required and not given.
    case "consent_required_without_consent":
      return "high";
    // Observed, nobody has decided anything about it.
    case "not_configured":
      return "medium";
    // Approved but ungated: a decision was made and then not wired to anything.
    case "no_purpose":
      return "medium";
    // Nobody has looked yet. A task, not a fault.
    case "unclassified_behaviour":
      return "low";
  }
}

const REMEDY: Record<ShadowTrackerReason, string> = {
  blocked_but_observed:
    "Your configuration says this should not load, and it did. Check the snippet is installed on this page and that enforcement is set to enforce rather than observe.",
  consent_required_without_consent:
    "This is configured to wait for consent but was seen running. Confirm the snippet loads before the vendor's own script.",
  not_configured:
    "Nothing in your approved configuration covers this. Review it and decide whether it needs consent.",
  no_purpose:
    "This is approved but no purpose is attached, so nothing gates it. Attach a purpose on Configure.",
  unclassified_behaviour:
    "Rift could not determine what this is. Classify it, or leave it unresolved — unresolved is not the same as requiring consent.",
};

/**
 * What is running that the configuration does not account for.
 *
 * Third-party observations only. A request to the site's own domain is the site
 * serving itself, and listing it would bury the four findings that matter under
 * forty that do not.
 */
export function detectShadowTrackers(input: IntelligenceInput): ShadowTracker[] {
  const technologies = input.results?.technologies ?? [];
  const requests = input.results?.requests ?? [];
  const findings: ShadowTracker[] = [];
  const seen = new Set<string>();

  const add = (t: ShadowTracker) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    findings.push(t);
  };

  for (const tech of technologies) {
    const rec = recommendationFor(input.approved, tech.detector_id, tech.name);
    const hosts = requests
      .filter((r) => r.third_party && r.host.includes(tech.name.toLowerCase().replace(/\s+/g, "")))
      .map((r) => r.host);
    const host = hosts[0] ?? tech.name;

    // Infrastructure a person has already approved is not a finding. It is the
    // configuration working.
    const isInfrastructure = INFRASTRUCTURE.has(tech.category);

    let reason: ShadowTrackerReason | null = null;
    if (!rec) {
      reason = tech.category === "unclassified" ? "unclassified_behaviour" : "not_configured";
    } else if (rec.recommended_action === "block") {
      reason = "blocked_but_observed";
    } else if (GATED_ACTIONS.has(rec.recommended_action) && !rec.suggested_purpose) {
      reason = "no_purpose";
    }

    if (reason === "not_configured" && isInfrastructure) continue;
    if (!reason) continue;

    add({
      id: tech.detector_id,
      host,
      vendor: rec?.vendor_name ?? tech.name,
      category: tech.category === "unclassified" ? null : tech.category,
      reason,
      severity: severityFor(reason),
      pages: [],
      destination_country: tech.destination_country ?? null,
      crosses_border: Boolean(tech.crosses_border),
      confidence: tech.confidence,
      approved: Boolean(rec),
      purpose: rec?.suggested_purpose ?? null,
      policy_action: rec?.recommended_action ?? null,
      evidence: [
        {
          source: "scan",
          detail: `Observed by the scanner as ${tech.name}, classified ${tech.category} with ${tech.confidence} confidence.`,
          ...(input.scanId ? { scan_id: input.scanId } : {}),
        },
        ...(rec
          ? [
              {
                source: "policy" as const,
                detail: `Approved configuration says ${rec.recommended_action}${
                  rec.suggested_purpose ? ` under "${rec.suggested_purpose}"` : " with no purpose attached"
                }.`,
              },
            ]
          : [
              {
                source: "policy" as const,
                detail: "No approved recommendation covers this technology.",
              },
            ]),
      ],
      recommended_action: REMEDY[reason],
      first_seen: null,
      last_seen: null,
    });
  }

  // Runtime evidence: hosts real browsers contacted. Stronger than a scan —
  // this happened to an actual visitor — so a blocked vendor seen here is the
  // most serious finding the system can produce.
  for (const component of input.runtime) {
    if (!component.third_party) continue;
    if (component.category && INFRASTRUCTURE.has(component.category)) continue;

    const rec = recommendationFor(input.approved, component.host, component.vendor);
    let reason: ShadowTrackerReason | null = null;
    if (!rec) reason = component.vendor ? "not_configured" : "unclassified_behaviour";
    else if (rec.recommended_action === "block") reason = "blocked_but_observed";

    if (!reason) continue;

    add({
      id: component.host,
      host: component.host,
      vendor: component.vendor,
      category: component.category,
      reason,
      severity: severityFor(reason),
      pages: [component.page_url],
      destination_country: component.destination_country,
      crosses_border: component.crosses_border,
      // A host contacted by a real browser is observed fact; whether we know
      // *what* it is remains uncertain when the catalogue has no vendor for it.
      confidence: component.vendor ? "high" : "low",
      approved: Boolean(rec),
      purpose: rec?.suggested_purpose ?? null,
      policy_action: rec?.recommended_action ?? null,
      evidence: [
        {
          source: "runtime",
          detail: `Contacted from ${component.page_url} in a visitor's browser, ${component.request_count} request(s).`,
          observed_at: component.last_seen,
        },
      ],
      recommended_action: REMEDY[reason],
      first_seen: component.first_seen,
      last_seen: component.last_seen,
    });
  }

  const order: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity] || a.host.localeCompare(b.host));
}

/**
 * What changed between two scans, judged against the approved configuration.
 *
 * A difference is only interesting relative to a decision. A new tracker on a
 * site with no approved policy is not drift — nothing was decided for it to
 * drift from — so those are reported as ordinary findings and the policy-aware
 * rules stay quiet.
 */
export function detectDrift(input: IntelligenceInput): DriftFinding[] {
  const findings: DriftFinding[] = [];
  if (!input.results) return findings;

  const current = new Map(input.results.technologies.map((t) => [t.detector_id, t]));
  const previous = new Map((input.baseline?.technologies ?? []).map((t) => [t.detector_id, t]));

  const evidence = (detail: string) => [
    {
      source: "scan" as const,
      detail,
      ...(input.scanId ? { scan_id: input.scanId } : {}),
    },
  ];

  // A first scan has nothing to compare against. Reporting every technology as
  // "added" would be true of the data and false about the site.
  if (input.baseline) {
    for (const [id, tech] of current) {
      if (previous.has(id)) continue;
      const rec = recommendationFor(input.approved, id, tech.name);
      findings.push({
        id: `added:${id}`,
        kind: "tracker_added",
        severity: rec ? "medium" : "high",
        host: tech.name,
        vendor: tech.name,
        page: null,
        previous_state: "Not present in the previous scan",
        current_state: `Observed, classified ${tech.category} with ${tech.confidence} confidence`,
        policy_version: input.policyVersion,
        evidence: evidence(`Present in this scan and absent from the previous one.`),
        recommended_action: rec
          ? "Already covered by your approved configuration. Confirm the purpose still fits."
          : "New and unaccounted for. Review it before it collects anything you have not decided about.",
      });
    }

    for (const [id, tech] of previous) {
      if (current.has(id)) continue;
      findings.push({
        id: `removed:${id}`,
        kind: "tracker_removed",
        severity: "info",
        host: tech.name,
        vendor: tech.name,
        page: null,
        previous_state: "Present in the previous scan",
        current_state: "Not observed in this scan",
        policy_version: input.policyVersion,
        evidence: evidence("Absent from this scan and present in the previous one."),
        // Stated rather than assumed: a crawl that reached fewer pages looks
        // exactly like a vendor that was removed.
        recommended_action:
          "It may have been removed, or this crawl may simply not have reached the page that loads it. Check before removing it from your configuration.",
      });
    }
  }

  // Policy-aware rules. These need an approved decision to drift from.
  for (const rec of input.approved) {
    const observed = current.get(rec.detector_id);

    if (rec.recommended_action === "block" && observed) {
      findings.push({
        id: `blocked:${rec.detector_id}`,
        kind: "blocked_still_active",
        severity: "critical",
        host: rec.vendor_name,
        vendor: rec.vendor_name,
        page: null,
        previous_state: `Approved configuration says block`,
        current_state: "Still observed on the site",
        policy_version: input.policyVersion,
        evidence: evidence(`Approved as "block" and still present in the latest scan.`),
        recommended_action:
          "A decision is being ignored. Check the snippet is installed and enforcement is set to enforce rather than observe.",
      });
    }

    if (GATED_ACTIONS.has(rec.recommended_action) && !rec.suggested_purpose && observed) {
      findings.push({
        id: `unconfigured:${rec.detector_id}`,
        kind: "consent_required_unconfigured",
        severity: "high",
        host: rec.vendor_name,
        vendor: rec.vendor_name,
        page: null,
        previous_state: "Approved as needing consent",
        current_state: "Running with no purpose attached, so nothing gates it",
        policy_version: input.policyVersion,
        evidence: evidence("Approved recommendation requires consent but names no purpose."),
        recommended_action:
          "Attach a purpose on Configure. Until then the requirement is recorded but not enforced.",
      });
    }

    // Approved for something the site no longer runs. Not urgent, but a
    // configuration describing a vendor nobody uses is one nobody maintains.
    if (!observed && input.baseline && !previous.has(rec.detector_id)) {
      findings.push({
        id: `stale:${rec.detector_id}`,
        kind: "policy_ahead_of_site",
        severity: "low",
        host: rec.vendor_name,
        vendor: rec.vendor_name,
        page: null,
        previous_state: "Covered by the approved configuration",
        current_state: "Not observed in the last two scans",
        policy_version: input.policyVersion,
        evidence: evidence("Approved, and absent from both the current and previous scans."),
        recommended_action:
          "Your configuration covers something the site no longer appears to use. Harmless, but worth tidying.",
      });
    }
  }

  const order: Record<FindingSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function buildSiteIntelligence(input: IntelligenceInput): SiteIntelligence {
  return {
    site_id: input.siteId,
    generated_at: (input.now ?? new Date()).toISOString(),
    scan_id: input.scanId,
    baseline_scan_id: input.baselineScanId,
    shadow_trackers: detectShadowTrackers(input),
    drift: detectDrift(input),
    legal_advice: false,
  };
}

/**
 * What is happening on one page, and how firmly we know it.
 *
 * ## Page attribution is thinner than it looks
 *
 * The crawler records scripts with the page they were seen on, and in-page
 * discovery records the page a request came from. Cookies and network requests
 * are aggregated across the whole scan — there is no page on those rows.
 *
 * So a cookie shown against a page is a host match, not a sighting, and it is
 * marked `inferred` rather than `observed`. The alternative was to leave
 * cookies out of the page view entirely, which would have been honest and much
 * less useful; marking the claim is better than dropping it or overstating it.
 */
export function buildPageIntelligence(
  input: IntelligenceInput & { shadowTrackers?: ShadowTracker[]; drift?: DriftFinding[] },
): PageIntelligence[] {
  const results = input.results;
  if (!results) return [];

  const shadow = input.shadowTrackers ?? detectShadowTrackers(input);
  const drift = input.drift ?? detectDrift(input);

  const technologyByHost = new Map<string, (typeof results.technologies)[number]>();
  for (const tech of results.technologies) {
    // The catalogue keys on detector id; hosts are matched loosely because a
    // script URL and a detector id rarely spell a vendor the same way.
    technologyByHost.set(tech.detector_id.toLowerCase(), tech);
    technologyByHost.set(tech.name.toLowerCase().replace(/\s+/g, ""), tech);
  }

  const findTech = (host: string) => {
    const h = host.toLowerCase();
    for (const [key, tech] of technologyByHost) {
      if (key.length > 3 && (h.includes(key) || key.includes(h.split(".")[0] ?? ""))) return tech;
    }
    return null;
  };

  const jurisdictions = input.approved[0]?.jurisdictions ?? [];

  return results.pages.map((page) => {
    const components: PageComponent[] = [];
    const seen = new Set<string>();

    const push = (c: PageComponent) => {
      const key = `${c.host}:${c.observed_as}`;
      if (seen.has(key)) return;
      seen.add(key);
      components.push(c);
    };

    // Scripts carry the page they were seen on, so these are genuine sightings.
    for (const script of results.scripts) {
      if (script.observed_on !== page.url || !script.host) continue;

      const tech = findTech(script.host);
      const rec = tech ? recommendationFor(input.approved, tech.detector_id, tech.name) : null;

      push({
        host: script.host,
        vendor: rec?.vendor_name ?? tech?.name ?? null,
        category: tech?.category === "unclassified" ? null : (tech?.category ?? null),
        third_party: script.third_party,
        confidence: tech?.confidence ?? "low",
        attribution: "observed",
        observed_as: "script",
        purpose: rec?.suggested_purpose ?? null,
        policy_action: rec?.recommended_action ?? null,
        consent_required: rec?.consent_requirement ?? null,
        enforcement: rec ? (rec.recommended_action === "block" ? "enforce" : "observe") : null,
        destination_country: tech?.destination_country ?? null,
        crosses_border: Boolean(tech?.crosses_border),
      });
    }

    // Runtime discovery records the page a request came from, so these are
    // sightings too — and stronger ones, since they happened to a real visitor.
    for (const component of input.runtime) {
      if (component.page_url !== page.url) continue;
      const rec = recommendationFor(input.approved, component.host, component.vendor);

      push({
        host: component.host,
        vendor: component.vendor,
        category: component.category,
        third_party: component.third_party,
        confidence: component.vendor ? "high" : "low",
        attribution: "observed",
        observed_as: `runtime ${component.kind}`,
        purpose: rec?.suggested_purpose ?? null,
        policy_action: rec?.recommended_action ?? null,
        consent_required: rec?.consent_requirement ?? null,
        enforcement: rec ? (rec.recommended_action === "block" ? "enforce" : "observe") : null,
        destination_country: component.destination_country,
        crosses_border: component.crosses_border,
      });
    }

    const hostsOnPage = new Set(components.map((c) => c.host.toLowerCase()));

    // Matched, not observed. See the note above.
    const cookies: PageCookie[] = results.cookies
      .filter((cookie) =>
        [...hostsOnPage].some(
          (host) => host.endsWith(cookie.domain.replace(/^\./, "")) || cookie.domain.includes(host),
        ),
      )
      .map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain,
        third_party: cookie.third_party,
        attribution: "inferred" as const,
      }));

    const pageHosts = new Set(components.map((c) => c.host));

    /**
     * Whether a site-level finding belongs to this page.
     *
     * Loose on purpose. A finding derived from a detected technology carries a
     * display name — "Google Analytics" — while a page carries a host —
     * `www.google-analytics.com`. Matching those exactly finds nothing, so every
     * finding would be site-level and no page would ever show one, which is the
     * failure this comparison exists to avoid. Compared on a squashed form of
     * both the finding's host and its vendor name.
     */
    const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const pageKeys = [...pageHosts, ...components.map((c) => c.vendor ?? "")]
      .filter(Boolean)
      .map(squash);

    const belongsToPage = (host: string | null, vendor: string | null) => {
      const candidates = [host, vendor].filter((v): v is string => Boolean(v)).map(squash);
      return candidates.some((candidate) =>
        pageKeys.some(
          (key) => key.length > 3 && candidate.length > 3 && (key.includes(candidate) || candidate.includes(key)),
        ),
      );
    };

    const pageShadow = shadow.filter(
      (s) => s.pages.includes(page.url) || belongsToPage(s.host, s.vendor),
    );
    const pageDrift = drift.filter((d) => belongsToPage(d.host, d.vendor));

    const purposes = [...new Set(components.map((c) => c.purpose).filter((p): p is string => Boolean(p)))];
    const dataCategories = [
      ...new Set(
        input.approved
          .filter((r) => pageHosts.has(r.vendor_name) || [...pageHosts].some((h) => h.includes(r.detector_id)))
          .flatMap((r) => r.data_categories),
      ),
    ];

    return {
      url: page.url,
      title: page.title,
      status: page.status,
      components,
      cookies,
      purposes,
      data_categories: dataCategories,
      jurisdictions,
      policy_version: input.policyVersion,
      shadow_trackers: pageShadow,
      drift: pageDrift,
      unresolved: components
        .filter((c) => c.third_party && c.vendor === null)
        .map((c) => ({ host: c.host, confidence: c.confidence })),
      summary: {
        components: components.length,
        third_party: components.filter((c) => c.third_party).length,
        // The reason to open this page: things nobody has decided about.
        needs_review: pageShadow.length,
      },
    };
  });
}
