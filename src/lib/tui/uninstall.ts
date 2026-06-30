// `agent uninstall`: tears down the managed runtime so a later install is clean.
// A pre-boot CLI command that boots neither the TUI nor agent-server, so it holds no lock on the managed root itself.
// It refuses to run while any process still has files open under the managed root,
// then removes the managed root, the PATH entry the installer added, and the installed binary.

import { readdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve, sep } from "node:path"
import { appVersion, MANAGED_ROOT } from "../constants"
import { isDevBuild } from "./update"

// region Managed-root processes

export interface ManagedProcess {
    pid: number
    exePath: string
}

// True when `candidate` resolves to the managed root or a path inside it.
// Case-insensitive on Windows; the trailing-separator guard keeps a sibling like "~/.agents/tui-other" from matching "~/.agents/tui".
function isUnderManagedRoot(candidate: string): boolean {
    const norm = (p: string): string => (process.platform === "win32" ? resolve(p).toLowerCase() : resolve(p))
    const root = norm(MANAGED_ROOT)
    const target = norm(candidate)
    return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep)
}

function systemPowershell(): string {
    const root = process.env.SystemRoot ?? "C:\\Windows"
    return `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
}

// Lists processes whose executable resolves under the managed root: the exact set
// (uv, the managed Python interpreter, the agent-server shim and its workers) that would hold files open and block the teardown.
export async function findManagedProcesses(): Promise<ManagedProcess[]> {
    return process.platform === "win32" ? findWindowsProcesses() : findLinuxProcesses()
}

async function findWindowsProcesses(): Promise<ManagedProcess[]> {
    const proc = Bun.spawn(
        [
            systemPowershell(),
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_Process | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress",
        ],
        { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    )
    const stdout = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) {
        const err = await new Response(proc.stderr).text()
        throw new Error(`enumerating processes failed (exit ${code}): ${err.trim()}`)
    }
    return parseWindowsProcesses(stdout)
}

function parseWindowsProcesses(stdout: string): ManagedProcess[] {
    const trimmed = stdout.trim()
    if (trimmed.length === 0) return []
    let parsed: unknown
    try {
        parsed = JSON.parse(trimmed)
    } catch {
        return []
    }
    // ConvertTo-Json emits a bare object rather than an array when exactly one process matches.
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const found: ManagedProcess[] = []
    for (const row of rows) {
        if (typeof row !== "object" || row === null) continue
        const record = row as Record<string, unknown>
        const exePath = record.ExecutablePath
        const pid = record.ProcessId
        if (typeof exePath !== "string" || typeof pid !== "number") continue
        if (pid === process.pid) continue
        if (isUnderManagedRoot(exePath)) found.push({ pid, exePath })
    }
    return found
}

function findLinuxProcesses(): ManagedProcess[] {
    let entries: string[]
    try {
        entries = readdirSync("/proc")
    } catch {
        return []
    }
    const found: ManagedProcess[] = []
    for (const entry of entries) {
        if (!/^\d+$/.test(entry)) continue
        const pid = Number(entry)
        if (pid === process.pid) continue
        let exePath: string
        try {
            exePath = readlinkSync(`/proc/${entry}/exe`)
        } catch {
            // EACCES for processes we don't own, ENOENT for ones that exited mid-scan: neither is ours to remove.
            continue
        }
        if (isUnderManagedRoot(exePath)) found.push({ pid, exePath })
    }
    return found
}

// endregion

// region Install location and PATH

// Where the installer places the `agent` binary (install.ps1 / install.sh). The uninstall reverses exactly this.
function installDir(): string {
    if (process.platform === "win32") {
        const base = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local")
        return join(base, "Programs", "agent-tui")
    }
    return join(homedir(), ".local", "bin")
}

function removeManagedRoot(): void {
    rmSync(MANAGED_ROOT, { recursive: true, force: true })
}

// Wraps a value as a PowerShell single-quoted literal, doubling embedded single quotes.
function psSingleQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`
}

// Removes only the install-dir entry the installer added to PATH, leaving every other entry exactly as it was.
// Best-effort: a failure prints a manual-fix hint rather than aborting the teardown.
async function removePathEntry(dir: string): Promise<void> {
    try {
        if (process.platform === "win32") {
            await removeWindowsPathEntry(dir)
        } else {
            removeLinuxPathEntry(dir)
        }
    } catch (err) {
        process.stderr.write(
            `Could not update PATH automatically (${(err as Error).message}).\nRemove ${dir} from your PATH by hand.\n`,
        )
    }
}

