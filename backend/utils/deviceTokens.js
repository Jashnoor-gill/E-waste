import fs from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(new URL('..', import.meta.url).pathname, 'device_tokens.json');

function readFileSafe() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) return [];
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.warn('Failed to read device tokens file:', err.message);
    return [];
  }
}

function writeFileSafe(tokens) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to write device tokens file:', err.message);
    return false;
  }
}

export function loadTokens() {
  // Merge env tokens and persisted file tokens
  const envTokens = (process.env.DEVICE_TOKENS || process.env.DEVICE_TOKEN || '').split(',').map(s=>s.trim()).filter(Boolean);
  const fileTokens = readFileSafe();
  const all = Array.from(new Set([...(envTokens||[]), ...(fileTokens||[])]));
  return all;
}

export function listTokens() {
  return loadTokens();
}

export function addToken(token) {
  if (!token) return false;
  const tokens = readFileSafe();
  if (tokens.includes(token)) return true;
  tokens.push(token);
  return writeFileSafe(tokens);
}

export function removeToken(token) {
  if (!token) return false;
  const tokens = readFileSafe();
  const filtered = tokens.filter(t => t !== token);
  return writeFileSafe(filtered);
}
