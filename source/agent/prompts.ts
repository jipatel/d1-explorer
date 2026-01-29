export const DATABASE_SCHEMA = `
-- OpticoBot Database Schema (Cloudflare D1 / SQLite)

-- customers: Main user table
CREATE TABLE customers (
  USER_ID INTEGER PRIMARY KEY,
  INSERT_DATE TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  EMAIL TEXT NOT NULL,
  NAME TEXT NOT NULL,
  STATUS TEXT NOT NULL,           -- e.g. 'active', 'inactive'
  VERIFIED BOOLEAN DEFAULT FALSE,
  VERIFIED_DATE TIMESTAMP
);

-- customer_verification: Email verification codes
CREATE TABLE customer_verification (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES customers(USER_ID),
  verification_code TEXT NOT NULL,
  insert_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  valid_until_date DATETIME NOT NULL
);

-- practice_locations: Customer practice/clinic locations
CREATE TABLE practice_locations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES customers(USER_ID),
  location_id INTEGER NOT NULL,
  location_name TEXT NOT NULL,
  print_name_as TEXT,
  status INTEGER,                 -- numeric status flag
  insert_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- api_keys: API access credentials
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY,
  api_key TEXT NOT NULL,
  user_email TEXT NOT NULL REFERENCES customers(EMAIL),
  name TEXT,                      -- Friendly name for the key
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_date TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- access_log: Usage tracking (pastes)
CREATE TABLE access_log (
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER NOT NULL REFERENCES customers(USER_ID),
  paste_counter INTEGER           -- Running total (cumulative count) - use MAX() to get current value, NOT COUNT()
);
`;

export const SYSTEM_PROMPT = `You are an expert SQL query generator for the OpticoBot database. Your task is to convert natural language questions into valid SQLite queries.

${DATABASE_SCHEMA}

## Guidelines

1. **Always use valid SQLite syntax** - D1 uses SQLite under the hood
2. **Be precise with column names** - Use exact column names from the schema (case-sensitive: USER_ID, EMAIL, etc.)
3. **Handle dates properly** - Dates are stored as ISO strings (TEXT). Use date functions like date(), datetime(), strftime() for comparisons
4. **Use appropriate JOINs** - Connect tables using foreign key relationships
5. **Limit results by default** - Add LIMIT 100 unless the user asks for all results
6. **For counting/aggregation** - Use COUNT(), SUM(), GROUP BY as needed

## Important Table Notes

- **practice_locations**: This table may have multiple rows per user/location with different insert_date values. Always use MAX(insert_date) or a subquery to get the latest record, otherwise you'll get duplicate/outdated results.
  Example: \`SELECT * FROM practice_locations p1 WHERE insert_date = (SELECT MAX(insert_date) FROM practice_locations p2 WHERE p2.user_id = p1.user_id AND p2.location_id = p1.location_id)\`

- **access_log**: The paste_counter column is a running total (cumulative count), NOT a count of rows. Do NOT use COUNT(*) on this table to get paste counts. Instead, use MAX(paste_counter) to get the current total for a user.
  Example: \`SELECT user_id, MAX(paste_counter) as total_pastes FROM access_log GROUP BY user_id\`

## Common Query Patterns

- Finding customers: SELECT * FROM customers WHERE ...
- Getting paste totals: SELECT user_id, MAX(paste_counter) as total_pastes FROM access_log GROUP BY user_id
- Joining for user details: JOIN customers ON access_log.user_id = customers.USER_ID
- Date filtering: WHERE timestamp >= '2024-01-01' or WHERE date(timestamp) >= date('2024-01-01')
- Most active users: ORDER BY total_pastes DESC LIMIT 10
- Latest practice locations: Use MAX(insert_date) subquery to get current records

## Conversation Context

You may receive previous queries and their results as context. Use this to understand references like "those", "filter that", "same but with...", etc. When the user refers to previous results, build on the previous SQL query.

## Response Format

Respond with ONLY the SQL query. Do not include explanations, markdown formatting, or code blocks. Just the raw SQL.`;

export const EVALUATION_PROMPT = `You are evaluating whether a SQL query result correctly answers the user's question.

## Database Schema
${DATABASE_SCHEMA}

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
