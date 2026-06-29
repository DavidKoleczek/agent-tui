import { homedir } from "node:os"
import { join } from "node:path"

// The single root every runtime artifact lives under.
export const MANAGED_ROOT = join(homedir(), ".agents", "tui")

// APP_VERSION is replaced at build time by `bun build --define`, but is absent in dev
declare const APP_VERSION: string | undefined
export const appVersion: string = typeof APP_VERSION === "string" && APP_VERSION.length > 0 ? APP_VERSION : "0.0.0-dev"

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

// Lines advanced per mouse-wheel tick in the activity log.
export const DEFAULT_SCROLL_SPEED = 5

// Minimum scrollbar thumb height in terminal cells.
export const MIN_SCROLLBAR_THUMB_CELLS = 1.4
