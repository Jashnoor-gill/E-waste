from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image
import torch
from torchvision import transforms
import os

app = FastAPI(title="E-waste Model Service")


class InferRequest(BaseModel):
    image_b64: str


MODEL_PATH = os.environ.get('MODEL_PATH') or str(Path(__file__).resolve().parents[2] / 'Final_DP' / 'Final_DP' / 'Model' / 'resnet50_ewaste_traced.pt')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')


def load_model(path: str):
    if not Path(path).exists():
        raise FileNotFoundError(f"Model not found at: {path}")
    model = torch.jit.load(path, map_location=DEVICE)
    model.eval()
    return model


# load model on startup
try:
    model = load_model(MODEL_PATH)
except Exception as e:
    # keep model as None and raise on call
    model = None
    app.state.load_error = str(e)


preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


CLASSES = [
    "Battery",
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
    if model is None:
        raise HTTPException(status_code=500, detail=f"Model not loaded: {getattr(app.state, 'load_error', 'unknown')}")

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
    if model is None:
        raise HTTPException(status_code=500, detail=f"Model not loaded: {getattr(app.state, 'load_error', 'unknown')}")
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
    ok = model is not None
    return {"ok": ok, "model_path": MODEL_PATH if ok else None, "error": getattr(app.state, 'load_error', None)}
