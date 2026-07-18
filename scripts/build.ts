// Release build script: cross-compiles the standalone `floppy` binary for Linux x64 and Windows x64,
// bakes in the app version, writes each binary plus a derived latest.json into dist/, and smoke-tests
// the host-native binary's --version. The release workflow runs this; it is also runnable locally.
//
// Run locally (version optional; falls back to the latest git tag, then 0.0.0-dev):
//   bun run build 0.1.0
// Add --skip-install to reuse already-installed cross-platform packages and skip the slow first install:
//   bun run scripts/build.ts 0.1.0 --skip-install

import { mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { PINNED_VERSIONS } from "../src/lib/versions"

const REPO = "DavidKoleczek/agent-tui"
const ENTRY = "src/main.tsx"
const DIST = "dist"
const SCHEMA_VERSION = 1

interface Target {
    key: "linux-x64" | "windows-x64"
    bunTarget: string
    filename: string
}

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
    platforms: Record<Target["key"], Asset>
}

const LINUX: Target = { key: "linux-x64", bunTarget: "bun-linux-x64", filename: "floppy-linux-x64" }
const WINDOWS: Target = { key: "windows-x64", bunTarget: "bun-windows-x64", filename: "floppy-windows-x64.exe" }
const TARGETS = [LINUX, WINDOWS]

function stripLeadingV(value: string): string {
    return value.startsWith("v") ? value.slice(1) : value
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
    for (const value of values) {
        if (value !== undefined && value.trim().length > 0) return value.trim()
    }
    return undefined
}

function gitDescribe(): string | undefined {
    try {
        const proc = Bun.spawnSync(["git", "describe", "--tags", "--abbrev=0"])
        return proc.exitCode === 0 ? proc.stdout.toString().trim() || undefined : undefined
    } catch {
        return undefined
    }
}

function resolveVersion(positional: string | undefined): string {
    return stripLeadingV(firstNonEmpty(positional, process.env.APP_VERSION, gitDescribe()) ?? "0.0.0-dev")
}

// OpenTUI ships its native Zig core as per-platform optional packages; bun installs only the host's
// variant by default, which makes cross-compilation fail to resolve the other targets' native module.
// Force every platform so a single host can compile all targets (the approach opencode's build uses).
async function ensureCrossPlatformNativePackages(): Promise<void> {
    const rootPkg = (await Bun.file("package.json").json()) as { dependencies: Record<string, string> }
    const spec = `@opentui/core@${rootPkg.dependencies["@opentui/core"]}`
    const proc = Bun.spawn(["bun", "install", "--os=*", "--cpu=*", spec], { stdout: "inherit", stderr: "inherit" })
    if ((await proc.exited) !== 0) throw new Error("cross-platform install of @opentui/core failed")
}

async function compile(target: Target, version: string): Promise<void> {
    const args = [
        "build",
        "--compile",
        `--target=${target.bunTarget}`,
        // --define parses the value as code, so it must itself be a quoted literal; JSON.stringify
        // yields a double-quoted string token the build folds into the binary.
        "--define",
        `APP_VERSION=${JSON.stringify(version)}`,
        "--outfile",
        join(DIST, target.filename),
        ENTRY,
    ]
    const proc = Bun.spawn(["bun", ...args], { stdout: "inherit", stderr: "inherit" })
    if ((await proc.exited) !== 0) throw new Error(`bun build failed for ${target.bunTarget}`)
}

// Turns a freshly compiled binary into its release-manifest entry (download url, sha256, size).
async function buildAsset(target: Target, tag: string): Promise<Asset> {
    const bytes = await Bun.file(join(DIST, target.filename)).arrayBuffer()
    return {
        url: `https://github.com/${REPO}/releases/download/${tag}/${target.filename}`,
        filename: target.filename,
        sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
        size: bytes.byteLength,
    }
}

// latest.json derives from the central pins module plus the build-injected app version, so a single
// edit to PINNED_VERSIONS changes both runtime behavior and what an update advertises.
function buildManifest(version: string, platforms: Record<Target["key"], Asset>): Manifest {
    const { agentServer, uv, python } = PINNED_VERSIONS
    return { schema: SCHEMA_VERSION, version, pins: { agentServer, uv, python }, platforms }
}

// Confirms --version reports the injected version and short-circuits before booting. Only the
// host-native target can run; cross-built targets are skipped.
async function smokeTest(target: Target, version: string): Promise<void> {
    const proc = Bun.spawn([join(DIST, target.filename), "--version"], { stdout: "pipe", stderr: "inherit" })
    const out = (await new Response(proc.stdout).text()).trim()
    if ((await proc.exited) !== 0) throw new Error(`smoke test failed for ${target.filename}`)
    if (out !== version) throw new Error(`smoke test mismatch for ${target.filename}: expected ${version}, got ${out}`)
    process.stdout.write(`  smoke test ${target.filename} --version -> ${out}\n`)
}

function hostTarget(): Target | undefined {
    const os = process.platform === "win32" ? "windows" : process.platform
    return TARGETS.find((target) => target.key === `${os}-${process.arch}`)
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2)
    const skipInstall = argv.includes("--skip-install")
    const version = resolveVersion(argv.find((arg) => !arg.startsWith("--")))
    const tag = firstNonEmpty(process.env.RELEASE_TAG) ?? `v${version}`

    if (!skipInstall) await ensureCrossPlatformNativePackages()

    rmSync(DIST, { recursive: true, force: true })
    mkdirSync(DIST, { recursive: true })
    for (const target of TARGETS) await compile(target, version)

    const platforms: Record<Target["key"], Asset> = {
        "linux-x64": await buildAsset(LINUX, tag),
        "windows-x64": await buildAsset(WINDOWS, tag),
    }
    await Bun.write(join(DIST, "latest.json"), `${JSON.stringify(buildManifest(version, platforms), null, 4)}\n`)

    process.stdout.write(`built ${version} (${tag})\n`)
    for (const asset of Object.values(platforms)) {
        process.stdout.write(`  ${asset.filename}  ${asset.sha256}  ${asset.size} bytes\n`)
    }
    process.stdout.write("  latest.json\n")

    const host = hostTarget()
    if (host !== undefined) await smokeTest(host, version)
}

await main()
