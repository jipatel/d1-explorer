import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { SelectList } from './SelectList.js';
import { getAccounts } from '../../session/wrangler.js';
import type { CloudflareAccount } from '../../session/types.js';

interface AccountStepProps {
  onComplete: (account: CloudflareAccount) => void;
}

export function AccountStep({ onComplete }: AccountStepProps) {
  const [accounts, setAccounts] = useState<CloudflareAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccounts()
      .then(result => {
        setAccounts(result);
        setLoading(false);
        // Auto-select if single account
        if (result.length === 1) {
          onComplete(result[0]);
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [onComplete]);

  const handleSelect = useCallback((item: { value: string }) => {
    const account = accounts?.find(a => a.id === item.value);
    if (account) {
      onComplete(account);
    }
  }, [accounts, onComplete]);

  if (loading) {
    return (
      <Box>
        <Text color="cyan"><Spinner type="dots" /></Text>
        <Text> Running wrangler whoami...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to get Cloudflare accounts: {error}</Text>
        <Text dimColor>Make sure wrangler is installed and authenticated (wrangler login)</Text>
      </Box>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Box>
        <Text color="red">No Cloudflare accounts found. Run `wrangler login` first.</Text>
      </Box>
    );
  }

  if (accounts.length === 1) {
    return (
      <Box>
        <Text color="green">Using account: {accounts[0].name}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Step 2: Select Cloudflare Account</Text>
      </Box>
      <SelectList
        items={accounts.map(a => ({ label: `${a.name} (${a.id})`, value: a.id }))}
        onSelect={handleSelect}
      />
    </Box>
  );
}
