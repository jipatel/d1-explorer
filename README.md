# D1 Explorer

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
- **Full-Width Layout** - Content-focused design with history as pagination (↑↓ to browse)
- **Persistent History** - Query history saved between sessions
- **Smart Retries** - AI automatically fixes SQL errors (up to 3 attempts)
- **Safe by Default** - Read-only mode prevents accidental data mutations

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              D1 Explorer                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐  │
│  │   Terminal UI   │    │   Agent Loop     │    │   Cloudflare D1       │  │
│  │   (React/Ink)   │    │                  │    │                       │  │
│  │                 │    │  ┌────────────┐  │    │  ┌─────────────────┐  │  │
│  │ ┌─────────────┐ │    │  │  Claude    │  │    │  │  (dynamically   │  │  │
│  │ │ Content     │ │◄───┤  │  Sonnet    │  │    │  │   discovered    │  │  │
│  │ │ Area        │ │    │  │  API       │  │    │  │   tables &      │  │  │
│  │ │ (full-width)│ │    │  └─────┬──────┘  │    │  │   columns)      │  │  │
│  │ └─────────────┘ │    │        │         │    │  │                 │  │  │
│  │ ┌─────────────┐ │    │  ┌─────▼──────┐  │    │  └────────▲────────┘  │  │
│  │ │ Query       │ │    │  │ SQL Gen &  │  │    │           │           │  │
│  │ │ Input       │─┼────►  │ Validation │  │    │           │           │  │
│  │ └─────────────┘ │    │  └─────┬──────┘  │    └───────────┼───────────┘  │
│  └─────────────────┘    │        │         │                │              │
│                         │  ┌─────▼──────┐  │    ┌───────────┴───────────┐  │
│                         │  │ Executor   │──┼────►   wrangler d1        │  │
│                         │  │ (wrangler) │  │    │   execute --json     │  │
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
git clone https://github.com/jipatel/d1-explorer.git
cd d1-explorer

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

The session is saved to `~/.d1-explorer/` so subsequent runs skip the wizard.

You can also configure via a `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLOUDFLARE_ACCOUNT_ID=...    # Required if you have multiple CF accounts
D1_DATABASE_NAME=my-database # Optional
```

## Usage

```bash
# Start the TUI (remote database)
d1-explorer

# Use local D1 database
d1-explorer --local

# Specify a different database
d1-explorer --database my-database

# Enable write operations (INSERT/UPDATE/DELETE)
d1-explorer --allow-mutations
```

## Commands

| Command        | Description                    |
|----------------|--------------------------------|
| `/clear`       | Clear query history            |
| `/summarize`   | Show schema summary            |
| `/resummarize` | Regenerate schema summary      |
| `/switch`      | Switch database                |
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
D1 Explorer                                          d1-explorer (remote)
──────────────────────────────────────────────────────────────────────

  show verified customers                                        1/3

  There are 15 verified customers in the database.

  SQL: SELECT * FROM customers WHERE VERIFIED = TRUE

  USER_ID  EMAIL            NAME
  ───────  ───────────────  ─────────────────
  1        john@email.com   John Smith
  2        jane@email.com   Jane Doe

  15 rows

──────────────────────────────────────────────────────────────────────
> show me their practice locations              ↑↓ history · /help
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
│   ├── Divider.tsx      # Terminal-width horizontal rule
│   ├── ResultsView.tsx  # Full-width results display
│   ├── QueryInput.tsx   # Text input with autocomplete
│   ├── StatusBar.tsx    # Inline processing status
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
│   ├── storage.ts       # Persist sessions to ~/.d1-explorer/, sorted by last used
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
