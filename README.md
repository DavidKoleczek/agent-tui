<h1 align="center">
    agent-tui
</h1>
<p align="center">
    <p align="center">An AI agent TUI named Floppy built using <a href="https://github.com/DavidKoleczek/agent-server">agent-server</a>, <a href="https://github.com/DavidKoleczek/interop-router">interop-router</a>, and <a href="https://github.com/anomalyco/opentui/">OpenTUI</a></p>
</p>
<p align="center">
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>


> [!NOTE]
> This library is in early development and subject to change.


## Installation

Supported platforms are Windows and Linux x64.

Powershell (Windows):

```powershell
irm https://github.com/DavidKoleczek/agent-tui/releases/latest/download/install.ps1 | iex
```

Linux:

```bash
curl -fsSL https://github.com/DavidKoleczek/agent-tui/releases/latest/download/install.sh | bash
```

## Usage

Launch with `floppy`!

```bash
# Resume an existing conversation in the current directory
floppy --resume
```

### Shift+Enter for Newlines on Windows Terminal

By default, not all Windows terminals send modifier keys with Enter by default. You may need to configure your terminal to send Shift+Enter as an escape sequence.

Open `settings.json` at:

```
%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json
```

Add this entry to the root-level `actions` array:

```json
{
    "command": {
        "action": "sendInput",
        "input": "\u001b[13;2u"
    },
    "id": "User.sendInput.ShiftEnter"
}
```

Add this entry to the root-level `keybindings` array:

```json
{
    "keys": "shift+enter",
    "id": "User.sendInput.ShiftEnter"
}
```

Save and restart Windows Terminal or open a new tab.


## Uninstall

Quit any running instances, then run:

```bash
floppy uninstall --yes
```

## Development

### Prerequisites

- [bun](https://github.com/oven-sh/bun)

### Install

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

To validate changes (typecheck, format, lint):

```bash
bun run check
```

To auto-fix formatting and lint issues:

```bash
bun run fmt
bun run lint:fix
```

### Recommended VSCode extensions

Open the repo in VSCode and accept the workspace recommendations, or install manually:

- `oxc.oxc-vscode` for `oxlint` diagnostics and `oxfmt` formatting
- `EditorConfig.EditorConfig` for `.editorconfig` support
- `oven.bun-vscode` for the Bun runtime and debugger

### Agent Hooks

`.github/hooks/hooks.json` registers an `agentStop` hook that runs `.github/hooks/agent-stop.ts` after every agent turn. 
The script runs `bun run fmt`, `bun run lint:fix`, and `bun run check` in order. If any step fails, the hook emits a `block` decision so the failing output is fed back to the agent as a new turn for it to fix before yielding.
