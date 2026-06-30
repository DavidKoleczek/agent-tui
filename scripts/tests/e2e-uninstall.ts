// Local end-to-end test for `agent uninstall`.
// Compiles a real host binary into a throwaway sandbox, seeds a fake managed runtime, and asserts the teardown that cannot run under `bun dev`.
//
// Everything is isolated under a temp directory via HOME / USERPROFILE / LOCALAPPDATA overrides, so the test never touches ~/.agents/tui, installed binary, or PATH.
// The Windows PATH edit is a guarded no-op here (the sandbox install dir is not on the real user PATH), so the real registry is left alone.
//
//   bun scripts/tests/e2e-uninstall.ts

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const ENTRY = "src/main.tsx"

interface Host {
    key: "linux-x64" | "windows-x64"
    bunTarget: string
    // Basename the installer writes (install.sh / install.ps1).
    installName: string
    // A self-contained system executable copied under the managed root to stand in for a running instance.
    sleeperSource: string
    sleeperArgs: (path: string) => string[]
}

function resolveHost(): Host {
    const os = process.platform === "win32" ? "windows" : process.platform
    const key = `${os}-${process.arch}`
    if (key === "windows-x64") {
        return {
            key,
            bunTarget: "bun-windows-x64",
            installName: "agent.exe",
            sleeperSource: join(process.env.SystemRoot ?? "C:\\Windows", "System32", "PING.EXE"),
            sleeperArgs: () => ["-n", "60", "127.0.0.1"],
        }
    }
    if (key === "linux-x64") {
        return {
            key,
            bunTarget: "bun-linux-x64",
            installName: "agent",
            sleeperSource: "/bin/sleep",
            sleeperArgs: () => ["60"],
        }
    }
    throw new Error(`the e2e uninstall test supports linux-x64 and windows-x64 only; this host is ${key}`)
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

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`FAIL: ${message}`)
    process.stdout.write(`  ok: ${message}\n`)
}

async function waitForGone(path: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (!existsSync(path)) return true
        await Bun.sleep(250)
    }
    return !existsSync(path)
}

// A managed root with a few files in the dirs uninstall removes wholesale.
function seedManagedRoot(managedRoot: string): void {
    for (const sub of ["uv/0.0.0", "cache", "python", "tools/scope", "bin/scope"]) {
        mkdirSync(join(managedRoot, sub), { recursive: true })
        writeFileSync(join(managedRoot, sub, "placeholder"), "x")
    }
}

function sandboxEnv(home: string, localAppData: string): Record<string, string> {
    // env replaces the child's environment, so carry the parent env and override only the home-rooted vars.
    const base: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) base[k] = v
    base.HOME = home
    if (process.platform === "win32") {
        base.USERPROFILE = home
        base.LOCALAPPDATA = localAppData
    }
    return base
}

async function main(): Promise<void> {
    const host = resolveHost()
    const base = mkdtempSync(join(tmpdir(), "agent-e2e-uninstall-"))
    process.stdout.write(`sandbox: ${base}\n`)

    const home = join(base, "home")
    const localAppData = join(home, "AppData", "Local")
    const managedRoot = join(home, ".agents", "tui")
    const installDir =
        process.platform === "win32" ? join(localAppData, "Programs", "agent-tui") : join(home, ".local", "bin")
    const installPath = join(installDir, host.installName)
    const env = sandboxEnv(home, localAppData)

    mkdirSync(installDir, { recursive: true })
    await compile("9.9.9", host.bunTarget, installPath)

    try {
        // Positive: a clean teardown removes the managed root, the binary, and (Linux) the installer's PATH line.
        process.stdout.write("\n[1/2] clean teardown\n")
        seedManagedRoot(managedRoot)

        const profile = join(home, ".bashrc")
        const pathLine = `export PATH="${join(home, ".local", "bin")}:$PATH"`
        if (process.platform !== "win32") {
            writeFileSync(profile, `# sentinel before\n${pathLine}\n# sentinel after\n`)
        }

        const run = Bun.spawnSync([installPath, "uninstall", "--yes"], { env, stdout: "pipe", stderr: "pipe" })
        process.stdout.write(run.stdout.toString())
        if (run.stderr.length > 0) process.stdout.write(run.stderr.toString())
        assert(run.exitCode === 0, "uninstall --yes exits 0")
        assert(!existsSync(managedRoot), "managed root is removed")

        if (process.platform === "win32") {
            // The detached WMI cleaner removes the install dir only after the binary process has exited.
            assert(await waitForGone(installDir, 15_000), "install dir is removed by the detached cleaner")
        } else {
            assert(!existsSync(installPath), "installed binary is unlinked")
            const after = readFileSync(profile, "utf8")
            assert(!after.includes(pathLine), "installer PATH line is removed from the profile")
            assert(
                after.includes("# sentinel before") && after.includes("# sentinel after"),
                "other profile lines are preserved",
            )
        }

        // Negative: a process whose image lives under the managed root blocks the teardown.
        process.stdout.write("\n[2/2] refuses while an instance runs\n")
        mkdirSync(installDir, { recursive: true })
        await compile("9.9.9", host.bunTarget, installPath)
        seedManagedRoot(managedRoot)

        const sleeperPath = join(managedRoot, "cache", host.installName === "agent.exe" ? "sleeper.exe" : "sleeper")
        cpSync(host.sleeperSource, sleeperPath)
        const sleeper = Bun.spawn([sleeperPath, ...host.sleeperArgs(sleeperPath)], {
            stdout: "ignore",
            stderr: "ignore",
            stdin: "ignore",
        })
        await Bun.sleep(1_000)
        try {
            const refused = Bun.spawnSync([installPath, "uninstall", "--yes"], { env, stdout: "pipe", stderr: "pipe" })
            process.stdout.write(refused.stderr.toString())
            assert(refused.exitCode === 1, "uninstall exits 1 while an instance runs")
            assert(existsSync(managedRoot), "managed root is left untouched when refused")
            assert(refused.stderr.toString().includes(sleeperPath), "the offending executable path is reported")
        } finally {
            sleeper.kill()
            await Bun.sleep(500)
        }

        process.stdout.write("\nALL ASSERTIONS PASSED\n")
    } finally {
        rmSync(base, { recursive: true, force: true })
    }
}

await main()
