# OpticoBot TUI

A terminal UI for natural language queries against a Cloudflare D1 database. Ask questions in plain English and get SQL results instantly.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Natural Language Queries** - Ask questions like "show me customers who signed up in 2024"
- **Conversation Context** - Follow-up queries work: "filter those by verified", "now show their locations"
- **Setup Wizard** - Interactive first-run flow discovers your Cloudflare account, database, and schema automatically
- **Dynamic Schema Discovery** - Tables and columns are read from D1 at startup — no hardcoded schema
- **Slash Command Autocomplete** - Type `/` to see commands with arrow-key navigation, Tab to fill, Enter to submit
- **Side-by-Side UI** - History panel on the left, results on the right
- **Persistent History** - Query history saved between sessions
- **Smart Retries** - AI automatically fixes SQL errors (up to 3 attempts)
- **Safe by Default** - Read-only mode prevents accidental data mutations

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OpticoBot TUI                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐  │
│  │   Terminal UI   │    │   Agent Loop     │    │   Cloudflare D1       │  │
│  │   (React/Ink)   │    │                  │    │                       │  │
│  │                 │    │  ┌────────────┐  │    │  ┌─────────────────┐  │  │
│  │ ┌─────────────┐ │    │  │  Claude    │  │    │  │   customers     │  │  │
│  │ │ History     │ │◄───┤  │  Sonnet    │  │    │  │   api_keys      │  │  │
│  │ │ Panel       │ │    │  │  API       │  │    │  │   access_log    │  │  │
│  │ └─────────────┘ │    │  └─────┬──────┘  │    │  │   practice_     │  │  │
│  │ ┌─────────────┐ │    │        │         │    │  │   locations     │  │  │
│  │ │ Results     │ │    │  ┌─────▼──────┐  │    │  └────────▲────────┘  │  │
│  │ │ Panel       │ │    │  │ SQL Gen &  │  │    │           │           │  │
│  │ └─────────────┘ │    │  │ Validation │  │    │           │           │  │
│  │ ┌─────────────┐ │    │  └─────┬──────┘  │    └───────────┼───────────┘  │
│  │ │ Query       │ │    │        │         │                │              │
│  │ │ Input       │─┼────►  ┌─────▼──────┐  │    ┌───────────┴───────────┐  │
│  │ └─────────────┘ │    │  │ Executor   │──┼────►   wrangler d1        │  │
│  └─────────────────┘    │  │ (wrangler) │  │    │   execute --json     │  │
│                         │  └────────────┘  │    └───────────────────────┘  │
│                         └──────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                              Data Flow
                              ─────────
        User Query ──► Claude API ──► SQL ──► D1 ──► Results ──► Display
                           ▲                            │
                           └────── Retry on Error ──────┘
```

## Installation

```bash
# Clone the repository
git clone https://github.com/jipatel/opticobot-tui.git
cd opticobot-tui

# Install dependencies
npm install

# Build and link globally
npm run build
npm link
```

## Configuration

On first run, the setup wizard will prompt you for:

1. **Anthropic API key** — your `sk-ant-...` key
2. **Cloudflare account** — auto-detected from `wrangler whoami`, or selected if you have multiple
3. **D1 database** — picked from your available databases
4. **Schema discovery** — tables and columns are read automatically

The session is saved to `~/.opticobot/` so subsequent runs skip the wizard.

You can also configure via a `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLOUDFLARE_ACCOUNT_ID=...    # Required if you have multiple CF accounts
D1_DATABASE_NAME=opticobot   # Optional, defaults to "opticobot"
```

## Usage

```bash
# Start the TUI (remote database)
opticobot

# Use local D1 database
opticobot --local

# Specify a different database
opticobot --database my-database

# Enable write operations (INSERT/UPDATE/DELETE)
opticobot --allow-mutations
```

## Commands

| Command        | Description                    |
|----------------|--------------------------------|
| `/clear`       | Clear query history            |
| `/summarize`   | Show schema summary            |
| `/resummarize` | Regenerate schema summary      |
| `/help`        | Show available commands        |
| `# <note>`     | Update schema notes via AI     |

Type `/` to see autocomplete suggestions.

## Keyboard Shortcuts

| Key       | Action                                         |
|-----------|-------------------------------------------------|
| `↑` / `↓` | Navigate query history (or autocomplete list)  |
| `Tab`     | Fill selected autocomplete suggestion           |
| `Enter`   | Submit query (or select and submit suggestion)  |
| `Esc`     | Dismiss autocomplete / exit history view        |
| `Ctrl+C`  | Quit                                            |

## Example Session

```
OpticoBot TUI - Natural Language Database Queries
Database: opticobot (remote)

┌─ History ─────────────────┐ ┌─ Query 1: show verified customers ──────────┐
│ > 1. show verified cust.. │ │ SQL: SELECT * FROM customers                │
│   2. filter by 2024       │ │      WHERE VERIFIED = TRUE                  │
│   3. count by status      │ │                                             │
│                           │ │ 15 rows                                     │
│ ↑↓ select • Esc close     │ │ USER_ID | EMAIL          | NAME             │
└───────────────────────────┘ │ --------+----------------+----------------- │
                              │ 1       | john@email.com | John Smith       │
                              │ 2       | jane@email.com | Jane Doe         │
                              └──────────────────────────────────────────────┘

> show me their practice locations
```

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **UI Framework**: [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink)
- **AI**: [Claude API](https://docs.anthropic.com/) (claude-sonnet-4-20250514)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) via Wrangler CLI

## Project Structure

```
source/
├── cli.tsx              # Entry point, CLI argument parsing
├── router.tsx           # Routes between setup wizard and main app
├── app.tsx              # Root component, state management
├── components/          # Ink UI components
│   ├── HistoryList.tsx  # Left panel - query history
│   ├── ResultsPanel.tsx # Right panel - SQL & results
│   ├── QueryInput.tsx   # Text input with autocomplete
│   ├── StatusBar.tsx    # Processing status
│   └── setup/           # Setup wizard steps
│       ├── SetupWizard.tsx
│       ├── ApiKeyStep.tsx
│       ├── AccountStep.tsx
│       ├── DatabaseStep.tsx
│       └── SchemaDiscoveryStep.tsx
├── agent/
│   ├── loop.ts          # AI agent loop (generate → execute → evaluate)
│   ├── prompts.ts       # System prompts built from discovered schema
│   └── types.ts         # TypeScript types
├── session/             # Session management and schema discovery
│   ├── discover.ts      # Auto-discover tables and columns from D1
│   ├── storage.ts       # Persist sessions to ~/.opticobot/
│   ├── directives.ts    # Schema note updates and summarization
│   ├── wrangler.ts      # Wrangler CLI helpers
│   └── types.ts         # Session and schema types
├── db/
│   ├── executor.ts      # Wrangler D1 execution
│   └── parser.ts        # D1 JSON response parsing
├── history/
│   └── storage.ts       # Persistent query history
└── config/
    └── index.ts         # Environment config with Zod validation
```

## License

MIT
