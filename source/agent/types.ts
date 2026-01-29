import type { D1Result } from '../db/parser.js';

export interface ConversationTurn {
  query: string;
  sql: string;
  result?: D1Result;
  error?: string;
}

export type AgentStatus =
  | 'idle'
  | 'generating'
  | 'executing'
  | 'evaluating'
  | 'complete'
  | 'error';

export interface AgentIteration {
  iterationNumber: number;
  sql: string;
  result?: D1Result;
  error?: string;
  evaluation?: string;
  needsRetry: boolean;
}

export interface AgentState {
  status: AgentStatus;
  query: string;
  currentSql?: string;
  iterations: AgentIteration[];
  finalResult?: D1Result;
  finalError?: string;
  statusMessage: string;
}

export interface AgentEvent {
  type: 'status_change' | 'sql_generated' | 'execution_complete' | 'evaluation_complete' | 'complete' | 'error';
  state: AgentState;
}

export interface GenerateSQLResult {
  sql: string;
  explanation?: string;
}

export interface EvaluationResult {
  isCorrect: boolean;
  explanation: string;
  suggestedFix?: string;
}

export const MAX_ITERATIONS = 3;
