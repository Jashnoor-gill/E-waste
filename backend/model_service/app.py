from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image
import torch
from torchvision import transforms
import os
import requests
import shutil
from urllib.parse import urlparse

try:
    import boto3
except Exception:
    boto3 = None

app = FastAPI(title="E-waste Model Service")

# Allow cross-origin requests from the frontend during local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# Attempt to download and load the model at startup so the download appears in deploy logs
@app.on_event('startup')
async def startup_load_model():
    try:
        print('Startup: checking model file and attempting download/load if needed...')
        # download_model_if_needed will return True if download succeeded or file exists
        ok = download_model_if_needed(MODEL_PATH)
        if ok:
            try:
                # load model to verify it loads correctly
                _ = load_model(MODEL_PATH)
                app.state.load_error = None
                print(f'Model loaded successfully from {MODEL_PATH}')
            except Exception as e:
                app.state.load_error = str(e)
                print('Model load failed at startup:', e)
        else:
            print(f'Model not present and download did not run or failed (MODEL_DOWNLOAD_URL={MODEL_DOWNLOAD_URL})')
    except Exception as e:
        app.state.load_error = str(e)
        print('Startup model load encountered an error:', e)


class InferRequest(BaseModel):
    image_b64: str


DEFAULT_MODEL = Path(__file__).resolve().parents[2] / 'Model' / 'Model' / 'resnet50_ewaste_traced.pt'
# Also check for user-provided traced model under `pi_model/DP-Group-17-/Model/`
# Prefer the new_layer4 variant if present
ALT_MODEL_NEW = Path(__file__).resolve().parents[2] / 'pi_model' / 'DP-Group-17-' / 'Model' / 'new_layer4_resnet50_ewaste_traced.pt'
ALT_MODEL_OLD = Path(__file__).resolve().parents[2] / 'pi_model' / 'DP-Group-17-' / 'Model' / 'resnet50_ewaste_traced.pt'
MODEL_PATH = os.environ.get('MODEL_PATH') or (
    str(ALT_MODEL_NEW) if ALT_MODEL_NEW.exists()
    else (str(ALT_MODEL_OLD) if ALT_MODEL_OLD.exists()
          else (str(DEFAULT_MODEL) if DEFAULT_MODEL.exists() else str(ALT_MODEL_NEW)))
)
MODEL_DOWNLOAD_URL = os.environ.get('MODEL_DOWNLOAD_URL') or os.environ.get('MODEL_S3_URL')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# If the configured MODEL_PATH points to a repo-local `pi_model/...` path that
# doesn't exist in the deployment (common when large models were removed from
# the branch), but a MODEL_DOWNLOAD_URL is provided, download the release
# asset into a local `downloaded_models/` folder and use that file as
# `MODEL_PATH` so the service can load it.
try:
    if MODEL_DOWNLOAD_URL and MODEL_PATH and 'pi_model' in MODEL_PATH and not Path(MODEL_PATH).exists():
        parsed_name = None
        try:
            parsed_name = Path(urlparse(MODEL_DOWNLOAD_URL).path).name
        except Exception:
            parsed_name = None
        if not parsed_name:
            parsed_name = 'downloaded_model.pt'
        fallback_dir = Path(__file__).resolve().parents[1] / 'downloaded_models'
        fallback_dir.mkdir(parents=True, exist_ok=True)
        fallback_target = fallback_dir / parsed_name
        # Use this fallback target as the effective MODEL_PATH for loading
        MODEL_PATH = str(fallback_target)
        print(f"MODEL_PATH overridden to fallback download target: {MODEL_PATH}")
except Exception as _e:
    print('Error while computing fallback MODEL_PATH:', _e)


def load_model(path: str):
    if not Path(path).exists():
        raise FileNotFoundError(f"Model not found at: {path}")
    model = torch.jit.load(path, map_location=DEVICE)
    model.eval()
    return model


def download_model_if_needed(target_path: str):
    """If model file is missing and MODEL_DOWNLOAD_URL provided, download it.
    Supports HTTP(S) direct downloads or s3://bucket/key with boto3 (if installed).
    """
    p = Path(target_path)
    if p.exists():
        return True
    url = MODEL_DOWNLOAD_URL
    if not url:
        return False
    print(f"Model file missing at {target_path}. Attempting download from: {url}")
    parsed = urlparse(url)
    try:
        if parsed.scheme in ('http', 'https'):
            # stream download
            resp = requests.get(url, stream=True, timeout=60)
            resp.raise_for_status()
            p.parent.mkdir(parents=True, exist_ok=True)
            with open(p, 'wb') as f:
                shutil.copyfileobj(resp.raw, f)
            print('Downloaded model via HTTP(S)')
            return True
        elif parsed.scheme == 's3':
            if boto3 is None:
                print('boto3 not installed; cannot download from s3:// URL')
                return False
            # parse s3://bucket/key
            bucket = parsed.netloc
            key = parsed.path.lstrip('/')
            s3 = boto3.client('s3')
            p.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, key, str(p))
            print('Downloaded model from S3')
            return True
        else:
            print('Unsupported model download scheme:', parsed.scheme)
            return False
    except Exception as e:
        print('Failed to download model:', e)
        return False

