import React, { useState, useCallback } from 'react';
import { App } from './app.js';
import { SetupWizard } from './components/setup/SetupWizard.js';
import { SessionPicker } from './components/setup/SessionPicker.js';
import type { AppSession, DbSession } from './session/types.js';

type Mode = 'app' | 'setup' | 'picker';

interface RouterProps {
  initialSession: AppSession | null;
  envApiKey: string;
  d1Remote: boolean;
  allowMutations: boolean;
}

export function Router({ initialSession, envApiKey, d1Remote, allowMutations }: RouterProps) {
  const [session, setSession] = useState<AppSession | null>(initialSession);
  const [mode, setMode] = useState<Mode>(initialSession ? 'app' : 'setup');

  const handleSetupComplete = useCallback((newSession: AppSession) => {
    setSession(newSession);
    setMode('app');
  }, []);

  const handleSwitch = useCallback(() => {
    setMode('picker');
  }, []);

  const handlePickSession = useCallback((dbSession: DbSession) => {
    const appSession: AppSession = {
      anthropicApiKey: dbSession.anthropicApiKey,
      cloudflareAccountId: dbSession.cloudflareAccountId,
      databaseName: dbSession.databaseName,
      d1Remote,
      allowMutations,
      schema: dbSession.schema,
    };
    setSession(appSession);
    setMode('app');
  }, [d1Remote, allowMutations]);

  const handleSetupNew = useCallback(() => {
    setMode('setup');
  }, []);

  if (mode === 'picker') {
    return (
      <SessionPicker
        onSelect={handlePickSession}
        onSetupNew={handleSetupNew}
      />
    );
  }

  if (mode === 'setup' || !session) {
    return (
      <SetupWizard
        envApiKey={envApiKey}
        d1Remote={d1Remote}
        allowMutations={allowMutations}
        onComplete={handleSetupComplete}
      />
    );
  }

  return <App key={session.databaseName} session={session} onSwitchDatabase={handleSwitch} />;
}
