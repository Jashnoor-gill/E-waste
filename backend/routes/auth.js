import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'name,email,password required' });
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'email_taken' });
    const hashed = await bcrypt.hash(password, 10);
    const u = new User({ name, email: email.toLowerCase().trim(), password: hashed, role: role || undefined });
    await u.save();
    const token = jwt.sign({ sub: u._id.toString(), role: u.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const out = { id: u._id, name: u.name, email: u.email, role: u.role, points: u.points };
    return res.json({ token, user: out });
  } catch (err) {
    console.error('auth.register error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email,password required' });
    const u = await User.findOne({ email: email.toLowerCase().trim() });
    if (!u) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const token = jwt.sign({ sub: u._id.toString(), role: u.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const out = { id: u._id, name: u.name, email: u.email, role: u.role, points: u.points };
    return res.json({ token, user: out });
  } catch (err) {
    console.error('auth.login error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Middleware to protect routes
const requireAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
};

// Returns current user info (protected)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select('-password');
    if (!u) return res.status(404).json({ error: 'not_found' });
    return res.json(u);
  } catch (err) {
    console.error('auth.me error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
