import { randomUUID } from "node:crypto"
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs"
import { join } from "node:path"
import { platform } from "../lifecycle/platform"

export interface WsLog {
    path: string
    sent(text: string): void
    recv(text: string): void
    warn(message: string): void
    close(): Promise<void>
}

// Per-session websocket transcript log.
export function createWsLog(cwd: string): WsLog {
    const fileName = `agent-ws-${formatTimestamp(new Date())}-${randomUUID().slice(0, 8)}.log`
    const primary = join(cwd, ".agents", "logs")
    const fallback = join(platform.uv.cacheRoot, "agent-tui", "logs")

    const opened = tryOpen(primary, fileName) ?? tryOpen(fallback, fileName)
    if (opened === null) {
        throw new Error(`Failed to open agent-ws log file. Tried ${primary} and ${fallback}.`)
    }

    const stream = opened.stream
    let chain: Promise<void> = Promise.resolve()

    const enqueue = (payload: string): void => {
        chain = chain.then(
            () =>
                new Promise<void>((resolve) => {
                    if (stream.write(payload)) {
                        resolve()
                    } else {
                        stream.once("drain", () => resolve())
                    }
                }),
        )
    }

    const format = (direction: "sent" | "recv", text: string): string => {
        const marker = direction === "sent" ? ">> sent" : "<< recv"
        const header = `${new Date().toISOString()} ${marker}`
        let body: string
        try {
            body = JSON.stringify(JSON.parse(text), null, 2)
        } catch {
            body = `${text} (unparsed)`
        }
        return `${header}\n${body}\n\n`
    }

    return {
        path: opened.path,
        sent(text) {
            enqueue(format("sent", text))
        },
        recv(text) {
            enqueue(format("recv", text))
        },
        warn(message) {
            enqueue(`${new Date().toISOString()} !! warn\n${message}\n\n`)
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
