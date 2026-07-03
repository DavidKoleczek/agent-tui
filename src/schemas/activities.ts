import { type IsoTimestamp } from "./branded-types"

// Wire-protocol types for the agent-server `/agent` WebSocket.
// Field names and `type` discriminants match the server's Pydantic models exactly so JSON round-trips without a translation layer.
// See agent-server/docs/PROTOCOL.md and agent-server/src/agent_server/schemas/activity.py.

export type ActivityState = "in_progress" | "complete" | "error" | "cancelled"
export type TaskPermission = "accepted" | "denied" | "pending"
export type SessionConfigKey = "tool_preset" | "model"

// region: Client Events
// Client events are inbound commands from the client. They are not persisted as conversation history.

export interface UserMessageEvent {
    type: "user_message"
    content: string
}

export interface PermissionChangeEvent {
    type: "permission_change"
    id: string
    permission: TaskPermission
}

export interface CancelEvent {
    type: "cancel"
}

export interface QuitEvent {
    type: "quit"
}

export interface SessionConfigChangeEvent {
    type: "session_config_change"
    config_key: SessionConfigKey
    new_value: string
}

export type ClientEvent = UserMessageEvent | PermissionChangeEvent | CancelEvent | QuitEvent | SessionConfigChangeEvent

// endregion

// region: Session Activities
// Session activities are persisted session history that can be loaded by clients later.

export interface ActivityBase {
    id: string
    state: ActivityState
    timestamp: IsoTimestamp
}

export interface UserActivity extends ActivityBase {
    type: "user"
    content: string
}

export interface AssistantActivity extends ActivityBase {
    type: "assistant"
    content: string
}

export interface ReasoningActivity extends ActivityBase {
    type: "reasoning"
    content: string
}

export interface TaskActivity extends ActivityBase {
    type: "task"
    name: string
    permission: TaskPermission
    arguments: Record<string, unknown> | null
    result: string | null
}

export interface ErrorActivity extends ActivityBase {
    type: "error"
    error_type: string
    detail: string
}

export type SessionActivity = UserActivity | AssistantActivity | ReasoningActivity | TaskActivity | ErrorActivity

// A persisted activity together with its ordering metadata, as returned by the server's `GET /resume` endpoint.
// Mirrors agent-server/src/agent_server/schemas/session.py:SessionActivityRecord.
export interface SessionActivityRecord {
    id: string
    position: number
    timestamp: IsoTimestamp
    type: string
    state: ActivityState
    activity: SessionActivity
}

// endregion

// region: Streaming Events
// Streaming events are the live updates that the server sends to the client. They are ephemeral and not persisted.

export interface TaskArgumentDelta {
    key: string
    value: unknown
}

export interface ActivityDelta {
    content_delta?: string | null
    argument_delta?: TaskArgumentDelta | null
    result_delta?: string | null
    permission?: TaskPermission | null
}

export type StatusId =
    | "agent_starting"
    | "agent_ready"
    | "agent_cancelling"
    | "agent_cancelled"
    | "agent_stopping"
    | "agent_stopped"
    | "agent_running"
    | "agent_turn_ended"
    | "waiting_for_llm_response"
    | "processing_llm_response"
    | "executing_tool"
    | "starting_new_turn"

// Reports the agent's current lifecycle phase. The `status_id` field identifies the phase.
export interface StatusEvent {
    type: "status"
    status_id: StatusId
}

export interface ActivityCreatedEvent {
    type: "activity_created"
    activity: SessionActivity
}

// Patches an existing activity. Intended for streaming efficiency, so only changed fields are present.
export interface ActivityDeltaEvent {
    type: "activity_delta"
    activity_id: string
    delta: ActivityDelta
}

// Carries the complete, finalized activity, replacing any previously created or patched copy.
export interface ActivityUpdatedEvent {
    type: "activity_updated"
    activity: SessionActivity
}

// Confirms that a session config change requested via `SessionConfigChangeEvent` has been applied.
export interface SessionConfigChangedEvent {
    type: "session_config_changed"
    config_key: string
    new_value: string
}

export type StreamingEvent =
    | ActivityCreatedEvent
    | ActivityDeltaEvent
    | ActivityUpdatedEvent
    | StatusEvent
    | SessionConfigChangedEvent

// endregion
