export interface HealthResult {
    ok: boolean
    attempts: number
    elapsedMs: number
    lastStatus?: number
    lastError?: string
}

export interface WaitForHealthzOptions {
    port: number
    totalMs?: number
    intervalMs?: number
    perRequestMs?: number
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Polls GET /healthz at a fixed cadence until either a 200 arrives or the total window elapses.
// Connection errors, request timeouts, and non-200 responses are all treated as "not ready"
// so the poll keeps going while uvicorn is still binding the socket or FastAPI is still starting up.
export async function waitForHealthz(options: WaitForHealthzOptions): Promise<HealthResult> {
    const { port, totalMs = 120_000, intervalMs = 250, perRequestMs = 1_000 } = options
    const url = `http://127.0.0.1:${port}/healthz`
    const started = Date.now()
    let attempts = 0
    let lastStatus: number | undefined
    let lastError: string | undefined

    while (Date.now() - started < totalMs) {
        attempts += 1
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), perRequestMs)
        try {
            const res = await fetch(url, { signal: ctrl.signal })
            lastStatus = res.status
            if (res.status === 200) {
                return { ok: true, attempts, elapsedMs: Date.now() - started, lastStatus: 200 }
            }
        } catch (err) {
            lastError = (err as Error).message
        } finally {
            clearTimeout(timer)
        }

        await sleep(intervalMs)
    }

    return { ok: false, attempts, elapsedMs: Date.now() - started, lastStatus, lastError }
}