async function removeWindowsPathEntry(dir: string): Promise<void> {
    // Edit HKCU\Environment\Path directly. Reading the raw value (DoNotExpandEnvironmentNames) and writing it back with
    // its original RegistryValueKind preserves a REG_EXPAND_SZ PATH,
    // so entries that rely on %VAR% expansion keep working.
    // Only the install-dir entry is dropped (case-insensitive, ignoring a trailing backslash), and the
    // value is written only when it actually changed. The trailing WM_SETTINGCHANGE broadcast mirrors what
    // SetEnvironmentVariable does so newly launched shells pick up the change without a sign-out.
    const script = `
$dir = ${psSingleQuote(dir)}
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
if ($null -eq $key) { return }
try {
    $current = $key.GetValue('Path', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ($null -eq $current) { return }
    $kind = $key.GetValueKind('Path')
    $currentStr = [string]$current
    $kept = @($currentStr.Split(';') | Where-Object { $_.TrimEnd('\\') -ine $dir.TrimEnd('\\') })
    $next = $kept -join ';'
    if ($next -eq $currentStr) { return }
    $key.SetValue('Path', $next, $kind)
} finally {
    $key.Close()
}
$sig = '[DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.IntPtr lpdwResult);'
try {
    $native = Add-Type -MemberDefinition $sig -Name NativeMethods -Namespace Win32Env -PassThru
    $res = [System.IntPtr]::Zero
    [void]$native::SendMessageTimeout([System.IntPtr]0xffff, 0x1A, [System.IntPtr]::Zero, 'Environment', 2, 5000, [ref]$res)
} catch {}
`.trim()
    const proc = Bun.spawn([systemPowershell(), "-NoProfile", "-NonInteractive", "-Command", script], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "pipe",
    })
    const code = await proc.exited
    if (code !== 0) {
        const err = await new Response(proc.stderr).text()
        throw new Error(`exit ${code}: ${err.trim()}`)
    }
}

function removeLinuxPathEntry(dir: string): void {
    // The installer appends exactly `export PATH="<dir>:$PATH"` (install.sh). Remove only that exact line from any
    // profile that has it; leave everything else. A no-op when ~/.local/bin was already on PATH (installer skips it).
    const line = `export PATH="${dir}:$PATH"`
    for (const name of [".zshrc", ".bashrc", ".profile"]) {
        const profile = join(homedir(), name)
        let content: string
        try {
            content = readFileSync(profile, "utf8")
        } catch {
            continue
        }
        const lines = content.split("\n")
        const kept = lines.filter((entry) => entry.trim() !== line)
        if (kept.length !== lines.length) {
            writeFileSync(profile, kept.join("\n"))
        }
    }
}

// Removes the installed binary. On POSIX the running image can be unlinked directly (the open inode stays mapped
// until exit). On Windows a process cannot delete its own image, so a detached cleaner removes the whole install
// dir after we exit.
async function removeBinaryAndInstallDir(dir: string): Promise<void> {
    if (process.platform === "win32") {
        await spawnWindowsCleaner(dir)
        return
    }
    // ~/.local/bin is shared with other tools, so only the binary is removed, not the directory.
    rmSync(process.execPath, { force: true })
}

// endregion

// region Windows self-delete cleaner

// Schedules removal of the (exclusively-ours) install dir once this process exits. Bun terminates its descendants
// when it exits on Windows, so a plain spawn would be killed at the moment the cleaner is needed. The cleaner is
// instead created through WMI (Win32_Process.Create), which parents it under the WMI service rather than our job,
// letting it outlive us. It waits for our PID to exit, then deletes the dir.
async function spawnWindowsCleaner(dir: string): Promise<void> {
    const ps = systemPowershell()
    const inner =
        `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue; ` +
        `Start-Sleep -Milliseconds 300; ` +
        `Remove-Item -LiteralPath ${psSingleQuote(dir)} -Recurse -Force -ErrorAction SilentlyContinue`
    const cleanerCmd = `${ps} -NoProfile -NonInteractive -WindowStyle Hidden -Command "${inner}"`
    const launcher =
        `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create ` +
        `-Arguments @{ CommandLine = ${psSingleQuote(cleanerCmd)} }; ` +
        `if ($r.ReturnValue -ne 0) { exit 1 }`
    const proc = Bun.spawn([ps, "-NoProfile", "-NonInteractive", "-Command", launcher], {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "pipe",
    })
    const code = await proc.exited
    if (code !== 0) {
        const err = await new Response(proc.stderr).text()
        throw new Error(`scheduling cleanup failed (exit ${code}): ${err.trim()}`)
    }
}

