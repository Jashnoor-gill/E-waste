"""Convert a PyTorch checkpoint (.pth) to a TorchScript traced model (.pt).

Place this script in the repo (next to the Pi Model folder) and run it from
your development machine where you have a working Python + torch install.

Adjust the constants below if your checkpoint key names or number of classes differ.
"""
from pathlib import Path
import torch
import torchvision.models as models

# --- CONFIGURE ---
PTH_PATH = Path(__file__).resolve().parent / 'Model' / 'resnet50_finetuned_layer4_standard.pth'
OUT_PATH = Path(__file__).resolve().parent / 'Model' / 'new_layer4_resnet50_ewaste_traced.pt'
NUM_CLASSES = 12
DEVICE = torch.device('cpu')
# -----------------


def load_state_dict(pth_path: Path):
    ckpt = torch.load(pth_path, map_location=DEVICE)
    if isinstance(ckpt, dict) and 'state_dict' in ckpt:
        sd = ckpt['state_dict']
    else:
        sd = ckpt
    # strip possible 'module.' prefixes from keys
    new_sd = {k.replace('module.', ''): v for k, v in sd.items()}
    return new_sd


def build_model(num_classes: int):
    model = models.resnet50(pretrained=False)
    model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
    return model


def main():
    print('PTH path:', PTH_PATH)
    if not PTH_PATH.exists():
        raise SystemExit(f'Checkpoint not found at: {PTH_PATH}')

    state = load_state_dict(PTH_PATH)
    model = build_model(NUM_CLASSES)
    model.load_state_dict(state)
    model.eval()
    model.to(DEVICE)

    example = torch.randn(1, 3, 224, 224, device=DEVICE)
    print('Tracing model...')
    with torch.no_grad():
        traced = torch.jit.trace(model, example)
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        traced.save(str(OUT_PATH))

    print('Wrote TorchScript model to:', OUT_PATH)


if __name__ == '__main__':
    main()
