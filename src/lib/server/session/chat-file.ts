import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { basename, join } from "node:path"

export function resolveChatFile(cwd: string): string {
    const sessionsDir = join(cwd, ".agents", "sessions")
    mkdirSync(sessionsDir, { recursive: true })

    const dirName = basename(cwd)
    const sanitized = dirName.replace(/[<>:"/\\|?*\s]/g, "_")
    const timestamp = formatTimestamp(new Date())
    const shortUuid = randomUUID().slice(0, 8)

    return join(sessionsDir, `${sanitized}_${timestamp}_${shortUuid}.json`)
}

function formatTimestamp(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, "0")
    return (
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
        `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    )
}
