import React, { useMemo } from 'react';
import Tree from 'react-d3-tree';
import { Box, Typography } from '@mui/material';

interface AccountTreeDiagramProps {
  accounts: Array<{
    id: number;
    name: string;
    isPrimary: boolean | number;
    currentBalance?: number;
    requiredBalance?: number;
  }>;
}

const AccountTreeDiagram: React.FC<AccountTreeDiagramProps> = ({ accounts }) => {
  // Find primary account
  const primary = accounts.find(a => a.isPrimary || a.isPrimary === 1);
  const nonPrimary = accounts.filter(a => !a.isPrimary && a.isPrimary !== 1);

  // Build tree data
  const treeData = useMemo(() => {
    if (!primary) return null;
    return {
      name: `${primary.name}`,
      attributes: {
        Balance: primary.currentBalance !== undefined ? `$${primary.currentBalance.toFixed(2)}` : undefined,
      },
      children: nonPrimary.map(a => ({
        name: a.name,
        attributes: {
          Balance: a.currentBalance !== undefined ? `$${a.currentBalance.toFixed(2)}` : undefined,
        },
      })),
    };
  }, [primary, nonPrimary]);

  if (!primary) {
    return <Typography color="error">No primary account found.</Typography>;
  }

  // Custom node shape: blue for primary, green for non-primary
  const nodeSvgShape = {
    shape: 'circle',
    shapeProps: {
      r: 18,
      fill: '#1976d2',
      stroke: '#fff',
      strokeWidth: 2,
    },
  };
  const leafNodeSvgShape = {
    shape: 'circle',
    shapeProps: {
      r: 16,
      fill: '#388e3c',
      stroke: '#fff',
      strokeWidth: 2,
    },
  };

  return (
    <Box sx={{ width: '100%', height: 400, bgcolor: '#f5f5f5', borderRadius: 2, p: 2, boxShadow: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
        Account Flow Tree
      </Typography>
      <Box sx={{ width: '100%', height: 340 }}>
        <Tree
          data={treeData as any}
          orientation="horizontal"
          translate={{ x: 120, y: 170 }}
          pathFunc="elbow"
          collapsible={false}
          nodeSize={{ x: 200, y: 100 }}
          separation={{ siblings: 1.5, nonSiblings: 2 }}
          renderCustomNodeElement={({ nodeDatum, toggleNode }) => (
            <g>
              <circle
                r={nodeDatum.__rd3t.depth === 0 ? 18 : 16}
                fill={nodeDatum.__rd3t.depth === 0 ? '#1976d2' : '#388e3c'}
                stroke="#fff"
                strokeWidth={2}
              />
              <text
                fill="#222"
                fontWeight="bold"
                fontSize={nodeDatum.__rd3t.depth === 0 ? 16 : 14}
                x={0}
                y={-24}
                textAnchor="middle"
              >
                {nodeDatum.name}
              </text>
              {nodeDatum.attributes?.Balance && (
                <text
                  fill="#555"
                  fontSize={12}
                  x={0}
                  y={8}
                  textAnchor="middle"
                >
                  {nodeDatum.attributes.Balance}
                </text>
              )}
            </g>
          )}
        />
      </Box>
    </Box>
  );
};

export default AccountTreeDiagram; 