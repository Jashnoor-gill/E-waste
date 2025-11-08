# Deploying frontend (Netlify) and backend + model service (Render)

This file summarizes the minimal steps to deploy the project using Netlify (frontend) and Render (backend + model service).

1) Push your repository to GitHub
  - Ensure your repo contains the model files tracked with Git LFS (they are in `Model/Model`) or host them externally and set MODEL_DOWNLOAD_URL.

2) Frontend → Netlify
  - In Netlify, create a new site from Git and connect your repo/branch.
  - In the site settings, set an environment variable `BACKEND_URL` to your backend URL (e.g. `https://ewaste-backend.onrender.com`).
  - Netlify will run the build command in `netlify.toml`: `node scripts/generate_frontend_config.js` which writes `frontend/config.js` with the runtime backend URL and publishes the `frontend` directory.
  - If you prefer a manual approach, run locally: `node scripts/generate_frontend_config.js` then serve the `frontend` directory.

3) Backend & Model Service → Render
  - Add two services to Render (or use the included `render.yaml` template):
    - Service A: Node web service at `backend/` (start: `node index.js`). Set env vars:
      - `MODEL_SERVICE_URL` = e.g. `https://<model-service>.onrender.com/infer`
      - `ADMIN_TOKEN` = a secret string for admin APIs
      - `DEVICE_TOKENS` = comma-separated device tokens (or use admin APIs to add tokens)
    - Service B: Docker web service for model (use `backend/model_service/Dockerfile`)
    - Set env var `MODEL_PATH` if you stored the model someplace other than the default `Model/Model/resnet50_ewaste_traced.pt`.
  - Ensure Render pulls Git LFS objects (Render supports LFS when connected to GitHub).

4) Test the live site
  - Open the Netlify site over HTTPS (camera access requires HTTPS).
  - The frontend will use `window.BACKEND_URL` (set by Netlify) to connect to the backend for websockets and the REST API.

5) Pi device setup
  - On the Pi, set `BACKEND_WS` to your backend URL (e.g., `https://ewaste-backend.onrender.com`) and `DEVICE_TOKEN` to a valid device token.
  - Run `python iot/pi_raspberry_client.py` (install `python-socketio[client]` and `requests`).

Notes:
  - The `backend/model_service/Dockerfile` installs PyTorch CPU wheels; builds can take some time.
  - For production, rotate tokens, enable HTTPS-only cookies, and consider adding rate-limiting and request auth.
