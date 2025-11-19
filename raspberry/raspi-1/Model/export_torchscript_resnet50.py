# export_torchscript_resnet50.py
import torch
import torchvision.models as models
import sys

# === EDIT if needed ===
WEIGHTS_PATH = "resnet50_finetuned_layer4_standard.pth"   # <-- your .pth file
OUT_PATH = "new_layer4_resnet50_ewaste_traced.pt"
NUM_CLASSES = 12                        # <-- change if your dataset has different number of classes
# =======================

# 1. define model architecture same as training
model = models.resnet50()
model.fc = torch.nn.Linear(model.fc.in_features, NUM_CLASSES)

# 2. load weights
state = torch.load(WEIGHTS_PATH, map_location="cpu")
# If you saved the whole model or a dict with 'model_state', adjust accordingly:
if isinstance(state, dict) and 'state_dict' in state:
    state = state['state_dict']
model.load_state_dict(state)
model.eval()

# 3. create example input matching training preprocessing (batch, channels, H, W)
example_input = torch.randn(1, 3, 224, 224)

# 4. trace & save TorchScript
with torch.no_grad():
    traced = torch.jit.trace(model, example_input)
    traced.save(OUT_PATH)

print(f"Saved TorchScript model to: {OUT_PATH}")
