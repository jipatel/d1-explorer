import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SelectList } from './SelectList.js';
import { listSessions, loadSession } from '../../session/storage.js';
import type { DbSession } from '../../session/types.js';

interface SessionInfo {
	dbSession: DbSession;
	label: string;
}

interface SessionPickerProps {
	onSelect: (dbSession: DbSession) => void;
	onSetupNew: () => void;
}

const NEW_DB_VALUE = '__new__';

export function SessionPicker({ onSelect, onSetupNew }: SessionPickerProps) {
	const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const names = await listSessions();
				const loaded: SessionInfo[] = [];
				for (const name of names) {
					const dbSession = await loadSession(name);
					if (dbSession) {
						const tableCount = dbSession.schema.tables.length;
						loaded.push({
							dbSession,
							label: `${dbSession.databaseName} (${dbSession.cloudflareAccountName}, ${tableCount} table${tableCount !== 1 ? 's' : ''})`,
						});
					}
				}
				setSessions(loaded);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, []);

	if (error) {
		return (
			<Box padding={1}>
				<Text color="red">Failed to load sessions: {error}</Text>
			</Box>
		);
	}

	if (sessions === null) {
		return (
			<Box padding={1}>
				<Text dimColor>Loading saved sessions...</Text>
			</Box>
		);
	}

	const items = [
		...sessions.map(s => ({
			label: s.label,
			value: s.dbSession.databaseName,
		})),
		{
			label: 'Set up new database...',
			value: NEW_DB_VALUE,
		},
	];

	return (
		<Box flexDirection="column" padding={1}>
			<SelectList
				title="Switch Database"
				items={items}
				onSelect={(item) => {
					if (item.value === NEW_DB_VALUE) {
						onSetupNew();
						return;
					}
					const match = sessions.find(s => s.dbSession.databaseName === item.value);
					if (match) {
						onSelect(match.dbSession);
					}
				}}
			/>
		</Box>
	);
}
