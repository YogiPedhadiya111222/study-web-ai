[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Message,

    [string]$RemoteName = "origin",

    [string]$RemoteUrl,

    [string]$PreferredBranch,

    [switch]$BackupNestedGitDirs
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Text)
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Text)
    Write-Host "    $Text"
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$AllowFailure
    )

    $displayCommand = "git " + ($Arguments -join " ")
    Write-Info $displayCommand

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & git @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    foreach ($line in @($output)) {
        if ($null -ne $line -and "$line".Length -gt 0) {
            Write-Host $line
        }
    }

    $result = [pscustomobject]@{
        Success = ($exitCode -eq 0)
        ExitCode = $exitCode
        Output = @($output)
        Command = $displayCommand
    }

    if (-not $result.Success -and -not $AllowFailure) {
        throw "Command failed: $displayCommand"
    }

    return $result
}

function Get-GitText {
    param([Parameter(Mandatory = $true)][object]$Result)
    return (($Result.Output | ForEach-Object { "$_" }) -join "`n")
}

function Get-RepoRoot {
    $result = Invoke-Git -Arguments @("rev-parse", "--show-toplevel")
    return (Get-GitText -Result $result).Trim()
}

function Get-CurrentBranch {
    $result = Invoke-Git -Arguments @("branch", "--show-current")
    return (Get-GitText -Result $result).Trim()
}

function Get-UpstreamBranch {
    $result = Invoke-Git -Arguments @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") -AllowFailure
    if ($result.Success) {
        return (Get-GitText -Result $result).Trim()
    }

    return $null
}

function Get-RemoteUrlValue {
    param([string]$Name)

    $result = Invoke-Git -Arguments @("remote", "get-url", $Name) -AllowFailure
    if ($result.Success) {
        return (Get-GitText -Result $result).Trim()
    }

    return $null
}

function Get-RemoteDefaultBranch {
    param([string]$Name)

    $result = Invoke-Git -Arguments @("ls-remote", "--symref", $Name, "HEAD") -AllowFailure
    if (-not $result.Success) {
        return $null
    }

    foreach ($line in $result.Output) {
        $text = "$line"
        if ($text -match "refs/heads/(?<branch>[^\s]+)\s+HEAD") {
            return $Matches["branch"]
        }
    }

    return $null
}

function Get-NestedGitDirectories {
    param([string]$RootPath)

    return @(Get-ChildItem -Path $RootPath -Directory -Recurse -Force |
        Where-Object {
            $_.Name -eq ".git" -and
            $_.FullName -ne (Join-Path $RootPath ".git")
        })
}

function Backup-NestedGitDirectories {
    param([System.IO.DirectoryInfo[]]$Directories)

    foreach ($directory in $Directories) {
        $parentPath = Split-Path -Path $directory.FullName -Parent
        $targetPath = Join-Path $parentPath ".git.local-backup"
        $counter = 1

        while (Test-Path -LiteralPath $targetPath) {
            $targetPath = Join-Path $parentPath (".git.local-backup.{0}" -f $counter)
            $counter++
        }

        Rename-Item -LiteralPath $directory.FullName -NewName (Split-Path -Path $targetPath -Leaf)
        Write-Info ("Backed up nested Git metadata: {0}" -f $targetPath)
    }
}

function Ensure-Remote {
    param(
        [string]$Name,
        [string]$Url
    )

    $existingUrl = Get-RemoteUrlValue -Name $Name

    if ($existingUrl) {
        Write-Info ("Remote '{0}' -> {1}" -f $Name, $existingUrl)
        return $existingUrl
    }

    if (-not $Url) {
        throw "Remote '$Name' is not configured. Rerun with -RemoteUrl <repository-url>."
    }

    Write-Step ("Adding missing remote '{0}'" -f $Name)
    Invoke-Git -Arguments @("remote", "add", $Name, $Url)
    return $Url
}

function Test-HasStagedChanges {
    & git diff --cached --quiet
    return ($LASTEXITCODE -ne 0)
}

function Test-IsAuthFailure {
    param([string]$Text)

    return (
        $Text -match "Authentication failed" -or
        $Text -match "Permission denied \(publickey\)" -or
        $Text -match "Could not read from remote repository" -or
        $Text -match "could not read Username" -or
        $Text -match "Repository not found"
    )
}

function Test-IsRejectedPush {
    param([string]$Text)

    return (
        $Text -match "failed to push some refs" -or
        $Text -match "non-fast-forward" -or
        $Text -match "\[rejected\]"
    )
}

