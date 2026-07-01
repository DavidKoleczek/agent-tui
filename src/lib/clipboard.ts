import { spawn, type ChildProcess } from "node:child_process"

// Writes text to the OS clipboard by piping it to the platform's clipboard tool.
// This is the local fallback for terminals that do not honor the OSC 52 escape.
// It is best-effort and fire-and-forget: a missing tool or spawn failure is swallowed so a copy attempt never disrupts the UI.
export function writeSystemClipboard(text: string): void {
    writeWithCommands(nativeClipboardCommands(), text)
}

// Candidate commands per platform, tried in order until one spawns. Each reads the text from stdin.
// Linux ships no single clipboard tool, so both the Wayland and X11 utilities are attempted.
function nativeClipboardCommands(): ReadonlyArray<readonly string[]> {
    switch (process.platform) {
        case "win32":
            return [["clip"]]
        case "darwin":
            return [["pbcopy"]]
        default:
            return [["wl-copy"], ["xclip", "-selection", "clipboard"]]
    }
}

function writeWithCommands(commands: ReadonlyArray<readonly string[]>, text: string): void {
    const [command, ...rest] = commands
    if (command === undefined) return
    const [cmd, ...args] = command
    if (cmd === undefined) return

    let child: ChildProcess
    try {
        child = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] })
    } catch {
        writeWithCommands(rest, text)
        return
    }
    // A missing executable surfaces asynchronously as an "error" event; fall through to the next candidate.
    child.once("error", () => writeWithCommands(rest, text))
    child.stdin?.on("error", () => {})
    child.stdin?.end(text)
    // Do not let a stuck clipboard tool keep the process alive on exit.
    child.unref()
}
