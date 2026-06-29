import { spawnSync } from "node:child_process"

interface StepResult {
    name: string
    code: number
    output: string
}

// Claude Code feeds Stop-hook input as JSON on stdin. Drain it so we can honor
// stop_hook_active and avoid looping forever when the checks can't be fixed.
let stopHookActive = false
try {
    const raw = require("node:fs").readFileSync(0, "utf-8")
    if (raw.trim()) {
        stopHookActive = Boolean(JSON.parse(raw).stop_hook_active)
    }
} catch {
    // No stdin / unparsable input — proceed as a normal run.
}

function run(name: string, cmd: string): StepResult {
    const result = spawnSync(cmd, { shell: true, encoding: "utf-8" })
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
    const code = result.status ?? (result.error ? 1 : 0)
    return { name, code, output }
}

const steps: StepResult[] = []
steps.push(run("bun run fmt", "bun run fmt"))
steps.push(run("bun run lint:fix", "bun run lint:fix"))
steps.push(run("bun run check", "bun run check"))

const failed = steps.filter((s) => s.code !== 0)
if (failed.length === 0 || stopHookActive) {
    process.exit(0)
}

const reason = [
    "The Stop hook ran `bun run fmt && bun run lint:fix && bun run check` and one or more steps failed. Fix the issues below before yielding again.",
    "",
    ...failed.map((s) => `--- ${s.name} (exit ${s.code}) ---\n${s.output}`),
].join("\n")

process.stdout.write(JSON.stringify({ decision: "block", reason }))
process.exit(0)
