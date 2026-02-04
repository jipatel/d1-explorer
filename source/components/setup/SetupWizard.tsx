import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { ApiKeyStep } from './ApiKeyStep.js';
import { AccountStep } from './AccountStep.js';
import { DatabaseStep } from './DatabaseStep.js';
import { SchemaDiscoveryStep } from './SchemaDiscoveryStep.js';
import { saveSession } from '../../session/storage.js';
import type { Config } from '../../config/index.js';
import type { CloudflareAccount, D1DatabaseInfo, DiscoveredSchema, DbSession, AppSession } from '../../session/types.js';

type WizardStep = 'api_key' | 'account' | 'database' | 'schema' | 'done' | 'error';

interface SetupWizardProps {
  envApiKey: string;
  d1Remote: boolean;
  allowMutations: boolean;
  onComplete: (session: AppSession) => void;
}

export function SetupWizard({ envApiKey, d1Remote, allowMutations, onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('api_key');
  const [apiKey, setApiKey] = useState('');
  const [account, setAccount] = useState<CloudflareAccount | null>(null);
  const [database, setDatabase] = useState<D1DatabaseInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleApiKeyComplete = useCallback((key: string) => {
    setApiKey(key);
    setStep('account');
  }, []);

  const handleAccountComplete = useCallback((acct: CloudflareAccount) => {
    setAccount(acct);
    setStep('database');
  }, []);

  const handleDatabaseComplete = useCallback((db: D1DatabaseInfo) => {
    setDatabase(db);
    setStep('schema');
  }, []);

  const handleSchemaComplete = useCallback(async (schema: DiscoveredSchema) => {
    if (!account || !database) return;

    // Save session to disk
    const dbSession: DbSession = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      anthropicApiKey: apiKey,
      cloudflareAccountId: account.id,
      cloudflareAccountName: account.name,
      databaseName: database.name,
      databaseUuid: database.uuid,
      schema,
    };

    try {
      await saveSession(dbSession);
    } catch {
      // Non-critical - continue even if save fails
    }

    const appSession: AppSession = {
      anthropicApiKey: apiKey,
      cloudflareAccountId: account.id,
      databaseName: database.name,
      d1Remote,
      allowMutations,
      schema,
    };

    setStep('done');
    onComplete(appSession);
  }, [apiKey, account, database, d1Remote, allowMutations, onComplete]);

  const handleSchemaError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setStep('error');
  }, []);

  // Build a config for schema discovery
  const discoveryConfig: Config | null = account && database ? {
    anthropicApiKey: apiKey,
    cloudflareAccountId: account.id,
    d1DatabaseName: database.name,
    d1Remote,
    allowMutations: false,
  } : null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">D1 Explorer Setup</Text>
      </Box>

      {/* Step 1: API Key */}
      {step === 'api_key' && (
        <ApiKeyStep envApiKey={envApiKey} onComplete={handleApiKeyComplete} />
      )}

      {/* Step 2: Account Selection */}
      {step === 'account' && (
        <AccountStep onComplete={handleAccountComplete} />
      )}

      {/* Step 3: Database Selection */}
      {step === 'database' && account && (
        <DatabaseStep accountId={account.id} onComplete={handleDatabaseComplete} />
      )}

      {/* Step 4: Schema Discovery */}
      {step === 'schema' && discoveryConfig && (
        <SchemaDiscoveryStep
          config={discoveryConfig}
          apiKey={apiKey}
          onComplete={handleSchemaComplete}
          onError={handleSchemaError}
        />
      )}

      {/* Done */}
      {step === 'done' && (
        <Text color="green">Setup complete! Loading query interface...</Text>
      )}

      {/* Error */}
      {step === 'error' && (
        <Box flexDirection="column">
          <Text color="red">Setup failed: {errorMessage}</Text>
          <Text dimColor>Please check your configuration and try again.</Text>
        </Box>
      )}

      {/* Progress indicator */}
      {step !== 'error' && step !== 'done' && (
        <Box marginTop={1}>
          <Text dimColor>
            [{step === 'api_key' ? '1' : step === 'account' ? '2' : step === 'database' ? '3' : '4'}/4]
          </Text>
        </Box>
      )}
    </Box>
  );
}
