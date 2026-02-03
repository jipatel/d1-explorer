import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ApiKeyStepProps {
  envApiKey: string;
  onComplete: (apiKey: string) => void;
}

export function ApiKeyStep({ envApiKey, onComplete }: ApiKeyStepProps) {
  const [apiKey, setApiKey] = useState('');

  // Auto-skip if API key already in env
  useEffect(() => {
    if (envApiKey) {
      onComplete(envApiKey);
    }
  }, [envApiKey, onComplete]);

  if (envApiKey) {
    return (
      <Box>
        <Text color="green">API key found in environment</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Step 1: Anthropic API Key</Text>
      </Box>
      <Text>Enter your Anthropic API key (starts with sk-ant-):</Text>
      <Box marginTop={1}>
        <Text color="cyan">{'> '}</Text>
        <TextInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={(value) => {
            const trimmed = value.trim();
            if (trimmed) {
              onComplete(trimmed);
            }
          }}
          mask="*"
        />
      </Box>
    </Box>
  );
}
