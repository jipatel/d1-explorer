import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../config/index.js';
import { executeQuery } from '../db/executor.js';
import type { D1Result } from '../db/parser.js';
import {
  SYSTEM_PROMPT,
  EVALUATION_PROMPT,
  buildConversationMessages,
  buildEvaluationPrompt,
  type ConversationTurnData,
} from './prompts.js';
import {
  type AgentState,
  type AgentEvent,
  type AgentIteration,
  type EvaluationResult,
  type ConversationTurn,
  MAX_ITERATIONS,
} from './types.js';

export interface AgentOptions {
  config: Config;
  conversationHistory?: ConversationTurn[];
  onEvent?: (event: AgentEvent) => void;
}

function createInitialState(query: string): AgentState {
  return {
    status: 'idle',
    query,
    iterations: [],
    statusMessage: 'Starting...',
  };
}

function emitEvent(
  state: AgentState,
  type: AgentEvent['type'],
  onEvent?: (event: AgentEvent) => void
): void {
  onEvent?.({ type, state: { ...state } });
}

async function generateSQL(
  client: Anthropic,
  userQuery: string,
  previousAttempts: AgentIteration[],
  conversationHistory: ConversationTurn[]
): Promise<string> {
  const attempts = previousAttempts.map(a => ({
    sql: a.sql,
    error: a.error,
    evaluation: a.evaluation,
  }));

  // Convert conversation history to the format expected by buildConversationMessages
  const historyData: ConversationTurnData[] = conversationHistory.map(turn => ({
    query: turn.query,
    sql: turn.sql,
    resultSummary: turn.result ? `${turn.result.rows.length} rows` : undefined,
    error: turn.error,
  }));

  const messages = buildConversationMessages(
    historyData,
    userQuery,
    attempts.length > 0 ? attempts : undefined
  );

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Clean up the SQL - remove markdown code blocks if present
  let sql = content.text.trim();
  if (sql.startsWith('```sql')) {
    sql = sql.slice(6);
  } else if (sql.startsWith('```')) {
    sql = sql.slice(3);
  }
  if (sql.endsWith('```')) {
    sql = sql.slice(0, -3);
  }
  return sql.trim();
}

async function evaluateResult(
  client: Anthropic,
  userQuery: string,
  sql: string,
  result: D1Result
): Promise<EvaluationResult> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: EVALUATION_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildEvaluationPrompt(userQuery, sql, result),
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  try {
    // Try to parse JSON from the response
    let jsonText = content.text.trim();

    // Handle markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }

    const parsed = JSON.parse(jsonText.trim());
    return {
      isCorrect: Boolean(parsed.isCorrect),
      explanation: String(parsed.explanation || ''),
      suggestedFix: parsed.suggestedFix ? String(parsed.suggestedFix) : undefined,
    };
  } catch {
    // If JSON parsing fails, try to infer from text
    const text = content.text.toLowerCase();
    const isCorrect = text.includes('correct') && !text.includes('incorrect');
    return {
      isCorrect,
      explanation: content.text,
    };
  }
}

export async function* runAgentLoop(
  query: string,
  options: AgentOptions
): AsyncGenerator<AgentEvent, AgentState, void> {
  const { config, conversationHistory = [], onEvent } = options;
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  let state = createInitialState(query);

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    // Generate SQL
    state = {
      ...state,
      status: 'generating',
      statusMessage: `Generating SQL (attempt ${iteration}/${MAX_ITERATIONS})...`,
    };
    emitEvent(state, 'status_change', onEvent);
    yield { type: 'status_change', state };

    let sql: string;
    try {
      sql = await generateSQL(client, query, state.iterations, conversationHistory);
    } catch (error) {
      state = {
        ...state,
        status: 'error',
        finalError: `Failed to generate SQL: ${error instanceof Error ? error.message : String(error)}`,
        statusMessage: 'Failed to generate SQL',
      };
      emitEvent(state, 'error', onEvent);
      yield { type: 'error', state };
      return state;
    }

    state = {
      ...state,
      currentSql: sql,
    };
    emitEvent(state, 'sql_generated', onEvent);
    yield { type: 'sql_generated', state };

    // Execute SQL
    state = {
      ...state,
      status: 'executing',
      statusMessage: 'Executing query...',
    };
    emitEvent(state, 'status_change', onEvent);
    yield { type: 'status_change', state };

    const executeResult = await executeQuery({ sql, config });

    const currentIteration: AgentIteration = {
      iterationNumber: iteration,
      sql,
      needsRetry: false,
    };

    if (!executeResult.response.success) {
      const errorResponse = executeResult.response as { success: false; error: string };
      currentIteration.error = errorResponse.error;
      currentIteration.needsRetry = iteration < MAX_ITERATIONS;

      state = {
        ...state,
        iterations: [...state.iterations, currentIteration],
        statusMessage: `Query failed: ${errorResponse.error}`,
      };
      emitEvent(state, 'execution_complete', onEvent);
      yield { type: 'execution_complete', state };

      if (iteration === MAX_ITERATIONS) {
        state = {
          ...state,
          status: 'error',
          finalError: `Failed after ${MAX_ITERATIONS} attempts. Last error: ${errorResponse.error}`,
          statusMessage: 'Max retries reached',
        };
        emitEvent(state, 'error', onEvent);
        yield { type: 'error', state };
        return state;
      }
      continue;
    }

    currentIteration.result = executeResult.response;

    // Evaluate result
    state = {
      ...state,
      status: 'evaluating',
      statusMessage: 'Evaluating results...',
    };
    emitEvent(state, 'status_change', onEvent);
    yield { type: 'status_change', state };

    let evaluation: EvaluationResult;
    try {
      evaluation = await evaluateResult(client, query, sql, executeResult.response);
    } catch (error) {
      // If evaluation fails, assume the result is good
      evaluation = {
        isCorrect: true,
        explanation: 'Evaluation skipped due to error',
      };
    }

    currentIteration.evaluation = evaluation.explanation;
    currentIteration.needsRetry = !evaluation.isCorrect && iteration < MAX_ITERATIONS;

    state = {
      ...state,
      iterations: [...state.iterations, currentIteration],
    };
    emitEvent(state, 'evaluation_complete', onEvent);
    yield { type: 'evaluation_complete', state };

    if (evaluation.isCorrect || iteration === MAX_ITERATIONS) {
      state = {
        ...state,
        status: 'complete',
        finalResult: executeResult.response,
        statusMessage: evaluation.isCorrect
          ? 'Query completed successfully'
          : `Best result after ${MAX_ITERATIONS} attempts`,
      };
      emitEvent(state, 'complete', onEvent);
      yield { type: 'complete', state };
      return state;
    }
  }

  return state;
}

export async function runAgent(query: string, options: AgentOptions): Promise<AgentState> {
  let finalState: AgentState | undefined;

  for await (const event of runAgentLoop(query, options)) {
    finalState = event.state;
  }

  return finalState!;
}