function Show-AuthHelp {
    param([string]$RemoteUrlValue)

    Write-Host ""
    Write-Host "Authentication to GitHub failed." -ForegroundColor Yellow
    Write-Host "Use one of these options, then rerun the script:"
    Write-Host "  gh auth login"
    Write-Host "  ssh -T git@github.com"
    Write-Host "  ssh-keygen -t ed25519 -C `"your-email@example.com`""
    Write-Host "Current remote: $RemoteUrlValue"
}

function Resolve-PushBranch {
    param(
        [string]$CurrentBranch,
        [string]$RemoteDefaultBranch,
        [string]$RequestedBranch
    )

    if ($RequestedBranch) {
        return $RequestedBranch
    }

    if ($CurrentBranch -in @("main", "master")) {
        return $CurrentBranch
    }

    if ($RemoteDefaultBranch -in @("main", "master")) {
        return $RemoteDefaultBranch
    }

    return $CurrentBranch
}

Write-Step "Checking repository"
Invoke-Git -Arguments @("status", "--short", "--branch")

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot
Write-Info ("Repository root: {0}" -f $repoRoot)

$nestedGitDirs = Get-NestedGitDirectories -RootPath $repoRoot
if ($nestedGitDirs.Count -gt 0) {
    if (-not $BackupNestedGitDirs) {
        $paths = $nestedGitDirs.FullName -join [Environment]::NewLine
        throw "Nested Git repositories found:`n$paths`nRerun with -BackupNestedGitDirs to preserve them as .git.local-backup folders before staging."
    }

    Write-Step "Backing up nested Git metadata"
    Backup-NestedGitDirectories -Directories $nestedGitDirs
}

$remoteUrlValue = Ensure-Remote -Name $RemoteName -Url $RemoteUrl
$currentBranch = Get-CurrentBranch

if (-not $currentBranch) {
    throw "You are in a detached HEAD state. Checkout a branch before committing."
}

$upstreamBranch = Get-UpstreamBranch
$remoteDefaultBranch = Get-RemoteDefaultBranch -Name $RemoteName

if (-not $upstreamBranch -and $remoteDefaultBranch -in @("main", "master") -and $currentBranch -in @("main", "master") -and $currentBranch -ne $remoteDefaultBranch) {
    Write-Step ("Aligning local branch name with remote default branch '{0}'" -f $remoteDefaultBranch)
    Invoke-Git -Arguments @("branch", "-M", $remoteDefaultBranch)
    $currentBranch = Get-CurrentBranch
}

$pushBranch = Resolve-PushBranch -CurrentBranch $currentBranch -RemoteDefaultBranch $remoteDefaultBranch -RequestedBranch $PreferredBranch

Write-Step "Staging all changes"
Invoke-Git -Arguments @("add", ".")

if (Test-HasStagedChanges) {
    Write-Step "Creating commit"
    $commitResult = Invoke-Git -Arguments @("commit", "-m", $Message) -AllowFailure
    $commitText = Get-GitText -Result $commitResult

    if (-not $commitResult.Success -and $commitText -notmatch "nothing to commit") {
        throw "Commit failed. Review the output above and try again."
    }
} else {
    Write-Step "No new staged changes to commit"
    Write-Info "The repository is already clean after staging."
}

$upstreamBranch = Get-UpstreamBranch

Write-Step "Pushing to GitHub"
if (-not $upstreamBranch) {
    $pushResult = Invoke-Git -Arguments @("push", "-u", $RemoteName, $pushBranch) -AllowFailure
} else {
    $pushResult = Invoke-Git -Arguments @("push") -AllowFailure
}

$pushText = Get-GitText -Result $pushResult
if (-not $pushResult.Success) {
    if (Test-IsAuthFailure -Text $pushText) {
        Show-AuthHelp -RemoteUrlValue $remoteUrlValue
        exit 1
    }

    if (Test-IsRejectedPush -Text $pushText) {
        Write-Step "Push rejected, pulling with rebase and retrying"
        Invoke-Git -Arguments @("pull", $RemoteName, $pushBranch, "--rebase")

        if (-not $upstreamBranch) {
            $pushResult = Invoke-Git -Arguments @("push", "-u", $RemoteName, $pushBranch) -AllowFailure
        } else {
            $pushResult = Invoke-Git -Arguments @("push") -AllowFailure
        }

        $pushText = Get-GitText -Result $pushResult
    }
}

if (-not $pushResult.Success) {
    throw "Push failed after retries. Review the output above."
}

Write-Host ""
Write-Host "Workflow completed successfully." -ForegroundColor Green
Write-Host "Future updates can use:"
Write-Host "  .\scripts\git-workflow.ps1 -Message `"Describe your update`""
Write-Host ""
Write-Host "Manual fallback:"
Write-Host "  git add ."
Write-Host "  git commit -m `"Describe your update`""
Write-Host "  git push"
