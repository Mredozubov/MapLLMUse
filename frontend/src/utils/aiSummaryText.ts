/** Human-readable copy when Gemini rejects the key (matches server-side formatting). */
const FRIENDLY_GEMINI_KEY =
  'Gemini could not run: the API key is missing, invalid, or expired. ' +
  'Create a new key at https://aistudio.google.com/apikey and set GEMINI_API_KEY (Netlify or backend/.env). ' +
  'Pattern scan results are still valid.'

/**
 * Normalize ugly API / SDK error blobs for display in the UI (static Data files, old responses, etc.).
 */
export function formatAiSummaryForDisplay(text: string): string {
  const raw = String(text ?? '').trim()
  if (!raw) return raw

  if (/API_KEY_INVALID|'API_KEY_INVALID'|"API_KEY_INVALID"/i.test(raw)) {
    return FRIENDLY_GEMINI_KEY
  }
  if (/API key expired|INVALID_ARGUMENT.*API key|invalid api key/i.test(raw)) {
    return FRIENDLY_GEMINI_KEY
  }
  if (/AI Analysis Error:\s*400\s+INVALID_ARGUMENT/i.test(raw) && /generativelanguage\.googleapis\.com/i.test(raw)) {
    return FRIENDLY_GEMINI_KEY
  }

  return raw
}
