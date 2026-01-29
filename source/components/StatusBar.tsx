import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AgentStatus } from '../agent/types.js';

interface StatusBarProps {
  status: AgentStatus;
  message: string;
  iterationCount?: number;
  maxIterations?: number;
}

const statusColors: Record<AgentStatus, string> = {
  idle: 'gray',
  generating: 'yellow',
  executing: 'blue',
  evaluating: 'magenta',
  complete: 'green',
  error: 'red',
};

const statusLabels: Record<AgentStatus, string> = {
  idle: 'Ready',
  generating: 'Generating SQL',
  executing: 'Executing',
  evaluating: 'Evaluating',
  complete: 'Complete',
  error: 'Error',
};

export function StatusBar({ status, message, iterationCount, maxIterations }: StatusBarProps) {
  const isActive = status !== 'idle' && status !== 'complete' && status !== 'error';
  const color = statusColors[status];
  const label = statusLabels[status];

  return (
    <Box flexDirection="row" gap={1}>
      <Box>
        {isActive ? (
          <Text color={color}>
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text color={color}>
            {status === 'complete' ? '✓' : status === 'error' ? '✗' : '○'}
          </Text>
        )}
      </Box>
      <Box>
        <Text color={color} bold>
          [{label}]
        </Text>
      </Box>
      <Box>
        <Text>{message}</Text>
      </Box>
      {iterationCount !== undefined && maxIterations !== undefined && (
        <Box>
          <Text dimColor>
            (attempt {iterationCount}/{maxIterations})
          </Text>
        </Box>
      )}
    </Box>
  );
}
