# scripts/classify_image.py
import os
import torch
from torchvision import transforms
from PIL import Image
from pathlib import Path

# SCRIPT_DIR and default model path (can be overridden with MODEL_PATH env var)
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = SCRIPT_DIR.parent / "Model" / "new_layer4_resnet50_ewaste_traced.pt"

# Allow override via environment variable or function argument
def _resolve_model_path(model_path: str | Path | None = None) -> Path:
    if model_path:
        return Path(model_path)
    env = os.environ.get('MODEL_PATH')
    if env:
        return Path(env)
    return DEFAULT_MODEL_PATH

# Device selection
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Lazy-loaded model instance
_LOADED_MODEL = None

def _load_model(model_path: str | Path | None = None):
    global _LOADED_MODEL
    if _LOADED_MODEL is not None:
        return _LOADED_MODEL
    path = _resolve_model_path(model_path)
    if not path.exists():
        raise FileNotFoundError(f"Model file not found at: {path}")
    # Load TorchScript model
    m = torch.jit.load(str(path), map_location=DEVICE)
    m.eval()
    _LOADED_MODEL = m
    return _LOADED_MODEL

# Define preprocessing (same as during training)
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

# Define class labels (example — update with your actual classes)
CLASSES = ["Battery","Cables", "Charger", "Earphones", "Headphones", "Keyboard", "Mobile", "Mouse", "PCBs", "Printer", "Remote Control", "Smartwatch"]
#CLASSES = ["Battery", "Headphones", "Keyboard", "Mobile", "Mouse", "PCBs", "Printer", "Remote Control", "Smartwatch"]


def classify_image(image_path: str, model_path: str | Path | None = None) -> str:
    """Runs inference on the given image and returns predicted class.

    model_path: optional path or None to use the default/ENV.
    """
    model = _load_model(model_path)
    image = Image.open(image_path).convert("RGB")
    input_tensor = preprocess(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(input_tensor)
        # handle both logits tensor or direct class index
        if isinstance(outputs, tuple) or (hasattr(outputs, 'shape') and outputs.ndim > 1):
            _, predicted = torch.max(outputs, 1)
            idx = int(predicted.item())
        else:
            # unexpected model output; try to coerce
            try:
                idx = int(outputs)
            except Exception:
                raise RuntimeError('Unexpected model output shape')
        label = CLASSES[idx]

    return label


def run_inference_from_path(path: str, model_path: str = None):
    """Compatibility wrapper used by `pi_client.py`.
    Returns a dict: { 'label': str, 'confidence': float }
    """
    try:
        label = classify_image(path, model_path=model_path)
        return {'label': label, 'confidence': 1.0}
    except Exception as e:
        return {'label': 'error', 'confidence': 0.0, 'error': str(e)}


def run_inference_from_pil(pil_image, model_path: str = None):
    """Run inference from a PIL Image instance and return the same dict shape as above."""
    try:
        model = _load_model(model_path)
        input_tensor = preprocess(pil_image).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            outputs = model(input_tensor)
            if isinstance(outputs, tuple) or (hasattr(outputs, 'shape') and outputs.ndim > 1):
                _, predicted = torch.max(outputs, 1)
                idx = int(predicted.item())
            else:
                try:
                    idx = int(outputs)
                except Exception:
                    raise RuntimeError('Unexpected model output shape')
            label = CLASSES[idx]
        return {'label': label, 'confidence': 1.0}
    except Exception as e:
        return {'label': 'error', 'confidence': 0.0, 'error': str(e)}