// endregion

// region Confirmation

// Reads a single y/N line from the terminal. Returns false when stdin is not a TTY so a non-interactive run
// without --yes aborts cleanly instead of blocking forever on input that will never arrive.
async function confirm(message: string): Promise<boolean> {
    if (!process.stdin.isTTY) return false
    process.stdout.write(message)
    const answer = await new Promise<string>((resolveAnswer) => {
        const onData = (chunk: Buffer): void => {
            process.stdin.off("data", onData)
            process.stdin.pause()
            resolveAnswer(chunk.toString())
        }
        process.stdin.resume()
        process.stdin.on("data", onData)
    })
    const normalized = answer.trim().toLowerCase()
    return normalized === "y" || normalized === "yes"
}

// endregion

// region Public flow

const USAGE = `Usage: agent uninstall [--yes]

Removes the managed runtime, the installed agent binary, and the PATH entry the installer added. Refuses to run
while any agent instance is still running. Conversation history in per-directory .agents folders is left untouched.

Options:
  -y, --yes    Skip the confirmation prompt.
  -h, --help   Show this message.
`

// Tears down the managed runtime.
export async function runUninstall(args: string[]): Promise<number> {
    let yes = false
    for (const arg of args) {
        if (arg === "--yes" || arg === "-y") {
            yes = true
        } else if (arg === "--help" || arg === "-h") {
            process.stdout.write(USAGE)
            return 0
        } else {
            process.stderr.write(`agent uninstall: unrecognized option '${arg}'\n\n${USAGE}`)
            return 2
        }
    }

    // A dev build (run from source) was never installed, so there is nothing to reverse;
    // refuse rather than act on the real managed root. process.execPath here is the Bun binary, not an installed agent.
    if (isDevBuild()) {
        process.stderr.write(
            `uninstall is unavailable in dev builds (${appVersion}).\n` +
                `Nothing was changed. To reset the managed runtime, delete ${MANAGED_ROOT} manually.\n`,
        )
        return 1
    }

    // Refuse while instances run, before touching anything, so the teardown stays all-or-nothing.
    const running = await findManagedProcesses()
    if (running.length > 0) {
        process.stderr.write("Cannot uninstall while agent instances are running:\n")
        for (const proc of running) {
            process.stderr.write(`  pid ${proc.pid}  ${proc.exePath}\n`)
        }
        process.stderr.write("Quit those instances, then re-run `agent uninstall`.\n")
        return 1
    }

    const dir = installDir()

    if (!yes) {
        process.stdout.write(
            `This removes the agent runtime at ${MANAGED_ROOT}\nand the agent binary at ${dir}.\n` +
                "Conversation history in per-directory .agents folders is preserved.\n",
        )
        if (!(await confirm("Proceed? [y/N] "))) {
            process.stdout.write("Uninstall cancelled.\n")
            return 0
        }
    }

    // Managed root first, install/PATH last: if this throws partway (e.g. a transient lock), the tool is still
    // installed and re-running uninstall retries cleanly against the partial tree.
    try {
        removeManagedRoot()
    } catch (err) {
        process.stderr.write(`Failed to remove ${MANAGED_ROOT}: ${(err as Error).message}\n`)
        process.stderr.write("Nothing else was changed; re-run `agent uninstall` to retry.\n")
        return 1
    }

    await removePathEntry(dir)
    try {
        await removeBinaryAndInstallDir(dir)
    } catch (err) {
        // The runtime and PATH entry are already gone; a leftover binary is inert and overwritten by a reinstall.
        process.stderr.write(
            `Could not remove ${dir} automatically (${(err as Error).message}).\nDelete it by hand after this process exits.\n`,
        )
    }

    process.stdout.write(
        "Uninstalled agent. Conversation history in per-directory .agents folders was left untouched.\n" +
            "Open a new terminal for the PATH change to take effect.\n",
    )
    return 0
}

// endregion
