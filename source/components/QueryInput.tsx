import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
  history?: string[];
}

export function QueryInput({ onSubmit, disabled = false, history = [] }: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setQuery('');
      setHistoryIndex(-1);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setHistoryIndex(-1);
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>
          {'> '}
        </Text>
        {disabled ? (
          <Text dimColor>{query || 'Processing...'}</Text>
        ) : (
          <TextInput
            value={query}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="Enter your query (e.g., 'show all customers')"
            focus={true}
          />
        )}
      </Box>
      {!disabled && (
        <Box marginTop={1}>
          <Text dimColor>
            Press Enter to submit, Ctrl+C to exit
          </Text>
        </Box>
      )}
    </Box>
  );
}
