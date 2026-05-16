import { SyntaxStyle, type StyleDefinitionInput } from "@opentui/core"

// `SyntaxStyle.create()` calls into the OpenTUI renderer, so it can only run after `createCliRenderer(...)` resolves.
// All callers live inside React components, which only mount once the renderer is up; lazy-init keeps this safe even
// if a consumer is imported eagerly at module-load time.
let cached: SyntaxStyle | undefined
let cachedReasoning: SyntaxStyle | undefined

const REASONING_FG = "#888888"
const REASONING_CONCEAL_FG = "#444444"

// Markdown chunker + tree-sitter markdown grammar emit `markup.*` scopes. `SyntaxStyle.getStyleId` only falls back
// from `a.b.c` to the top-level `a`, so subscopes like `markup.list.checked` or `markup.link.bracket.close` need
// explicit registrations to inherit visual intent.
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
    "markup.link.bracket.close": { underline: true, fg: "#5fafff" },
    "markup.quote": { italic: true, fg: "#888888" },
    "markup.list": { fg: "#888888" },
    "markup.list.unchecked": { fg: "#888888" },
    "markup.list.checked": { fg: "#888888", dim: true },
    // `conceal` is consumed by MarkdownRenderable as the default border color for tables when no explicit borderColor
    // is provided. Picking a faint gray keeps tables visually consistent with our other muted chrome.
    conceal: { fg: "#444444" },
}

// Source-code token colors used by the OpenTUI tree-sitter grammars (TypeScript, JavaScript, ...).
const CODE_STYLES: Record<string, StyleDefinitionInput> = {
    comment: { fg: "#6c6c6c", italic: true },
    "comment.documentation": { fg: "#6c6c6c", italic: true },
    string: { fg: "#00ceb9" },
    "string.escape": { fg: "#00ceb9" },
    "string.regexp": { fg: "#9e9e9e" },
    "character.special": { fg: "#9e9e9e" },
    number: { fg: "#93e9f6" },
    boolean: { fg: "#93e9f6" },
    constant: { fg: "#93e9f6" },
    "constant.builtin": { fg: "#93e9f6" },
    function: { fg: "#ffba92" },
    "function.call": { fg: "#ffba92" },
    "function.method": { fg: "#ffba92" },
    "function.method.call": { fg: "#ffba92" },
    "function.builtin": { fg: "#ffba92" },
    constructor: { fg: "#ffba92" },
    type: { fg: "#ecf58c" },
    "type.builtin": { fg: "#ecf58c" },
    variable: { fg: "#efefef" },
    "variable.builtin": { fg: "#efefef" },
    "variable.member": { fg: "#ff9ae2" },
    property: { fg: "#ff9ae2" },
    attribute: { fg: "#ff9ae2" },
    keyword: { fg: "#6c6c6c" },
    "keyword.import": { fg: "#6c6c6c" },
    "keyword.return": { fg: "#6c6c6c" },
    "keyword.function": { fg: "#6c6c6c" },
    "keyword.conditional": { fg: "#6c6c6c" },
    "keyword.conditional.ternary": { fg: "#6c6c6c" },
    "keyword.operator": { fg: "#6c6c6c" },
    "keyword.modifier": { fg: "#6c6c6c" },
    "keyword.type": { fg: "#6c6c6c" },
    "keyword.repeat": { fg: "#6c6c6c" },
    "keyword.exception": { fg: "#6c6c6c" },
    "keyword.coroutine": { fg: "#6c6c6c" },
    "keyword.directive": { fg: "#6c6c6c" },
    operator: { fg: "#6c6c6c" },
    punctuation: { fg: "#6c6c6c" },
    "punctuation.bracket": { fg: "#6c6c6c" },
    "punctuation.delimiter": { fg: "#6c6c6c" },
    "punctuation.special": { fg: "#6c6c6c" },
    module: { fg: "#efefef" },
    "module.builtin": { fg: "#efefef" },
    label: { fg: "#ffba92" },
}

export function getMarkdownSyntaxStyle(): SyntaxStyle {
    if (!cached) {
        cached = SyntaxStyle.create()
        for (const [scope, style] of Object.entries(MARKDOWN_STYLES)) {
            cached.registerStyle(scope, style)
        }
        for (const [scope, style] of Object.entries(CODE_STYLES)) {
            cached.registerStyle(scope, style)
        }
    }
    return cached
}

// Reasoning content renders in a single muted grey.
// We strip token-specific colors so headings, code, links, etc. don't break the visual treatment,
// while keeping attributes (bold, italic, underline) so the markdown structure is still legible at a glance.
function toGreyStyles(styles: Record<string, StyleDefinitionInput>): Record<string, StyleDefinitionInput> {
    const result: Record<string, StyleDefinitionInput> = {}
    for (const [scope, style] of Object.entries(styles)) {
        const fg = scope === "conceal" ? REASONING_CONCEAL_FG : REASONING_FG
        result[scope] = { ...style, fg }
    }
    return result
}

export function getReasoningMarkdownSyntaxStyle(): SyntaxStyle {
    if (!cachedReasoning) {
        cachedReasoning = SyntaxStyle.create()
        for (const [scope, style] of Object.entries(toGreyStyles(MARKDOWN_STYLES))) {
            cachedReasoning.registerStyle(scope, style)
        }
        for (const [scope, style] of Object.entries(toGreyStyles(CODE_STYLES))) {
            cachedReasoning.registerStyle(scope, style)
        }
    }
    return cachedReasoning
}
