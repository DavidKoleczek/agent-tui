// Simple GET wrappers for agent-server HTTP endpoints.
import type { SessionCapabilities, SessionConfigValues } from "../../schemas/rest-endpoints"

export interface FetchCapabilitiesOptions {
    baseUrl: string
}

// Calls `GET /capabilities` and returns the changeable session config options, each with its display label,
// valid values, and default.
export async function fetchCapabilities(options: FetchCapabilitiesOptions): Promise<SessionCapabilities> {
    const { baseUrl } = options
    const response = await fetch(`${baseUrl}/capabilities`)
    if (!response.ok) {
        throw new Error(`capabilities request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as SessionCapabilities
}

export interface FetchSessionConfigOptions {
    baseUrl: string
    // Absolute path to the session's SQLite database, e.g.
    // "C:\Users\me\project\.agents\sessions\project_2026-07-03-141530_1a2b3c4d.sqlite".
    sessionDatabase: string
}

// Calls `GET /session-config` and returns the session's current stored config. Returns null on a 404, meaning
// the database file does not exist yet. Callers query this only once the agent worker is running (the
// agent_running status), by which point the worker has created the database, so a null result is not expected.
export async function fetchSessionConfig(options: FetchSessionConfigOptions): Promise<SessionConfigValues | null> {
    const { baseUrl, sessionDatabase } = options
    const params = new URLSearchParams({ session_database: sessionDatabase })
    const response = await fetch(`${baseUrl}/session-config?${params.toString()}`)
    if (response.status === 404) return null
    if (!response.ok) {
        throw new Error(`session-config request failed: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as SessionConfigValues
}
