// Shared color palette for the TUI. Use these semantic tokens instead of inline hex literals so colors
// stay consistent across components and can be adjusted in one place.
//
// The syntax highlighting theme lives separately in `src/lib/tui/syntax-style.ts` and is not part of this palette.
export const Colors = {
    // Subtle separator/border lines, e.g. the control tower frame.
    border: "#444444",
    // De-emphasized secondary text: placeholders, idle tabs, reasoning text, tool argument dumps.
    mutedText: "#888888",
    // Primary accent (brand blue). Used for status text and the focused/selected highlight background.
    accent: "#2EA6E0",
    // Accent blue with alpha, used as a translucent highlight background (e.g. user message bubbles).
    accentTranslucent: "#2da4f481",
    // Text drawn on top of an `accent` background, where dark-on-accent gives the most contrast.
    onAccentText: "#000000",
    // Bright foreground for the active (but unfocused) tab label.
    activeText: "#FFFFFF",
    // Background for error activity rows.
    errorBackground: "#ff4d4d",
    // Background for task (tool call) activity rows.
    taskBackground: "#1a1a1a",
} as const
