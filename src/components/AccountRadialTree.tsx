import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import type { HierarchyPointNode, HierarchyPointLink } from 'd3';

interface AccountRadialTreeProps {
  accounts: Array<{
    id: number;
    name: string;
    isPrimary: boolean | number;
    currentBalance?: number;
    requiredBalance?: number;
  }>;
  perAccountExpenses: Record<number, number>;
  frequencyLabel: string;
  totalIncome: number;
}

const WIDTH = 700;
const HEIGHT = 700;
const RADIUS = 224;

const AccountRadialTree: React.FC<AccountRadialTreeProps> = ({ accounts, perAccountExpenses, frequencyLabel, totalIncome }) => {
  // Find primary account
  const primary = accounts.find(a => a.isPrimary || a.isPrimary === 1);
  const nonPrimary = accounts.filter(a => !a.isPrimary && a.isPrimary !== 1);

  // Calculate total expenses for all non-primary accounts
  const totalExpenses = nonPrimary.reduce((sum, a) => sum + (perAccountExpenses[a.id] || 0), 0);

  // Build hierarchy data
  const treeData = useMemo(() => {
    if (!primary) return null;
    return {
      name: primary.name,
      balance: primary.currentBalance,
      children: nonPrimary.map(a => ({
        id: a.id,
        name: a.name,
        balance: a.currentBalance,
        expense: perAccountExpenses[a.id] || 0,
      })),
    };
  }, [primary, nonPrimary, perAccountExpenses]);

  // Compute radial tree layout
  const nodesAndLinks = useMemo(() => {
    if (!treeData) return { nodes: [], links: [] };
    const root = d3.hierarchy(treeData);
    const treeLayout = d3.tree().size([2 * Math.PI, RADIUS]);
    const treeRoot = treeLayout(root);
    const nodes = treeRoot.descendants();
    const links = treeRoot.links();
    return { nodes, links };
  }, [treeData]);

  // Color palette for nodes
  const nodeColors = [
    '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#7cb342', '#fbc02d', '#5d4037'
  ];

  if (!primary) {
    return <Typography color="error">No primary account found.</Typography>;
  }

  return (
    <Box sx={{ width: WIDTH, height: HEIGHT, mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
        Funds Distribution
      </Typography>
      <svg width={WIDTH} height={HEIGHT} style={{ display: 'block', margin: '0 auto', background: 'none' }}>
        <g transform={`translate(${WIDTH / 2},${HEIGHT / 2})`}>
          {/* Links */}
          {nodesAndLinks.links.map((link: HierarchyPointLink<any>, i: number) => {
            const source = [
              Math.cos(link.source.x - Math.PI / 2) * link.source.y,
              Math.sin(link.source.x - Math.PI / 2) * link.source.y,
            ];
            const target = [
              Math.cos(link.target.x - Math.PI / 2) * link.target.y,
              Math.sin(link.target.x - Math.PI / 2) * link.target.y,
            ];
            return (
              <line
                key={i}
                x1={source[0]}
                y1={source[1]}
                x2={target[0]}
                y2={target[1]}
                stroke="#888"
                strokeWidth={2}
              />
            );
          })}
          {/* Nodes */}
          {nodesAndLinks.nodes.map((node: HierarchyPointNode<any>, i: number) => {
            const [x, y] = [
              Math.cos(node.x - Math.PI / 2) * node.y,
              Math.sin(node.x - Math.PI / 2) * node.y,
            ];
            const isRoot = node.depth === 0;
            // Set node size based on primary/non-primary
            const nodeW = isRoot ? 120 : 120;
            const nodeH = isRoot ? 80 : 60;
            let percent = '';
            let amount = '';
            if (isRoot) {
              percent = totalIncome > 0 ? `${(100 - (totalExpenses / totalIncome) * 100).toFixed(1)}%` : '0%';
              amount = totalIncome > 0 ? `$${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
            } else if (typeof node.data.expense === 'number' && totalExpenses > 0) {
              percent = `${((node.data.expense / totalExpenses) * 100).toFixed(1)}%`;
              amount = `$${node.data.expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            if (!percent) return null;
            const nodeColors = [
              '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#7cb342', '#fbc02d', '#5d4037'
            ];
            return (
              <g key={i} transform={`translate(${x},${y})`}>
                <rect
                  x={-nodeW / 2}
                  y={-nodeH / 2}
                  width={nodeW}
                  height={nodeH}
                  fill={nodeColors[i % nodeColors.length]}
                  stroke="#fff"
                  strokeWidth={2}
                  rx={isRoot ? 4 : 8}
                  ry={isRoot ? 4 : 8}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}
                />
                {/* Only render percent badge for non-primary nodes */}
                {!isRoot && (() => {
                  const percent = typeof node.data.expense === 'number' && totalExpenses > 0 ? `${((node.data.expense / totalExpenses) * 100).toFixed(1)}%` : '';
                  if (!percent) return null;
                  const badgeW = 38, badgeH = 22;
                  const badgeX = nodeW / 2 - badgeW / 2 - 4;
                  const badgeY = -nodeH / 2 - badgeH / 2 + 2 - nodeH * 0.1;
                  return (
                    <g>
                      <rect
                        x={badgeX}
                        y={badgeY}
                        width={badgeW}
                        height={badgeH}
                        rx={0}
                        ry={0}
                        fill="#fff"
                        stroke="#bbb"
                        strokeWidth={1}
                        style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.10))' }}
                      />
                      <text
                        x={badgeX + badgeW / 2}
                        y={badgeY + badgeH / 2 + 1}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight="bold"
                        fill="#222"
                        dominantBaseline="middle"
                      >
                        {percent}
                      </text>
                    </g>
                  );
                })()}
                {/* Node content: label and value */}
                {isRoot ? (
                  <>
                    <text
                      x={0}
                      y={-nodeH / 2 + 18}
                      textAnchor="middle"
                      fontSize={13}
                      fill="#e0e0e0"
                      fontWeight="normal"
                      dominantBaseline="middle"
                    >
                      Income
                    </text>
                    <text
                      x={0}
                      y={-nodeH / 2 + 36}
                      textAnchor="middle"
                      fontSize={20}
                      fontWeight="bold"
                      fill="#fff"
                      dominantBaseline="middle"
                    >
                      {amount}
                    </text>
                    {/* Saved row with percent */}
                    {(() => {
                      const saved = totalIncome - totalExpenses;
                      const percent = totalIncome > 0 ? ((saved / totalIncome) * 100).toFixed(1) : '0.0';
                      return (
                        <>
                          <text
                            x={0}
                            y={-nodeH / 2 + 54}
                            textAnchor="middle"
                            fontSize={11}
                            fill="#e0e0e0"
                            fontWeight="normal"
                            dominantBaseline="middle"
                          >
                            {`Saved (${percent}%)`}
                          </text>
                          <text
                            x={0}
                            y={-nodeH / 2 + 68}
                            textAnchor="middle"
                            fontSize={15}
                            fontWeight="bold"
                            fill="#fff"
                            dominantBaseline="middle"
                          >
                            {`+${saved >= 0 ? saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`}
                          </text>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <text
                      x={-52}
                      y={-18}
                      fontWeight="bold"
                      fontSize={13}
                      fill="#fff"
                      dominantBaseline="middle"
                      textAnchor="start"
                    >
                      {node.data.name}
                    </text>
                    <text
                      x={0}
                      y={6}
                      fontSize={16}
                      fontWeight="bold"
                      fill="#e0e0e0"
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      {typeof node.data.expense === 'number' ? `$${node.data.expense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </Box>
  );
};

export default AccountRadialTree; 