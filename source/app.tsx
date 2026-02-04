import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { QueryInput, StatusBar, ResultsView, Divider } from './components/index.js';
import { runAgentLoop } from './agent/loop.js';
import { loadHistory, saveHistory } from './history/storage.js';
import { applyDirective, summarizeAiNotes, updateSessionAiNotes, updateSessionAiNotesSummary } from './session/index.js';
import type { AgentState, ConversationTurn } from './agent/types.js';
import type { AppSession } from './session/types.js';
import type { DiscoveredSchema } from './session/types.js';
import type { Config } from './config/index.js';

interface AppProps {
  session: AppSession;
  onSwitchDatabase: () => void;
}

const INITIAL_STATE: AgentState = {
  status: 'idle',
  query: '',
  iterations: [],
  statusMessage: 'Ready',
};

export function App({ session, onSwitchDatabase }: AppProps) {
  const { exit } = useApp();
  const [agentState, setAgentState] = useState<AgentState>(INITIAL_STATE);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [suggestionsActive, setSuggestionsActive] = useState(false);
  const [schema, setSchema] = useState<DiscoveredSchema>(session.schema);
  const [notesSummary, setNotesSummary] = useState<string | undefined>(session.schema.aiNotesSummary);
  const summaryGenId = useRef(0);

  // Build a Config object from the session for the executor
  const config: Config = useMemo(() => ({
    anthropicApiKey: session.anthropicApiKey,
    cloudflareAccountId: session.cloudflareAccountId,
    d1DatabaseName: session.databaseName,
    d1Remote: session.d1Remote,
    allowMutations: session.allowMutations,
  }), [session]);

  // Handle /summarize — may need async API call if no cache
  const handleSummarize = useCallback(async (force = false) => {
    if (notesSummary && !force) {
      setCommandMessage(notesSummary);
      return;
    }
    if (!schema.aiNotes) {
      setCommandMessage('No schema notes to summarize.');
      setTimeout(() => setCommandMessage(null), 3000);
      return;
    }
    setIsProcessing(true);
    setAgentState(prev => ({
      ...prev,
      status: 'generating',
      statusMessage: 'Generating schema summary...',
    }));
    try {
      const summary = await summarizeAiNotes(schema.aiNotes, session.anthropicApiKey);
      setNotesSummary(summary);
      setSchema(prev => ({ ...prev, aiNotesSummary: summary }));
      await updateSessionAiNotesSummary(session.databaseName, summary);
      setCommandMessage(summary);
    } catch (error) {
      setCommandMessage(`Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setCommandMessage(null), 4000);
    } finally {
      setAgentState(INITIAL_STATE);
      setIsProcessing(false);
    }
  }, [notesSummary, schema.aiNotes, session.anthropicApiKey, session.databaseName]);

  // Handle slash commands - returns true if input was a command
  const handleCommand = useCallback((input: string): boolean => {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === '/clear') {
      setConversationHistory([]);
      setHistoryIndex(null);
      saveHistory(session.databaseName, []);
      setCommandMessage('History cleared');
      setTimeout(() => setCommandMessage(null), 2000);
      return true;
    }

    if (trimmed === '/summarize') {
      handleSummarize();
      return true;
    }

    if (trimmed === '/resummarize') {
      handleSummarize(true);
      return true;
    }

    if (trimmed === '/switch') {
      onSwitchDatabase();
      return true;
    }

    if (trimmed === '/help') {
      setCommandMessage('Commands: /clear (clear history), /summarize (show schema summary), /resummarize (regenerate summary), /switch (switch database), /help (show commands) | # <note> (update schema notes)');
      setTimeout(() => setCommandMessage(null), 5000);
      return true;
    }

    if (trimmed.startsWith('/')) {
      setCommandMessage(`Unknown command: ${trimmed}. Type /help for available commands.`);
      setTimeout(() => setCommandMessage(null), 3000);
      return true;
    }

    return false;
  }, [session.databaseName, handleSummarize, onSwitchDatabase]);

  // Load history on mount
  useEffect(() => {
    loadHistory(session.databaseName).then(history => {
      setConversationHistory(history);
      setHistoryLoaded(true);
    });
  }, [session.databaseName]);

  // Save history when it changes
  useEffect(() => {
    if (historyLoaded && conversationHistory.length > 0) {
      saveHistory(session.databaseName, conversationHistory);
    }
  }, [conversationHistory, historyLoaded, session.databaseName]);

  // Background regeneration of aiNotes summary
  const regenerateSummaryInBackground = useCallback((aiNotes: string) => {
    const genId = ++summaryGenId.current;
    summarizeAiNotes(aiNotes, session.anthropicApiKey)
      .then(summary => {
        // Only apply if no newer generation was started
        if (genId === summaryGenId.current) {
          setNotesSummary(summary);
          setSchema(prev => ({ ...prev, aiNotesSummary: summary }));
          updateSessionAiNotesSummary(session.databaseName, summary).catch(() => {});
        }
      })
      .catch(() => {});
  }, [session.anthropicApiKey, session.databaseName]);

  // On mount: if aiNotes exist but no cached summary, generate in background
  useEffect(() => {
    if (schema.aiNotes && !notesSummary) {
      regenerateSummaryInBackground(schema.aiNotes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    // History navigation - only when not processing, history exists, and no suggestions open
    if (!isProcessing && conversationHistory.length > 0 && !suggestionsActive) {
      if (key.upArrow) {
        setCommandMessage(null);
        setHistoryIndex(prev =>
          prev === null ? conversationHistory.length - 1 : Math.max(0, prev - 1)
        );
      }
      if (key.downArrow) {
        setCommandMessage(null);
        setHistoryIndex(prev => {
          if (prev === null) return null;
          return prev >= conversationHistory.length - 1 ? null : prev + 1;
        });
      }
      if (key.escape) {
        setCommandMessage(null);
        setHistoryIndex(null);
      }
    }
  });

  const handleDirective = useCallback(async (text: string) => {
    setIsProcessing(true);
    setAgentState(prev => ({
      ...prev,
      status: 'generating',
      statusMessage: 'Updating schema notes...',
    }));

    try {
      const newNotes = await applyDirective(
        schema.aiNotes,
        text,
        session.anthropicApiKey,
      );
      setSchema(prev => ({ ...prev, aiNotes: newNotes, aiNotesSummary: undefined }));
      setNotesSummary(undefined);
      await updateSessionAiNotes(session.databaseName, newNotes);
      setCommandMessage('Schema notes updated');
      setTimeout(() => setCommandMessage(null), 3000);
      // Regenerate summary in the background
      regenerateSummaryInBackground(newNotes);
    } catch (error) {
      setCommandMessage(`Failed to update notes: ${error instanceof Error ? error.message : String(error)}`);
      setTimeout(() => setCommandMessage(null), 4000);
    } finally {
      setAgentState(INITIAL_STATE);
      setIsProcessing(false);
    }
  }, [schema, session.anthropicApiKey, session.databaseName, regenerateSummaryInBackground]);

  const handleQuerySubmit = useCallback(async (query: string) => {
    setIsProcessing(true);
    setQueryHistory(prev => [...prev, query]);

    let finalState: AgentState | undefined;

    try {
      const generator = runAgentLoop(query, {
        config,
        schema,
        conversationHistory,
      });

      for await (const event of generator) {
        setAgentState(event.state);
        finalState = event.state;
      }

      // Add successful query to conversation history
      if (finalState?.status === 'complete' && finalState.currentSql) {
        setConversationHistory(prev => [
          ...prev,
          {
            query,
            sql: finalState!.currentSql!,
            result: finalState!.finalResult,
            summary: finalState!.finalSummary,
          },
        ]);
      }
    } catch (error) {
      setAgentState(prev => ({
        ...prev,
        status: 'error',
        finalError: error instanceof Error ? error.message : String(error),
        statusMessage: 'Unexpected error',
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [config, schema, conversationHistory]);

  const handleNewQuery = useCallback(() => {
    setAgentState(INITIAL_STATE);
  }, []);

  const currentIteration = agentState.iterations.length;

  // Determine what to show in the content area
  const selectedHistoryItem = historyIndex !== null ? conversationHistory[historyIndex] : null;
  const showingHistory = selectedHistoryItem !== null;

  const contentQuery = showingHistory
    ? selectedHistoryItem?.query
    : agentState.query;

  const contentSql = showingHistory
    ? selectedHistoryItem?.sql
    : agentState.currentSql;

  const contentResult = showingHistory
    ? selectedHistoryItem?.result
    : agentState.finalResult;

  const contentError = showingHistory
    ? selectedHistoryItem?.error
    : agentState.finalError;

  const contentSummary = showingHistory
    ? selectedHistoryItem?.summary
    : agentState.finalSummary;

  const hasContent = contentQuery || contentSql || contentResult || contentError || contentSummary;
  const isIdle = !isProcessing && !hasContent && !commandMessage;

  // Database info string
  const dbInfo = `${session.databaseName} (${session.d1Remote ? 'remote' : 'local'})`;

  // History position indicator
  const historyIndicator = showingHistory
    ? `${historyIndex! + 1}/${conversationHistory.length}`
    : conversationHistory.length > 0 && (agentState.status === 'complete' || agentState.status === 'error')
      ? `${conversationHistory.length}/${conversationHistory.length}`
      : undefined;

  // Right-aligned hints for the input bar
  const hints: string[] = [];
  if (conversationHistory.length > 0) hints.push('↑↓ history');
  hints.push('/help');
  const hintsText = hints.join(' · ');

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold color="cyan">OpticoBot</Text>
        <Text dimColor>
          {dbInfo}
          {session.allowMutations ? ' [mutations]' : ''}
        </Text>
      </Box>

      <Divider />

      {/* Content area */}
      <Box flexDirection="column" paddingY={1} paddingX={1}>
        {/* Idle state — welcome message */}
        {isIdle && (
          <Box flexDirection="column">
            <Text>Ask a question about your database.</Text>
            <Text dimColor>Try "show all customers" or "how many records?"</Text>
          </Box>
        )}

        {/* Command message (e.g. /summarize, /help, /clear feedback) */}
        {commandMessage && !isProcessing && (
          <Box flexDirection="column">
            <Text color="yellow">{commandMessage}</Text>
          </Box>
        )}

        {/* Processing state */}
        {isProcessing && (
          <Box flexDirection="column">
            {agentState.query && (
              <Box marginBottom={1}>
                <Text>{agentState.query}</Text>
              </Box>
            )}
            {agentState.currentSql && (
              <Box marginBottom={1}>
                <Text dimColor>SQL: </Text>
                <Text color="yellow">{agentState.currentSql}</Text>
              </Box>
            )}
            <StatusBar
              status={agentState.status}
              message={agentState.statusMessage}
              iterationCount={currentIteration > 0 ? currentIteration : undefined}
              maxIterations={3}
            />
          </Box>
        )}

        {/* Results / History view */}
        {!isProcessing && !commandMessage && hasContent && (
          <Box flexDirection="column">
            {/* Query line with position indicator */}
            {contentQuery && (
              <Box marginBottom={1} justifyContent="space-between">
                <Text>{contentQuery}</Text>
                {historyIndicator && (
                  <Text dimColor>{historyIndicator}</Text>
                )}
              </Box>
            )}

            <ResultsView
              sql={contentSql}
              result={contentResult}
              error={contentError}
              summary={contentSummary}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* Input bar */}
      {!isProcessing && (
        <Box justifyContent="space-between">
          <Box flexShrink={1}>
            <QueryInput
              onSubmit={(input) => {
                const trimmed = input.trim();
                if (trimmed.startsWith('#')) {
                  const directive = trimmed.slice(1).trim();
                  if (directive) {
                    handleDirective(directive);
                  }
                  return;
                }
                if (handleCommand(input)) {
                  return;
                }
                if (agentState.status === 'complete' || agentState.status === 'error') {
                  handleNewQuery();
                }
                setCommandMessage(null);
                setHistoryIndex(null);
                handleQuerySubmit(input);
              }}
              disabled={false}
              history={queryHistory}
              onSuggestionsVisibleChange={setSuggestionsActive}
            />
          </Box>
          <Box flexShrink={0}>
            <Text dimColor>{hintsText}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
