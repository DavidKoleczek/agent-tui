import { posixPlatform } from "./posix"
import type { ServerPlatform } from "./types"
import { win32Platform } from "./win32"

// Single choice point for OS-conditional behavior across the server module.
// Every other file imports `platform` from here and treats it as opaque.
export const platform: ServerPlatform = process.platform === "win32" ? win32Platform : posixPlatform
