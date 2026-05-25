import type OpenAI from "openai"

// Wire-protocol types for the agent-server `/agent` WebSocket.
// Field names and `type` discriminants match the server's Pydantic models exactly so JSON round-trips without a translation layer.
// See agent-server/docs/PROTOCOL.md and agent-server/src/agent_server/schemas/activity.py.

// region: Client -> Server

export interface UserActivity {
    type: "user_message"
    content: string
}

export interface CancelActivity {
    type: "cancel"
}

export interface QuitActivity {
    type: "quit"
}

export type ClientActivity = UserActivity | CancelActivity | QuitActivity

// endregion

// region: Server -> Client

export interface ReadyActivity {
    type: "ready"
}

export interface TurnStartActivity {
    type: "turn_start"
}

export interface TurnEndActivity {
    type: "turn_end"
}

export type ErrorActivityType = "invalid_client_activity_format" | "agent_error"

export interface ErrorActivity {
    type: "error"
    error_type: ErrorActivityType
    detail: string
}

export interface OpenAIStreamActivity {
    type: "openai_stream"
    model_name: string
    stream_event: OpenAI.Responses.ResponseStreamEvent
}

// `response` is interop-router's `RouterResponse`. No TS package exists yet, so it stays
// opaque until we actually consume it.
export interface RouterResponseActivity {
    type: "router_response"
    response: unknown
}

export type AssistantActivity =
    | ReadyActivity
    | TurnStartActivity
    | TurnEndActivity
    | ErrorActivity
    | OpenAIStreamActivity
    | RouterResponseActivity

// endregion
