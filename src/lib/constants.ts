import { homedir } from "node:os"
import { join } from "node:path"

// Root of the `.agents` directory where the tui and other agents keep their data, configs, and logs.
export const DATA_ROOT = join(homedir(), ".agents")

// The subtree the tui installs and removes on uninstall.
export const MANAGED_ROOT = join(DATA_ROOT, "tui")

// Version used when no real version was injected at build time (i.e. `bun dev`).
export const DEV_VERSION = "0.0.0-dev"

// APP_VERSION is replaced at build time by `bun build --define`, but is absent in dev
declare const APP_VERSION: string | undefined
export const appVersion: string = typeof APP_VERSION === "string" && APP_VERSION.length > 0 ? APP_VERSION : DEV_VERSION

// Releases URL the updater fetches
export const MANIFEST_URL = "https://github.com/DavidKoleczek/agent-tui/releases/latest/download/latest.json"

export const Colors = {
    // Subtle separator/border lines, e.g. the control tower frame.
    border: "#444444",
    // De-emphasized secondary text: placeholders, idle tabs, reasoning text, tool argument dumps.
    mutedText: "#888888",
    // Primary accent (brand blue). Used for status text and the focused/selected highlight background.
    accent: "#2EA6E0",
    // Accent blue with alpha, used as a translucent highlight background (e.g. user message bubbles).
    accentTranslucent: "#2c658b77",
    // Text drawn on top of an `accent` background, where dark-on-accent gives the most contrast.
    onAccentText: "#000000",
    // Bright foreground for the active (but unfocused) tab label.
    activeText: "#FFFFFF",
    // Background for error activity rows.
    errorBackground: "#ff4d4d",
    // Attention foreground for status dots: a pending or denied tool permission.
    warning: "#f2c94c",
    // Error foreground for status dots. Shares the error red, but is a foreground marker rather than a row background.
    danger: "#ff4d4d",
    // Subtle background shown only while a task is hovered, signaling it is interactive.
    rowHover: "#1a1a1a",
    // Opaque background for the expanded task overlay so the activity log behind it does not bleed through.
    overlayBackground: "#0d0d0d",
} as const

export const DEFAULT_MODEL = "gpt-5.6-sol"

// Only show these models even if the API returns more.
export const MODEL_ALLOWLIST: readonly string[] = [
    DEFAULT_MODEL,
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "claude-opus-4-8",
    "claude-sonnet-5",
    "gemini-3.5-flash",
]

// Lines advanced per mouse-wheel tick in the activity log.
export const DEFAULT_SCROLL_SPEED = 5

// Minimum scrollbar thumb height in terminal cells.
export const MIN_SCROLLBAR_THUMB_CELLS = 1.4
