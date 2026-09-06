# The consent dependency graph and the privacy impact simulator

Two features, one principle: **show what is actually known, and say how it is
known.**

## The graph is a view, never a second source of truth

Every node and edge is derived at request time from data that already exists —
scan results, the approved configuration, enforcement events, intelligence
findings, experiments. Nothing is persisted. There are no graph tables and no
migration.

A stored graph is a copy; a copy drifts; and the first question anyone would ask
of a stored edge is whether it is still true. The cost is that each request does
the gathering work. That is the right trade: a stale graph that looks current is
worse than a slow one.

## Provenance

Every edge and every node carries one of five values. This is the most important
thing on the screen, because the same picture can mean four different things.

| Provenance | Means | Example |
| --- | --- | --- |
| `OBSERVED` | A crawler or the runtime saw it happen | A page loaded a script |
| `CONFIGURED` | An operator declared it. Nobody has seen it | A declared purpose, a market |
| `ENFORCED` | The firewall acted on it, or would have | A BLOCK decision |
| `INFERRED` | Rift matched it. Something computed it | A host matched to a vendor by the catalogue |
| `UNKNOWN` | Asked, and not answered | — |

A tracker joined to a vendor by a catalogue lookup and a tracker *seen* sending
data to that vendor render identically on a canvas, and only one is evidence.
Presenting an inference as an observation is the specific failure this design is
shaped to prevent.

When two passes disagree, the firmer wins: `OBSERVED`/`ENFORCED` outrank
`CONFIGURED`, which outranks `INFERRED`, which outranks `UNKNOWN`. A node says
the strongest thing that is true about it, not the last thing written.

### Encoding without colour

Provenance carries three redundant channels: a **line pattern** (solid, dashed,
dotted), a **word** in the legend and on every selected edge, and — last — a hue.
A reader who cannot distinguish the palette can still tell an observation from an
inference.

## Node kinds

`site` · `page` · `tracker` · `vendor` · `destination` · `cookie` · `purpose` ·
`data_category` · `jurisdiction` · `policy_version` · `enforcement_rule` ·
`enforcement_event` · `shadow_finding` · `drift_finding` · `experiment` ·
`experiment_variant`

Deliberately shorter than the obvious list. There is no `regulation` node:
regimes are attached to a jurisdiction by the policy engine and carry citations,
but nothing in the store makes a regulation an entity with its own
relationships — and a node with one edge and no content is a box on a diagram
rather than an intelligence.

**Nothing is invented to fill the picture.** No edge is emitted without evidence
behind it, and no pass "connects up" lonely nodes. A sparse graph of real
relationships is worth more than a dense one where half the lines are the
diagram's own idea of what ought to connect.

## Edge kinds

`has_page` · `loads` · `operated_by` · `sends_to` · `serves_purpose` ·
`processes_category` · `requires_consent` · `governed_by` · `applies_in` ·
`enforced_by` · `decided` · `sets_cookie` · `flagged_as` · `drifted` · `varies` ·
`measured_under`

## Evidence

Every node and edge carries `evidence[]`: a source (`scan`, `policy`,
`enforcement`, `intelligence`, `experiment`, `catalogue`), a reference a person
could look up (scan id, policy version, finding id, event id), a plain-language
detail, and where applicable a timestamp.

No evidence reference exposes a secret, and **no personal data reaches the
graph** — no principal, no session, no address. The consent log is deliberately
not a source here.

## The data-flow reading

Laid out left to right along the path an operator is actually reading:

```
site -> page -> tracker -> vendor -> destination -> enforcement
```

with configuration below: purposes, data categories, markets, the approved
configuration and its rules.

That answers the question the map exists for: *what can leave this page, where
can it go, and what consent control governs it?*

Layout is by node kind in columns, not force-directed. A physics simulation of
two hundred nodes is a hairball that answers nothing and gets worse as a site
grows.

## Performance

Capped rather than paged: **600 nodes, 1500 edges, 3 hops**. Enforcement is read
at 200 most-recent events, experiments at 25.

A truncated graph **says so**, in the response and on the screen. A capped graph
that does not announce itself is one an operator reads as complete — and "no
tracker on that page" is exactly the conclusion they must not draw from a node
limit.

