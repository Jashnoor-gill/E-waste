# scripts/classify_image.py
import torch
from torchvision import transforms
from PIL import Image
from pathlib import Path

# Initialize model
# --- Dynamically find model path ---
SCRIPT_DIR = Path(__file__).resolve().parent
MODEL_PATH = SCRIPT_DIR.parent / "Model" / "new_resnet50_ewaste_traced.pt"
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
