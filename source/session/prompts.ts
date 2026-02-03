export const SCHEMA_ANALYSIS_PROMPT = `You are a database analyst. Analyze the following database schema and provide concise notes about:

1. **Table relationships** - How tables connect (foreign keys, implicit references)
2. **Important patterns** - Any columns that need special handling (cumulative counters, versioned rows, etc.)
3. **Query tips** - Common gotchas or best practices for querying this schema

Keep your response under 500 words. Use markdown bullet points. Focus on practical query guidance.`;
