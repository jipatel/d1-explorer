import React from 'react';
import { Box, Text } from 'ink';
import type { D1Result } from '../db/parser.js';

interface ResultsTableProps {
  result: D1Result | undefined;
  maxRows?: number;
}

function formatCell(value: unknown, maxWidth: number): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  const str = String(value);
  if (str.length > maxWidth) {
    return str.slice(0, maxWidth - 3) + '...';
  }
  return str;
}

function calculateColumnWidths(
  columns: Array<{ name: string }>,
  rows: Record<string, unknown>[],
  maxWidth: number = 30
): number[] {
  return columns.map(col => {
    const headerWidth = col.name.length;
    const maxDataWidth = Math.max(
      ...rows.map(row => formatCell(row[col.name], maxWidth).length),
      0
    );
    return Math.min(Math.max(headerWidth, maxDataWidth, 4), maxWidth);
  });
}

export function ResultsTable({ result, maxRows = 50 }: ResultsTableProps) {
  if (!result) {
    return null;
  }

  if (result.rows.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>No rows returned</Text>
        <Text dimColor>
          Query completed in {result.meta.duration}ms
        </Text>
      </Box>
    );
  }

  const displayRows = result.rows.slice(0, maxRows);
  const columnWidths = calculateColumnWidths(result.columns, displayRows);

  // Header
  const headerRow = result.columns
    .map((col, i) => col.name.padEnd(columnWidths[i]))
    .join(' | ');

  // Separator
  const separator = columnWidths.map(w => '-'.repeat(w)).join('-+-');

  // Data rows
  const dataRows = displayRows.map(row =>
    result.columns
      .map((col, i) => formatCell(row[col.name], columnWidths[i]).padEnd(columnWidths[i]))
      .join(' | ')
  );

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1}>
        <Text bold color="green">
          Results ({result.rows.length} row{result.rows.length !== 1 ? 's' : ''})
        </Text>
        <Box marginTop={1}>
          <Text color="cyan" bold>
            {headerRow}
          </Text>
        </Box>
        <Box>
          <Text dimColor>{separator}</Text>
        </Box>
        {dataRows.map((row, i) => (
          <Box key={i}>
            <Text>{row}</Text>
          </Box>
        ))}
        {result.rows.length > maxRows && (
          <Box marginTop={1}>
            <Text dimColor>
              ... and {result.rows.length - maxRows} more rows (showing first {maxRows})
            </Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Query completed in {result.meta.duration}ms | Rows read: {result.meta.rows_read}
        </Text>
      </Box>
    </Box>
  );
}
