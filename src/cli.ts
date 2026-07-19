import { appVersion } from "./lib/constants"
import { runUninstall } from "./lib/tui"

export type LaunchMode = "default" | "resume"

export type CliResult = { exitCode: number } | { launchMode: LaunchMode }

// Handles flags and subcommands that must short-circuit before the TUI and resolves how interactive launches should start.
export async function runPreBootCli(argv: string[]): Promise<CliResult> {
    const args = argv.slice(2)
    if (args.includes("--version")) {
        process.stdout.write(`${appVersion}\n`)
        return { exitCode: 0 }
    }
    if (args[0] === "uninstall") {
        return { exitCode: await runUninstall(args.slice(1)) }
    }
    return { launchMode: args.includes("--resume") ? "resume" : "default" }
}
