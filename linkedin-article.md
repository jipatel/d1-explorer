# I Built a Terminal App That Lets You Talk to Your Database in Plain English

SQL is powerful, but it's a barrier. Every time you want a quick answer from your database, you have to context-switch into query-writing mode — remembering table names, join conditions, column types. What if you could just *ask*?

That's why I built **D1 Explorer** — a terminal UI that lets you query Cloudflare D1 databases using natural language. You type "show me customers who signed up in 2024" and it generates the SQL, executes it, and shows you the results. No copying queries from ChatGPT. No switching between tabs. Just answers.

## What It Looks Like in Practice

```
> show me all customers
┌────┬──────────────┬────────────┬──────────┐
│ id │ name         │ email      │ verified │
├────┼──────────────┼────────────┼──────────┤
│  1 │ Acme Corp    │ acme@...   │ true     │
│  2 │ Globex Inc   │ globex@... │ false    │
└────┴──────────────┴────────────┴──────────┘

> filter those by verified = true

> now show their practice locations
```

Each query builds on the last. The AI remembers context, so follow-up questions work naturally — just like a conversation.

## Zero Configuration

One of the design principles I cared most about: **no setup files, no config, no schema definitions.**

On first run, D1 Explorer launches a setup wizard that:

1. Detects your Cloudflare account from `wrangler whoami`
2. Lists your D1 databases and lets you pick one
3. Reads the schema directly from D1 — tables, columns, foreign keys, all of it
4. Uses AI to generate human-readable notes about your schema's quirks and relationships

Everything is persisted locally. Next time you run it, you're right where you left off, defaulting to your most recently used database.

## The Technical Decisions That Mattered

### Streaming responses change everything

Early versions would freeze for 3-5 seconds while Claude generated SQL. The UX felt broken — you'd wonder if the app had crashed.

Switching to streaming (via Claude's `messages.stream()` API and async generators) transformed the experience. SQL appears character-by-character as it's generated. Summaries flow in word by word. The app always feels responsive, even when the AI is thinking.

The implementation uses async generators that yield events as they arrive:

```typescript
for await (const event of agentLoop(query, context)) {
  if (event.type === 'stream_delta') updateUI(event.text);
}
```

This pattern is clean, composable, and integrates naturally with React state management.

### A self-correcting agent loop

The AI doesn't always get the SQL right on the first try. Instead of showing an error and giving up, D1 Explorer implements a 3-attempt loop:

1. **Generate** SQL from the question + schema
2. **Execute** against D1
3. **Evaluate** — does this actually answer the question?
4. If not, feed the error back and try again

In practice, this handles the majority of "almost right" queries — wrong column name, missing JOIN, off-by-one in a GROUP BY. The user never sees the failed attempts.

### Read-only by default

Mutations (INSERT, UPDATE, DELETE, DROP) are blocked unless you explicitly pass `--allow-mutations`. Every query is validated before execution. This was non-negotiable — a tool that translates natural language to SQL could easily produce destructive queries from ambiguous input.

### Wrangler as the database layer

Rather than building a custom D1 driver or maintaining persistent connections, D1 Explorer shells out to `wrangler d1 execute --json` for every query. It's stateless, simple, and leverages authentication that developers already have configured. Sometimes the least clever approach is the right one.

## The Stack

- **TypeScript + Node.js** for the runtime
- **React + Ink** for the terminal UI (yes, React in the terminal — it works remarkably well)
- **Claude API** for SQL generation, evaluation, and summarization
- **Cloudflare D1** via Wrangler CLI
- **Zod** for configuration validation

The entire app is under 2,000 lines of TypeScript. No complex build pipeline, no heavy dependencies.

## What I Learned

**AI-powered tools need guardrails, not just capabilities.** The mutation blocking, retry limits, and evaluation step aren't features — they're what makes the tool trustworthy enough to use on real data.

**Streaming isn't optional for AI UX.** The perceived performance difference between "wait 4 seconds then show everything" and "start showing text immediately" is enormous, even when the total time is the same.

**Dynamic discovery beats configuration.** Every minute spent on schema auto-detection saved hours of "why isn't this working" debugging. The best config file is no config file.

**Conversation context is the killer feature.** Being able to say "filter those by verified" or "same but for 2024" turns a query tool into a data exploration tool. It's the difference between running isolated commands and having a dialogue with your data.

## Try It Out

D1 Explorer is open source. If you work with Cloudflare D1 and want a faster way to explore your data, give it a spin:

```bash
npm install
npm run build
npm start
```

The setup wizard handles the rest.

---

*Building developer tools that remove friction from real workflows — that's what gets me excited. What's a tool you wish existed for your day-to-day work?*

#DeveloperTools #AI #CloudflareDevelopers #TypeScript #OpenSource #TerminalUI #SQL #NaturalLanguageProcessing
