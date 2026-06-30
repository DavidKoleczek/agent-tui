// The Control Tower update flow: detect a newer release from latest.json and apply it by replacing the running binary in place.

import { randomUUID } from "node:crypto"
import { chmodSync, renameSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { appVersion, DEV_VERSION, MANIFEST_URL } from "../constants"

// region Host platform

type PlatformKey = "linux-x64" | "windows-x64"

function currentPlatformKey(): PlatformKey | null {
    if (process.arch !== "x64") return null
    switch (process.platform) {
        case "linux":
            return "linux-x64"
        case "win32":
            return "windows-x64"
        default:
            return null
    }
}

// endregion

// region Release manifest

const SCHEMA_VERSION = 1

interface Asset {
    url: string
    filename: string
    sha256: string
    size: number
}

interface Manifest {
    schema: number
    version: string
    pins: { agentServer: string; uv: string; python: string }
    platforms: Record<PlatformKey, Asset>
}

function isAsset(value: unknown): value is Asset {
    if (typeof value !== "object" || value === null) return false
    const asset = value as Record<string, unknown>
    return (
        typeof asset.url === "string" &&
        typeof asset.filename === "string" &&
        typeof asset.sha256 === "string" &&
        typeof asset.size === "number"
    )
}

// Validates decoded JSON against the expected schema version and shape
function parseManifest(raw: unknown): Manifest {
    if (typeof raw !== "object" || raw === null) {
        throw new Error("release manifest is not an object")
    }
    const manifest = raw as Record<string, unknown>
    if (manifest.schema !== SCHEMA_VERSION) {
        throw new Error(`unsupported release manifest schema ${String(manifest.schema)} (expected ${SCHEMA_VERSION})`)
    }
    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        throw new Error("release manifest is missing a version")
    }
    if (typeof manifest.platforms !== "object" || manifest.platforms === null) {
        throw new Error("release manifest is missing platforms")
    }
    return raw as Manifest
}

// Returns the asset for the given host, or null when the manifest does not carry a valid one
function assetForPlatform(manifest: Manifest, key: PlatformKey): Asset | null {
    const asset = manifest.platforms[key]
    return isAsset(asset) ? asset : null
}

// Fetches and validates the release manifest.
// AGENT_TUI_MANIFEST_URL overrides the source for local end-to-end testing against a served dist/ directory.
async function fetchManifest(signal?: AbortSignal): Promise<Manifest> {
    const url = process.env.AGENT_TUI_MANIFEST_URL ?? MANIFEST_URL
    const response = await fetch(url, { signal })
    if (!response.ok) {
        throw new Error(`fetching the release manifest failed: HTTP ${response.status}`)
    }
    return parseManifest(await response.json())
}

// endregion

// region Version comparison

// Parses a dotted MAJOR.MINOR.PATCH version into numeric segments, or null if any segment is not a plain integer.
// Release versions come from git tags (see scripts/build.ts) so they hold this shape
function parseSegments(version: string): number[] | null {
    const segments = version.split(".")
    const parsed: number[] = []
    for (const segment of segments) {
        if (!/^\d+$/.test(segment)) return null
        parsed.push(Number(segment))
    }
    return parsed.length > 0 ? parsed : null
}

// True only when `remote` is a strictly higher release than `local`, so an update is never offered for a downgrade or a re-apply of the same version.
// The dev sentinel or any unparseable version on either side returns false, which keeps dev builds from ever seeing an update.
function isNewer(remote: string, local: string): boolean {
    if (remote === DEV_VERSION || local === DEV_VERSION) return false
    const remoteSegments = parseSegments(remote)
    const localSegments = parseSegments(local)
    if (remoteSegments === null || localSegments === null) return false

    const length = Math.max(remoteSegments.length, localSegments.length)
    for (let i = 0; i < length; i++) {
        const a = remoteSegments[i] ?? 0
        const b = localSegments[i] ?? 0
        if (a !== b) return a > b
    }
    return false
}

export function isDevBuild(): boolean {
    return appVersion === DEV_VERSION
}

// endregion

// region Download and verify

