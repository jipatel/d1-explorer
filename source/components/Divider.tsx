import React from 'react';
import { Box, Text, useStdout } from 'ink';

interface DividerProps {
  paddingX?: number;
}

export function Divider({ paddingX = 1 }: DividerProps) {
  const { stdout } = useStdout();
  const width = (stdout?.columns ?? 80) - paddingX * 2;
  return (
    <Box>
      <Text dimColor>{'─'.repeat(width)}</Text>
    </Box>
  );
}
