import type { ClientEvent, StreamingEvent, UserMessageEvent, CancelEvent, QuitEvent } from "../../schemas/activities"
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
    subscribeActivities(listener: (activity: StreamingEvent) => void): () => void
    sendUserMessage(content: string): boolean
    cancel(): boolean
    quit(): boolean
    warn(message: string): void
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
    const streamingListeners = new Set<(activity: StreamingEvent) => void>()
    const notifyReady = (): void => {
        for (const listener of readyListeners) listener()
    }
    const notifyActivity = (activity: StreamingEvent): void => {
        for (const listener of streamingListeners) listener(activity)
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
            const parsed = tryParseActivity(event.data)
            if (parsed !== null) notifyActivity(parsed)
        } else {
            log.recv("(binary frame omitted)")
        }
    }

    const trySend = (activity: ClientEvent): boolean => {
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
        subscribeActivities(listener) {
            streamingListeners.add(listener)
            return () => {
                streamingListeners.delete(listener)
            }
        },
        sendUserMessage(content) {
            const activity: UserMessageEvent = { type: "user_message", content }
            return trySend(activity)
        },
        cancel() {
            const activity: CancelEvent = { type: "cancel" }
            return trySend(activity)
        },
        quit() {
            const activity: QuitEvent = { type: "quit" }
            return trySend(activity)
        },
        warn(message) {
            log.warn(message)
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

// Minimal duck-typed validation: enough to filter obvious junk frames without dragging in a runtime validator.
// The reducer downstream only branches on `activity.type`; everything else stays opaque until we actually consume it.
function tryParseActivity(raw: string): StreamingEvent | null {
    try {
        const obj = JSON.parse(raw)
        if (typeof obj !== "object" || obj === null) return null
        if (typeof (obj as { type?: unknown }).type !== "string") return null
        return obj as StreamingEvent
    } catch {
        return null
    }
}
