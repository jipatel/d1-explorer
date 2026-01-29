import React from 'react';
import { Box, Text } from 'ink';

interface ErrorDisplayProps {
  error: string | undefined;
  retryCount?: number;
  maxRetries?: number;
}

export function ErrorDisplay({ error, retryCount, maxRetries }: ErrorDisplayProps) {
  if (!error) {
    return null;
  }

  const isRetrying = retryCount !== undefined && maxRetries !== undefined && retryCount < maxRetries;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="red"
      paddingX={1}
      marginTop={1}
    >
      <Box marginBottom={1}>
        <Text bold color="red">
          Error
        </Text>
      </Box>
      <Box>
        <Text color="red">{error}</Text>
      </Box>
      {isRetrying && (
        <Box marginTop={1}>
          <Text color="yellow">
            Retrying... (attempt {retryCount! + 1}/{maxRetries})
          </Text>
        </Box>
      )}
    </Box>
  );
}
