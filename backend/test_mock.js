// Simple test to call /api/iot/run-model with mock:true
import fetch from 'node-fetch';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';

async function main() {
  const url = BACKEND + '/api/iot/run-model';
  const body = { mock: true, replySocketId: null };
  console.log('Posting mock request to', url);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  console.log('Response:', JSON.stringify(j, null, 2));
}

main().catch(e => { console.error('Error', e); process.exit(1); });
