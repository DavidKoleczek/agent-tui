import { existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { MANAGED_ROOT } from "../../constants"
import { PINNED_VERSIONS } from "../../versions"
import type { LogFile } from "../session/server-log"
import { pipeStream } from "./pipe-stream"
import { platform } from "./platform"
import { uvSandboxEnv } from "./uv"

const GIT_URL = "https://github.com/DavidKoleczek/agent-server"
const AGENT_SERVER_SHA = PINNED_VERSIONS.agentServer
const PYTHON_VERSION = PINNED_VERSIONS.python

export interface ResolvedAgentServer {
    // Absolute path to the installed entry point for the pinned scope.
    entryPoint: string
    // "installed" when this call ran `uv tool install`; "cached" when the scope was already present and uv was skipped.
    source: "installed" | "cached"
}

export interface EnsureAgentServerOptions {
    uvPath: string
    log: LogFile
}

// Each pinned (agent-server SHA, Python version) installs into its own tool/bin directories, keyed by this scope.
// Scoping the install means a pin change resolves to a fresh directory rather than overwriting a shared venv in place,
// so a running instance on the old pin is not disturbed
function scope(): string {
    return `${AGENT_SERVER_SHA}-py${PYTHON_VERSION}`
}

function toolDir(): string {
    return join(MANAGED_ROOT, "tools", scope())
}

function binDir(): string {
    return join(MANAGED_ROOT, "bin", scope())
}

function entryPointPath(): string {
    return join(binDir(), platform.agentServer.binaryName)
}

// Removes tool/bin directories for every scope except the current pin, best-effort.
function pruneSupersededScopes(): void {
    const current = scope()
    for (const parent of [join(MANAGED_ROOT, "tools"), join(MANAGED_ROOT, "bin")]) {
        let entries: string[]
        try {
            entries = readdirSync(parent)
        } catch {
            continue
        }
        for (const entry of entries) {
            if (entry === current) continue
            try {
                rmSync(join(parent, entry), { recursive: true, force: true })
            } catch {}
        }
    }
}

async function installAgentServer(uvPath: string, log: LogFile): Promise<void> {
    // No `--force`: the scope directory is unique per pin, so there is never an existing install to overwrite.
    // `--managed-python` keeps the interpreter under UV_PYTHON_INSTALL_DIR.
    const args = [
        uvPath,
        "tool",
        "install",
        "--python",
        PYTHON_VERSION,
        "--managed-python",
        `git+${GIT_URL}@${AGENT_SERVER_SHA}`,
    ]
    const commandLine = args.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")
    log.write(`[agent-tui] installing agent-server @${AGENT_SERVER_SHA} (python=${PYTHON_VERSION})\n`)
    log.write(`[agent-tui] command=${commandLine}\n`)

    const proc = Bun.spawn(args, {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        // Shared uv dirs (cache, managed interpreters) plus this scope's tool/bin dirs so the venv and entry-point
        // shim land under the pin's directory and nothing reaches the user's global uv state or PATH.
        env: { ...process.env, ...uvSandboxEnv(), UV_TOOL_DIR: toolDir(), UV_TOOL_BIN_DIR: binDir() },
    })

    // Drain both streams to completion before reading the exit code so all install output reaches the log.
    await Promise.all([
        pipeStream(proc.stdout as ReadableStream<Uint8Array>, log).catch((err) => {
            log.write(`[agent-tui] install stdout pump error: ${(err as Error).message}\n`)
        }),
        pipeStream(proc.stderr as ReadableStream<Uint8Array>, log).catch((err) => {
            log.write(`[agent-tui] install stderr pump error: ${(err as Error).message}\n`)
        }),
    ])

    const code = await proc.exited
    if (code !== 0) {
        throw new Error(`uv tool install failed (exit ${code}); see ${log.path} for details`)
    }
}

// Ensures the pinned agent-server is installed for the current scope and returns the entry point to exec.
export async function ensureAgentServer(options: EnsureAgentServerOptions): Promise<ResolvedAgentServer> {
    const { uvPath, log } = options
    const entryPoint = entryPointPath()

    const source: ResolvedAgentServer["source"] = existsSync(entryPoint) ? "cached" : "installed"
    if (source === "installed") {
        await installAgentServer(uvPath, log)
    }

    pruneSupersededScopes()
    return { entryPoint, source }
}
