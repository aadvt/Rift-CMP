'use client';
import * as React from 'react';
import { Card, CardBody, CardHeader, Chip, EmptyState, Notice, cn, type ChipTone } from '@rift/ui';
import type * as W from '@/lib/api/backend';

/**
 * The consent dependency graph, drawn so the lines can be told apart.
 *
 * ## Provenance is not encoded in colour alone
 *
 * A reader who cannot distinguish the palette still has to be able to tell an
 * observation from an inference, because on a canvas those two look identical
 * and only one is evidence. So provenance carries three redundant channels: a
 * line pattern (solid, dashed, dotted), a word in the legend and on the selected
 * edge, and — last — a hue. Colour is the redundant channel here, never the
 * primary one.
 *
 * ## Layout by kind, not by force
 *
 * A force-directed layout of two hundred nodes is a hairball that answers no
 * question. This lays out in columns by node kind, left to right along the flow
 * an operator is actually reading:
 *
 *     site → page → tracker → vendor → destination → enforcement
 *
 * with configuration (purposes, categories, jurisdictions, policy) below. The
 * result is legible at a glance and stays legible as the site grows, which a
 * physics simulation does not.
 *
 * ## It draws what it was given
 *
 * No node is added to balance a column and no edge is drawn to connect a lonely
 * node. A sparse picture of real relationships is the honest one.
 */

const COLUMN_ORDER: string[] = [
  'site',
  'page',
  'tracker',
  'vendor',
  'destination',
  'enforcement_event',
  'shadow_finding',
  'drift_finding',
  'purpose',
  'data_category',
  'jurisdiction',
  'policy_version',
  'enforcement_rule',
  'cookie',
  'experiment',
  'experiment_variant',
];

const KIND_LABEL: Record<string, string> = {
  site: 'Site',
  page: 'Pages',
  tracker: 'Trackers',
  vendor: 'Vendors',
  destination: 'Destinations',
  enforcement_event: 'Enforcement',
  shadow_finding: 'Unaccounted for',
  drift_finding: 'Drift',
  purpose: 'Purposes',
  data_category: 'Data categories',
  jurisdiction: 'Markets',
  policy_version: 'Configuration',
  enforcement_rule: 'Rules',
  cookie: 'Cookies',
  experiment: 'Experiments',
  experiment_variant: 'Variants',
};

/** Pattern first, word second, colour last. */
const PROVENANCE: Record<
  W.WireProvenance,
  { dash: string; label: string; stroke: string; tone: ChipTone }
> = {
  OBSERVED: { dash: '', label: 'Observed', stroke: 'var(--md-primary)', tone: 'success' },
  ENFORCED: { dash: '', label: 'Enforced', stroke: 'var(--md-error)', tone: 'error' },
  CONFIGURED: { dash: '6 3', label: 'Configured', stroke: 'var(--md-on-surface-variant)', tone: 'primary' },
  INFERRED: { dash: '2 4', label: 'Inferred', stroke: 'var(--md-on-surface-variant)', tone: 'warning' },
  UNKNOWN: { dash: '1 5', label: 'Unknown', stroke: 'var(--md-outline)', tone: 'neutral' },
};

const SEVERITY_TONE: Record<string, ChipTone> = {
  critical: 'error',
  high: 'warning',
  medium: 'warning',
  low: 'neutral',
  info: 'neutral',
};

const COLUMN_WIDTH = 190;
const ROW_HEIGHT = 46;
const NODE_WIDTH = 158;
const NODE_HEIGHT = 32;

interface Placed {
  node: W.WireGraphNode;
  x: number;
  y: number;
}

