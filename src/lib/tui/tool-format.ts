// Formatting helpers for task activities

const MAX_KEY_CHARS = 20
// Values longer than this are shortened so a single argument cannot blow out the header line.
const MAX_VALUE_CHARS = 100
const VALUE_EDGE_CHARS = 50
const MAX_RESULT_LINE_CHARS = 300
const WHITESPACE = /\s/u

export interface FormatArgumentsOptions {
    streaming?: boolean
}

// Title-case a tool name, turning underscores into spaces: "web_fetch" -> "Web Fetch", "read" -> "Read".
export function formatTaskName(name: string): string {
    return name
        .split("_")
        .filter((word) => word.length > 0)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
}

// Formats compact task arguments as "key: value, key2: value2". Long streaming values keep a stable prefix,
// while completed values preserve both ends.
export function formatArguments(args: Record<string, unknown>, options: FormatArgumentsOptions = {}): string {
    return Object.entries(args)
        .map(([key, value]) => `${key.slice(0, MAX_KEY_CHARS)}: ${truncateValue(value, options.streaming ?? false)}`)
        .join(", ")
}

// Example: a long "command beginning ... current tail" is shown as "command beginning..." while streaming,
// then as "command beginning...final tail" after completion.
function truncateValue(value: unknown, streaming: boolean): string {
    if (streaming) {
        // Argument deltas repeatedly replace the current value. Keep only its stable visible prefix so newly appended
        // text cannot make a retained suffix jump around, and stop scanning as soon as the prefix is full.
        const collapsed = collapseToLimit(stringifyValue(value), MAX_VALUE_CHARS)
        return collapsed.truncated ? `${collapsed.text}...` : collapsed.text
    }

    // A completed value no longer changes, so normalize all of it and preserve both its beginning and ending.
    const collapsed = stringifyValue(value).replace(/\s+/g, " ").trim()
    if (collapsed.length <= MAX_VALUE_CHARS) return collapsed
    return `${collapsed.slice(0, VALUE_EDGE_CHARS)}...${collapsed.slice(-VALUE_EDGE_CHARS)}`
}

// Collapses whitespace while collecting at most maxChars Unicode code points.
// It stops once additional visible text is found so large streaming values do not need to be scanned in full.
function collapseToLimit(value: string, maxChars: number): { text: string; truncated: boolean } {
    const chars: string[] = []
    let pendingSpace = false

    for (const char of value) {
        if (WHITESPACE.test(char)) {
            pendingSpace = chars.length > 0
            continue
        }

        if (pendingSpace) {
            if (chars.length >= maxChars) return { text: chars.join(""), truncated: true }
            chars.push(" ")
            pendingSpace = false
        }

        if (chars.length >= maxChars) return { text: chars.join(""), truncated: true }
        chars.push(char)
    }

    return { text: chars.join(""), truncated: false }
}

export function stringifyValue(value: unknown): string {
    if (typeof value === "string") return value
    try {
        return JSON.stringify(value) ?? String(value)
    } catch {
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
