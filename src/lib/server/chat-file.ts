import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { basename, join } from "node:path"

// Mirrors agent-server's `_resolve_chat_file` so the TUI can hand the server a chat-file path it controls.
// Sanitization regex matches Python's `re.sub(r'[<>:"/\\|?*\s]', "_", name)`.
export function resolveChatFile(cwd: string): string {
    const sessionsDir = join(cwd, ".agents", "sessions")
    mkdirSync(sessionsDir, { recursive: true })

    const dirName = basename(cwd)
    const sanitized = dirName.replace(/[<>:"/\\|?*\s]/g, "_")
    const date = formatDate(new Date())
    const shortUuid = randomUUID().slice(0, 8)

    return join(sessionsDir, `${sanitized}_${date}_${shortUuid}.json`)
}

function formatDate(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
