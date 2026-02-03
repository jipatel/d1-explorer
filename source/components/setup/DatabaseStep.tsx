import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { SelectList } from './SelectList.js';
import { listD1Databases } from '../../session/wrangler.js';
import type { D1DatabaseInfo } from '../../session/types.js';

interface DatabaseStepProps {
  accountId: string;
  onComplete: (database: D1DatabaseInfo) => void;
}

export function DatabaseStep({ accountId, onComplete }: DatabaseStepProps) {
  const [databases, setDatabases] = useState<D1DatabaseInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listD1Databases(accountId)
      .then(result => {
        setDatabases(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [accountId]);

  const handleSelect = useCallback((item: { value: string }) => {
    const db = databases?.find(d => d.uuid === item.value);
    if (db) {
      onComplete(db);
    }
  }, [databases, onComplete]);

  if (loading) {
    return (
      <Box>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text> Fetching D1 databases...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to list databases: {error}</Text>
        <Text dimColor>Make sure you have D1 databases in your account.</Text>
      </Box>
    );
  }

  if (!databases || databases.length === 0) {
    return (
      <Box>
        <Text color="red">No D1 databases found in this account.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Step 3: Select D1 Database</Text>
      </Box>
      <SelectList
        items={databases.map(db => ({
          label: `${db.name}${db.created_at ? ` (created: ${db.created_at.split('T')[0]})` : ''}`,
          value: db.uuid,
        }))}
        onSelect={handleSelect}
      />
    </Box>
  );
}
