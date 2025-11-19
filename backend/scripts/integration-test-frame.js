import fs from 'fs/promises';
import fetch from 'node-fetch';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3000';
const DEVICE_ID = process.env.TEST_DEVICE_ID || 'test-device-1';

async function main(){
  try{
    const imgPath = './test.jpg';
    const data = await fs.readFile(imgPath);
    const b64 = data.toString('base64');
    console.log('Uploading test.jpg as base64 to', BACKEND);
    const uploadRes = await fetch(`${BACKEND.replace(/\/$/, '')}/api/frame/upload_frame`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: DEVICE_ID, frame: b64 })
    });
    const upJ = await uploadRes.json().catch(()=>null);
    console.log('upload response', uploadRes.status, upJ);

    // wait a moment for backend to process/store
    await new Promise(r=>setTimeout(r, 800));

    const latest = await fetch(`${BACKEND.replace(/\/$/, '')}/api/frame/latest_frame?device_id=${encodeURIComponent(DEVICE_ID)}`);
    if (!latest.ok) {
      console.error('latest_frame failed', latest.status, await latest.text());
      process.exit(1);
    }
    const j = await latest.json();
    console.log('latest_frame', j);
    if (j.url) {
      const getUrl = (j.url.startsWith('http://') || j.url.startsWith('https://')) ? j.url : `${BACKEND.replace(/\/$/, '')}${j.url}`;
      console.log('Fetching stored image from', getUrl);
      const imgRes = await fetch(getUrl);
      if (!imgRes.ok) { console.error('fetch stored image failed', imgRes.status); process.exit(1); }
      const buf = await imgRes.arrayBuffer();
      await fs.writeFile('./downloaded-integration.jpg', Buffer.from(buf));
      console.log('Saved downloaded-integration.jpg');
      process.exit(0);
    } else if (j.frame) {
      await fs.writeFile('./downloaded-integration.jpg', Buffer.from(j.frame, 'base64'));
      console.log('Saved downloaded-integration.jpg from inline frame');
      process.exit(0);
    } else if (j.gridfsId) {
      const getUrl = `${BACKEND.replace(/\/$/, '')}/api/frame/get/${j.gridfsId}`;
      console.log('Fetching GridFS file from', getUrl);
      const imgRes = await fetch(getUrl);
      if (!imgRes.ok) { console.error('fetch gridfs failed', imgRes.status); process.exit(1); }
      const buf = await imgRes.arrayBuffer();
      await fs.writeFile('./downloaded-integration.jpg', Buffer.from(buf));
      console.log('Saved downloaded-integration.jpg');
      process.exit(0);
    } else {
      console.error('No usable frame data returned');
      process.exit(1);
    }
  }catch(err){
    console.error('integration test failed', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
