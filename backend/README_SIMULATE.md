Running a simulated IoT device for local and remote testing

This helper explains how to run the included simulated device client so you can test
capture + run-model flows without a Raspberry Pi.

Files
- `iot/simulate-device.js` — Node script that connects with socket.io-client and emits `register_device`.

Prereqs
- Node.js installed (same as backend runtime)
- From `backend/` install dependencies:

  npm install

Run backend locally

1. Start backend server (from `backend/`):

   npm run start

Run simulated device (local server)

1. Open a new terminal and run the simulated device (defaults to localhost:5000):

   node iot/simulate-device.js

Run simulated device against deployed backend

1. Point the script at your deployed backend by setting `BACKEND_URL`:

   # PowerShell example
   $env:BACKEND_URL='https://<your-backend>.onrender.com'
   node iot/simulate-device.js

2. If your backend enforces device tokens, provide a token too:

   $env:BACKEND_URL='https://<your-backend>.onrender.com'
   $env:DEVICE_TOKEN_TO_USE='the-token-value'
   node iot/simulate-device.js

Verify registration

- Call the debug endpoint the server exposes:

  Invoke-RestMethod -Uri 'https://<your-backend>.onrender.com/debug/devices' -Method Get

  Example response:
  { devices: [ { name: 'simulated-device', socketId: '...' } ], count: 1 }

Test run-model

- Device-forwarding (device must be registered):

  Invoke-RestMethod -Uri 'https://<your-backend>.onrender.com/api/iot/run-model' -Method Post -Body (@{ deviceName='simulated-device' } | ConvertTo-Json) -ContentType 'application/json'

- Server-side inference (no device required)
  - Ensure `MODEL_SERVICE_URL` points to your model service endpoint (e.g. `https://e-waste-1-agt0.onrender.com/infer`) in your backend's environment variables (on Render: add env var and redeploy)
  - Then call with an `image_b64` payload:

    Invoke-RestMethod -Uri 'https://<your-backend>.onrender.com/api/iot/run-model' -Method Post -Body (@{ image_b64='...base64...' } | ConvertTo-Json) -ContentType 'application/json'

Notes
- If your backend returns 503: `No IoT device connected`, it means no device registered. Use the simulated device script to register one.
- If the backend returns 500 with "Model service returned 404", point `MODEL_SERVICE_URL` to the exact path exposed by the model service (for this project it's commonly `/infer`).

If you'd like, I can also add a small npm script to start the simulate script (e.g. `npm run simulate`) and/or add CI to validate basic endpoints.
