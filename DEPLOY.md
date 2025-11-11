# Deployment & CI/CD Guide

This document explains how to enable the GitHub Actions workflows that deploy your frontend to Netlify and trigger deploys of backend + model service on Render. It also shows how to test the mock inference path quickly.

## Workflow files added
- `.github/workflows/deploy-frontend-netlify.yml` — deploys the `frontend` folder to Netlify on push to `main`.
- `.github/workflows/deploy-render.yml` — triggers Render deploys for the backend and model service on push to `main`.

## Required GitHub repository secrets
Add the following secrets in your GitHub repository (Settings → Secrets → Actions):

- `NETLIFY_AUTH_TOKEN` — a Netlify personal access token with deploy permissions.
- `NETLIFY_SITE_ID` — the Netlify Site ID for your frontend site.
- `RENDER_API_KEY` — a Render API key with permission to create deploys.
- `RENDER_BACKEND_SERVICE_ID` — the Render service ID for your backend (Node) service.
- `RENDER_MODEL_SERVICE_ID` — the Render service ID for your model service (FastAPI).

If you don't plan to deploy the model service via Render (e.g., you will host it elsewhere), you can leave `RENDER_MODEL_SERVICE_ID` empty, but the workflow expects it; you may edit `.github/workflows/deploy-render.yml` to remove the model-service job.

## How to get the values

- Netlify
  - `NETLIFY_AUTH_TOKEN`: https://app.netlify.com/user/applications — create a personal token.
  - `NETLIFY_SITE_ID`: In Site settings → Site information → Site ID.

- Render
  - `RENDER_API_KEY`: In Render dashboard → Account → API Keys → Create Key.
  - `RENDER_BACKEND_SERVICE_ID` and `RENDER_MODEL_SERVICE_ID`: In your service's page URL or in the service settings (the ID appears in the URL `/services/<SERVICE_ID>`).

## Triggering deploys
- Push to `main` branch. The GitHub Actions workflows will run automatically.
- You can monitor Actions in the GitHub Actions tab for the repository.

## Quick local test (mock inference)
To verify the mock flow without deploying anything, you can run the included test script that POSTs a mock request to your locally running backend.

1. Start your backend locally (from `backend/`):
```powershell
cd backend
npm install
npm run dev
```

2. Run the mock test (Node must be installed):
```powershell
node backend/test_mock.js
```

This posts a `mock:true` request to `POST /backend/iot/run-model` and prints the response. The backend should also emit a `iot-model-result` event to the socket if `replySocketId` is provided.

## Troubleshooting
- If the Netlify deploy fails, check the Action logs and Netlify site deploy logs — missing `NETLIFY_SITE_ID` or wrong `NETLIFY_AUTH_TOKEN` are common causes.
- If Render deploys fail, the Action will show the HTTP response from Render; ensure `RENDER_API_KEY` and service IDs are correct.

If you want, I can walk you through adding the secrets in your GitHub repo or modify workflows to match other hosts.
