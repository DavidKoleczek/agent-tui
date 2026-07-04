import type {
    ClientEvent,
    StreamingEvent,
    UserMessageEvent,
    CancelEvent,
    QuitEvent,
    SessionConfigChangeEvent,
    PermissionChangeEvent,
    TaskPermission,
} from "../../../schemas/activities"
import { settleWithin } from "../lifecycle/wait"
import type { LogFile } from "../session/server-log"
import type { WsLog } from "../session/ws-log"

export interface ConnectAgentWebSocketOptions {
    port: number
    workingDir: string
    sessionDatabase: string
    log: WsLog
    serverLog: LogFile
}

export interface AgentWSClient {
    sessionDatabase: string
    isReady(): boolean
    subscribeReady(listener: () => void): () => void
    subscribeActivities(listener: (activity: StreamingEvent) => void): () => void
    sendUserMessage(content: string): boolean
    sendSessionConfigChange(configKey: string, newValue: string): boolean
    sendPermissionChange(id: string, permission: TaskPermission): boolean
    cancel(): boolean
    quit(): boolean
    warn(message: string): void
    close(): Promise<void>
}

const CLOSE_GRACE_MS = 1_000

// Single, eager websocket connection to agent-server's /agent endpoint.
// Sends are silent no-ops when the socket is not OPEN.
// The UI gates submission via isReady() and we explicitly don't surface "not ready yet" for now
export function connectAgentWebSocket(options: ConnectAgentWebSocketOptions): AgentWSClient {
    const { port, workingDir, sessionDatabase, log, serverLog } = options

    const url = buildUrl(port, workingDir, sessionDatabase)
    const ws = new WebSocket(url)

    // Timestamp of the most recent user send, cleared once the first activity arrives so we record
    // perceived send-to-first-activity latency once per turn.
    let pendingSendAt: number | null = null

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
            if (parsed !== null) {
                if (pendingSendAt !== null) {
                    serverLog.write(`[agent-tui] first activity ${Date.now() - pendingSendAt}ms after send\n`)
                    pendingSendAt = null
                }
                notifyActivity(parsed)
            }
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
        sessionDatabase,
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
            const sent = trySend(activity)
            if (sent) {
                pendingSendAt = Date.now()
                serverLog.write(`[agent-tui] user message sent (chars=${content.length})\n`)
            }
            return sent
        },
        sendSessionConfigChange(configKey, newValue) {
            const activity: SessionConfigChangeEvent = {
                type: "session_config_change",
                config_key: configKey,
                new_value: newValue,
            }
            return trySend(activity)
        },
        sendPermissionChange(id, permission) {
            const activity: PermissionChangeEvent = { type: "permission_change", id, permission }
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
                const closed = new Promise<void>((resolve) => {
                    const prev = ws.onclose
                    ws.onclose = (ev): void => {
                        prev?.call(ws, ev)
                        resolve()
                    }
                })
                await settleWithin(closed, CLOSE_GRACE_MS)
            })()
            return closing
        },
    }
}

function buildUrl(port: number, workingDir: string, sessionDatabase: string): string {
    const params = new URLSearchParams({ working_dir: workingDir, session_database: sessionDatabase })
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
