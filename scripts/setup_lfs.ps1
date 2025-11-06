Write-Host "Setting up Git LFS tracking for model files..."
git lfs install
git lfs track "Final_DP/Final_DP/Model/*.pt"
git lfs track "Final_DP/Final_DP/Model/*.pth"
git add .gitattributes
git commit -m "Track model binaries with Git LFS" || Write-Host "Nothing to commit"
Write-Host "If you already committed model binaries, consider running:`n git lfs migrate import --include='Final_DP/Final_DP/Model/**'`nand then force-push."
