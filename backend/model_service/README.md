Model service (FastAPI)

This small service loads the TorchScript model and exposes an inference endpoint.

Run locally (example):

1. Create virtualenv and install requirements

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Start the server

```powershell
uvicorn app:app --host 0.0.0.0 --port 8001
```

3. Health check

GET http://localhost:8001/health

4. Inference

POST http://localhost:8001/infer
Body (JSON): { "image_b64": "<base64-string>" }

OR

POST http://localhost:8001/infer-file (multipart form, file field `file`)

Notes:
- You can override the model path using the `MODEL_PATH` environment variable.
- This service expects the traced TorchScript file `resnet50_ewaste_traced.pt` available at the configured path.
