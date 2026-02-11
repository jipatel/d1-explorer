import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { Config } from '../../config/index.js';
import type { DiscoveredSchema, DiscoveredTable } from '../../session/types.js';
import { discoverSchema } from '../../session/discover.js';

interface SchemaDiscoveryStepProps {
  config: Config;
  apiKey: string;
  onComplete: (schema: DiscoveredSchema) => void;
  onError: (error: string) => void;
}

export function SchemaDiscoveryStep({ config, apiKey, onComplete, onError }: SchemaDiscoveryStepProps) {
  const [status, setStatus] = useState('Starting schema discovery...');
  const [tables, setTables] = useState<DiscoveredTable[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const generator = discoverSchema(config, apiKey);
        let lastSchema: DiscoveredSchema | null = null;

        for await (const event of generator) {
          if (cancelled) return;

          setStatus(event.message);

          if (event.type === 'table_discovered' && event.table) {
            setTables(prev => [...prev, event.table!]);
          }

          if (event.type === 'stream_delta' && event.delta) {
            setStreamingText(prev => prev + event.delta);
          }

          if (event.type === 'analyzing') {
            setStreamingText('');
          }

          if (event.type === 'complete' && event.schema) {
            lastSchema = event.schema;
          }

          if (event.type === 'error') {
            onError(event.message);
            return;
          }
        }

        if (!cancelled && lastSchema) {
          setDone(true);
          onComplete(lastSchema);
        }
      } catch (err) {
        if (!cancelled) {
          onError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [config, apiKey, onComplete, onError]);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Step 4: Schema Discovery</Text>
      </Box>

      <Box>
        {!done && <Text color="cyan"><Spinner type="dots" /></Text>}
        {done && <Text color="green">{'[done]'}</Text>}
        <Text> {status}</Text>
      </Box>

      {tables.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {tables.map(table => (
            <Text key={table.name} dimColor>
              {'  '}{table.name} ({table.columns.length} columns{table.foreignKeys.length > 0 ? `, ${table.foreignKeys.length} FK` : ''})
            </Text>
          ))}
        </Box>
      )}

      {streamingText && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>{streamingText}</Text>
        </Box>
      )}
    </Box>
  );
}
