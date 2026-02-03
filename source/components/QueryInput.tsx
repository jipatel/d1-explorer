import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

const COMMANDS = [
  { label: '/clear', description: 'Clear conversation history' },
  { label: '/summarize', description: 'Show schema summary' },
  { label: '/resummarize', description: 'Regenerate schema summary' },
  { label: '/help', description: 'Show available commands' },
];

interface QueryInputProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
  history?: string[];
  onSuggestionsVisibleChange?: (visible: boolean) => void;
}

export function QueryInput({ onSubmit, disabled = false, history = [], onSuggestionsVisibleChange }: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const pendingSubmitRef = useRef<string | null>(null);

  useEffect(() => {
    onSuggestionsVisibleChange?.(suggestionsVisible);
  }, [suggestionsVisible, onSuggestionsVisibleChange]);

  const getFilteredCommands = (value: string) => {
    if (!value.startsWith('/')) return [];
    return COMMANDS.filter(cmd => cmd.label.startsWith(value.toLowerCase()));
  };

  const handleSubmit = (value: string) => {
    // If a pending submit was set by useInput (Enter on suggestion), use that instead
    if (pendingSubmitRef.current !== null) {
      const command = pendingSubmitRef.current;
      pendingSubmitRef.current = null;
      setQuery('');
      setHistoryIndex(-1);
      setSuggestionsVisible(false);
      setSelectedIndex(0);
      onSubmit(command);
      return;
    }

    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSubmit(trimmed);
      setQuery('');
      setHistoryIndex(-1);
      setSuggestionsVisible(false);
      setSelectedIndex(0);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setHistoryIndex(-1);

    if (value.startsWith('/')) {
      setSuggestionsVisible(true);
      setSelectedIndex(0);
    } else {
      setSuggestionsVisible(false);
      setSelectedIndex(0);
    }
  };

  const filtered = suggestionsVisible ? getFilteredCommands(query) : [];

  useInput((input, key) => {
    if (disabled || !suggestionsVisible) return;

    if (key.upArrow) {
      setSelectedIndex(prev =>
        filtered.length === 0 ? 0 : prev > 0 ? prev - 1 : filtered.length - 1
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev =>
        filtered.length === 0 ? 0 : prev < filtered.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (key.tab && filtered.length > 0) {
      const selected = filtered[selectedIndex];
      if (selected) {
        setQuery(selected.label);
        setSuggestionsVisible(false);
        setSelectedIndex(0);
      }
      return;
    }

    if (key.return && filtered.length > 0) {
      const selected = filtered[selectedIndex];
      if (selected) {
        // Set pending so handleSubmit knows to use this value
        pendingSubmitRef.current = selected.label;
      }
      return;
    }

    if (key.escape) {
      setSuggestionsVisible(false);
      setSelectedIndex(0);
      return;
    }
  });

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
      {!disabled && suggestionsVisible && (
        <Box flexDirection="column" marginLeft={2}>
          {filtered.length > 0 ? (
            filtered.map((cmd, index) => (
              <Box key={cmd.label}>
                <Text color={index === selectedIndex ? 'cyan' : undefined}>
                  {index === selectedIndex ? '> ' : '  '}
                  {cmd.label}
                </Text>
                <Text dimColor> — {cmd.description}</Text>
              </Box>
            ))
          ) : (
            <Text dimColor>No matching commands</Text>
          )}
        </Box>
      )}
      {!disabled && !suggestionsVisible && (
        <Box marginTop={1}>
          <Text dimColor>
            Press Enter to submit, Ctrl+C to exit
          </Text>
        </Box>
      )}
    </Box>
  );
}
