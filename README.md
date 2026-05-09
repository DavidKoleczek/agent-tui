<h1 align="center">
    agent-tui
</h1>
<p align="center">
    <p align="center">Terminal user interface for AI agents built on <a href="https://github.com/DavidKoleczek/agent-core">agent-core</a>.</p>
</p>
<p align="center">
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
</p>

An AI agent TUI built in Rust.

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

1. Ensure Rust is installed: https://rust-lang.org/tools/install/
    ```bash
    # Update with:
    rustup update
    # Then make sure you have rustfmt and clippy
    rustup component add rustfmt clippy
    ```
1. Run the app:
    ```bash
    cargo run
    ```
1. Format and lint:
    ```bash
    cargo fmt --all
    cargo lint
    ```
1. (Optional) VSCode setup. Open the repo in VSCode and accept the prompt to install the recommended extensions, or run `Extensions: Show Recommended Extensions` from the command palette. The workspace ships with `.vscode/settings.json` that wires up:
    - `rust-analyzer` as the default formatter for `*.rs` files with format-on-save (uses `rustfmt.toml`).
    - `cargo clippy` as the on-save check (`-D warnings`), so lint failures show up in the **Problems** panel and inline via Error Lens.
    - `Even Better TOML` for `Cargo.toml`, `dependi` for crate version hints, and `CodeLLDB` for debugging.
1. Build and run the release executable:
    ```bash
    # Windows (PowerShell)
    cargo build --release; .\target\release\agent-tui.exe
    # Linux
    cargo build --release && ./target/release/agent-tui
    ```
