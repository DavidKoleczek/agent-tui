// HTTP response shapes for agent-server config REST endpoints.
// Field names match the server's Pydantic models exactly so JSON round-trips without a translation layer.
// See agent-server/src/agent_server/routes/capabilities.py and routes/session_config.py.

// One changeable config option as advertised by `GET /capabilities`. Keys are opaque to the client: it renders
// whatever the server advertises rather than enumerating a fixed set.
export interface ConfigOption {
    key: string
    label: string
    values: string[]
    default: string
}

// Response body of `GET /capabilities`.
export interface SessionCapabilities {
    options: ConfigOption[]
}

// Response body of `GET /session-config`: the current stored value for each config key, keyed by ConfigOption.key.
export type SessionConfigValues = Record<string, string>
