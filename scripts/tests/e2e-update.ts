// Local end-to-end test for the Control Tower update flow.
// Builds two real host binaries, stands up a local file host server,
// and prints a launcher that runs the old binary through check -> download -> verify -> swap.
//
// This exercises the parts that cannot run under `bun dev`:
// with a real compiled binary the dev-build guard is off and the swap targets a real process.execPath.
// It relies on the AGENT_TUI_MANIFEST_URL override already in the updater, so no production code changes are involved.
//
//   bun scripts/tests/e2e-update.ts
//   bun scripts/tests/e2e-update.ts 1.0.0 1.0.1

import { chmodSync, mkdirSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PINNED_VERSIONS } from "../../src/lib/versions"

const ENTRY = "src/main.tsx"

interface Host {
    key: "linux-x64" | "windows-x64"
    bunTarget: string
    // How the installer places the binary on PATH (see install.sh / install.ps1).
    installName: string
    // The release asset filename a real build/manifest would use.
    assetName: string
}

function resolveHost(): Host {
    const os = process.platform === "win32" ? "windows" : process.platform
    const key = `${os}-${process.arch}`
    if (key === "windows-x64") {
        return { key, bunTarget: "bun-windows-x64", installName: "agent.exe", assetName: "agent-windows-x64.exe" }
    }
    if (key === "linux-x64") {
        return { key, bunTarget: "bun-linux-x64", installName: "agent", assetName: "agent-linux-x64" }
    }
    throw new Error(`the e2e update test supports linux-x64 and windows-x64 only; this host is ${key}`)
}

async function compile(version: string, bunTarget: string, outPath: string): Promise<void> {
    const args = [
        "build",
        "--compile",
        `--target=${bunTarget}`,
        "--define",
        `APP_VERSION=${JSON.stringify(version)}`,
        "--outfile",
        outPath,
        ENTRY,
    ]
    process.stdout.write(`building agent@${version} -> ${outPath}\n`)
    const proc = Bun.spawn(["bun", ...args], { stdout: "inherit", stderr: "inherit" })
    if ((await proc.exited) !== 0) throw new Error(`bun build failed for agent@${version}`)
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2)
    const oldVersion = argv[0] ?? "0.0.1"
    const newVersion = argv[1] ?? "0.0.2"
    const host = resolveHost()

    const base = mkdtempSync(join(tmpdir(), "agent-e2e-"))
    const installDir = join(base, "install")
    const serveDir = join(base, "serve")
    mkdirSync(installDir, { recursive: true })
    mkdirSync(serveDir, { recursive: true })

    const installPath = join(installDir, host.installName)
    const newBinaryPath = join(serveDir, host.assetName)

    await compile(oldVersion, host.bunTarget, installPath)
    await compile(newVersion, host.bunTarget, newBinaryPath)

    const bytes = await Bun.file(newBinaryPath).arrayBuffer()
    const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const size = bytes.byteLength

    let manifestJson = ""
    const server = Bun.serve({
        port: 0,
        fetch(req) {
            const path = new URL(req.url).pathname
            if (path === "/latest.json") {
                return new Response(manifestJson, { headers: { "content-type": "application/json" } })
            }
            if (path === `/${host.assetName}`) {
                return new Response(Bun.file(newBinaryPath))
            }
            return new Response("not found", { status: 404 })
        },
    })

    const manifestUrl = `http://127.0.0.1:${server.port}/latest.json`
    manifestJson = JSON.stringify(
        {
            schema: 1,
            version: newVersion,
            pins: {
                agentServer: PINNED_VERSIONS.agentServer,
                uv: PINNED_VERSIONS.uv,
                python: PINNED_VERSIONS.python,
            },
            platforms: {
                [host.key]: {
                    url: `http://127.0.0.1:${server.port}/${host.assetName}`,
                    filename: host.assetName,
                    sha256,
                    size,
                },
            },
        },
        null,
        2,
    )

    // A launcher that sets the override and starts the old binary in one step.
    // The override only takes effect in the process that runs the binary,
    // so running the bare exe instead would hit the real release and report "up to date".
    // Run it again to restart after the update; it sets the override each time,
    // so the restarted binary also resolves against this server.
    const launcherPath = join(base, process.platform === "win32" ? "run.cmd" : "run.sh")
    const launcherBody =
        process.platform === "win32"
            ? `@echo off\r\nset "AGENT_TUI_MANIFEST_URL=${manifestUrl}"\r\n"${installPath}"\r\n`
            : `#!/usr/bin/env bash\nexec env AGENT_TUI_MANIFEST_URL="${manifestUrl}" "${installPath}"\n`
    await Bun.write(launcherPath, launcherBody)
    if (process.platform !== "win32") chmodSync(launcherPath, 0o755)

    const oldImageNote =
        process.platform === "win32"
            ? `  - ${host.installName}.old appears after the swap, then is deleted on that restart\n`
            : ""

    process.stdout.write(
        `\ne2e update server ready\n` +
            `  old:  ${installPath}  (agent@${oldVersion})\n` +
            `  new:   agent@${newVersion}  sha256=${sha256.slice(0, 12)}...  ${size} bytes\n` +
            `  manifest:       ${manifestUrl}\n\n` +
            `In a NEW terminal, run the launcher below. It sets AGENT_TUI_MANIFEST_URL for you and starts\n` +
            `the old binary; then open the Control Tower Settings tab and pick "Check for updates":\n\n` +
            `  ${launcherPath}\n\n` +
            `The override must be set in the process that runs the binary. Running the bare exe without it\n` +
            `fetches the real release and shows "up to date". To set it by hand instead:\n\n` +
            `  PowerShell:  $env:AGENT_TUI_MANIFEST_URL = "${manifestUrl}"; & "${installPath}"\n` +
            `  bash:        AGENT_TUI_MANIFEST_URL="${manifestUrl}" "${installPath}"\n\n` +
            `Expect:\n` +
            `  - the panel shows Current version ${oldVersion} and Update available ${newVersion}\n` +
            `  - confirming downloads, verifies sha256, and swaps; the panel then shows "Update installed,\n` +
            `    restart agent to use ${newVersion}"\n` +
            `  - quit, then run the launcher again to restart: it now reports ${newVersion}\n` +
            oldImageNote +
            `\nLeave this server running while you test. Press Ctrl+C to stop.\n` +
            `Temp dir (delete when done): ${base}\n`,
    )
}

await main()
