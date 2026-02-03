import Anthropic from '@anthropic-ai/sdk';

const DIRECTIVE_SYSTEM_PROMPT = `You maintain schema notes for a database query assistant. The user is providing a correction or addition to the existing notes.

Your job:
1. Read the current notes and the user's directive
2. Merge the directive into the existing notes
3. If the directive contradicts existing notes, the user's directive takes precedence — replace the old note
4. Keep notes concise and well-organized
5. Return ONLY the updated notes text — no explanations, no markdown code blocks`;

export async function applyDirective(
  currentNotes: string,
  directive: string,
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const userMessage = currentNotes
    ? `## Current Notes\n${currentNotes}\n\n## User Directive\n${directive}`
    : `## User Directive\n${directive}\n\nThere are no existing notes. Create initial notes from this directive.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: DIRECTIVE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text.trim();
}

const SUMMARIZE_SYSTEM_PROMPT = `You produce a concise technical summary of database schema notes. The audience is a developer or DBA.

Rules:
1. List each table with a one-line description of what it stores
2. Show relationships between tables (foreign keys, JOINs)
3. Call out any gotchas: cumulative columns, multi-row-per-entity patterns, required aggregations, etc.
4. Keep it compact — use short bullet points, no full paragraphs
5. Return ONLY the summary — no markdown code blocks, no SQL`;

export async function summarizeAiNotes(
  aiNotes: string,
  apiKey: string,
): Promise<string> {
  if (!aiNotes) return '';

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: SUMMARIZE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Summarize these schema notes:\n\n${aiNotes}` }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return content.text.trim();
}
