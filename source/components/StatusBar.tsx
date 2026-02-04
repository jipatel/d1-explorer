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

export function StatusBar({ status, message, iterationCount, maxIterations }: StatusBarProps) {
  const isActive = status !== 'idle' && status !== 'complete' && status !== 'error';

  return (
    <Box>
      <Box flexGrow={1}>
        {isActive ? (
          <Text>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text> {message}</Text>
          </Text>
        ) : status === 'complete' ? (
          <Text color="green">✓ {message}</Text>
        ) : status === 'error' ? (
          <Text color="red">✗ {message}</Text>
        ) : (
          <Text dimColor>{message}</Text>
        )}
      </Box>
      {iterationCount !== undefined && maxIterations !== undefined && (
        <Text dimColor>attempt {iterationCount}/{maxIterations}</Text>
      )}
    </Box>
  );
}
