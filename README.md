# OpticoBot TUI

A terminal UI for natural language queries against a Cloudflare D1 database. Ask questions in plain English and get SQL results instantly.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Natural Language Queries** - Ask questions like "show me customers who signed up in 2024"
- **Conversation Context** - Follow-up queries work: "filter those by verified", "now show their locations"
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

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Build and link globally
npm run build
npm link
```

## Configuration

Create a `.env` file with:

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

| Command   | Description                    |
|-----------|--------------------------------|
| `/clear`  | Clear query history            |
| `/help`   | Show available commands        |

## Keyboard Shortcuts

| Key       | Action                              |
|-----------|-------------------------------------|
| `↑` / `↓` | Navigate query history              |
| `Esc`     | Exit history view                   |
| `Ctrl+C`  | Quit                                |

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
├── app.tsx              # Root component, state management
├── components/          # Ink UI components
│   ├── HistoryList.tsx  # Left panel - query history
│   ├── ResultsPanel.tsx # Right panel - SQL & results
│   ├── QueryInput.tsx   # Text input with history
│   └── StatusBar.tsx    # Processing status
├── agent/
│   ├── loop.ts          # AI agent loop (generate → execute → evaluate)
│   ├── prompts.ts       # System prompts with DB schema
│   └── types.ts         # TypeScript types
├── db/
│   ├── executor.ts      # Wrangler D1 execution
│   └── parser.ts        # D1 JSON response parsing
├── history/
│   └── storage.ts       # Persistent history (~/.opticobot/)
└── config/
    └── index.ts         # Environment config with Zod validation
```

## License

MIT
