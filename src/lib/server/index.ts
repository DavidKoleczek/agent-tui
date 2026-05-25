import { waitForHealthz } from "./health"
import { createLogFile, type LogFile } from "./log-file"
import { pickFreePort } from "./port"
import { spawnAgentServer, type ServerProcess } from "./spawn"
import { resolveUv } from "./uv"

export interface ServerHandle {
    // Resolves with the live process once spawn succeeds, or null if startup failed.
    // Failures never reject; all errors are written to the log file.
    process: Promise<ServerProcess | null>
    // Idempotent. Awaits process startup (if still in-flight), kills it, and flushes
    // the log file. Safe to call from multiple cleanup paths concurrently.
    stop(): Promise<void>
    // Path of the per-session log file, exposed for diagnostics.
    logPath: string
}

// Boots the agent-server lifecycle without blocking the caller. Errors during
// resolution, spawn, or health check are caught and recorded in the per-session
// log; the TUI keeps running regardless, matching the agreed failure policy.
export function startServer(cwd: string = process.cwd()): ServerHandle {
    const log: LogFile = createLogFile(cwd)

    let stopping: Promise<void> | null = null

    const processPromise: Promise<ServerProcess | null> = (async () => {
        try {
            const uv = await resolveUv()
            log.write(`[agent-tui] uv resolved: ${uv.path} (source=${uv.source}, version=${uv.version})\n`)

            const port = await pickFreePort()
            const proc = spawnAgentServer({ uvPath: uv.path, port, cwd, log })

            const health = await waitForHealthz({ port })
            if (health.ok) {
                log.write(`[agent-tui] healthz ready after ${health.elapsedMs}ms (attempts=${health.attempts})\n`)
            } else {
                log.write(
                    `[agent-tui] healthz timed out after ${health.elapsedMs}ms (attempts=${health.attempts}, ` +
                        `lastStatus=${health.lastStatus ?? "n/a"}, lastError=${health.lastError ?? "n/a"})\n`,
                )
            }
            return proc
        } catch (err) {
            log.write(`[agent-tui] startup failed: ${(err as Error).stack ?? (err as Error).message}\n`)
            return null
        }
    })()

    const stop = (): Promise<void> => {
        if (stopping !== null) return stopping
        stopping = (async () => {
            const proc = await processPromise
            if (proc !== null) {
                await proc.kill()
            }
            await log.close()
        })()
        return stopping
    }

    return {
        process: processPromise,
        stop,
        logPath: log.path,
    }
}
