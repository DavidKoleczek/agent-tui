import type { CancelActivity, ClientActivity, QuitActivity, UserActivity } from "../../schemas/activities"
import type { WsLog } from "./ws-log"

export interface ConnectAgentWebSocketOptions {
    port: number
    workingDir: string
    chatFile: string
    log: WsLog
}

export interface WsClient {
    isReady(): boolean
    subscribeReady(listener: () => void): () => void
    sendUserMessage(content: string): boolean
    cancel(): boolean
    quit(): boolean
    close(): Promise<void>
}

const CLOSE_GRACE_MS = 1_000

// Single, eager websocket connection to agent-server's /agent endpoint.
// Sends are silent no-ops when the socket is not OPEN.
// The UI gates submission via isReady() and we explicitly don't surface "not ready yet" for now
export function connectAgentWebSocket(options: ConnectAgentWebSocketOptions): WsClient {
    const { port, workingDir, chatFile, log } = options

    const url = buildUrl(port, workingDir, chatFile)
    const ws = new WebSocket(url)

    const readyListeners = new Set<() => void>()
    const notifyReady = (): void => {
        for (const listener of readyListeners) listener()
    }

    ws.onopen = (): void => {
        notifyReady()
    }
    ws.onclose = (): void => {
        notifyReady()
    }
    ws.onerror = (): void => {
        // The browser-style WebSocket fires `error` then `close`; the close handler is the
        // single source of truth for ready-state changes, so this is intentionally a no-op
        // beyond letting the close handler propagate.
    }
    ws.onmessage = (event: MessageEvent): void => {
        if (typeof event.data === "string") {
            log.recv(event.data)
        } else {
            log.recv("(binary frame omitted)")
        }
    }

    const trySend = (activity: ClientActivity): boolean => {
        if (ws.readyState !== WebSocket.OPEN) return false
        const text = JSON.stringify(activity)
        ws.send(text)
        log.sent(text)
        return true
    }

    let closing: Promise<void> | null = null

    return {
        isReady: () => ws.readyState === WebSocket.OPEN,
        subscribeReady(listener) {
            readyListeners.add(listener)
            return () => {
                readyListeners.delete(listener)
            }
        },
        sendUserMessage(content) {
            const activity: UserActivity = { type: "user_message", content }
            return trySend(activity)
        },
        cancel() {
            const activity: CancelActivity = { type: "cancel" }
            return trySend(activity)
        },
        quit() {
            const activity: QuitActivity = { type: "quit" }
            return trySend(activity)
        },
        close: () => {
            if (closing !== null) return closing
            closing = (async () => {
                if (ws.readyState === WebSocket.CLOSED) return
                if (ws.readyState !== WebSocket.CLOSING) ws.close()
                await Promise.race([
                    new Promise<void>((resolve) => {
                        const prev = ws.onclose
                        ws.onclose = (ev): void => {
                            prev?.call(ws, ev)
                            resolve()
                        }
                    }),
                    new Promise<void>((resolve) => setTimeout(resolve, CLOSE_GRACE_MS)),
                ])
            })()
            return closing
        },
    }
}

function buildUrl(port: number, workingDir: string, chatFile: string): string {
    const params = new URLSearchParams({ working_dir: workingDir, chat_file: chatFile })
    return `ws://127.0.0.1:${port}/agent?${params.toString()}`
}
