import React, { useState, useCallback } from 'react';
import { App } from './app.js';
import { SetupWizard } from './components/setup/SetupWizard.js';
import type { AppSession } from './session/types.js';

interface RouterProps {
  initialSession: AppSession | null;
  envApiKey: string;
  d1Remote: boolean;
  allowMutations: boolean;
}

export function Router({ initialSession, envApiKey, d1Remote, allowMutations }: RouterProps) {
  const [session, setSession] = useState<AppSession | null>(initialSession);

  const handleSetupComplete = useCallback((newSession: AppSession) => {
    setSession(newSession);
  }, []);

  if (!session) {
    return (
      <SetupWizard
        envApiKey={envApiKey}
        d1Remote={d1Remote}
        allowMutations={allowMutations}
        onComplete={handleSetupComplete}
      />
    );
  }

  return <App session={session} />;
}
