export interface DiscoveredColumn {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  defaultValue: string | null;
}

export interface DiscoveredForeignKey {
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface DiscoveredTable {
  name: string;
  columns: DiscoveredColumn[];
  foreignKeys: DiscoveredForeignKey[];
}

export interface DiscoveredSchema {
  tables: DiscoveredTable[];
  discoveredAt: string;
  aiNotes: string;
  aiNotesSummary?: string;
}

export interface CloudflareAccount {
  name: string;
  id: string;
}

export interface D1DatabaseInfo {
  uuid: string;
  name: string;
  created_at?: string;
}

export interface DbSession {
  version: 1;
  createdAt: string;
  updatedAt: string;
  anthropicApiKey: string;
  cloudflareAccountId: string;
  cloudflareAccountName: string;
  databaseName: string;
  databaseUuid: string;
  schema: DiscoveredSchema;
}

export interface AppSession {
  anthropicApiKey: string;
  cloudflareAccountId: string;
  databaseName: string;
  d1Remote: boolean;
  allowMutations: boolean;
  schema: DiscoveredSchema;
}
