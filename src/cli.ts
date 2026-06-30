import { appVersion } from "./lib/constants"
import { runUninstall } from "./lib/tui"

// Handles flags and subcommands that must short-circuit before the TUI and agent-server boot.
// Returns the exit code to use when the invocation is fully handled, or null when the caller should go on to boot the TUI.
export async function runPreBootCli(argv: string[]): Promise<number | null> {
    const args = argv.slice(2)
    if (args.includes("--version")) {
        process.stdout.write(`${appVersion}\n`)
        return 0
    }
    if (args[0] === "uninstall") {
        return runUninstall(args.slice(1))
    }
    return null
}
