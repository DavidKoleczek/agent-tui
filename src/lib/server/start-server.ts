import { connectAgentWebSocket, type AgentWSClient } from "./agent"
import { pickFreePort, resolveUv, spawnAgentServer, type ServerProcess, waitForHealthz } from "./lifecycle"
import { createLogFile, createWsLog, resolveChatFile, type LogFile, type WsLog } from "./session"

export interface ServerHandle {
    // Resolves with the live process once spawn succeeds, or null if startup failed.
    // Failures never reject; all errors are written to the log file.
    process: Promise<ServerProcess | null>
    // Resolves with the websocket client once /healthz is ready and the socket constructor has been called,
    // or null if the server never reached the ready state.
    // Resolution does not imply the socket is OPEN. Consumers must observe `isReady()` for that.
    ws: Promise<AgentWSClient | null>
    // Idempotent. Awaits startup (if still in-flight), closes the websocket, kills the process, and flushes both log files.
    // Safe to call from multiple cleanup paths concurrently.
    stop(): Promise<void>
    // Path of the per-session server-stdout log file, exposed for diagnostics.
    logPath: string
    // Path of the per-session websocket transcript log file, exposed for diagnostics.
    wsLogPath: string
}

// Boots the agent-server lifecycle without blocking the caller.
// Errors during resolution, spawn, or health check are caught and recorded in the per-session log
export function startServer(cwd: string = process.cwd()): ServerHandle {
    const log: LogFile = createLogFile(cwd)
    const wsLog: WsLog = createWsLog(cwd)

    let stopping: Promise<void> | null = null

    let resolveWs: (value: AgentWSClient | null) => void = () => {}
    const wsPromise: Promise<AgentWSClient | null> = new Promise((resolve) => {
        resolveWs = resolve
    })

    const processPromise: Promise<ServerProcess | null> = (async () => {
        try {
            const uv = await resolveUv()
            log.write(`[agent-tui] uv resolved: ${uv.path} (source=${uv.source}, version=${uv.version})\n`)

            const port = await pickFreePort()
            const proc = spawnAgentServer({ uvPath: uv.path, port, cwd, log })

            const health = await waitForHealthz({ port })
            if (health.ok) {
                log.write(`[agent-tui] healthz ready after ${health.elapsedMs}ms (attempts=${health.attempts})\n`)
                try {
                    const chatFile = resolveChatFile(cwd)
                    log.write(`[agent-tui] chat_file=${chatFile}\n`)
                    log.write(`[agent-tui] ws_log=${wsLog.path}\n`)
                    const client = connectAgentWebSocket({
                        port,
                        workingDir: cwd,
                        chatFile,
                        log: wsLog,
                    })
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
            const [proc, ws] = await Promise.all([processPromise, wsPromise])
            if (ws !== null) {
                await ws.close()
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
        stop,
        logPath: log.path,
        wsLogPath: wsLog.path,
    }
}
