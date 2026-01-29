import React from 'react';
import { Box, Text } from 'ink';
import type { ConversationTurn } from '../agent/types.js';
import { ResultsTable } from './ResultsTable.js';

interface QueryHistoryProps {
  history: ConversationTurn[];
  currentIndex: number;
}

export function QueryHistory({ history, currentIndex }: QueryHistoryProps) {
  if (history.length === 0 || currentIndex < 0 || currentIndex >= history.length) {
    return null;
  }

  const turn = history[currentIndex];
  const totalItems = history.length;
  const displayIndex = currentIndex + 1;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="magenta"
      paddingX={1}
      marginBottom={1}
    >
      {/* Header with pagination */}
      <Box marginBottom={1}>
        <Text bold color="magenta">
          History [{displayIndex}/{totalItems}]
        </Text>
        <Text dimColor>  ↑↓ navigate • Esc exit</Text>
      </Box>

      {/* Query */}
      <Box>
        <Text dimColor>Query: </Text>
        <Text>&quot;{turn.query}&quot;</Text>
      </Box>

      {/* SQL */}
      <Box marginBottom={1}>
        <Text dimColor>SQL: </Text>
        <Text color="yellow">{turn.sql}</Text>
      </Box>

      {/* Error display */}
      {turn.error && (
        <Box>
          <Text color="red">Error: {turn.error}</Text>
        </Box>
      )}

      {/* Results table */}
      {turn.result && (
        <ResultsTable result={turn.result} maxRows={20} />
      )}
    </Box>
  );
}
