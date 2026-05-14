/**
 * Best-effort repair for LLM JSON output that may be truncated or have minor
 * syntax errors (trailing commas, unclosed structures, markdown fences).
 */
export function repairJson(raw: string): string {
  // Strip markdown code fences
  let s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // Try as-is first
  try { JSON.parse(s); return s; } catch {}

  // Walk the string tracking open brackets and string state
  const closers: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') closers.push('}');
    else if (ch === '[') closers.push(']');
    else if (ch === '}' || ch === ']') closers.pop();
  }

  // Truncated mid-string — close the string
  if (inString) s += '"';

  // Remove trailing comma before we append closing tokens
  s = s.replace(/,\s*$/, '');

  // Close all open structures in reverse order
  while (closers.length > 0) s += closers.pop();

  return s;
}
