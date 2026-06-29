---
name: update-dependencies
description: Updates project dependencies, validates them, and then updates the reference repositories under reference/.
disable-model-invocation: true
---

When this command is invoked, run the following two sections to make sure the project is up to date and ready for development.

# Project Dependency Update

NOTE: Bash should be (nearly) identical.

1. Make sure the current lockfile and checks pass
```powershell
bun install --frozen-lockfile
bun run check
```

2. Discover and audit outdated dependencies
```powershell
bun outdated
bun audit
```

3. Bump caret-ranged dependencies.
```powershell
bun update
```

4. Bump the OpenTUI trio (exact, all three together).
```powershell
bun add -E @opentui/core@<v> @opentui/keymap@<v> @opentui/react@<v>
```

5. Bump oxlint and/or oxfmt (exact).
```powershell
bun add -d -E oxlint@<v>
bun add -d -E oxfmt@<v>
```

6. Validate
```powershell
bun install --frozen-lockfile
bun run check
bun audit
```

7. Update the user
- If at any point something major changes or there are a lot of new issues, pause and alert the user.
  - Do some due dilligence for the user so they understand factually what happened, such as by exploring the source code and going to release notes:
    - OpenTUI: https://github.com/anomalyco/opentui/releases
    - oxlint and oxfmt: https://github.com/oxc-project/oxc/releases
- Do not update to major versions, like from 0.x to 1.x or 5.x to 6.x. Instead raise those to the user and they will decide.


# Reference Repos Update

Keeps `reference/<repo>` in sync with the upstream version this project depends on. Run all commands from the repo root. All clones are shallow (`--depth 1 --single-branch`).

Repos:
- `reference/opentui` from https://github.com/anomalyco/opentui at tag `v<version>` of `@opentui/core` (read from `package.json`).
- `reference/opencode` from https://github.com/anomalyco/opencode at branch `dev` (the default; no `main` exists).
- `reference/awesome-opentui` from https://github.com/msmps/awesome-opentui at branch `main`.
- `reference/agent-server` from https://github.com/DavidKoleczek/agent-server at branch `main`.

### opentui

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

### Other Repos

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
