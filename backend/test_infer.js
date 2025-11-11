// Small test script to POST an image to the backend /api/iot/run-model endpoint
// Usage: node test_infer.js path/to/image.png
import fs from 'fs';
import fetch from 'node-fetch';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node test_infer.js path/to/image.png [backendUrl]');
  process.exit(2);
}
const imgPath = args[0];
const backend = args[1] || 'http://localhost:3000';

async function main() {
  const buf = fs.readFileSync(imgPath);
  const b64 = buf.toString('base64');
  const resp = await fetch(backend + '/backend/iot/run-model', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64: b64 })
  });
  const j = await resp.json();
  console.log('Response:', JSON.stringify(j, null, 2));
}

main().catch((e) => { console.error('Error', e); process.exit(1); });
