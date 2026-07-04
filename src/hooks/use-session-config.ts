import { useCallback, useMemo, useRef, useState } from "react"
import { type SessionCapabilities, type SessionConfigValues } from "../schemas/rest-endpoints"
import { MODEL_ALLOWLIST } from "../lib/constants"
import { fetchCapabilities, fetchSessionConfig } from "../lib/server/rest-endpoints"

const EMPTY_VALUES: SessionConfigValues = {}

// A single config option prepared for display: friendly label plus the value choices to render as buttons.
export interface ControlOption {
    key: string
    label: string
    values: string[]
}

// The tower's config view-model
export interface ControlConfigState {
    loaded: boolean // gates interaction until the first fetch resolves.
    options: readonly ControlOption[]
    current: SessionConfigValues
}

export interface LoadSessionConfigArgs {
    baseUrl: string
    sessionDatabase: string
}

export interface SessionConfigController {
    // The view-model consumed by the Control tower
    state: ControlConfigState
    load: (args: LoadSessionConfigArgs) => void
    // Optimistically updates a value locally in response to a user action.
    setLocal: (key: string, value: string) => void
    // Reconciles a value from the server's SessionConfigChangedEvent confirmation.
    applyConfirmed: (key: string, value: string) => void
    reset: () => void
}

// Owns the Control tower's session config state: fetches capabilities and current values, applies optimistic
// updates, and reconciles server confirmations. A monotonic load id drops stale fetch results when the session
// swaps (e.g. resume) so a slow in-flight fetch cannot clobber the newer session.
export function useSessionConfig(): SessionConfigController {
    const [capabilities, setCapabilities] = useState<SessionCapabilities | null>(null)
    const [current, setCurrent] = useState<SessionConfigValues | null>(null)
    const loadIdRef = useRef(0)

    const state = useMemo<ControlConfigState>(() => {
        if (capabilities === null || current === null) {
            return { loaded: false, options: [], current: EMPTY_VALUES }
        }
        return { loaded: true, options: buildControlOptions(capabilities, current), current }
    }, [capabilities, current])

    const load = useCallback((args: LoadSessionConfigArgs) => {
        const id = ++loadIdRef.current
        void (async () => {
            let capabilitiesResult: SessionCapabilities
            try {
                capabilitiesResult = await fetchCapabilities({ baseUrl: args.baseUrl })
            } catch {
                // Leave the state unloaded so the gate stays disabled rather than showing a wrong config.
                return
            }
            if (id !== loadIdRef.current) return

            // Callers gate this on agent_running, so the session database exists and a single read suffices.
            // A 404 or transport error is unexpected here; fall back to the advertised defaults so the gate opens.
            let values: SessionConfigValues | null = null
            try {
                values = await fetchSessionConfig({ baseUrl: args.baseUrl, sessionDatabase: args.sessionDatabase })
            } catch {
                values = null
            }
            if (id !== loadIdRef.current) return
            setCapabilities(capabilitiesResult)
            setCurrent(values ?? defaultsFromCapabilities(capabilitiesResult))
        })()
    }, [])

    const setLocal = useCallback((key: string, value: string) => {
        setCurrent((prev) => (prev === null ? prev : { ...prev, [key]: value }))
    }, [])

    const applyConfirmed = useCallback((key: string, value: string) => {
        setCurrent((prev) => (prev === null ? prev : { ...prev, [key]: value }))
    }, [])

    const reset = useCallback(() => {
        loadIdRef.current++
        setCapabilities(null)
        setCurrent(null)
    }, [])

    return { state, load, setLocal, applyConfirmed, reset }
}

const MODEL_KEY = "model"

// Prepares each advertised option for display.
// MODEL_KEY is a special case whose values are intersected with the allowlist.
// If the active model is outside the allowlist it is still shown, prepended so the running model stays visible.
function buildControlOptions(capabilities: SessionCapabilities, current: SessionConfigValues): ControlOption[] {
    return capabilities.options.map((option) => {
        if (option.key !== MODEL_KEY) return { key: option.key, label: option.label, values: option.values }
        let values = MODEL_ALLOWLIST.filter((model) => option.values.includes(model))
        const activeModel = current[MODEL_KEY]
        if (activeModel !== undefined && activeModel !== "" && !values.includes(activeModel)) {
            values = [activeModel, ...values]
        }
        return { key: option.key, label: option.label, values }
    })
}

// The advertised defaults, used to seed a session's current values when `GET /session-config` cannot be read.
function defaultsFromCapabilities(capabilities: SessionCapabilities): SessionConfigValues {
    return Object.fromEntries(capabilities.options.map((option): [string, string] => [option.key, option.default]))
}
