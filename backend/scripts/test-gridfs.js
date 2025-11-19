const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const fs = require('fs');
(async ()=>{
  const uri = process.env.MONGODB_URI;
  if(!uri){ console.error('set MONGODB_URI in env'); process.exit(1); }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: process.env.GRIDFS_BUCKET || 'frames' });
  // make sure test.jpg exists in repo root
  if(!fs.existsSync('./test.jpg')){
    console.error('Place a small test.jpg next to this script and run again');
    await client.close();
    process.exit(1);
  }
  const uploadStream = bucket.openUploadStream('test-frame.jpg', { metadata: { test: true } });
  fs.createReadStream('./test.jpg').pipe(uploadStream).on('finish', async ()=>{
    console.log('Uploaded id=', uploadStream.id.toString());
    const downloadStream = bucket.openDownloadStream(uploadStream.id);
    const out = fs.createWriteStream('./downloaded-test.jpg');
    downloadStream.pipe(out).on('finish', async ()=>{
      console.log('Downloaded saved to downloaded-test.jpg');
      await client.close();
    });
  });
})();
