import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SelectListItem {
  label: string;
  value: string;
}

interface SelectListProps {
  items: SelectListItem[];
  onSelect: (item: SelectListItem) => void;
  title?: string;
}

export function SelectList({ items, onSelect, title }: SelectListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    }
    if (key.return) {
      const item = items[selectedIndex];
      if (item) {
        onSelect(item);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold color="cyan">{title}</Text>
        </Box>
      )}
      {items.map((item, index) => (
        <Box key={item.value}>
          <Text color={index === selectedIndex ? 'cyan' : undefined}>
            {index === selectedIndex ? '> ' : '  '}
            {item.label}
          </Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
}
