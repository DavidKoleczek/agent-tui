---
name: reference-repos
description: Clone or update the reference repositories under reference/.
disable-model-invocation: true
---

# Reference Repos Skill

Keeps `reference/<repo>` in sync with the upstream version this project depends on. Run all commands from the repo root. All clones are shallow (`--depth 1 --single-branch`).

Repos:
- `reference/opentui` from https://github.com/anomalyco/opentui at tag `v<version>` of `@opentui/core` (read from `package.json`).
- `reference/opencode` from https://github.com/anomalyco/opencode at branch `dev` (the default; no `main` exists).
- `reference/awesome-opentui` from https://github.com/msmps/awesome-opentui at branch `main`.

## opentui

PowerShell:

```powershell
# Read the installed @opentui/core version, stripping any leading ^ or ~ from the semver range.
$ver = (Get-Content package.json -Raw | ConvertFrom-Json).dependencies.'@opentui/core' -replace '^[\^~]',''
$tag = "v$ver"
$dst = "reference\opentui"
# Probe the existing checkout's pinned tag; null if missing or not a git repo (e.g. a plain snapshot).
$current = if (Test-Path "$dst\.git") { git -C $dst describe --tags --exact-match 2>$null } else { $null }
if ($current -ne $tag) {
    # Wipe any existing directory so a non-git snapshot or a wrong-tag clone is replaced cleanly.
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    git clone --depth 1 --branch $tag --single-branch https://github.com/anomalyco/opentui.git $dst
}
```

Bash:

```bash
ver=$(node -p "require('./package.json').dependencies['@opentui/core'].replace(/^[\^~]/, '')")
tag="v$ver"
dst="reference/opentui"
current=$(git -C "$dst" describe --tags --exact-match 2>/dev/null || true)
if [ "$current" != "$tag" ]; then
    rm -rf "$dst"
    git clone --depth 1 --branch "$tag" --single-branch https://github.com/anomalyco/opentui.git "$dst"
fi
```

## Other Repos

PowerShell:

```powershell
$url    = "<repo URL>"
$branch = "<branch>"
$dst    = "<dst path, e.g. reference\opencode>"
if (Test-Path "$dst\.git") {
    git -C $dst fetch --depth 1 origin $branch
    # Move HEAD to the freshly fetched tip; a shallow clone has no local branch ref to fast-forward.
    git -C $dst reset --hard FETCH_HEAD
} else {
    if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
    git clone --depth 1 --branch $branch --single-branch $url $dst
}
```

Bash:

```bash
url="<repo URL>"
branch="<branch>"
dst="<dst path, e.g. reference/opencode>"
if [ -d "$dst/.git" ]; then
    git -C "$dst" fetch --depth 1 origin "$branch"
    git -C "$dst" reset --hard FETCH_HEAD
else
    rm -rf "$dst"
    git clone --depth 1 --branch "$branch" --single-branch "$url" "$dst"
fi
```