export function ConsentGraphView({
  graph,
  onSimulate,
}: {
  graph: W.WireConsentGraph | null;
  onSimulate?: (node: W.WireGraphNode) => void;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = React.useState<Set<string>>(new Set());
  const [search, setSearch] = React.useState('');
  const [zoom, setZoom] = React.useState(1);

  const visible = React.useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    const term = search.trim().toLowerCase();

    const nodes = graph.nodes.filter(
      (node) =>
        !hiddenKinds.has(node.kind) &&
        (term === '' || node.label.toLowerCase().includes(term) || node.kind.includes(term)),
    );
    const keep = new Set(nodes.map((n) => n.id));
    return { nodes, edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)) };
  }, [graph, hiddenKinds, search]);

  const placed = React.useMemo(() => {
    const byKind = new Map<string, W.WireGraphNode[]>();
    for (const node of visible.nodes) {
      byKind.set(node.kind, [...(byKind.get(node.kind) ?? []), node]);
    }

    const positions = new Map<string, Placed>();
    let column = 0;

    for (const kind of COLUMN_ORDER) {
      const nodes = byKind.get(kind);
      if (!nodes || nodes.length === 0) continue;

      nodes.forEach((node, row) => {
        positions.set(node.id, { node, x: column * COLUMN_WIDTH + 20, y: row * ROW_HEIGHT + 48 });
      });
      column += 1;
    }

    return positions;
  }, [visible.nodes]);

  const size = React.useMemo(() => {
    let width = 400;
    let height = 300;
    for (const { x, y } of placed.values()) {
      width = Math.max(width, x + NODE_WIDTH + 40);
      height = Math.max(height, y + NODE_HEIGHT + 40);
    }
    return { width, height };
  }, [placed]);

  if (!graph) {
    return (
      <EmptyState
        icon="layers"
        title="Graph unavailable"
        body="Rift could not build the graph for this site. This is a connection problem, not a site with nothing on it."
      />
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="Nothing to draw yet"
        body="The graph is built from scans, your approved configuration and enforcement activity. Run a scan and it will have something to show."
      />
    );
  }

  const selectedNode = selected ? graph.nodes.find((n) => n.id === selected) ?? null : null;
  const selectedEdges = selected
    ? graph.edges.filter((e) => e.from === selected || e.to === selected)
    : [];

  const kinds = COLUMN_ORDER.filter((kind) => (graph.totals[kind] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-5">
      {graph.truncated.reason ? (
        <Notice tone="warning" title="This graph is a subset">
          {graph.truncated.reason}
        </Notice>
      ) : null}

      <Card className="rounded-2xl">
        <CardBody className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search nodes"
              className="h-9 min-w-[200px] flex-1 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-body-small text-md-on-surface"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                className="h-9 rounded-lg px-3 text-label-medium text-md-on-surface-variant hover:bg-md-surface-container"
              >
                −
              </button>
              <span className="w-12 text-center text-label-small tabular-nums text-md-on-surface-variant">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                className="h-9 rounded-lg px-3 text-label-medium text-md-on-surface-variant hover:bg-md-surface-container"
              >
                +
              </button>
            </div>
          </div>

          {/* Legend. Pattern and word carry the meaning; colour repeats it. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-md-outline-variant/40 pt-3">
            {(Object.keys(PROVENANCE) as W.WireProvenance[]).map((key) => (
              <span key={key} className="flex items-center gap-2 text-label-small text-md-on-surface-variant">
                <svg width="28" height="8" aria-hidden>
                  <line
                    x1="0"
                    y1="4"
                    x2="28"
                    y2="4"
                    stroke={PROVENANCE[key].stroke}
                    strokeWidth="2"
                    strokeDasharray={PROVENANCE[key].dash}
                  />
                </svg>
                {PROVENANCE[key].label}
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setHiddenKinds((current) => {
                    const next = new Set(current);
                    if (next.has(kind)) next.delete(kind);
                    else next.add(kind);
                    return next;
                  })
                }
                aria-pressed={!hiddenKinds.has(kind)}
                className={cn(
                  'rounded-full px-3 py-1 text-label-small transition-colors',
                  hiddenKinds.has(kind)
                    ? 'bg-md-surface-container text-md-on-surface-variant/60 line-through'
                    : 'bg-md-secondary-container text-md-on-secondary-container',
                )}
              >
                {KIND_LABEL[kind] ?? kind} {graph.totals[kind]}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card className="rounded-2xl">
          <CardBody className="p-0">
            <div className="overflow-auto" style={{ maxHeight: 620 }}>
              <svg
                width={size.width * zoom}
                height={size.height * zoom}
                viewBox={`0 0 ${size.width} ${size.height}`}
                role="img"
                aria-label={`Consent dependency graph: ${visible.nodes.length} nodes, ${visible.edges.length} relationships`}
              >
                {visible.edges.map((edge) => {
                  const from = placed.get(edge.from);
                  const to = placed.get(edge.to);
                  if (!from || !to) return null;

                  const style = PROVENANCE[edge.provenance];
                  const active = selected === edge.from || selected === edge.to;

                  return (
                    <line
                      key={edge.id}
                      x1={from.x + NODE_WIDTH}
                      y1={from.y + NODE_HEIGHT / 2}
                      x2={to.x}
                      y2={to.y + NODE_HEIGHT / 2}
                      stroke={style.stroke}
                      strokeWidth={active ? 2 : 1}
                      strokeDasharray={style.dash}
                      opacity={selected && !active ? 0.15 : 0.6}
                    />
                  );
                })}

                {[...placed.values()].map(({ node, x, y }) => {
                  const active = node.id === selected;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      onClick={() => setSelected(active ? null : node.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx="6"
                        fill={active ? 'var(--md-secondary-container)' : 'var(--md-surface-container)'}
                        stroke={
                          node.severity && node.severity !== 'info'
                            ? 'var(--md-error)'
                            : 'var(--md-outline-variant)'
                        }
                        strokeWidth={active ? 2 : 1}
                      />
                      <text
                        x="10"
                        y="20"
                        fontSize="11"
                        fill="var(--md-on-surface)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </CardBody>
        </Card>

        <NodePanel
          node={selectedNode}
          edges={selectedEdges}
          nodes={graph.nodes}
          {...(onSimulate ? { onSimulate } : {})}
        />
      </div>

      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader title="What this graph does not show" sub="Read it against this." />
          <ul className="mt-4 flex flex-col gap-2">
            {graph.caveats.map((caveat) => (
              <li key={caveat} className="text-body-small leading-relaxed text-md-on-surface-variant">
                {caveat}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function NodePanel({
  node,
  edges,
  nodes,
  onSimulate,
}: {
  node: W.WireGraphNode | null;
  edges: W.WireGraphEdge[];
  nodes: W.WireGraphNode[];
  onSimulate?: (node: W.WireGraphNode) => void;
}) {
  if (!node) {
    return (
      <Card className="rounded-2xl">
        <CardBody className="p-6">
          <CardHeader title="Select a node" sub="Its evidence, its neighbours and what it is connected to appear here." />
        </CardBody>
      </Card>
    );
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <Card className="rounded-2xl">
      <CardBody className="p-6">
        <CardHeader title={node.label} sub={node.sublabel ?? node.kind.replace(/_/g, ' ')} />

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip tone={PROVENANCE[node.provenance].tone}>{PROVENANCE[node.provenance].label}</Chip>
          {node.severity && node.severity !== 'info' ? (
            <Chip tone={SEVERITY_TONE[node.severity] ?? 'neutral'}>{node.severity}</Chip>
          ) : null}
          <Chip tone="neutral">{node.kind.replace(/_/g, ' ')}</Chip>
        </div>

        {Object.keys(node.attributes).length > 0 ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
            {Object.entries(node.attributes)
              .filter(([, value]) => value !== null && value !== '')
              .map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-label-medium text-md-on-surface-variant">
                    {key.replace(/_/g, ' ')}
                  </dt>
                  <dd className="text-body-small text-md-on-surface">{String(value)}</dd>
                </div>
              ))}
          </dl>
        ) : null}

        <p className="mt-5 text-label-small uppercase tracking-[0.06em] text-md-on-surface-variant/70">
          Evidence
        </p>
        <ul className="mt-2 flex flex-col gap-2 border-l-2 border-md-outline-variant pl-3">
          {node.evidence.map((ref, i) => (
            <li key={i} className="text-body-small leading-relaxed text-md-on-surface-variant">
              <span className="mr-1.5 uppercase tracking-[0.06em] text-label-small opacity-70">
                {ref.source}
                {ref.ref ? ` ${ref.ref.slice(0, 8)}` : ''}
              </span>
              {ref.detail}
            </li>
          ))}
        </ul>

        {edges.length > 0 ? (
          <>
            <p className="mt-5 text-label-small uppercase tracking-[0.06em] text-md-on-surface-variant/70">
              Connected to
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {edges.slice(0, 24).map((edge) => {
                const other = byId.get(edge.from === node.id ? edge.to : edge.from);
                if (!other) return null;
                return (
                  <li key={edge.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-body-small text-md-on-surface">{other.label}</span>
                    <Chip tone="neutral">{edge.label}</Chip>
                    {/* The word, not only the line pattern. */}
                    <Chip tone={PROVENANCE[edge.provenance].tone}>
                      {PROVENANCE[edge.provenance].label}
                    </Chip>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {onSimulate ? (
          <button
            type="button"
            onClick={() => onSimulate(node)}
            className="mt-5 h-10 w-full rounded-full bg-md-secondary-container text-label-medium font-medium text-md-on-secondary-container"
          >
            Simulate a change to this
          </button>
        ) : null}
      </CardBody>
    </Card>
  );
}
