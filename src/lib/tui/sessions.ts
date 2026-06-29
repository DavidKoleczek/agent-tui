import { Database } from "bun:sqlite"
import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

// region: Discovery

// A session database on disk, discovered without opening it. `modifiedMs` comes from the OS so listing stays fast;
// the conversation preview is loaded separately and only for the page being shown.
export interface SessionFile {
    path: string
    fileName: string
    modifiedMs: number
}

const SESSIONS_SUBDIR = join(".agents", "sessions")
const SQLITE_EXTENSION = ".sqlite"

// Lists session databases in `<cwd>/.agents/sessions`, newest first by OS modified time.
// Returns an empty list when the directory does not exist yet.
export function listSessionFiles(cwd: string = process.cwd()): SessionFile[] {
    const sessionsDir = join(cwd, SESSIONS_SUBDIR)

    let entries: string[]
    try {
        entries = readdirSync(sessionsDir)
    } catch {
        // Directory absent (no sessions created yet) or unreadable; treat both as "nothing to resume".
        return []
    }

    const files: SessionFile[] = []
    for (const entry of entries) {
        if (!entry.endsWith(SQLITE_EXTENSION)) continue
        const path = join(sessionsDir, entry)
        try {
            const stats = statSync(path)
            if (!stats.isFile()) continue
            files.push({ path, fileName: entry, modifiedMs: stats.mtimeMs })
        } catch {
            // A file that vanished or cannot be stat'd between readdir and stat is simply skipped.
            continue
        }
    }

    files.sort((a, b) => b.modifiedMs - a.modifiedMs)
    return files
}

// endregion

// region: Preview

// A session row ready to display: discovery metadata plus the conversation's last user-typed message.
export interface SessionPreview {
    path: string
    fileName: string
    modifiedMs: number
    // The most recent human message, single-line and truncated.
    // Null when the session has no such message or its database could not be read.
    lastUserMessage: string | null
}

const DEFAULT_MAX_PREVIEW_CHARS = 80

// Human-typed messages are persisted in `chat_messages` with `created_by = 'user'`. That bucket also holds tool
// outputs (function_call_output) which are role-less, so we additionally require `message.role = 'user'` to isolate
// the messages a person actually typed. Agent activities live in the separate `activities` table and are not used here.
const LAST_USER_MESSAGE_QUERY = `
    SELECT chat_message FROM chat_messages
    WHERE created_by = 'user' AND json_extract(chat_message, '$.message.role') = 'user'
    ORDER BY position DESC
    LIMIT 1
`

interface ChatMessageRow {
    chat_message: string
}

// Reads the most recent human message from a single session database. Synchronous (bun:sqlite is synchronous) but
// kept async so callers can fan out across a page of sessions with `Promise.all`. Never throws: a database that is
// missing, locked, or malformed yields a null `lastUserMessage` rather than failing the whole list.
export async function readSessionPreview(
    file: SessionFile,
    maxChars: number = DEFAULT_MAX_PREVIEW_CHARS,
): Promise<SessionPreview> {
    const base: SessionPreview = {
        path: file.path,
        fileName: file.fileName,
        modifiedMs: file.modifiedMs,
        lastUserMessage: null,
    }

    let database: Database | null = null
    try {
        database = new Database(file.path, { readonly: true })
        const row = database.query(LAST_USER_MESSAGE_QUERY).get() as ChatMessageRow | null
        if (row === null) return base

        const content = extractContent(row.chat_message)
        return { ...base, lastUserMessage: content === null ? null : truncateSingleLine(content, maxChars) }
    } catch {
        return base
    } finally {
        database?.close()
    }
}

// Loads previews for many sessions concurrently. Used to populate a single page of the picker.
export function readSessionPreviews(files: readonly SessionFile[], maxChars?: number): Promise<SessionPreview[]> {
    return Promise.all(files.map((file) => readSessionPreview(file, maxChars)))
}

function extractContent(chatMessageJson: string): string | null {
    try {
        const parsed: unknown = JSON.parse(chatMessageJson)
        const message = (parsed as { message?: unknown }).message
        if (typeof message !== "object" || message === null) return null

        const content = (message as { content?: unknown }).content
        if (typeof content === "string") return content
        if (Array.isArray(content)) {
            // The message may be an array of typed parts; concatenate any text parts.
            const parts = content
                .map((part) =>
                    typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : null,
                )
                .filter((text): text is string => text !== null)
            return parts.length === 0 ? null : parts.join(" ")
        }
        return null
    } catch {
        return null
    }
}

function truncateSingleLine(text: string, maxChars: number): string {
    const collapsed = text.replace(/\s+/g, " ").trim()
    if (collapsed.length <= maxChars) return collapsed
    return `${collapsed.slice(0, Math.max(0, maxChars - 1))}...`
}

// endregion

// region: Formatting

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// Formats a past timestamp as a short, human-friendly "time ago" label (e.g. "just now", "5m ago", "3d ago").
// Falls back to a locale date for anything older than a week so old sessions still read clearly.
export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
    const elapsed = nowMs - timestampMs
    if (elapsed < MINUTE_MS) return "just now"
    if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m ago`
    if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h ago`
    if (elapsed < 7 * DAY_MS) return `${Math.floor(elapsed / DAY_MS)}d ago`
    return new Date(timestampMs).toLocaleDateString()
}

// endregion
