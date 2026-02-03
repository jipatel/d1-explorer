# CLAUDE.md - OpticoBot TUI

## Project Overview

OpticoBot TUI is a terminal UI for natural language queries against a Cloudflare D1 database. Users type questions like "show me customers who signed up in 2024" and an AI agent generates, executes, and refines SQL until correct.

**Key features**:
- Conversation context is preserved between queries ("filter those by verified", "same but for 2024")
- Setup wizard auto-discovers Cloudflare account, database, and schema on first run
- Schema is read dynamically from D1 — no hardcoded table definitions
- Slash command autocomplete (type `/` to see available commands)

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **TUI Framework**: React + Ink
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) - uses claude-sonnet-4-20250514
- **Database**: Cloudflare D1 via `wrangler d1 execute --json`

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm start            # Run TUI (setup wizard on first run)
npm start -- --local # Use local D1 instead of remote
npm start -- --database <name>  # Specify database name
npm start -- --allow-mutations  # Enable INSERT/UPDATE/DELETE
```

## Project Structure

```
source/
├── cli.tsx              # Entry point, CLI argument parsing (meow)
├── router.tsx           # Routes between setup wizard and main app
├── app.tsx              # Root React component, state management, conversation history
├── components/          # Ink UI components
│   ├── QueryInput.tsx   # Text input with slash command autocomplete
│   ├── HistoryList.tsx  # Left panel - query history
│   ├── ResultsPanel.tsx # Right panel - SQL & results
│   ├── StatusBar.tsx    # Agent status with spinner
│   └── setup/           # Setup wizard steps
│       ├── SetupWizard.tsx
│       ├── ApiKeyStep.tsx
│       ├── AccountStep.tsx
│       ├── DatabaseStep.tsx
│       └── SchemaDiscoveryStep.tsx
├── agent/
│   ├── loop.ts          # Core agent loop (async generator), accepts conversation history
│   ├── prompts.ts       # System prompts built from discovered schema
│   └── types.ts         # AgentState, AgentEvent, ConversationTurn types
├── session/             # Session management and schema discovery
│   ├── discover.ts      # Auto-discover tables and columns from D1
│   ├── storage.ts       # Persist sessions to ~/.opticobot/
│   ├── directives.ts    # Schema note updates and AI summarization
│   ├── wrangler.ts      # Wrangler CLI helpers
│   ├── prompts.ts       # Prompts for directive processing
│   └── types.ts         # AppSession, DiscoveredSchema types
├── db/
│   ├── executor.ts      # Spawns wrangler d1 execute
│   └── parser.ts        # Parses D1 JSON output
├── history/
│   └── storage.ts       # Persistent query history (~/.opticobot/)
└── config/
    └── index.ts         # Loads .env, validates with zod
```

## Database Schema

The schema is discovered dynamically at startup via `source/session/discover.ts`. Tables and columns are read from D1's `sqlite_master` and `PRAGMA table_info`. The discovered schema is stored in `~/.opticobot/sessions/` and used to build agent prompts.

Schema notes (gotchas, relationships, aggregation rules) can be added at runtime with the `# <note>` directive and are persisted with the session.

## Agent Flow

1. User enters natural language query
2. Claude generates SQL using discovered schema and conversation context
3. SQL executes via `wrangler d1 execute --json`
4. If error: Claude retries with error context (max 3 attempts)
5. If success: Claude evaluates if results answer the question
6. Display results and save to conversation history

## Slash Commands

| Command        | Description                    |
|----------------|--------------------------------|
| `/clear`       | Clear conversation history     |
| `/summarize`   | Show schema summary            |
| `/resummarize` | Regenerate schema summary      |
| `/help`        | Show available commands        |
| `# <note>`     | Update schema notes via AI     |

Commands autocomplete when typing `/` — arrow keys navigate, Tab fills, Enter submits.

## Conversation Context

- Successful queries are saved with their SQL and results
- Enables follow-up queries: "filter those", "now show their locations", "same but for 2024"
- Context persists until the TUI is closed
- `/clear` resets conversation history

## Key Files to Modify

- **Change AI model**: Edit model name in `source/agent/loop.ts`
- **Add UI features**: Create components in `source/components/`
- **Change CLI flags**: Edit `source/cli.tsx`
- **Conversation history logic**: `source/app.tsx` and `source/agent/prompts.ts`
- **Schema discovery**: `source/session/discover.ts`
- **Slash commands**: Command list in `source/components/QueryInput.tsx`, dispatch in `source/app.tsx`
- **Schema directives**: `source/session/directives.ts`

## Environment Variables

Optional `.env` file (the setup wizard handles configuration interactively on first run):
```
ANTHROPIC_API_KEY=sk-ant-...
CLOUDFLARE_ACCOUNT_ID=...        # Required if multiple accounts
D1_DATABASE_NAME=opticobot       # optional, default: opticobot
D1_REMOTE=true                   # optional, default: true (remote)
```

## Setup Wizard

On first run (or when no saved session exists), the wizard walks through:

1. **API Key** — prompts for Anthropic API key
2. **Cloudflare Account** — auto-detected from `wrangler whoami`, or selected if multiple
3. **Database** — lists available D1 databases to choose from
4. **Schema Discovery** — reads tables and columns from D1 automatically

Sessions are saved to `~/.opticobot/sessions/` so subsequent runs skip the wizard.

## Safety Features

- **Read-only by default**: INSERT/UPDATE/DELETE/DROP blocked unless `--allow-mutations`
- **SQL validation**: Checks for mutation keywords before execution
- **Max retries**: Agent stops after 3 failed attempts

## Testing

1. Ensure wrangler is authenticated: `wrangler whoami`
2. Run `npm start` — setup wizard will guide you through configuration
3. Try a conversation:
   - "show all customers"
   - "filter those by verified = true"
   - "now show their practice locations"
4. Try slash commands: type `/` and navigate with arrow keys
