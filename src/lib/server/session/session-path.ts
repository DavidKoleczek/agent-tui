import { basename, join } from "node:path"

const UNSAFE_NAME_CHARS = /[<>:"/\\|?*\s]/g

// Generates a fresh session database path using the same convention agent-server
export function generateSessionDatabasePath(workingDir: string): string {
    const sanitized = basename(workingDir).replace(UNSAFE_NAME_CHARS, "_")
    const now = new Date()
    const pad = (value: number): string => String(value).padStart(2, "0")
    const dateStr =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const shortUuid = crypto.randomUUID().slice(0, 8)
    return join(workingDir, ".agents", "sessions", `${sanitized}_${dateStr}_${shortUuid}.sqlite`)
}
