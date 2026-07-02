import { logFileName, openLogStream } from "./log-location"

export interface WsLog {
    path: string
    sent(text: string): void
    recv(text: string): void
    warn(message: string): void
    close(): Promise<void>
}

// Per-session websocket transcript log.
export function createWsLog(cwd: string): WsLog {
    const opened = openLogStream(cwd, logFileName("agent-ws", "jsonl"))
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

    const line = (record: Record<string, unknown>): string => `${JSON.stringify(record)}\n`

    const format = (direction: "sent" | "recv", text: string): string => {
        const time = new Date().toISOString()
        try {
            return line({ time, direction, payload: JSON.parse(text) })
        } catch {
            return line({ time, direction, raw: text })
        }
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
            enqueue(line({ time: new Date().toISOString(), direction: "warn", message }))
        },
        close: async () => {
            await chain
            await new Promise<void>((resolve) => stream.end(() => resolve()))
        },
    }
}
