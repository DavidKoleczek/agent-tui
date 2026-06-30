import type { LogFile } from "../session/server-log"
import { pipeStream } from "./pipe-stream"
import { platform } from "./platform"
import { uvSandboxEnv } from "./uv"
import { settleWithin } from "./wait"

export interface SpawnAgentServerOptions {
    // Absolute path to the installed agent-server entry point (see ensureAgentServer).
    entryPoint: string
    port: number
    cwd: string
    log: LogFile
}

export interface ServerProcess {
    pid: number
    port: number
    exited: Promise<number>
    kill(): Promise<void>
}

const KILL_GRACE_MS = 3_000

function buildArgs(entryPoint: string, port: number): string[] {
    return [entryPoint, "--port", String(port), "--no-reload"]
}

// Spawns agent-server by exec'ing the installed entry point directly (ensureAgentServer handles install).
export function spawnAgentServer(options: SpawnAgentServerOptions): ServerProcess {
    const { entryPoint, port, cwd, log } = options
    const args = platform.supervisor.wrap(buildArgs(entryPoint, port))

    const commandLine = args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")
    log.write(`[agent-tui] starting agent-server at ${new Date().toISOString()} cwd=${cwd} port=${port}\n`)
    log.write(`[agent-tui] command=${commandLine}\n`)

    const proc = Bun.spawn(args, {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PYTHONUNBUFFERED: "1", ...uvSandboxEnv() },
        ...platform.supervisor.spawnOptions(),
    })

    const supervision = platform.supervisor.register(proc.pid, proc.exited, log)

    // Run both pumps to completion; failures are swallowed because the child stream closing mid-read is normal during shutdown.
    pipeStream(proc.stdout as ReadableStream<Uint8Array>, log).catch((err) => {
        log.write(`[agent-tui] stdout pump error: ${(err as Error).message}\n`)
    })
    pipeStream(proc.stderr as ReadableStream<Uint8Array>, log).catch((err) => {
        log.write(`[agent-tui] stderr pump error: ${(err as Error).message}\n`)
    })

    proc.exited.then((code) => {
        log.write(`[agent-tui] agent-server exited with code=${code}\n`)
    })

    let killing: Promise<void> | null = null

    const kill = (): Promise<void> => {
        if (killing !== null) return killing
        killing = (async () => {
            log.write(`[agent-tui] stopping agent-server pid=${proc.pid}\n`)
            await supervision.killTree()
            await settleWithin(proc.exited, KILL_GRACE_MS)
        })()
        return killing
    }

    return {
        pid: proc.pid,
        port,
        exited: proc.exited,
        kill,
    }
}
