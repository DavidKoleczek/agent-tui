import type { LogFile } from "../session/server-log"
import { platform } from "./platform"

export interface SpawnAgentServerOptions {
    uvPath: string
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

const GIT_URL = "https://github.com/DavidKoleczek/agent-server"
const GIT_REF = "main"
const KILL_GRACE_MS = 3_000

function buildArgs(uvPath: string, port: number): string[] {
    return [
        uvPath,
        "tool",
        "run",
        "--from",
        `git+${GIT_URL}@${GIT_REF}`,
        "agent-server",
        "--port",
        String(port),
        "--no-reload",
    ]
}

// Drains a ReadableStream<Uint8Array> into the log, decoding as streaming UTF-8 so multi-byte sequences split across chunks aren't corrupted.
// The log's internal write queue serializes against the other stdio stream sharing the same writer.
async function pipeStream(stream: ReadableStream<Uint8Array>, log: LogFile): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder("utf-8")
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value !== undefined && value.byteLength > 0) {
                log.write(decoder.decode(value, { stream: true }))
            }
        }
        const tail = decoder.decode()
        if (tail.length > 0) log.write(tail)
    } finally {
        reader.releaseLock()
    }
}

// Spawns agent-server via `uv tool run`.
export function spawnAgentServer(options: SpawnAgentServerOptions): ServerProcess {
    const { uvPath, port, cwd, log } = options
    const args = platform.supervisor.wrap(buildArgs(uvPath, port))

    const commandLine = args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")
    log.write(`[agent-tui] starting agent-server at ${new Date().toISOString()} cwd=${cwd} port=${port}\n`)
    log.write(`[agent-tui] command=${commandLine}\n`)

    const proc = Bun.spawn(args, {
        cwd,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
        ...platform.supervisor.spawnOptions(),
    })

    const supervision = platform.supervisor.register(proc.pid, log)

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
            await Promise.race([
                proc.exited.then(() => undefined),
                new Promise<void>((resolve) => setTimeout(resolve, KILL_GRACE_MS)),
            ])
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
