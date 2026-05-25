import { randomUUID } from "node:crypto"
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs"
import { join } from "node:path"
import { platform } from "./platform"

export interface LogFile {
    path: string
    write(text: string): void
    close(): Promise<void>
}

// Opens an append-only log file under `<cwd>/.agents/logs/`,
// falling back to `<platform.uv.cacheRoot>/agent-tui/logs/` if the working directory is read-only or otherwise rejects mkdir.
// Writes are serialized through a promise chain so the two stdio streams that
// share this writer never interleave a partial line and `close()` can await an actual flush.
export function createLogFile(cwd: string): LogFile {
    const fileName = `agent-server-${formatTimestamp(new Date())}-${randomUUID().slice(0, 8)}.log`
    const primary = join(cwd, ".agents", "logs")
    const fallback = join(platform.uv.cacheRoot, "agent-tui", "logs")

    const opened = tryOpen(primary, fileName) ?? tryOpen(fallback, fileName)
    if (opened === null) {
        throw new Error(`Failed to open agent-server log file. Tried ${primary} and ${fallback}.`)
    }

    const stream = opened.stream
    let chain: Promise<void> = Promise.resolve()

    return {
        path: opened.path,
        write(text) {
            chain = chain.then(
                () =>
                    new Promise<void>((resolve) => {
                        if (stream.write(text)) {
                            resolve()
                        } else {
                            stream.once("drain", () => resolve())
                        }
                    }),
            )
        },
        close: async () => {
            await chain
            await new Promise<void>((resolve) => stream.end(() => resolve()))
        },
    }
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
