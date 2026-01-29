import React from 'react';
import { Box, Text } from 'ink';

interface SQLPreviewProps {
  sql: string | undefined;
  iterationNumber?: number;
}

export function SQLPreview({ sql, iterationNumber }: SQLPreviewProps) {
  if (!sql) {
    return null;
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Generated SQL
          {iterationNumber !== undefined && iterationNumber > 1 && (
            <Text dimColor> (iteration {iterationNumber})</Text>
          )}
        </Text>
      </Box>
      <Box>
        <Text color="yellow">{sql}</Text>
      </Box>
    </Box>
  );
}
