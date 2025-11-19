# scripts/classify_image.py
import torch
from torchvision import transforms
from PIL import Image
from pathlib import Path

# Initialize model
# --- Dynamically find model path ---
SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = SCRIPT_DIR.parent / "Model" / "new_layer4_resnet50_ewaste_traced.pt"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load the TorchScript model
model = torch.jit.load(MODEL_PATH, map_location=DEVICE)
model.eval()

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


def classify_image(image_path: str) -> str:
    """Runs inference on the given image and returns predicted class."""
    image = Image.open(image_path).convert("RGB")
    input_tensor = preprocess(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        outputs = model(input_tensor)
        _, predicted = torch.max(outputs, 1)
        label = CLASSES[predicted.item()]

    return label


def run_inference_from_path(path: str, model_path: str = None):
    """Compatibility wrapper used by `pi_client.py`.
    Returns a dict: { 'label': str, 'confidence': float }
    """
    try:
        label = classify_image(path)
        # The traced TorchScript model used here returns logits; we don't compute a real confidence here.
        # Return a placeholder confidence of 1.0 for the predicted class to keep the API shape.
        return {'label': label, 'confidence': 1.0}
    except Exception as e:
        return {'label': 'error', 'confidence': 0.0, 'error': str(e)}


def run_inference_from_pil(pil_image, model_path: str = None):
    """Run inference from a PIL Image instance and return the same dict shape as above."""
    try:
        # reuse preprocessing
        input_tensor = preprocess(pil_image).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            outputs = model(input_tensor)
            _, predicted = torch.max(outputs, 1)
            label = CLASSES[predicted.item()]
        return {'label': label, 'confidence': 1.0}
    except Exception as e:
        return {'label': 'error', 'confidence': 0.0, 'error': str(e)}
