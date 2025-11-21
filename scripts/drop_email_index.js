#!/usr/bin/env node
// Usage: node scripts/drop_email_index.js [--unset-null-emails]
// Requires environment variable MONGODB_URI or pass as first arg: node ... <mongoUri>

const { MongoClient } = require('mongodb');

async function main() {
  const argv = process.argv.slice(2);
  let mongoUri = process.env.MONGODB_URI;
  let unsetNull = false;

  if (argv.length && !argv[0].startsWith('--')) mongoUri = argv[0];
  if (argv.includes('--unset-null-emails')) unsetNull = true;

  if (!mongoUri) {
    console.error('ERROR: set MONGODB_URI env var or pass the mongo URI as first arg');
    process.exit(2);
  }

  // Newer mongodb drivers ignore/use a default set of options; do not pass deprecated options.
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db();
    const coll = db.collection('users');

    console.log('Indexes before:');
    console.log(await coll.indexes());

    if (unsetNull) {
      console.log('Unsetting email:null documents (converting email:null -> removed field)...');
      const res = await coll.updateMany({ email: null }, { $unset: { email: '' } });
      console.log('Updated count:', res.modifiedCount);
    }

    // Attempt to drop the legacy index name email_1 if it exists
    const idxs = await coll.indexes();
    const emailIndex = idxs.find(i => i.name === 'email_1');
    if (emailIndex) {
      console.log('Dropping index email_1 ...');
      await coll.dropIndex('email_1');
      console.log('Dropped email_1');
    } else {
      console.log('No index named email_1 found. Current indexes:');
      console.log(idxs);
    }

    // Create a sparse unique index on email (idempotent if exists)
    console.log('Ensuring sparse unique index on email...');
    await coll.createIndex({ email: 1 }, { unique: true, sparse: true, name: 'email_sparse_unique' });
    console.log('Index ensured. Indexes after:');
    console.log(await coll.indexes());

    console.log('Done. Restart backend server after this operation.');
  } catch (err) {
    console.error('Error:', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
