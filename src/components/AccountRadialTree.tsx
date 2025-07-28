import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import * as d3 from 'd3';
import type { HierarchyPointNode, HierarchyPointLink } from 'd3';

interface AccountRadialTreeProps {
  accounts: any[];
  perAccountExpenses: Record<number, number>;
  frequencyLabel: string;
  totalIncome: number;
  style?: React.CSSProperties;
}

const AccountRadialTree: React.FC<AccountRadialTreeProps> = ({ accounts, perAccountExpenses, frequencyLabel, totalIncome, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 700 });

  // Update dimensions when container size changes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.8; // Use 80% of available space
        setDimensions({ width: size, height: size });
      }
    };

    updateDimensions();
    
    // Use ResizeObserver for more accurate container size detection
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

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

  // Compute radial tree layout with dynamic radius
  const nodesAndLinks = useMemo(() => {
    if (!treeData) return { nodes: [], links: [] };
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35; // Dynamic radius
    const root = d3.hierarchy(treeData);
    const treeLayout = d3.tree().size([2 * Math.PI, radius]);
    const treeRoot = treeLayout(root);
    const nodes = treeRoot.descendants();
    const links = treeRoot.links();
    return { nodes, links, radius };
  }, [treeData, dimensions]);

  // Color palette for nodes
  const nodeColors = [
    '#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#7cb342', '#fbc02d', '#5d4037'
  ];

  if (!primary) {
    return <Typography color="error">No primary account found.</Typography>;
  }

  const { width, height } = dimensions;
  const radius = nodesAndLinks.radius || 224;
  const baseSize = Math.min(width, height) * 0.15; // Responsive base size

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`-${width/2} -${height/2} ${width} ${height}`}
        style={{
          ...style,
          maxWidth: '100%',
          maxHeight: '100%',
          width: '100%',
          height: '100%'
        }}
      >
        <g transform={`translate(0,0)`}>
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
            // Set node size based on primary/non-primary and container size
            const nodeW = isRoot ? baseSize * 1.5 : baseSize * 1.2;
            const nodeH = isRoot ? baseSize : baseSize * 0.8;
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
                  
                  // Calculate dynamic badge width based on text length
                  const fontSize = Math.max(10, baseSize * 0.08);
                  const textWidth = percent.length * fontSize * 0.6; // Approximate character width
                  const minBadgeW = baseSize * 0.4;
                  const badgeW = Math.max(minBadgeW, textWidth + 16); // Add padding
                  const badgeH = baseSize * 0.25;
                  const badgeX = nodeW / 2 - badgeW / 2 - 8; // More padding from edge
                  const badgeY = -nodeH / 2 - badgeH / 2 - 4 - nodeH * 0.15; // More padding from top
                  
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
                        fontSize={fontSize}
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
                      y={-nodeH / 2 + baseSize * 0.2}
                      textAnchor="middle"
                      fontSize={Math.max(10, baseSize * 0.1)}
                      fill="#e0e0e0"
                      fontWeight="normal"
                      dominantBaseline="middle"
                    >
                      Income
                    </text>
                    <text
                      x={0}
                      y={-nodeH / 2 + baseSize * 0.4}
                      textAnchor="middle"
                      fontSize={Math.max(14, baseSize * 0.15)}
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
                            y={-nodeH / 2 + baseSize * 0.6}
                            textAnchor="middle"
                            fontSize={Math.max(8, baseSize * 0.08)}
                            fill="#e0e0e0"
                            fontWeight="normal"
                            dominantBaseline="middle"
                          >
                            {`Saved (${percent}%)`}
                          </text>
                          <text
                            x={0}
                            y={-nodeH / 2 + baseSize * 0.75}
                            textAnchor="middle"
                            fontSize={Math.max(11, baseSize * 0.12)}
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
                      x={-nodeW / 2 + 8}
                      y={-nodeH / 2 + baseSize * 0.15}
                      fontWeight="bold"
                      fontSize={Math.max(10, baseSize * 0.1)}
                      fill="#fff"
                      dominantBaseline="middle"
                      textAnchor="start"
                    >
                      {node.data.name}
                    </text>
                    <text
                      x={0}
                      y={nodeH / 2 - baseSize * 0.15}
                      fontSize={Math.max(12, baseSize * 0.12)}
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