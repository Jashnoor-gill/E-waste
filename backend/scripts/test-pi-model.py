#!/usr/bin/env python3
"""
Test script to load the project's preferred model and run a single image through it.
Usage: python backend/scripts/test-pi-model.py --image path/to/image.jpg
"""
import argparse
from pathlib import Path
import os
import torch
from torchvision import transforms
from PIL import Image

# Resolve model path using same logic as model_service
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = ROOT / 'Model' / 'Model' / 'resnet50_ewaste_traced.pt'
ALT_MODEL_NEW = ROOT / 'pi_model' / 'DP-Group-17-' / 'Model' / 'new_layer4_resnet50_ewaste_traced.pt'
ALT_MODEL_OLD = ROOT / 'pi_model' / 'DP-Group-17-' / 'Model' / 'resnet50_ewaste_traced.pt'
MODEL_PATH = os.environ.get('MODEL_PATH') or (str(ALT_MODEL_NEW) if ALT_MODEL_NEW.exists() else (str(ALT_MODEL_OLD) if ALT_MODEL_OLD.exists() else (str(DEFAULT_MODEL) if DEFAULT_MODEL.exists() else None)))

if not MODEL_PATH:
    raise SystemExit('No model found. Set MODEL_PATH or place model in expected locations.')

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

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


def load_model(path):
    print('Loading model from', path)
    m = torch.jit.load(path, map_location=DEVICE)
    m.eval()
    return m


def classify(model, image_path):
    img = Image.open(image_path).convert('RGB')
    inp = preprocess(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        out = model(inp)
        probs = torch.nn.functional.softmax(out, dim=1)
        conf, idx = torch.max(probs, 1)
        label = CLASSES[idx.item()]
        return label, float(conf.item())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--image', '-i', required=True)
    args = p.parse_args()
    if not Path(args.image).exists():
        raise SystemExit('Image not found: ' + args.image)
    model = load_model(MODEL_PATH)
    label, conf = classify(model, args.image)
    print({'label': label, 'confidence': conf})

if __name__ == '__main__':
    main()