# lazy model (will be loaded on first inference to make startup robust)
model = None
app.state.load_error = None

def ensure_model_loaded():
    """Load the model on-demand. Sets app.state.load_error on failure and returns the model or raises HTTPException."""
    global model
    if model is not None:
        return model
    try:
        # If model file missing, try to download it from MODEL_DOWNLOAD_URL / MODEL_S3_URL
        if not Path(MODEL_PATH).exists():
            ok = download_model_if_needed(MODEL_PATH)
            if not ok:
                raise FileNotFoundError(f"Model not found at: {MODEL_PATH} and no download succeeded (MODEL_DOWNLOAD_URL={MODEL_DOWNLOAD_URL})")
        model = load_model(MODEL_PATH)
        app.state.load_error = None
        return model
    except Exception as e:
        app.state.load_error = str(e)
        raise HTTPException(status_code=500, detail=f"Model not loaded: {e}")


preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


CLASSES = [
    "Battery",
    "Cables",
    "Charger",
    "Earphones",
    "Headphones",
    "Keyboard",
    "Mobile",
    "Mouse",
    "PCBs",
    "Printer",
    "Remote Control",
    "Smartwatch",
]


def image_from_b64(b64: str) -> Image.Image:
    try:
        data = base64.b64decode(b64)
        return Image.open(BytesIO(data)).convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")


@app.post('/infer')
async def infer(req: InferRequest):
    """Accepts JSON with `image_b64` and returns { label, confidence }"""
    # ensure model is available (lazy-load if necessary)
    ensure_model_loaded()
    img = image_from_b64(req.image_b64)
    input_tensor = preprocess(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(input_tensor)
        # if outputs is a tensor of shape [1, C]
        probs = torch.nn.functional.softmax(outputs, dim=1)
        conf, idx = torch.max(probs, 1)
        label = CLASSES[idx.item()]
        confidence = float(conf.item())

    return {"label": label, "confidence": confidence}


@app.post('/infer-file')
async def infer_file(file: UploadFile = File(...)):
    """Accepts multipart/form-data file upload (image)"""
    # ensure model is available (lazy-load if necessary)
    ensure_model_loaded()
    contents = await file.read()
    try:
        img = Image.open(BytesIO(contents)).convert('RGB')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    input_tensor = preprocess(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        outputs = model(input_tensor)
        probs = torch.nn.functional.softmax(outputs, dim=1)
        conf, idx = torch.max(probs, 1)
        label = CLASSES[idx.item()]
        confidence = float(conf.item())

    return {"label": label, "confidence": confidence}


@app.get('/health')
async def health():
    """
    Health endpoint. Return ok=True when either:
    - the model is loaded in memory, or
    - the model file exists on disk (so the service can load it on demand).

    This makes readiness probes less flaky across worker restarts where the
    process may not yet have loaded the model into memory but the file is
    already present (downloaded during previous startup).
    """
    # Prefer the in-memory model state when available
    if model is not None:
        return {"ok": True, "model_path": MODEL_PATH, "error": None}

    # If the model file exists on disk, report ok=True so external probes
    # treat the service as ready (it can load the model lazily on first request).
    try:
        from pathlib import Path
        if Path(MODEL_PATH).exists():
            return {"ok": True, "model_path": MODEL_PATH, "error": getattr(app.state, 'load_error', None)}
    except Exception:
        # Fall through to reporting not-ready on unexpected errors
        pass

    return {"ok": False, "model_path": None, "error": getattr(app.state, 'load_error', None)}


# Helpful developer GET routes to avoid confusing 404s in the browser console.
@app.get('/')
async def root():
    return {"service": "E-waste model service", "routes": ["POST /infer (json image_b64)", "POST /infer-file (multipart)", "GET /health"]}


@app.get('/infer')
async def infer_get():
    # Informative response for accidental GET requests from the browser.
    raise HTTPException(status_code=405, detail="POST /infer with JSON { image_b64 } is required; use POST not GET")
