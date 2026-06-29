import { appVersion } from "./lib/constants"

// Handles flags that must short-circuit before the TUI and agent-server boot. Returns true when the
// invocation is fully handled and the caller should exit without booting.
export function runPreBootCli(argv: string[]): boolean {
    const args = argv.slice(2)
    if (args.includes("--version")) {
        process.stdout.write(`${appVersion}\n`)
        return true
    }
    return false
}
