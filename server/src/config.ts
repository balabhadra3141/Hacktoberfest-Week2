import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env explicitly instead of relying on Prisma's side effect.
// Try a few locations so the API works whether it is started from the
// repository root (`npx tsx server/src/index.ts`) or from `server/` (`npm run dev`).
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
  path.resolve(__dirname, '..', '.env'),
];

export const envFileLoaded = envCandidates.find((file) => fs.existsSync(file)) ?? null;
if (envFileLoaded) {
  dotenv.config({ path: envFileLoaded });
}

function int(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Server
export const PORT = int(process.env.PORT, 3001);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Uploads
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
export const MAX_UPLOAD_SIZE_MB = int(process.env.MAX_UPLOAD_SIZE_MB, 10);

// Local AI (Ollama)
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
// Local models on CPU are slow: an 8B model can take ~30s per ledger line.
export const OLLAMA_TIMEOUT_MS = int(process.env.OLLAMA_TIMEOUT_MS, 180000);
