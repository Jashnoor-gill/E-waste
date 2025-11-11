import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post('/run-model', async (req, res) => {
  try {
    // Choose python executable depending on platform
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    // run the companion Python script located next to this file
    const scriptPath = path.join(__dirname, 'run_model.py');

    const python = spawn(pythonCmd, [scriptPath], { cwd: __dirname });

    let resultData = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      resultData += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('Python error:', data.toString());
    });

    // Safety: kill long-running child after 60s
    const killTimer = setTimeout(() => {
      try { python.kill(); } catch (e) { /* ignore */ }
    }, 60000);

    python.on('close', (code) => {
      clearTimeout(killTimer);
      if (stderr && !resultData) {
        console.error('Python process exited with stderr:', stderr);
      }
      try {
        const result = resultData ? JSON.parse(resultData) : {};
        return res.json(result);
      } catch (err) {
        console.error('JSON parse error:', err, 'raw output:', resultData);
        return res.status(500).json({ error: 'Failed to parse Python output', details: err.message, raw: resultData });
      }
    });

  } catch (error) {
    console.error('Run-model error:', error);
    res.status(500).json({ error: 'Model service call failed', details: String(error) });
  }
});

export default router;
