# Git LFS instructions

If you want to keep large model files inside the repo, use Git LFS (Large File Storage). This prevents very large git packs and push failures.

Quick guide (run locally):

1) Install Git LFS

PowerShell (Windows):

```powershell
# Use your preferred installer or package manager. Examples:
# choco install git-lfs
# winget install --id Git.GitLFS
git lfs install
```

2) Track the model files and commit `.gitattributes`

```powershell
git lfs track "Model/Model/*.pt"
git lfs track "Model/Model/*.pth"
git add .gitattributes
git commit -m "Track model binaries with Git LFS"
```

3) Move existing large files into LFS (history rewrite)

Only run this if you already committed large binaries and want them migrated into LFS. This rewrites history and requires a force-push.

```powershell
git lfs migrate import --include="Model/Model/**"
git push origin --force
```

Notes and warnings
- Rewriting history means collaborators need to re-clone or reset their local clones.
- Alternative: host model files outside the repo (S3, Google Drive, GitHub Release) and add download scripts in the repo if you prefer not to use LFS.
