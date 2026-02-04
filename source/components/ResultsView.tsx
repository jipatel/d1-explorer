import React from 'react';
import { Box, Text } from 'ink';
import type { D1Result } from '../db/parser.js';

interface ResultsViewProps {
  sql?: string;
  result?: D1Result;
  error?: string;
  summary?: string;
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

export function ResultsView({ sql, result, error, summary, maxRows = 30 }: ResultsViewProps) {
  return (
    <Box flexDirection="column">
      {/* Summary */}
      {summary && (
        <Box marginBottom={1}>
          <Text>{summary}</Text>
        </Box>
      )}

      {/* SQL */}
      {sql && (
        <Box marginBottom={1}>
          <Text dimColor>SQL: </Text>
          <Text color="yellow">{sql}</Text>
        </Box>
      )}

      {/* Error */}
      {error && (
        <Box>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}

      {/* Results table */}
      {result && result.rows.length > 0 && (
        <Box flexDirection="column">
          {renderTable(result, maxRows)}
          <Box marginTop={1}>
            <Text dimColor>{result.rows.length} row{result.rows.length !== 1 ? 's' : ''}</Text>
          </Box>
        </Box>
      )}

      {/* Empty result */}
      {result && result.rows.length === 0 && (
        <Text dimColor>No rows returned</Text>
      )}
    </Box>
  );
}

function renderTable(result: D1Result, maxRows: number) {
  const displayRows = result.rows.slice(0, maxRows);
  const columnWidths = calculateColumnWidths(result.columns, displayRows);

  const headerRow = result.columns
    .map((col, i) => col.name.padEnd(columnWidths[i]!))
    .join('  ');

  const separator = columnWidths.map(w => '─'.repeat(w)).join('──');

  const dataRows = displayRows.map((row, rowIndex) => (
    <Box key={rowIndex}>
      <Text>
        {result.columns
          .map((col, i) => formatCell(row[col.name], columnWidths[i]!).padEnd(columnWidths[i]!))
          .join('  ')}
      </Text>
    </Box>
  ));

  return (
    <>
      <Box>
        <Text color="cyan" bold>{headerRow}</Text>
      </Box>
      <Box>
        <Text dimColor>{separator}</Text>
      </Box>
      {dataRows}
      {result.rows.length > maxRows && (
        <Box marginTop={1}>
          <Text dimColor>
            ... and {result.rows.length - maxRows} more rows
          </Text>
        </Box>
      )}
    </>
  );
}
