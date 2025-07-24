import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { sankey } from 'd3-sankey';
import type { SankeyNode, SankeyLink } from 'd3-sankey';

interface TransferFlowsSankeyProps {
  incomes: any[];
  expenses: any[];
  tags: any[];
}

interface SankeyNodeEx extends SankeyNode<any, any> {
  name: string;
  type: 'income' | 'tag';
}

interface SankeyLinkEx extends SankeyLink<any, any> {
  source: number;
  target: number;
  value: number;
}

const WIDTH = 600;
const HEIGHT = 360;

const nodeColor = (type: string) => {
  if (type === 'income') return '#1976d2';
  if (type === 'tag') return '#f57c00';
  return '#888';
};

const TransferFlowsSankey: React.FC<TransferFlowsSankeyProps> = ({ incomes, expenses, tags }) => {
  // Unique tags from all expenses
  const uniqueTags = useMemo(() => {
    const allTags = expenses.flatMap((expense: any) => expense.tags || []);
    return [...new Set(allTags)];
  }, [expenses]);

  // Total for each tag
  const tagTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    uniqueTags.forEach(tag => {
      const tagExpenses = expenses.filter((expense: any) => expense.tags && expense.tags.includes(tag));
      totals[tag] = tagExpenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    });
    return totals;
  }, [expenses, uniqueTags]);

  // Nodes: incomes, tags
  const nodes: SankeyNodeEx[] = [
    ...incomes.map((i) => ({ name: i.name || 'Income', type: 'income' as const })),
    ...uniqueTags.map((tag) => ({ name: tag, type: 'tag' as const })),
  ];

  // Links: each income to each tag, value = tag total / incomes.length
  const links: SankeyLinkEx[] = [];
  uniqueTags.forEach((tag, tIdx) => {
    incomes.forEach((income, iIdx) => {
      links.push({
        source: iIdx,
        target: incomes.length + tIdx,
        value: tagTotals[tag] / incomes.length
      });
    });
  });

  // Only include nodes that are actually part of a flow
  const usedNodeIdx = new Set<number>();
  links.forEach(l => { usedNodeIdx.add(l.source); usedNodeIdx.add(l.target); });
  const filteredNodes = nodes.filter((_, idx) => usedNodeIdx.has(idx));
  const idxMap = Array(nodes.length).fill(-1);
  filteredNodes.forEach((n, i) => { idxMap[nodes.indexOf(n)] = i; });
  const filteredLinks = links.map(l => ({ ...l, source: idxMap[l.source], target: idxMap[l.target] }));

  const { nodes: layoutNodes, links: layoutLinks } = useMemo(() => {
    const sankeyGen = sankey<any, any>()
      .nodeWidth(40)
      .nodePadding(40)
      .extent([[0, 0], [WIDTH, HEIGHT]]);
    const graph = { nodes: filteredNodes.map(n => ({ ...n })), links: filteredLinks.map(l => ({ ...l })) };
    return sankeyGen(graph);
    // eslint-disable-next-line
  }, [JSON.stringify(filteredNodes), JSON.stringify(filteredLinks)]);

  return (
    <>
      <svg width={WIDTH} height={HEIGHT} style={{ background: '#f5f5f5', borderRadius: 8, border: '2px solid #888' }}>
        {/* Links */}
        {layoutLinks.map((link, i) => (
          <path
            key={i}
            d={link.path!}
            fill="none"
            stroke="#bbb"
            strokeWidth={Math.max(1, link.width || 1)}
            opacity={0.7}
            style={{ cursor: 'pointer' }}
          >
            <title>
              {`${layoutNodes[link.source.index!]?.name} → ${layoutNodes[link.target.index!]?.name}\nValue: ${link.value.toFixed(2)}`}
            </title>
          </path>
        ))}
        {/* Nodes */}
        {layoutNodes.map((node, i) => (
          <g key={i} style={{ cursor: 'pointer' }}>
            <rect
              x={node.x0}
              y={node.y0}
              width={node.x1 - node.x0}
              height={node.y1 - node.y0}
              fill={nodeColor(node.type)}
              stroke="#fff"
              strokeWidth={2}
              rx={4}
            >
              <title>{`${node.name} (${node.type})`}</title>
            </rect>
            <text
              x={node.x0 < WIDTH / 2 ? node.x1 + 6 : node.x0 - 6}
              y={(node.y0 + node.y1) / 2}
              textAnchor={node.x0 < WIDTH / 2 ? 'start' : 'end'}
              alignmentBaseline="middle"
              fontSize={16}
              fill="#333"
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
      <Box sx={{ mt: 2, p: 1, bgcolor: '#222', color: '#fff', borderRadius: 1, fontSize: 12 }}>
        <div>nodes: <pre>{JSON.stringify(filteredNodes, null, 2)}</pre></div>
        <div>links: <pre>{JSON.stringify(filteredLinks, null, 2)}</pre></div>
      </Box>
    </>
  );
};

export default TransferFlowsSankey; 