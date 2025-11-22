import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

// POST /api/iot/run-on-remote
// Body: { host?, user?, cmd? }
// Falls back to env vars REMOTE_HOST, REMOTE_USER, REMOTE_CMD if not provided.
// NOTE: This route will execute an SSH command from the backend host. Ensure the
// backend machine has SSH key access to the target (no password prompt) and that
// this endpoint is protected in production.
router.post('/run-on-remote', async (req, res) => {
  try {
    const host = (req.body && req.body.host) ? String(req.body.host) : (process.env.REMOTE_HOST || '');
    const user = (req.body && req.body.user) ? String(req.body.user) : (process.env.REMOTE_USER || '');
    const cmd = (req.body && req.body.cmd) ? String(req.body.cmd) : (process.env.REMOTE_CMD || 'cd dp && python3 Scripts/main.py');

    if (!host || !user) return res.status(400).json({ error: 'remote host or user not specified' });

    const target = `${user}@${host}`;
    const sshArgs = [target, cmd];
    const timeoutMs = parseInt(process.env.SSH_RUN_TIMEOUT_MS || '60000', 10);

    const child = spawn('ssh', sshArgs, { timeout: timeoutMs });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });

    child.on('error', (err) => {
      console.error('SSH spawn error:', err);
      return res.status(500).json({ error: 'ssh_spawn_failed', message: String(err) });
    });

    child.on('close', (code, signal) => {
      return res.json({ exitCode: code, signal: signal, stdout, stderr });
    });
  } catch (err) {
    console.error('run-on-remote error:', err);
    return res.status(500).json({ error: 'run_on_remote_failed', message: String(err) });
  }
});

export default router;
