import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../agent/types.js';

interface HistoryListProps {
  history: ConversationTurn[];
  selectedIndex: number | null;
}

export function HistoryList({ history, selectedIndex }: HistoryListProps) {
  if (history.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        width={30}
      >
        <Text bold color="magenta">History</Text>
        <Text dimColor>No queries yet</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="magenta"
      paddingX={1}
      width={30}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">History</Text>
      </Box>

      {history.map((turn, index) => {
        const isSelected = index === selectedIndex;
        const truncatedQuery = turn.query.length > 22
          ? turn.query.substring(0, 22) + '...'
          : turn.query;
        const rowCount = turn.result?.rows?.length ?? 0;

        return (
          <Box key={index}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? '> ' : '  '}
              {index + 1}. {truncatedQuery}
            </Text>
            <Text dimColor> ({rowCount})</Text>
          </Box>
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>↑↓ select • Esc close</Text>
      </Box>
    </Box>
  );
}
