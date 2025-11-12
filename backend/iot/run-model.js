/*
  DEPRECATED: This file used to spawn a Python helper to run inference. The project
  now uses `run_model.js` (underscore) as the active router (mounted in index.js).
  Keeping this file as a no-op stub avoids accidental usage while preserving history.
*/
import express from 'express';
const router = express.Router();

router.post('/run-model', (req, res) => {
  // Explicitly return 501 to make it obvious this path is deprecated if called.
  console.warn('Deprecated router /iot/run-model (hyphen) called. Use run_model.js (underscore) instead.');
  return res.status(501).json({ error: 'Deprecated route - use server-side run_model.js' });
});

export default router;
