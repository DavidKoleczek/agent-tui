import { randomUUID } from "node:crypto"
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs"
import { join } from "node:path"
import { DATA_ROOT } from "../../constants"
import { platform } from "../lifecycle/platform"

// Flattens an absolute working directory into a single filesystem-safe folder name,
// so every log produced for that directory is collected in one place.
// Ex: "C:\Repos\Prod\dev-tools" becomes "repos-prod-dev-tools".
// A Windows drive designator ("C:") and empty segments are dropped;
// each remaining segment is lowercased with any run of non-alphanumeric characters collapsed to a single hyphen.
// Falls back to "root" for a path with no usable segments.
export function workingDirSlug(cwd: string): string {
    const segments = cwd
        .split(/[\\/]+/)
        .filter((segment) => segment.length > 0 && !/^[a-zA-Z]:$/.test(segment))
        .map((segment) =>
            segment
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, ""),
        )
        .filter((segment) => segment.length > 0)
    return segments.length > 0 ? segments.join("-") : "root"
}

// Builds a unique, lexically sortable log file name, e.g. "agent-ws-20260701-142530-1a2b3c4d.jsonl".
export function logFileName(prefix: string, extension: string): string {
    return `${prefix}-${formatTimestamp(new Date())}-${randomUUID().slice(0, 8)}.${extension}`
}

// Opens an append-only log stream under `.agents/logs/<working-dir-slug>/` in the user's home directory.
// Falls back to the platform cache root when the home directory rejects mkdir.
export function openLogStream(cwd: string, fileName: string): { path: string; stream: WriteStream } {
    const slug = workingDirSlug(cwd)
    const primary = join(DATA_ROOT, "logs", slug)
    const fallback = join(platform.uv.cacheRoot, "agent-tui", "logs", slug)

    const opened = tryOpen(primary, fileName) ?? tryOpen(fallback, fileName)
    if (opened === null) {
        throw new Error(`Failed to open log file "${fileName}". Tried ${primary} and ${fallback}.`)
    }
    return opened
}

function formatTimestamp(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, "0")
    return (
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
        `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    )
}

function tryOpen(dir: string, fileName: string): { path: string; stream: WriteStream } | null {
    try {
        mkdirSync(dir, { recursive: true })
        const path = join(dir, fileName)
        const stream = createWriteStream(path, { flags: "a" })
        return { path, stream }
    } catch {
        return null
    }
}
