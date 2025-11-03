import express from 'express';
import { listTokens, addToken, removeToken } from '../utils/deviceTokens.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;
  const header = req.headers['x-admin-token'];
  if (!adminToken) return res.status(500).json({ error: 'admin_token_not_configured' });
  if (!header || header !== adminToken) return res.status(403).json({ error: 'forbidden' });
  next();
}

// List connected devices
router.get('/devices', requireAdmin, (req, res) => {
  const devices = req.app.get('devices');
  const out = [];
  for (const [name, socketId] of devices.entries()) out.push({ name, socketId });
  res.json(out);
});

// List tokens
router.get('/tokens', requireAdmin, (req, res) => {
  res.json(listTokens());
});

// Add token
router.post('/tokens', requireAdmin, (req, res) => {
  const token = req.body && req.body.token;
  if (!token) return res.status(400).json({ error: 'token_required' });
  const ok = addToken(token);
  if (!ok) return res.status(500).json({ error: 'failed_to_add' });
  res.status(201).json({ added: true });
});

// Remove token
router.delete('/tokens/:token', requireAdmin, (req, res) => {
  const token = req.params.token;
  if (!token) return res.status(400).json({ error: 'token_required' });
  const ok = removeToken(token);
  if (!ok) return res.status(500).json({ error: 'failed_to_remove' });
  res.json({ removed: true });
});

export default router;
