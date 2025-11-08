Write-Host "Setting up Git LFS tracking for model files..."
git lfs install
git lfs track "Model/Model/*.pt"
git lfs track "Model/Model/*.pth"
git add .gitattributes
git commit -m "Track model binaries with Git LFS" || Write-Host "Nothing to commit"
Write-Host "If you already committed model binaries, consider running:`n git lfs migrate import --include='Model/Model/**'`nand then force-push."
