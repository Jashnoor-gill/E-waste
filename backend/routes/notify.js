import express from 'express';
import { sendMail } from '../utils/mailer.js';
import { sendSMS } from '../utils/sms.js';

const router = express.Router();

// Send email notification
router.post('/email', async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    await sendMail({ to, subject, text });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send SMS notification
router.post('/sms', async (req, res) => {
  const { to, body } = req.body;
  try {
    await sendSMS({ to, body });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
