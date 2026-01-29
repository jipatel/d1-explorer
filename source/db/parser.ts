import { z } from 'zod';

export interface D1Column {
  name: string;
  type: string;
}

export interface D1Result {
  success: boolean;
  columns: D1Column[];
  rows: Record<string, unknown>[];
  meta: {
    duration: number;
    changes: number;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1Error {
  success: false;
  error: string;
}

export type D1Response = D1Result | D1Error;

const D1MetaSchema = z.object({
  duration: z.number().optional().default(0),
  changes: z.number().optional().default(0),
  rows_read: z.number().optional().default(0),
  rows_written: z.number().optional().default(0),
});

const D1ResultSchema = z.object({
  success: z.literal(true),
  results: z.array(z.record(z.unknown())).optional().default([]),
  meta: D1MetaSchema.optional(),
});

const D1ErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

const D1OutputSchema = z.array(z.union([D1ResultSchema, D1ErrorSchema]));

export function parseD1Output(jsonOutput: string): D1Response {
  try {
    const parsed = JSON.parse(jsonOutput);
    const validated = D1OutputSchema.parse(parsed);

    if (validated.length === 0) {
      return {
        success: false,
        error: 'No results returned from D1',
      };
    }

    const result = validated[0];

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const rows = result.results ?? [];
    const columns = extractColumns(rows);

    return {
      success: true,
      columns,
      rows,
      meta: {
        duration: result.meta?.duration ?? 0,
        changes: result.meta?.changes ?? 0,
        rows_read: result.meta?.rows_read ?? 0,
        rows_written: result.meta?.rows_written ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: `Failed to parse D1 JSON output: ${error.message}`,
      };
    }
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Invalid D1 response format: ${error.message}`,
      };
    }
    return {
      success: false,
      error: `Unknown error parsing D1 output: ${String(error)}`,
    };
  }
}

function extractColumns(rows: Record<string, unknown>[]): D1Column[] {
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  return Object.entries(firstRow).map(([name, value]) => ({
    name,
    type: inferType(value),
  }));
}

function inferType(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return Number.isInteger(value) ? 'INTEGER' : 'REAL';
  if (typeof value === 'boolean') return 'INTEGER';
  if (typeof value === 'string') return 'TEXT';
  return 'BLOB';
}

export function formatResultsAsText(result: D1Result): string {
  if (result.rows.length === 0) {
    return 'No rows returned';
  }

  const columnWidths = calculateColumnWidths(result.columns, result.rows);
  const lines: string[] = [];

  // Header
  const header = result.columns
    .map((col, i) => col.name.padEnd(columnWidths[i]))
    .join(' | ');
  lines.push(header);

  // Separator
  const separator = columnWidths.map(w => '-'.repeat(w)).join('-+-');
  lines.push(separator);

  // Rows
  for (const row of result.rows) {
    const rowStr = result.columns
      .map((col, i) => formatCell(row[col.name]).padEnd(columnWidths[i]))
      .join(' | ');
    lines.push(rowStr);
  }

  return lines.join('\n');
}

function calculateColumnWidths(columns: D1Column[], rows: Record<string, unknown>[]): number[] {
  return columns.map(col => {
    const headerWidth = col.name.length;
    const maxDataWidth = Math.max(
      ...rows.map(row => formatCell(row[col.name]).length),
      0
    );
    return Math.min(Math.max(headerWidth, maxDataWidth), 50);
  });
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return value;
  return String(value);
}
