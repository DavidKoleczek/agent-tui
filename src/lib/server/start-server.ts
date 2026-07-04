import { PINNED_VERSIONS } from "../versions"
import { connectAgentWebSocket, type AgentWSClient } from "./agent"
import {
    ensureAgentServer,
    pickFreePort,
    resolveUv,
    spawnAgentServer,
    type ServerProcess,
    waitForHealthz,
} from "./lifecycle"
import { createLogFile, createWsLog, generateSessionDatabasePath, type LogFile, type WsLog } from "./session"

export interface ServerHandle {
    // Resolves with the live process.
    process: Promise<ServerProcess | null>
    // Resolves with the websocket client for the initial (new) session once /healthz is ready and the socket
    // constructor has been called, or null if the server never reached the ready state.
    // Resolution does not imply the socket is OPEN. Consumers must observe `isReady()` for that.
    ws: Promise<AgentWSClient | null>
    // Directory the server is operating in. Needed when resuming a session.
    workingDir: string
    // Base URL for the server's HTTP endpoints (e.g. /resume), or null until the server is ready.
    httpBaseUrl(): string | null
    // Opens a fresh websocket connection, optionally bound to an existing session database to resume it.
    // The previously active client (if any) is closed first so only one socket is live at a time.
    // Returns null if the server is not ready yet.
    createClient(sessionDatabase?: string): AgentWSClient | null
    // Idempotent. Awaits startup (if still in-flight), closes the active websocket, kills the process, and flushes both log files.
    stop(): Promise<void>
    // Path of the per-session server-stdout log file, exposed for diagnostics.
    logPath: string
    // Path of the per-session websocket transcript log file, exposed for diagnostics.
    wsLogPath: string
}

// Boots the agent-server lifecycle without blocking the caller.
// Errors during resolution, spawn, or health check are caught and recorded in the per-session log
export function startServer(cwd: string = process.cwd()): ServerHandle {
    const startedAt = Date.now()
    const sinceStart = (): number => Date.now() - startedAt

    const log: LogFile = createLogFile(cwd)
    const wsLog: WsLog = createWsLog(cwd)

    let stopping: Promise<void> | null = null
    // Set once the server is healthy; gates HTTP base URL and websocket (re)connection.
    let serverPort: number | null = null
    // The single live websocket client. Swapped out by createClient and closed by stop().
    let currentClient: AgentWSClient | null = null

    const connect = (sessionDatabase?: string): AgentWSClient | null => {
        if (serverPort === null) return null
        if (currentClient !== null) {
            const previous = currentClient
            currentClient = null
            void previous.close()
        }
        // A new session gets a freshly generated path and can reuse it for the session-config HTTP endpoints
        // resume passes the existing database path through unchanged.
        const client = connectAgentWebSocket({
            port: serverPort,
            workingDir: cwd,
            sessionDatabase: sessionDatabase ?? generateSessionDatabasePath(cwd),
            log: wsLog,
            serverLog: log,
        })
        currentClient = client
        return client
    }

    let resolveWs: (value: AgentWSClient | null) => void = () => {}
    const wsPromise: Promise<AgentWSClient | null> = new Promise((resolve) => {
        resolveWs = resolve
    })

    const processPromise: Promise<ServerProcess | null> = (async () => {
        try {
            const uvStartedAt = Date.now()
            const uv = await resolveUv()
            log.write(
                `[agent-tui] uv resolved: ${uv.path} (source=${uv.source}, version=${uv.version}) ` +
                    `in ${Date.now() - uvStartedAt}ms\n`,
            )

            const ensureStartedAt = Date.now()
            const agentServer = await ensureAgentServer({ uvPath: uv.path, log })
            log.write(
                `[agent-tui] agent-server ${agentServer.source} (sha=${PINNED_VERSIONS.agentServer}) ` +
                    `entryPoint=${agentServer.entryPoint} in ${Date.now() - ensureStartedAt}ms\n`,
            )

            const portStartedAt = Date.now()
            const port = await pickFreePort()
            log.write(`[agent-tui] free port ${port} picked in ${Date.now() - portStartedAt}ms\n`)
            const proc = spawnAgentServer({ entryPoint: agentServer.entryPoint, port, cwd, log })

            const health = await waitForHealthz({ port })
            if (health.ok) {
                log.write(`[agent-tui] healthz ready after ${health.elapsedMs}ms (attempts=${health.attempts})\n`)
                try {
                    serverPort = port
                    log.write(`[agent-tui] ws_log=${wsLog.path}\n`)
                    const client = connect()
                    if (client !== null) {
                        // The socket opening is the moment the TUI can first send a message; log it with total elapsed from start.
                        let readyLogged = false
                        const stopReadyLog = client.subscribeReady(() => {
                            if (readyLogged || !client.isReady()) return
                            readyLogged = true
                            log.write(`[agent-tui] ready to send (websocket open) ${sinceStart()}ms after start\n`)
                            stopReadyLog()
                        })
                    }
                    resolveWs(client)
                } catch (err) {
                    log.write(`[agent-tui] ws connect failed: ${(err as Error).stack ?? (err as Error).message}\n`)
                    resolveWs(null)
                }
            } else {
                log.write(
                    `[agent-tui] healthz timed out after ${health.elapsedMs}ms (attempts=${health.attempts}, ` +
                        `lastStatus=${health.lastStatus ?? "n/a"}, lastError=${health.lastError ?? "n/a"})\n`,
                )
                resolveWs(null)
            }
            return proc
        } catch (err) {
            log.write(`[agent-tui] startup failed: ${(err as Error).stack ?? (err as Error).message}\n`)
            resolveWs(null)
            return null
        }
    })()

    const stop = (): Promise<void> => {
        if (stopping !== null) return stopping
        stopping = (async () => {
            const proc = await processPromise
            // Ensure the initial connection attempt has settled before tearing down.
            await wsPromise
            if (currentClient !== null) {
                await currentClient.close()
                currentClient = null
            }
            if (proc !== null) {
                await proc.kill()
            }
            await wsLog.close()
            await log.close()
        })()
        return stopping
    }

    return {
        process: processPromise,
        ws: wsPromise,
        workingDir: cwd,
        httpBaseUrl: () => (serverPort === null ? null : `http://127.0.0.1:${serverPort}`),
        createClient: (sessionDatabase) => connect(sessionDatabase),
        stop,
        logPath: log.path,
        wsLogPath: wsLog.path,
    }
}
