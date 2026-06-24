import type { SessionActivityRecord } from "../../schemas/activities"

export interface FetchSessionActivitiesOptions {
    // Base URL of the agent-server, e.g. "http://127.0.0.1:8123".
    baseUrl: string
    // Directory the session operated in.
    workingDir: string
    // Absolute path to the existing SQLite session database to resume.
    sessionDatabase: string
}

// Calls the agent-server `GET /resume` endpoint and returns the session's persisted activity history, ordered by position.
// Throws on a non-2xx response or transport failure so callers can surface the error.
export async function fetchSessionActivities(options: FetchSessionActivitiesOptions): Promise<SessionActivityRecord[]> {
    const { baseUrl, workingDir, sessionDatabase } = options
    const params = new URLSearchParams({ working_dir: workingDir, session_database: sessionDatabase })
    const url = `${baseUrl}/resume?${params.toString()}`

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`resume request failed: ${response.status} ${response.statusText}`)
    }

    const records = (await response.json()) as SessionActivityRecord[]
    return records
}
