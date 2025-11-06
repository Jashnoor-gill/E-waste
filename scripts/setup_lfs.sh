#!/usr/bin/env bash
set -euo pipefail
echo "Setting up Git LFS tracking for model files..."
git lfs install
git lfs track "Final_DP/Final_DP/Model/*.pt"
git lfs track "Final_DP/Final_DP/Model/*.pth"
git add .gitattributes || true
git commit -m "Track model binaries with Git LFS" || echo "Nothing to commit"
echo "If you already committed model binaries, run: git lfs migrate import --include='Final_DP/Final_DP/Model/**' && git push --force"
