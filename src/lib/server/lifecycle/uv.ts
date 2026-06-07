import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { platform } from "./platform"

// Pinned version of uv we vendor for end users without a system uv.
const UV_VERSION = "0.11.16"

export interface ResolvedUv {
    path: string
    source: "path" | "cache" | "downloaded"
    version: string
}

function cacheDir(): string {
    return join(platform.uv.cacheRoot, "agent-tui", "bin")
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

        return targetBinary
    } finally {
        try {
            rmSync(stagingDir, { recursive: true, force: true })
        } catch {
            // Staging dir cleanup is best-effort; the temp directory will reclaim it eventually.
        }
    }
}

// Resolves the uv binary the TUI will use to spawn agent-server.
// Prefers a system install on PATH,
// then a previously cached download under `<platform.uv.cacheRoot>/agent-tui/bin/`,
// and finally downloads a pinned release as a last resort.
export async function resolveUv(): Promise<ResolvedUv> {
    const onPath = Bun.which("uv")
    if (onPath !== null) {
        return { path: onPath, source: "path", version: "system" }
    }

    const cached = join(cacheDir(), platform.uv.binaryName)
    if (existsSync(cached)) {
        return { path: cached, source: "cache", version: UV_VERSION }
    }

    const downloaded = await downloadUv()
    return { path: downloaded, source: "downloaded", version: UV_VERSION }
}
