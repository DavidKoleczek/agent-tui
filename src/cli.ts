import { appVersion } from "./lib/constants"
import { runUninstall } from "./lib/tui"

export type LaunchMode = "default" | "resume"

export type CliResult = { exitCode: number } | { launchMode: LaunchMode }

type CliAction =
    | { type: "launch"; launchMode: LaunchMode }
    | { type: "version" }
    | { type: "help" }
    | { type: "uninstall"; yes: boolean }
    | { type: "error"; message: string }

const CLI_HELP = `Usage:
  floppy
  floppy --resume
  floppy --version
  floppy --help
  floppy uninstall [--yes]

Commands:
  uninstall   Remove floppy and its managed runtime.
    --yes     Skip the confirmation prompt.
`

function unknownOption(argument: string): CliAction {
    return { type: "error", message: `error: unknown option '${argument}'` }
}

function parseCliArgs(args: string[]): CliAction {
    const first = args[0]
    if (first === undefined) return { type: "launch", launchMode: "default" }

    if (first === "--resume") {
        return args.length === 1
            ? { type: "launch", launchMode: "resume" }
            : { type: "error", message: "error: Invalid command format." }
    }
    if (first === "--version") {
        return args.length === 1 ? { type: "version" } : { type: "error", message: "error: Invalid command format." }
    }
    if (first === "--help") {
        return args.length === 1 ? { type: "help" } : { type: "error", message: "error: Invalid command format." }
    }
    if (first === "uninstall") {
        const second = args[1]
        if (second === undefined) return { type: "uninstall", yes: false }
        if (args.length === 2 && second === "--yes") return { type: "uninstall", yes: true }
        return unknownOption(second === "--yes" ? (args[2] ?? second) : second)
    }
    return first.startsWith("-") ? unknownOption(first) : { type: "error", message: "error: Invalid command format." }
}

// Handles flags and subcommands that must short-circuit before the TUI and resolves how interactive launches should start.
export async function runPreBootCli(argv: string[]): Promise<CliResult> {
    const action = parseCliArgs(argv.slice(2))
    switch (action.type) {
        case "launch":
            return { launchMode: action.launchMode }
        case "version":
            process.stdout.write(`${appVersion}\n`)
            return { exitCode: 0 }
        case "help":
            process.stdout.write(CLI_HELP)
            return { exitCode: 0 }
        case "uninstall":
            return { exitCode: await runUninstall(action.yes) }
        case "error":
            process.stderr.write(`${action.message}\n\n${CLI_HELP}`)
            return { exitCode: 2 }
    }
}
