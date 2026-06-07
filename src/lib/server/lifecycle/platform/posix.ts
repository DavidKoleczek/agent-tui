import { join } from "node:path"
import type { LogFile } from "../../session/server-log"
import type { ProcessSupervisor, ServerPlatform, SupervisionHandle, UvPlatform } from "./types"

function cacheRoot(): string {
    if (process.env.XDG_DATA_HOME !== undefined && process.env.XDG_DATA_HOME !== "") {
        return process.env.XDG_DATA_HOME
    }
    const home = process.env.HOME ?? "."
    if (process.platform === "darwin") {
        return join(home, "Library", "Application Support")
    }
    return join(home, ".local", "share")
}

function archAssetName(): string {
    if (process.platform === "darwin") {
        switch (process.arch) {
            case "x64":
                return "uv-x86_64-apple-darwin.tar.gz"
            case "arm64":
                return "uv-aarch64-apple-darwin.tar.gz"
            default:
                throw new Error(`Unsupported macOS architecture for uv download: ${process.arch}`)
        }
    }
    switch (process.arch) {
        case "x64":
            return "uv-x86_64-unknown-linux-gnu.tar.gz"
        case "arm64":
            return "uv-aarch64-unknown-linux-gnu.tar.gz"
        case "ia32":
            return "uv-i686-unknown-linux-gnu.tar.gz"
        default:
            throw new Error(`Unsupported Linux architecture for uv download: ${process.arch}`)
    }
}

const uv: UvPlatform = {
    binaryName: "uv",
    cacheRoot: cacheRoot(),
    archiveAssetName: archAssetName,
    async extractArchive(archivePath: string, destDir: string): Promise<void> {
        const proc = Bun.spawn(["tar", "-xzf", archivePath, "-C", destDir, "--strip-components=1"], {
            stdout: "pipe",
            stderr: "pipe",
        })
        const code = await proc.exited
        if (code !== 0) {
            const err = await new Response(proc.stderr).text()
            throw new Error(`tar extract failed (exit ${code}): ${err.trim()}`)
        }
    },
}

const KILL_GRACE_MS = 3_000

function trySignal(pid: number, signal: NodeJS.Signals, log: LogFile): boolean {
    try {
        // Negative pid signals the entire process group, which is why spawn uses detached: true.
        process.kill(-pid, signal)
        return true
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        // ESRCH means the group is already gone; that's the success path during teardown.
        if (code === "ESRCH") return false
        log.write(`[agent-tui] kill(-${pid}, ${signal}) failed: ${(err as Error).message}\n`)
        return false
    }
}

const supervisor: ProcessSupervisor = {
    wrap(args) {
        // setpriv --pdeathsig TERM asks the kernel to send SIGTERM to the direct child as soon as our process dies,
        // providing an OS-level safety net analogous to the Windows Job Object.
        const setpriv = Bun.which("setpriv")
        if (setpriv === null) return args
        return [setpriv, "--pdeathsig", "TERM", "--", ...args]
    },
    spawnOptions() {
        // detached: true triggers setsid() on POSIX so the child becomes the leader of a new process group.
        // That lets killTree signal -pid to reach every descendant.
        return { detached: true }
    },
    register(pid: number, log: LogFile): SupervisionHandle {
        let killing: Promise<void> | null = null
        return {
            killTree(): Promise<void> {
                if (killing !== null) return killing
                killing = (async () => {
                    const stillAlive = trySignal(pid, "SIGTERM", log)
                    if (!stillAlive) return
                    await new Promise<void>((resolve) => setTimeout(resolve, KILL_GRACE_MS))
                    trySignal(pid, "SIGKILL", log)
                })()
                return killing
            },
        }
    },
}

export const posixPlatform: ServerPlatform = { uv, supervisor }
