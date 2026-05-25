import { join } from "node:path"
import type { LogFile } from "../log-file"
import { createKillOnCloseJob, type JobHandle } from "./win32-job-object"
import type { ProcessSupervisor, ServerPlatform, SupervisionHandle, UvPlatform } from "./types"

function cacheRoot(): string {
    const base = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? ".", "AppData", "Local")
    return base
}

const uv: UvPlatform = {
    binaryName: "uv.exe",
    cacheRoot: cacheRoot(),
    archiveAssetName(): string {
        switch (process.arch) {
            case "x64":
                return "uv-x86_64-pc-windows-msvc.zip"
            case "arm64":
                return "uv-aarch64-pc-windows-msvc.zip"
            case "ia32":
                return "uv-i686-pc-windows-msvc.zip"
            default:
                throw new Error(`Unsupported Windows architecture for uv download: ${process.arch}`)
        }
    },
    async extractArchive(archivePath: string, destDir: string): Promise<void> {
        // PowerShell Expand-Archive is built into Windows 10+ and avoids a third-party zip dependency.
        // The Astral zip is flat, so destDir ends up with uv.exe directly inside (no nesting).
        const proc = Bun.spawn(
            [
                "powershell.exe",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
            ],
            { stdout: "pipe", stderr: "pipe" },
        )
        const code = await proc.exited
        if (code !== 0) {
            const err = await new Response(proc.stderr).text()
            throw new Error(`Expand-Archive failed (exit ${code}): ${err.trim()}`)
        }
    },
}

const KILL_GRACE_MS = 3_000

function taskkillTree(pid: number): Promise<number> {
    const taskkill = `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\taskkill.exe`
    const proc = Bun.spawn([taskkill, "/F", "/T", "/PID", String(pid)], {
        stdout: "ignore",
        stderr: "ignore",
    })
    return proc.exited
}

const supervisor: ProcessSupervisor = {
    wrap(args) {
        return args
    },
    spawnOptions() {
        return {}
    },
    register(pid: number, log: LogFile): SupervisionHandle {
        let job: JobHandle | null = null
        try {
            job = createKillOnCloseJob()
            job.assign(pid)
            log.write(`[agent-tui] job object assigned to pid=${pid} (KILL_ON_JOB_CLOSE)\n`)
        } catch (err) {
            log.write(
                `[agent-tui] job object setup failed; falling back to taskkill on shutdown: ${(err as Error).message}\n`,
            )
            if (job !== null) {
                try {
                    job.close()
                } catch {
                    // If close itself fails after a partial setup, there's nothing more we can do.
                }
                job = null
            }
        }

        let killing: Promise<void> | null = null
        return {
            killTree(): Promise<void> {
                if (killing !== null) return killing
                killing = (async () => {
                    if (job !== null) {
                        try {
                            job.close()
                        } catch (err) {
                            log.write(`[agent-tui] job close failed: ${(err as Error).message}\n`)
                        }
                    } else {
                        try {
                            await Promise.race([
                                taskkillTree(pid).then(() => undefined),
                                new Promise<void>((resolve) => setTimeout(resolve, KILL_GRACE_MS)),
                            ])
                        } catch (err) {
                            log.write(`[agent-tui] taskkill failed: ${(err as Error).message}\n`)
                        }
                    }
                })()
                return killing
            },
        }
    },
}

export const win32Platform: ServerPlatform = { uv, supervisor }