// Downloads the asset into the install directory into the same dir as the running binary, so the later rename is atomic
async function downloadVerified(asset: Asset, installPath: string, signal?: AbortSignal): Promise<string> {
    const response = await fetch(asset.url, { signal })
    if (!response.ok) {
        throw new Error(`downloading the update failed: HTTP ${response.status}`)
    }
    const buffer = await response.arrayBuffer()

    if (buffer.byteLength !== asset.size) {
        throw new Error(`update size mismatch (expected ${asset.size} bytes, got ${buffer.byteLength})`)
    }
    const sha256 = new Bun.CryptoHasher("sha256").update(buffer).digest("hex")
    if (sha256.toLowerCase() !== asset.sha256.toLowerCase()) {
        throw new Error(`update checksum mismatch (expected ${asset.sha256}, got ${sha256})`)
    }

    const stagedPath = join(dirname(installPath), `.agent-update-${randomUUID()}`)
    try {
        await Bun.write(stagedPath, buffer)
    } catch (err) {
        // A partially written staged file would otherwise litter the install dir; remove it before rethrowing.
        try {
            rmSync(stagedPath, { force: true })
        } catch {
            // Best-effort: a leftover staged file is harmless and reclaimed by a later update.
        }
        throw err
    }
    return stagedPath
}

// endregion

// region In-place self-replace

// Replaces the running binary with the staged one in place.
// Windows cannot overwrite a running .exe, so the old image is moved aside to .old and reclaimed on the next boot;
// POSIX renames the new binary over the old inode, which the running process keeps mapped until it exits.
// installPath is process.execPath; backupPath is installPath + ".old".
function swapBinary(installPath: string, stagedPath: string): void {
    if (process.platform === "win32") {
        const backupPath = `${installPath}.old`
        // Clear any backup a prior update left behind so the move-aside has a free destination.
        rmSync(backupPath, { force: true })
        renameSync(installPath, backupPath)
        try {
            renameSync(stagedPath, installPath)
        } catch (err) {
            // Restore the original so a failed swap still leaves a runnable install.
            renameSync(backupPath, installPath)
            throw err
        }
        return
    }

    // The release asset is a bare binary with no exec bit; set one before it becomes the entry point.
    chmodSync(stagedPath, 0o755)
    renameSync(stagedPath, installPath)
}

// Best-effort removal of a stale .old backup left by a prior in-place update on Windows. POSIX never
// creates one, so this is a no-op there. Called early at startup, before anything holds the file.
export function cleanupStaleBackup(installPath: string): void {
    try {
        rmSync(`${installPath}.old`, { force: true })
    } catch {
        // The old image may still be locked by an exiting predecessor; a later run reclaims it.
    }
}

// endregion

// region Public flow

export interface UpdateCheck {
    // "available": a newer release exists for this host. "up-to-date": none. "unsupported": no asset for this host.
    status: "up-to-date" | "available" | "unsupported"
    // The running app's version.
    current: string
    // The advertised release version, present whenever the manifest could be read.
    remote?: string
    // The asset to download, present only when status is "available".
    asset?: Asset
}

// Fetches the release manifest and decides whether an update applies to this host.
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateCheck> {
    const current = appVersion
    const key = currentPlatformKey()
    if (key === null) {
        return { status: "unsupported", current }
    }

    const manifest = await fetchManifest(signal)
    const asset = assetForPlatform(manifest, key)
    if (asset === null) {
        return { status: "unsupported", current, remote: manifest.version }
    }
    if (!isNewer(manifest.version, current)) {
        return { status: "up-to-date", current, remote: manifest.version }
    }
    return { status: "available", current, remote: manifest.version, asset }
}

// Downloads, verifies, and swaps in the new binary in place. The new version takes effect on the next
// start (the running process keeps the old image mapped). Refuses to run in a dev build.
export async function applyUpdate(check: UpdateCheck, signal?: AbortSignal): Promise<void> {
    if (isDevBuild()) {
        throw new Error("updates are unavailable in dev builds")
    }
    if (check.status !== "available" || check.asset === undefined) {
        throw new Error("no update is available to apply")
    }

    const installPath = process.execPath
    const stagedPath = await downloadVerified(check.asset, installPath, signal)
    swapBinary(installPath, stagedPath)
}

// endregion
