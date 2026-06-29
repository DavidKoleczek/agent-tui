import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { MANAGED_ROOT } from "../../constants"
import { PINNED_VERSIONS } from "../../versions"
import { platform } from "./platform"

const UV_VERSION = PINNED_VERSIONS.uv

export interface ResolvedUv {
    path: string
    source: "cache" | "downloaded"
    version: string
}

function uvRoot(): string {
    return join(MANAGED_ROOT, "uv")
}

// Version-scoped cache directory for the managed uv binary.
// Scoping the path by version means a UV_VERSION bump resolves to a fresh directory, which is what makes a version change trigger a re-download.
function cacheDir(): string {
    return join(uvRoot(), UV_VERSION)
}

// Resolves the managed uv binary the TUI uses to spawn agent-server.
// It is downloaded once into the version-scoped cache and reused on every later run.
export async function resolveUv(): Promise<ResolvedUv> {
    const cached = join(cacheDir(), platform.uv.binaryName)
    if (existsSync(cached)) {
        return { path: cached, source: "cache", version: UV_VERSION }
    }

    const downloaded = await downloadUv()
    return { path: downloaded, source: "downloaded", version: UV_VERSION }
}

async function downloadUv(): Promise<string> {
    const asset = platform.uv.archiveAssetName()
    const url = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${asset}`
    const targetDir = cacheDir()
    mkdirSync(targetDir, { recursive: true })
    const targetBinary = join(targetDir, platform.uv.binaryName)

    const stagingDir = join(tmpdir(), `agent-tui-uv-${randomUUID()}`)
    mkdirSync(stagingDir, { recursive: true })
    const archivePath = join(stagingDir, asset)
    const extractDir = join(stagingDir, "extract")
    mkdirSync(extractDir, { recursive: true })

    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Download failed for ${url}: HTTP ${response.status}`)
        }
        // Buffer the full body via arrayBuffer() before writing.
        const bytes = await response.arrayBuffer()
        await Bun.write(archivePath, bytes)

        await platform.uv.extractArchive(archivePath, extractDir)

        const extractedBinary = join(extractDir, platform.uv.binaryName)
        if (!existsSync(extractedBinary)) {
            throw new Error(`${platform.uv.binaryName} not found after extraction at ${extractedBinary}`)
        }

        // rename is atomic when source and destination share a volume.
        // Both live under the user's data dir so this holds.
        // If the destination is locked by a concurrent uv process, fall back to a copy.
        try {
            renameSync(extractedBinary, targetBinary)
        } catch {
            await Bun.write(targetBinary, Bun.file(extractedBinary))
        }

        pruneOldVersions()
        return targetBinary
    } finally {
        try {
            rmSync(stagingDir, { recursive: true, force: true })
        } catch {
            // Staging dir cleanup is best-effort; the temp directory will reclaim it eventually.
        }
    }
}

// Best-effort removal of previously cached uv versions once the current one is in place
function pruneOldVersions(): void {
    let entries: string[]
    try {
        entries = readdirSync(uvRoot())
    } catch {
        return
    }
    for (const entry of entries) {
        if (entry === UV_VERSION) continue
        try {
            rmSync(join(uvRoot(), entry), { recursive: true, force: true })
        } catch {
            // A locked old version is harmless; it will be retried on the next download.
        }
    }
}
