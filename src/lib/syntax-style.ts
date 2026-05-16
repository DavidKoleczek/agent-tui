import { SyntaxStyle, type StyleDefinitionInput } from "@opentui/core"

// `SyntaxStyle.create()` calls into the OpenTUI renderer, so it can only run after `createCliRenderer(...)` resolves.
// All callers live inside React components, which only mount once the renderer is up; lazy-init keeps this safe even
// if a consumer is imported eagerly at module-load time.
let cached: SyntaxStyle | undefined

// Minimal markdown scope -> style map.
// OpenTUI's markdown chunker and tree-sitter markdown grammar both emit these scope names
const MARKDOWN_STYLES: Record<string, StyleDefinitionInput> = {
    "markup.bold": { bold: true },
    "markup.strong": { bold: true },
    "markup.italic": { italic: true },
    "markup.strikethrough": { dim: true },
    "markup.heading": { bold: true, fg: "#5fafff" },
    "markup.heading.1": { bold: true, fg: "#5fafff" },
    "markup.heading.2": { bold: true, fg: "#5fafff" },
    "markup.heading.3": { bold: true, fg: "#5fafff" },
    "markup.heading.4": { bold: true, fg: "#5fafff" },
    "markup.heading.5": { bold: true, fg: "#5fafff" },
    "markup.heading.6": { bold: true, fg: "#5fafff" },
    "markup.raw": { fg: "#e6a23c" },
    "markup.raw.inline": { fg: "#e6a23c" },
    "markup.raw.block": { fg: "#e6a23c" },
    "markup.link": { underline: true, fg: "#5fafff" },
    "markup.link.label": { underline: true, fg: "#5fafff" },
    "markup.link.url": { underline: true, fg: "#5fafff" },
    "markup.quote": { italic: true, fg: "#888888" },
    "markup.list": { fg: "#888888" },
}

export function getMarkdownSyntaxStyle(): SyntaxStyle {
    if (!cached) {
        cached = SyntaxStyle.create()
        for (const [scope, style] of Object.entries(MARKDOWN_STYLES)) {
            cached.registerStyle(scope, style)
        }
    }
    return cached
}
