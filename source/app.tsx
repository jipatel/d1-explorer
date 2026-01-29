import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { QueryInput, StatusBar, HistoryList, ResultsPanel } from './components/index.js';
import { runAgentLoop } from './agent/loop.js';
import { loadHistory, saveHistory } from './history/storage.js';
import type { AgentState, ConversationTurn } from './agent/types.js';
import type { Config } from './config/index.js';

interface AppProps {
  config: Config;
}

const INITIAL_STATE: AgentState = {
  status: 'idle',
  query: '',
  iterations: [],
  statusMessage: 'Ready',
};

export function App({ config }: AppProps) {
  const { exit } = useApp();
  const [agentState, setAgentState] = useState<AgentState>(INITIAL_STATE);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);

  // Handle slash commands - returns true if input was a command
  const handleCommand = useCallback((input: string): boolean => {
    const trimmed = input.trim().toLowerCase();

    if (trimmed === '/clear') {
      setConversationHistory([]);
      setHistoryIndex(null);
      saveHistory([]);
      setCommandMessage('History cleared');
      setTimeout(() => setCommandMessage(null), 2000);
      return true;
    }

    if (trimmed === '/help') {
      setCommandMessage('Commands: /clear (clear history), /help (show commands)');
      setTimeout(() => setCommandMessage(null), 4000);
      return true;
    }

    if (trimmed.startsWith('/')) {
      setCommandMessage(`Unknown command: ${trimmed}. Type /help for available commands.`);
      setTimeout(() => setCommandMessage(null), 3000);
      return true;
    }

    return false;
  }, []);

  // Load history on mount
  useEffect(() => {
    loadHistory().then(history => {
      setConversationHistory(history);
      setHistoryLoaded(true);
    });
  }, []);

  // Save history when it changes
  useEffect(() => {
    if (historyLoaded && conversationHistory.length > 0) {
      saveHistory(conversationHistory);
    }
  }, [conversationHistory, historyLoaded]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    // History navigation - only when not processing and history exists
    if (!isProcessing && conversationHistory.length > 0) {
      if (key.upArrow) {
        setHistoryIndex(prev =>
          prev === null ? conversationHistory.length - 1 : Math.max(0, prev - 1)
        );
      }
      if (key.downArrow) {
        setHistoryIndex(prev => {
          if (prev === null) return null;
          return prev >= conversationHistory.length - 1 ? null : prev + 1;
        });
      }
      if (key.escape) {
        setHistoryIndex(null);
      }
    }
  });

  const handleQuerySubmit = useCallback(async (query: string) => {
    setIsProcessing(true);
    setQueryHistory(prev => [...prev, query]);

    let finalState: AgentState | undefined;

    try {
      const generator = runAgentLoop(query, { config, conversationHistory });

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
  }, [config, conversationHistory]);

  const handleNewQuery = useCallback(() => {
    setAgentState(INITIAL_STATE);
  }, []);

  const currentIteration = agentState.iterations.length;
  const showStatusBar = agentState.status !== 'idle' || isProcessing;

  // Determine what to show in results panel
  const selectedHistoryItem = historyIndex !== null ? conversationHistory[historyIndex] : null;
  const showingHistory = selectedHistoryItem !== null;

  // Results panel content
  const panelTitle = showingHistory
    ? `Query ${historyIndex! + 1}`
    : agentState.status === 'complete'
      ? 'Results'
      : agentState.status === 'error'
        ? 'Error'
        : 'Results';

  const panelQuery = showingHistory
    ? selectedHistoryItem?.query
    : agentState.query;

  const panelSql = showingHistory
    ? selectedHistoryItem?.sql
    : agentState.currentSql;

  const panelResult = showingHistory
    ? selectedHistoryItem?.result
    : agentState.finalResult;

  const panelError = showingHistory
    ? selectedHistoryItem?.error
    : agentState.finalError;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          OpticoBot TUI
        </Text>
        <Text dimColor> - Natural Language Database Queries</Text>
      </Box>

      {/* Database info */}
      <Box marginBottom={1}>
        <Text dimColor>
          Database: {config.d1DatabaseName} ({config.d1Remote ? 'remote' : 'local'})
          {config.allowMutations && <Text color="yellow"> [mutations enabled]</Text>}
        </Text>
      </Box>

      {/* Status bar */}
      {showStatusBar && (
        <Box marginBottom={1}>
          <StatusBar
            status={agentState.status}
            message={agentState.statusMessage}
            iterationCount={currentIteration > 0 ? currentIteration : undefined}
            maxIterations={3}
          />
        </Box>
      )}

      {/* Side-by-side layout: History | Results */}
      <Box flexDirection="row" marginBottom={1}>
        {/* History list (left panel) */}
        <HistoryList
          history={conversationHistory}
          selectedIndex={historyIndex}
        />

        {/* Results panel (right panel) */}
        <Box marginLeft={1} flexGrow={1}>
          <ResultsPanel
            title={panelTitle}
            query={panelQuery}
            sql={panelSql}
            result={panelResult}
            error={panelError}
          />
        </Box>
      </Box>

      {/* Current query display while processing */}
      {isProcessing && agentState.query && (
        <Box>
          <Text color="cyan" bold>{'> '}</Text>
          <Text>{agentState.query}</Text>
        </Box>
      )}

      {/* Command feedback */}
      {commandMessage && (
        <Box marginBottom={1}>
          <Text color="yellow">{commandMessage}</Text>
        </Box>
      )}

      {/* Query input */}
      {!isProcessing && (
        <Box>
          <QueryInput
            onSubmit={(input) => {
              if (handleCommand(input)) {
                return;
              }
              if (agentState.status === 'complete' || agentState.status === 'error') {
                handleNewQuery();
              }
              setHistoryIndex(null);
              handleQuerySubmit(input);
            }}
            disabled={false}
            history={queryHistory}
          />
        </Box>
      )}
    </Box>
  );
}
