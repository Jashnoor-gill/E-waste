#!/usr/bin/env node
/*
  Manage backend/device_tokens.json locally.
  Usage:
    node scripts/manage_device_token.js list
    node scripts/manage_device_token.js add <token>
    node scripts/manage_device_token.js remove <token>

  This script edits `backend/device_tokens.json` next to the backend code so the server's
  `deviceTokens.js` will pick up the tokens via file read.
*/

const fs = require('fs');
const path = require('path');

const ACTION = process.argv[2];
const TOKEN = process.argv[3];

const TOKENS_FILE = path.join(__dirname, '..', 'backend', 'device_tokens.json');

function readTokens() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) return [];
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Failed to read tokens file:', e.message);
    process.exit(1);
  }
}

function writeTokens(tokens) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write tokens file:', e.message);
    return false;
  }
}

if (!ACTION || (ACTION !== 'list' && ACTION !== 'add' && ACTION !== 'remove')) {
  console.log('Usage: node scripts/manage_device_token.js <list|add|remove> [token]');
  process.exit(0);
}

if (ACTION === 'list') {
  const tokens = readTokens();
  if (tokens.length === 0) console.log('(no tokens)');
  else tokens.forEach(t => console.log(t));
  process.exit(0);
}

if (!TOKEN) {
  console.error('Token required for add/remove');
  process.exit(1);
}

const tokens = readTokens();

if (ACTION === 'add') {
  if (tokens.includes(TOKEN)) {
    console.log('Token already present');
    process.exit(0);
  }
  tokens.push(TOKEN);
  if (writeTokens(tokens)) console.log('Token added');
  process.exit(0);
}

if (ACTION === 'remove') {
  const filtered = tokens.filter(t => t !== TOKEN);
  if (filtered.length === tokens.length) {
    console.log('Token not found');
    process.exit(0);
  }
  if (writeTokens(filtered)) console.log('Token removed');
  process.exit(0);
}
