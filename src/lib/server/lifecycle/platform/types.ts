import type { LogFile } from "../../session/server-log"

// Abstraction over the OS-specific bits of resolving and downloading uv.
export interface UvPlatform {
    // The basename of the uv executable on this platform (e.g. "uv.exe", "uv").
    binaryName: string
    // The user-writable per-user data root where agent-tui caches its binaries and logs. Resolved at startup; never changes.
    cacheRoot: string
    // The asset filename in Astral's GitHub releases for the current arch+os.
    archiveAssetName(): string
    // Extracts the downloaded archive into destDir such that destDir/<binaryName> is the uv binary.
    // Implementations should flatten any top-level directory that the archive format imposes.
    extractArchive(archivePath: string, destDir: string): Promise<void>
}

// Abstraction over OS-specific process supervision.
// Mirrors the lifecycle of a  single spawned child:
// pre-spawn arg rewrite, spawn-time options, post-spawn registration, and tree-kill on shutdown.
export interface ProcessSupervisor {
    // Returns the command line possibly wrapped to enforce parent-death cleanup at exec time.
    // Identity on Windows; on Linux this may prepend `setpriv --pdeathsig TERM --` when available.
    wrap(args: string[]): string[]
    // Extra Bun.spawn options merged into the spawn call (e.g. `{ detached: true }`
    // on POSIX so the child becomes its own process group leader).
    spawnOptions(): { detached?: boolean }
    // Called once after Bun.spawn returns. Returns a handle for later teardown.
    register(pid: number, log: LogFile): SupervisionHandle
}

export interface SupervisionHandle {
    // Idempotent. Initiates a tree kill via the appropriate primitive
    killTree(): Promise<void>
}

export interface ServerPlatform {
    uv: UvPlatform
    supervisor: ProcessSupervisor
}
