<h1 align="center">
    agent-tui
</h1>
<p align="center">
    <p align="center">Terminal user interface for AI agents built on <a href="https://github.com/DavidKoleczek/agent-core">agent-core</a>.</p>
</p>
<p align="center">
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

An AI agent TUI built using OpenTUI.

> [!NOTE]
> This library is in early development and subject to change.


## List of Features

These are the features at I view as necessary for moving over my development.

- First class Windows support
- Skills: .github/skills, .claude/skills, or .agents/skills
- Multiple models, with seamless swap in the middle of the conversation
- Bash tool that handles background tasks well
  - General system for spawning background tasks that live in the context
- Seamless stop, resume, and steering
- Computer use mode
- Conversations as files, knows how to explore
- Bypass permissions is the default mode, with smart restrictions
- Defining subagents, which can be run in parallel
  - Ability to choose what context is passed (just from caller, last x messages, full history)
- Infinite chat by default
- Good plan mode
- Verifier "mode" - define criteria, and it iterates until its done
- Teacher mode - does not implement, but instead explains.
- Built in file type handling for the read tool: pdf, docx, excel, etc
- Continual chat title refinement
- Integration with different apps (like Fusion) - App interaction protocol


## Development

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
