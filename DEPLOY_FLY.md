# Deploying to Fly.io (both backend and model service)

This guide shows minimal steps to deploy the Node backend (`backend/`) and the Python model service (`backend/model_service/`) to Fly.io.

Prerequisites
- Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
- Have a Fly account and be logged in: `flyctl auth login`
- Ensure your repo is pushed to GitHub (optional) and you are on a working branch.

Files added
- `backend/Dockerfile` - Dockerfile for the Node backend.
- `backend/fly.toml` - Fly config for the backend (edit `app.name`).
- `backend/model_service/fly.toml` - Fly config for the model service (edit `app.name`).

Steps to deploy

1. Login to Fly and create apps

```powershell
flyctl auth login
flyctl apps create ewaste-backend --region iad
flyctl apps create ewaste-model --region iad
```

2. Set secrets (example)

```powershell
flyctl secrets set ADMIN_TOKEN="<your-admin-token>" DEVICE_TOKENS="token1,token2"
# For model download from S3/HTTP
flyctl secrets set MODEL_DOWNLOAD_URL="https://your-storage.example.com/resnet50_ewaste_traced.pt"
```

3. Deploy the backend

```powershell
cd backend
flyctl deploy --config fly.toml
```

4. Deploy the model service

```powershell
cd backend/model_service
flyctl deploy --config fly.toml
```

5. Verify

- Check logs
```powershell
flyctl logs -a ewaste-backend
flyctl logs -a ewaste-model
```
- Visit the public URL returned by `flyctl status` or `flyctl info`.

CI / GitHub Actions (optional)
--------------------------------
If you'd like automatic deploys on push to `main`, create a GitHub Actions workflow. I added a sample workflow at `.github/workflows/deploy_fly.yml` that:

- Checks out the repo (with Git LFS support)
- Installs `flyctl`
- Sets Fly secrets from GitHub Secrets
- Deploys the backend and model service using `flyctl deploy --remote-only`

Required GitHub Secrets (create in your repo settings -> Secrets):
- `FLY_API_TOKEN` — your Fly personal API token
- `ADMIN_TOKEN` — admin token for the backend admin API
- `DEVICE_TOKENS` — comma-separated device tokens
- `MODEL_DOWNLOAD_URL` — public or signed URL to the model file (optional if model baked into image)
- `MODEL_SERVICE_URL` — (optional) URL the backend uses to contact the model service (if needed)

The workflow deploys apps named `ewaste-backend` and `ewaste-model`. If you used different app names, edit `.github/workflows/deploy_fly.yml` and the `fly.toml` files accordingly.

Security notes
- Don’t store tokens in code. Use `flyctl secrets set` or GitHub Secrets as shown.
- Consider rotating credentials regularly and enabling least-privilege roles for S3 access.

Notes
- The model service listens on port 8001 internally but Fly exposes it on port 80. The backend's `MODEL_SERVICE_URL` should point to the public URL of the model app (e.g., `https://ewaste-model.fly.dev/infer`).
- If you prefer not to store model in the repo, upload the model to an object store (S3/GCS) and set `MODEL_DOWNLOAD_URL` to the public (or signed) URL. The service will download it on first request.
- For production, rotate tokens and set a secure `ADMIN_TOKEN` and manage device tokens through the admin API.
