# Git Workflow Guide

This project includes a reusable PowerShell workflow script for safe day-to-day Git usage.

## Recommended workflow

Run this from the repository root:

```powershell
.\scripts\git-workflow.ps1 -Message "Add frontend and Git workflow automation"
```

The script will:

1. Check the current Git status.
2. Verify that the repository is on a normal branch.
3. Detect a missing `origin` remote and add it if you provide `-RemoteUrl`.
4. Detect `main`/`master` mismatches and align the first push with the remote default branch.
5. Stage all changes with `git add .`.
6. Commit the staged changes with your message.
7. Push the branch to GitHub.
8. If the first push has no upstream, use `git push -u`.
9. If the push is rejected, run `git pull --rebase` and retry automatically.
10. Show GitHub authentication help if login or SSH is not configured.

## First push examples

If `origin` already exists:

```powershell
.\scripts\git-workflow.ps1 -Message "Initial project import"
```

If `origin` does not exist yet:

```powershell
.\scripts\git-workflow.ps1 -Message "Initial project import" -RemoteUrl "git@github.com:your-name/your-repo.git"
```

If the project contains a nested repository that should become part of this root repository:

```powershell
.\scripts\git-workflow.ps1 -Message "Initial project import" -BackupNestedGitDirs
```

That option preserves nested `.git` folders as `.git.local-backup` so the files can be committed by the root repository.

## Manual workflow

If you prefer to run commands yourself:

```powershell
git status
git add .
git commit -m "Describe your changes clearly"
git push -u origin main
```

If your repository still uses `master`, use:

```powershell
git push -u origin master
```

After the first successful push, your normal update flow is:

```powershell
git add .
git commit -m "Describe your update"
git push
```

## Common problems

Remote not connected:

```powershell
git remote add origin <repository-url>
```

Push rejected:

```powershell
git pull origin main --rebase
git push origin main
```

If your repository still uses `master`, replace `main` with `master`.

Authentication failed:

```powershell
gh auth login
```

Or test SSH access:

```powershell
ssh -T git@github.com
```
