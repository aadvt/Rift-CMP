'use client';
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@rift/ui';
import type * as W from '@/lib/api/backend';
import { ConsentGraphView } from './ConsentGraph';
import { Simulator } from './Simulator';

/**
 * Graph and simulator, sharing a selection.
 *
 * Selecting a node and pressing "simulate a change to this" moves to the
 * simulator with that node as the starting context. The alternative — a
 * simulator that always starts empty — makes an operator retype the thing they
 * were already looking at, and the retyping is where they pick the wrong vendor.
 */
export function GraphWorkspace({
  siteId,
  graph,
}: {
  siteId: string;
  graph: W.WireConsentGraph | null;
}) {
  const [tab, setTab] = React.useState('graph');
  const [seed, setSeed] = React.useState<W.WireGraphNode | null>(null);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="graph">Graph</TabsTrigger>
        <TabsTrigger value="simulate">Simulate</TabsTrigger>
      </TabsList>

      <TabsContent value="graph">
        <ConsentGraphView
          graph={graph}
          onSimulate={(node) => {
            setSeed(node);
            setTab('simulate');
          }}
        />
      </TabsContent>

      <TabsContent value="simulate">
        <Simulator
          siteId={siteId}
          seedNode={seed ? { id: seed.id, kind: seed.kind, label: seed.label } : null}
        />
      </TabsContent>
    </Tabs>
  );
}
