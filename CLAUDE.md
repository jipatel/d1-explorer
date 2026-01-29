# CLAUDE.md - OpticoBot TUI

## Project Overview

OpticoBot TUI is a terminal UI for natural language queries against a Cloudflare D1 database. Users type questions like "show me customers who signed up in 2024" and an AI agent generates, executes, and refines SQL until correct.

**Key feature**: Conversation context is preserved between queries, so you can use references like "filter those by verified", "same but for 2024", etc.

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **TUI Framework**: React + Ink
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) - uses claude-sonnet-4-20250514
- **Database**: Cloudflare D1 via `wrangler d1 execute --json`

## Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm start            # Run TUI (defaults to remote D1)
npm start -- --local # Use local D1 instead of remote
npm start -- --database <name>  # Specify database name
npm start -- --allow-mutations  # Enable INSERT/UPDATE/DELETE
```

## Project Structure

```
source/
├── cli.tsx              # Entry point, CLI argument parsing (meow)
├── app.tsx              # Root React component, state management, conversation history
├── components/          # Ink UI components
│   ├── QueryInput.tsx   # Natural language text input
│   ├── ResultsTable.tsx # ASCII table for query results
│   ├── StatusBar.tsx    # Agent status with spinner
│   ├── SQLPreview.tsx   # Shows generated SQL
│   └── ErrorDisplay.tsx # Error presentation
├── agent/
│   ├── loop.ts          # Core agent loop (async generator), accepts conversation history
│   ├── prompts.ts       # System prompts with DB schema, conversation message builder
│   └── types.ts         # AgentState, AgentEvent, ConversationTurn types
├── db/
│   ├── executor.ts      # Spawns wrangler d1 execute
│   └── parser.ts        # Parses D1 JSON output
└── config/
    └── index.ts         # Loads .env, validates with zod
```

## Database Schema

The agent has access to these tables (defined in `source/agent/prompts.ts`):

- **customers**: USER_ID, INSERT_DATE, EMAIL, NAME, STATUS, VERIFIED, VERIFIED_DATE
- **customer_verification**: id, user_id, verification_code, insert_date, valid_until_date
- **practice_locations**: id, user_id, location_id, location_name, print_name_as, status, insert_date
  - **Note**: May have multiple rows per user/location. Always use `MAX(insert_date)` to get latest records.
- **api_keys**: id, api_key, user_email, name, created_date, last_used_date, is_active
- **access_log**: timestamp, user_id, paste_counter
  - **Note**: `paste_counter` is a running total (cumulative). Use `MAX(paste_counter)` to get the current count, NOT `COUNT(*)`.

## Agent Flow

1. User enters natural language query
2. Claude generates SQL (with conversation context from previous queries)
3. SQL executes via `wrangler d1 execute --json`
4. If error: Claude retries with error context (max 3 attempts)
5. If success: Claude evaluates if results answer the question
6. Display results and save to conversation history

## Conversation Context

- Successful queries are saved with their SQL and results
- Header displays `[N previous queries in context]`
- Enables follow-up queries: "filter those", "now show their locations", "same but for 2024"
- Context persists until the TUI is closed

## Key Files to Modify

- **Add new tables**: Update schema in `source/agent/prompts.ts`
- **Change AI model**: Edit model name in `source/agent/loop.ts`
- **Add UI features**: Create components in `source/components/`
- **Change CLI flags**: Edit `source/cli.tsx`
- **Conversation history logic**: `source/app.tsx` and `source/agent/prompts.ts`

## Environment Variables

Required in `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
CLOUDFLARE_ACCOUNT_ID=...        # Required if multiple accounts
D1_DATABASE_NAME=opticobot       # optional, default: opticobot
D1_REMOTE=true                   # optional, default: true (remote)
```

## Multiple Cloudflare Accounts

If you have multiple Cloudflare accounts, you must set `CLOUDFLARE_ACCOUNT_ID` in `.env`. Find your account ID with:
```bash
wrangler whoami
```

## Safety Features

- **Read-only by default**: INSERT/UPDATE/DELETE/DROP blocked unless `--allow-mutations`
- **SQL validation**: Checks for mutation keywords before execution
- **Max retries**: Agent stops after 3 failed attempts

## Testing

1. Ensure wrangler is authenticated: `wrangler whoami`
2. Create `.env` with your API key and account ID
3. Run `npm start` to connect to remote D1
4. Try a conversation:
   - "show all customers"
   - "filter those by verified = true"
   - "now show their practice locations"
