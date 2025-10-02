import twilio from 'twilio';

let client = null;
const isDummy = !process.env.TWILIO_SID || process.env.TWILIO_SID === 'dummysid';
if (!isDummy) {
  client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

export function sendSMS({ to, body }) {
  if (isDummy) {
    // Simulate SMS in dev
    console.log(`[DEV] SMS to ${to}: ${body}`);
    return Promise.resolve({ dev: true });
  }
  return client.messages.create({
    body,
    from: process.env.TWILIO_PHONE,
    to
  });
}
