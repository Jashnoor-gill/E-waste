import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// Lightweight request logger for auth routes to aid debugging login/register failures.
router.use((req, res, next) => {
  try {
    console.log(`[auth] ${req.method} ${req.path} - body keys: ${req.body ? Object.keys(req.body).join(',') : '<no-body>'}`);
  } catch (e) { console.log('[auth] logger error', e); }
  return next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d';

// Register new user
router.post('/register', async (req, res) => {
  try {
    console.log('[auth.register] payload:', JSON.stringify(req.body).slice(0, 1000));
    const { name, email, username, password, role } = req.body;
    // Require username and password for registration. Email and name are optional.
    if (!username || !password) return res.status(400).json({ error: 'username,password required' });
    const uname = String(username).toLowerCase().trim();
    // Check for existing username or email
    const existing = await User.findOne({ $or: [{ username: uname }, ...(email ? [{ email: String(email).toLowerCase().trim() }] : [])] });
    if (existing) return res.status(409).json({ error: 'username_or_email_taken' });
    const hashed = await bcrypt.hash(password, 10);
    const u = new User({ name: name || undefined, username: uname, email: email ? String(email).toLowerCase().trim() : undefined, password: hashed, role: role || undefined });
    await u.save();
    const token = jwt.sign({ sub: u._id.toString(), role: u.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const out = { id: u._id, name: u.name, username: u.username, email: u.email, role: u.role, points: u.points };
    return res.json({ token, user: out });
  } catch (err) {
    console.error('auth.register error', err && err.stack ? err.stack : err);
    // handle duplicate key errors gracefully
    if (err && err.code === 11000) return res.status(409).json({ error: 'duplicate_key' });
    return res.status(500).json({ error: 'server_error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('[auth.login] payload:', JSON.stringify(req.body).slice(0, 1000));
    const { identifier, username, password } = req.body || {};
    const pwd = typeof password === 'string' ? password : (password ? String(password) : '');
    if ((!identifier && !username) || !pwd) return res.status(400).json({ error: 'identifier_or_username,password required' });
    const id = String(identifier || username).toLowerCase().trim();
    const q = { $or: [{ username: id }] };
    // if identifier looks like an email, search by email too
    if (String(id).includes('@')) q.$or.push({ email: String(id).toLowerCase().trim() });
    let u = await User.findOne(q);
    // If user does not exist, auto-create (username-first flow)
    if (!u) {
      try {
        const uname = String(id).toLowerCase().trim();
        const hashed = await bcrypt.hash(pwd, 10);
        const created = new User({ username: uname, password: hashed, role: 'binuser' });
        await created.save();
        const token = jwt.sign({ sub: created._id.toString(), role: created.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        const out = { id: created._id, name: created.name, username: created.username, email: created.email, role: created.role, points: created.points };
        return res.json({ token, user: out });
      } catch (err) {
        // possible duplicate key if created concurrently
        if (err && err.code === 11000) {
          u = await User.findOne(q);
          if (!u) return res.status(500).json({ error: 'server_error' });
        } else {
          console.error('auth.login create user error', err);
          return res.status(500).json({ error: 'server_error' });
        }
      }
    }

    console.log(`[auth.login] user found: id=${u && u._id} username=${u && u.username} passwordPresent=${!!(u && u.password)}`);
    // If the user exists but has no stored local password, set one now (user may have been created externally)
    if (u && !u.password) {
      try {
        const hashed = await bcrypt.hash(pwd, 10);
        u.password = hashed;
        await u.save();
        console.log(`[auth.login] set password for existing user id=${u._id}`);
        const token = jwt.sign({ sub: u._id.toString(), role: u.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
        const out = { id: u._id, name: u.name, username: u.username, email: u.email, role: u.role, points: u.points };
        return res.json({ token, user: out });
      } catch (err) {
        console.error('auth.login set password error', err && err.stack ? err.stack : err);
        return res.status(500).json({ error: 'server_error' });
      }
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(pwd, u.password);
    } catch (bcryptErr) {
      console.error('auth.login bcrypt.compare error', bcryptErr && bcryptErr.stack ? bcryptErr.stack : bcryptErr);
      return res.status(500).json({ error: 'server_error', detail: 'bcrypt_failed' });
    }
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const token = jwt.sign({ sub: u._id.toString(), role: u.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    const out = { id: u._id, name: u.name, username: u.username, email: u.email, role: u.role, points: u.points };
    return res.json({ token, user: out });
  } catch (err) {
    console.error('auth.login error', err && err.stack ? err.stack : err);
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

// Export middleware so other route files can protect endpoints
export { requireAuth };

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
