// Pure formatting helpers for the task (tool call) activity row. Kept out of the component so the display stays small
// and the truncation rules are easy to reason about and change in one place.

const MAX_KEY_CHARS = 20
// Values longer than this are elided in the middle so a single argument cannot blow out the header line.
const MAX_VALUE_CHARS = 100
const VALUE_EDGE_CHARS = 50
const MAX_RESULT_LINE_CHARS = 300

// Title-case a tool name, turning underscores into spaces: "web_fetch" -> "Web Fetch", "read" -> "Read".
export function formatTaskName(name: string): string {
    return name
        .split("_")
        .filter((word) => word.length > 0)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

// Render arguments as "key: value, key2: value2" with keys and values truncated for a single-line header.
export function formatArguments(args: Record<string, unknown>): string {
    return Object.entries(args)
        .map(([key, value]) => `${key.slice(0, MAX_KEY_CHARS)}: ${truncateValue(value)}`)
        .join(", ")
}

// Collapse a value to one line and elide the middle when it is too long, keeping the informative head and tail.
function truncateValue(value: unknown): string {
    const collapsed = stringifyValue(value).replace(/\s+/g, " ").trim()
    if (collapsed.length <= MAX_VALUE_CHARS) return collapsed
    return `${collapsed.slice(0, VALUE_EDGE_CHARS)}...${collapsed.slice(-VALUE_EDGE_CHARS)}`
}

export function stringifyValue(value: unknown): string {
    if (typeof value === "string") return value
    try {
        return JSON.stringify(value) ?? String(value)
    } catch {
        // Circular structures, bigints, and similar throw; fall back to a plain string coercion.
        return String(value)
    }
}

export function fullArgumentEntries(args: Record<string, unknown>): Array<{ key: string; value: string }> {
    return Object.entries(args).map(([key, value]) => ({ key, value: stringifyValue(value) }))
}

// Summarize a result into at most three display lines: the first line, an elision marker, and the last line.
// Long single lines are cut to MAX_RESULT_LINE_CHARS; a long last line keeps its tail so the end stays visible.
export function formatResultLines(result: string): string[] {
    const trimmed = result.trimEnd()
    if (trimmed.length === 0) return []

    const lines = trimmed.split(/\r?\n/)
    const first = lines[0] ?? ""
    const firstDisplay = first.slice(0, MAX_RESULT_LINE_CHARS)

    const hasMore = lines.length > 1 || first.length > MAX_RESULT_LINE_CHARS
    if (!hasMore) return [firstDisplay]

    const last = lines[lines.length - 1] ?? ""
    const lastDisplay = last.length > MAX_RESULT_LINE_CHARS ? `...${last.slice(-MAX_RESULT_LINE_CHARS)}` : last
    return [firstDisplay, "...", lastDisplay]
}