## Graph API

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/sites/{siteId}/graph` |
| `GET` | `/api/v1/sites/{siteId}/graph/nodes/{nodeId}` |
| `POST` | `/api/v1/sites/{siteId}/simulate` |

Filters: `page`, `tracker`, `vendor`, `purpose`, `data_category`,
`jurisdiction`, `severity`, `provenance`, `focus`, `depth`.

Filters are applied **after** the graph is built, so a filter narrows what is
shown and never changes what an edge means. Filtering during construction would
let a narrow query produce a *different* graph, and two views of one site that
disagree is worse than a slow one.

An unknown `provenance`, `severity` or out-of-range `depth` is a 400, never
silently ignored — dropping it would return an unfiltered graph to somebody who
asked for a filtered one, and they would read it as filtered.

## Security

Isolation is **structural, not a check**. A node id is resolved *inside the graph
built for the requested site*. There is no id-to-record lookup that could be
pointed elsewhere, so a crafted id from another tenant is not forbidden — it is
simply not present, and returns 404.

Every endpoint requires management authentication and site ownership. A site
public key (`pk_`, which ships in every visitor's page source) is refused: if it
opened the graph, a site's entire tracker inventory and configuration would be
public.

Tested against: cross-tenant access, cross-site node ids, made-up ids,
wrong-shaped ids, path traversal, SQL fragments, unbounded depth.

---

# The simulator

**Simulation results are hypothetical and do not modify production.**

## Immutability is structural, not procedural

`api/lib/simulation.ts` **imports no database client**. Not "does not currently
call one" — it has no handle to one, and adding a write would mean adding an
import a reviewer would see. The evidence arrives as a value, is copied, is
modified, and is fed back through the same engines production uses. The result is
a value.

There is no scenario table, no draft policy row, and no persisted result. That
costs something real: scenarios cannot be saved, shared by link, or reopened
tomorrow. It is worth it — a simulator that writes anywhere is one somebody
eventually points at production, and *running this changed nothing* becomes a
property of code review rather than of the architecture.

## It reuses the real engines

`generatePolicy`, `detectShadowTrackers`, `detectDrift` and
`computeConsentQuality` are the same functions production calls, on a modified
copy of the same inputs. There is no second policy evaluator and no simplified
model of one. A simulation that disagreed with production about the same facts
would be worse than none, because its output looks exactly as authoritative.

## Supported operations

`add_tracker` · `remove_tracker` · `reclassify_tracker` · `add_jurisdiction` ·
`remove_jurisdiction` · `set_enforcement` · `set_enforcement_mode`

Shorter than the obvious list, deliberately. `change_data_category` is absent:
data categories are attached by the policy engine from the regimes in play, not
chosen per vendor, so an operator "changing" one would be overriding a derivation
rather than configuring anything — and the simulator would be modelling a system
that does not exist.

`add_tracker` **requires a category**. The engine derives the purpose and the
consent requirement from what a technology is normally used for; without one it
cannot answer, and guessing would produce a confident wrong answer.

An operation the architecture cannot evaluate comes back in `unsupported` with a
reason. Silently dropping it would answer a different question from the one
asked.

## Output

Inventory delta · consent requirement changes · jurisdictions and the regimes
they bring · enforcement rule counts · shadow tracker and drift deltas · a
simulated quality score.

**Every finding carries `because`** — the rule or evidence that produced it. A
result an operator cannot check is one they cannot defend, and this exists to
support a decision somebody will have to argue for.

The real score and the simulated score are **always rendered together, both
labelled**. A figure that looks like the Consent Quality Score and is not one is
the most dangerous thing this feature can produce.

## Graph and simulation, in both directions

Selecting a node offers only the operations the engine can actually evaluate —
served by the API rather than hard-coded in the UI, so the offered set cannot
drift from the supported one. "What if I block this?" starts from the node the
operator was looking at.

With `include_graph`, the response carries **live and simulated graphs
separately**. They are never merged: mixing hypothetical nodes into the
production picture is the one presentation this feature must not offer.

## There is no apply action

Not on this path, not in the UI. Changing a site goes through the ordinary
configuration workflow with its own authorisation and its own human approval. A
shortcut from this screen would be a policy bypass wearing a different name,
however much confirmation it asked for.

## Integration with the rest of the platform

**Drift** — findings appear as nodes connected to the tracker and page they
concern. The existing detector is reused; there is no second drift logic.

**Shadow trackers** — findings appear connected to their tracker and every page
they were seen on, with the detector's own severity and evidence. Experiments
cannot suppress them: a variant varies banner copy, which is not something a scan
looks at.

**Enforcement** — `enforcement_event` is a separate node kind from `destination`
on purpose, so "data flowed here" and "we acted on it" stay distinct. A
client-reported event says on its own evidence that it is a claim about what the
SDK did, not proof that nothing left the page.

**Experiments** — shown with their status. A draft or paused experiment is **not**
linked to the live configuration: it describes a banner nobody is being shown,
and linking it would suggest it is being measured against production.

**Consent proof** — deliberately absent from the graph. The proof chain is keyed
on a principal, and putting it here would rebuild the identity link the rest of
this architecture goes to some length not to have. Proof status lives on the
consent records table, where it belongs.

## Known limitations

* A scan is one visit by one crawler. A tracker that did not fire during it is
  absent, and absence here is not evidence of absence on the site.
* Cookies are attributed by host match — the crawler records them per scan, not
  per page — so those edges are `INFERRED`.
* Requests are aggregated per host, so a request connects a tracker to a
  destination and never a page to a request.
* Shadow tracker and drift counts in a simulation are site-wide; scans do not run
  per visitor.
* Enforcement in the graph is the 200 most recent events, not the whole log.
* Scenarios are not persisted and cannot be shared by link.
* There is no `regulation` node and no `consent_requirement` node; both would be
  boxes with no independent relationships in the current model.
