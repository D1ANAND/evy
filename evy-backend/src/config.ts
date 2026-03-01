import 'dotenv/config';
import OpenAI from 'openai';

// ─── Environment / Config ─────────────────────────────────────────────────────

export const PORT = parseInt(process.env.PORT ?? '3001', 10);
export const DB_PATH = process.env.DB_PATH ?? './supportpilot.db';
export const OXLO_MODEL = process.env.OXLO_MODEL ?? 'mistral-small-latest';
export const OXLO_FALLBACK_MODEL = 'open-mistral-7b';

if (!process.env.OXLO_API_KEY) {
  console.warn('[config] OXLO_API_KEY is not set — AI calls will fail');
}

// ─── Oxlo (OpenAI-compatible) Client ─────────────────────────────────────────

export const oxloClient = new OpenAI({
  apiKey: process.env.OXLO_API_KEY ?? 'missing-key',
  baseURL: 'https://api.oxlo.ai/v1',
});
