import type { DiscoveredSchema } from '../session/types.js';

export function buildSchemaText(schema: DiscoveredSchema): string {
  const parts: string[] = [];

  for (const table of schema.tables) {
    const colDefs = table.columns.map(col => {
      let def = `  ${col.name} ${col.type}`;
      if (col.pk) def += ' PRIMARY KEY';
      if (col.notnull) def += ' NOT NULL';
      if (col.defaultValue !== null) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    const fkDefs = table.foreignKeys.map(fk =>
      `  FOREIGN KEY (${fk.fromColumn}) REFERENCES ${fk.toTable}(${fk.toColumn})`
    );

    const allDefs = [...colDefs, ...fkDefs].join(',\n');
    parts.push(`CREATE TABLE ${table.name} (\n${allDefs}\n);`);
  }

  return parts.join('\n\n');
}

export function buildSystemPrompt(schema: DiscoveredSchema): string {
  const schemaText = buildSchemaText(schema);

  return `You are an expert SQL query generator. Your task is to convert natural language questions into valid SQLite queries.

## Database Schema

${schemaText}

${schema.aiNotes ? `## Schema Notes\n\n${schema.aiNotes}\n` : ''}
## Guidelines

1. **Always use valid SQLite syntax** - D1 uses SQLite under the hood
2. **Be precise with column names** - Use exact column names from the schema (case-sensitive)
3. **Handle dates properly** - Dates are stored as ISO strings (TEXT). Use date functions like date(), datetime(), strftime() for comparisons
4. **Use appropriate JOINs** - Connect tables using foreign key relationships
5. **Limit results by default** - Add LIMIT 100 unless the user asks for all results
6. **For counting/aggregation** - Use COUNT(), SUM(), GROUP BY as needed

## Conversation Context

You may receive previous queries and their results as context. Use this to understand references like "those", "filter that", "same but with...", etc. When the user refers to previous results, build on the previous SQL query.

## Response Format

Respond with ONLY the SQL query. Do not include explanations, markdown formatting, or code blocks. Just the raw SQL.`;
}

export function buildEvaluationSystemPrompt(schema: DiscoveredSchema): string {
  const schemaText = buildSchemaText(schema);

  return `You are evaluating whether a SQL query result correctly answers the user's question.

## Database Schema
${schemaText}

## Evaluation Criteria

1. **Completeness** - Does the result contain the information the user asked for?
2. **Correctness** - Is the data accurate based on what was queried?
3. **Format** - Is the result in a useful format (right columns, proper ordering)?

If the result is empty but the query is correct (just no matching data), that's still correct.

## Response Format

Respond with a JSON object:
{
  "isCorrect": true/false,
  "explanation": "Brief explanation of your evaluation",
  "suggestedFix": "If incorrect, suggest what to change in the SQL"
}`;
}

export const SUMMARY_PROMPT = `You are a concise data analyst. Given a user's question and the SQL query results, provide a brief natural language summary of the findings.

## Guidelines

1. **Be concise** - 1-3 sentences max
2. **Highlight key numbers** - Mention counts, totals, dates, and notable values
3. **Answer the question directly** - Lead with the answer, then add context
4. **Handle empty results** - If no rows returned, say so plainly
5. **No SQL or technical jargon** - Write for a non-technical reader`;

export function buildSummaryPrompt(
  userQuery: string,
  sql: string,
  result: { columns: Array<{ name: string }>; rows: Record<string, unknown>[] }
): string {
  const preview = result.rows.slice(0, 20);
  const resultText = preview.length > 0
    ? JSON.stringify(preview, null, 2)
    : '(no rows returned)';

  return `## User's Question
"${userQuery}"

## SQL Run
${sql}

## Results (${result.rows.length} row${result.rows.length !== 1 ? 's' : ''})
Columns: ${result.columns.map(c => c.name).join(', ')}
${resultText}
${result.rows.length > 20 ? `(showing 20 of ${result.rows.length} total rows)` : ''}

Summarize these results in plain English.`;
}

export function buildGeneratePrompt(userQuery: string, previousAttempts?: Array<{ sql: string; error?: string; evaluation?: string }>): string {
  let prompt = `Convert this natural language query to SQL:\n\n"${userQuery}"`;

  if (previousAttempts && previousAttempts.length > 0) {
    prompt += '\n\n## Previous Attempts\n';
    for (const attempt of previousAttempts) {
      prompt += `\nSQL: ${attempt.sql}`;
      if (attempt.error) {
        prompt += `\nError: ${attempt.error}`;
      }
      if (attempt.evaluation) {
        prompt += `\nEvaluation: ${attempt.evaluation}`;
      }
      prompt += '\n';
    }
    prompt += '\nPlease fix the issues and generate a corrected SQL query.';
  }

  return prompt;
}

export function buildEvaluationPrompt(
  userQuery: string,
  sql: string,
  result: { columns: Array<{ name: string }>; rows: Record<string, unknown>[] }
): string {
  const resultPreview = result.rows.slice(0, 10);
  const resultText = resultPreview.length > 0
    ? JSON.stringify(resultPreview, null, 2)
    : '(no rows returned)';

  return `## User's Question
"${userQuery}"

## Generated SQL
${sql}

## Query Result (first 10 rows)
Columns: ${result.columns.map(c => c.name).join(', ')}
${resultText}

${result.rows.length > 10 ? `(showing 10 of ${result.rows.length} total rows)` : ''}

Does this result correctly answer the user's question?`;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationTurnData {
  query: string;
  sql: string;
  resultSummary?: string;
  error?: string;
}

export function buildConversationMessages(
  history: ConversationTurnData[],
  currentQuery: string,
  previousAttempts?: Array<{ sql: string; error?: string; evaluation?: string }>
): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  // Add previous conversation turns
  for (const turn of history) {
    // User's query
    messages.push({
      role: 'user',
      content: `Convert this natural language query to SQL:\n\n"${turn.query}"`,
    });

    // Assistant's SQL response
    let assistantContent = turn.sql;
    if (turn.resultSummary) {
      assistantContent += `\n\n[Query returned: ${turn.resultSummary}]`;
    } else if (turn.error) {
      assistantContent += `\n\n[Query error: ${turn.error}]`;
    }
    messages.push({
      role: 'assistant',
      content: assistantContent,
    });
  }

  // Add current query with any retry context
  let currentPrompt = `Convert this natural language query to SQL:\n\n"${currentQuery}"`;

  if (previousAttempts && previousAttempts.length > 0) {
    currentPrompt += '\n\n## Previous Attempts (for this query)\n';
    for (const attempt of previousAttempts) {
      currentPrompt += `\nSQL: ${attempt.sql}`;
      if (attempt.error) {
        currentPrompt += `\nError: ${attempt.error}`;
      }
      if (attempt.evaluation) {
        currentPrompt += `\nEvaluation: ${attempt.evaluation}`;
      }
      currentPrompt += '\n';
    }
    currentPrompt += '\nPlease fix the issues and generate a corrected SQL query.';
  }

  messages.push({
    role: 'user',
    content: currentPrompt,
  });

  return messages;
}
