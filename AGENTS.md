# General Instructions

Agent TUI is a product and any development of it must have the highest standards of quality, security, and reliability.

- Shortcuts are not appropriate. When in doubt, you must work with the user for guidance.
- Any documentation you write, including in the README.md, should be clear, concise, and accurate like the official documentation of other production-grade applications.
- Don't generate characters that a user could not type on a standard keyboard like fancy arrows within regular code or documentation.
- Any *new* comments should be necessary (do not driveby remove existing comments). A necessary comment captures intent that cannot be encoded in names, types, or structure. They should concisely describe the "why", only used to record rationale, trade-offs, links to specs/papers, or non-obvious domain insights. They should add signal that code cannot.
- Prefer "soft-wrap" for prose comments. Split up lines at natural breaking points at around 120 characters. Hard wraps tend to break mid-clause and look mechanical, and they create noisy diffs whenever the prose changes. Generally keep your comments in the style of the others in the project.
- The current code in the package should be treated as an example of high quality code. Make sure to follow its style and tackle issues in similar ways where appropriate.
- Don't generate characters that a user could not type on a standard keyboard like fancy arrows.
- Anything is possible. Do not blame external factors after something doesn't work on the first try. Instead, investigate and test assumptions through debugging through first principles.
- When writing documentation
  - Keep it very concise
  - No emojis or em dashes.
  - Documentation should be written exactly like it is for production-grade, polished projects.
  - Please do not use tables unless asked for or they are absolutely the right choice.
- Prefer to ask the user more questions to clarify their needs.
- NEVER store or update memories.
- New features should be continually organized in directories and files. We want things to be modular, so if a piece does not work well its easy to replace. Files like `index.tsx` should remain small when possible.


# Development Stage

Starting to build up the UX


# Development Environment

- Assume that everything is being tested in PowerShell and Windows Terminal first class. With support for inside VSCode as a close second.
- Assume that everything needs to work on Windows 10/11 as first class
- Performance is critical to make sure rendering and scrolling are fast across all terminals.


# Key Files

@README.md

reference/ includes the source code for key libraries as a reference:
- `opentui`
- `opencode`
- `awesome-opentui`

OpenTUI Docs
- The docs that power https://opentui.com/docs (https://opentui.com/docs) live at: `reference\opentui\packages\web\src\content\docs\`
- Also start by using the opentui skill.
