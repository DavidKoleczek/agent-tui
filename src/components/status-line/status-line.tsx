import type { StatusId } from "../../schemas/activities"
import { useDotBounce } from "./use-dot-bounce"
import { Colors } from "../../lib/constants"

interface StatusLineProps {
    // Whether the agent connection is ready. While false, the line shows the out-of-band "Server initializing" label.
    ready: boolean
    // The latest server lifecycle status, or null when there is nothing to show (idle or after agent_turn_ended).
    status: StatusId | null
}

// Shown while the connection is not ready.
// This status lives outside the server-sent set and signals that the agent server has not started yet.
const LOADING_LABEL = "Server initializing"

const STATUS_LABELS: Record<Exclude<StatusId, "agent_running">, string> = {
    agent_starting: "Agent starting",
    agent_ready: "Agent almost ready",
    agent_cancelling: "Agent cancelling",
    agent_cancelled: "Agent cancelled",
    agent_stopping: "Agent stopping",
    agent_stopped: "Agent stopped",
    agent_turn_ended: "Returning to idle",
    waiting_for_llm_response: "Waiting for LLM response",
    processing_llm_response: "Processing LLM response",
    executing_tool: "Executing tool",
    starting_new_turn: "Starting new turn",
}

function resolveLabel(ready: boolean, status: StatusId | null): string {
    if (!ready) return LOADING_LABEL
    if (status === null || status === "agent_running") return ""
    return STATUS_LABELS[status]
}

export function StatusLine({ ready, status }: StatusLineProps) {
    const label = resolveLabel(ready, status)
    // Animate the dots whenever there is an active label, whether that is "Server initializing" or a server status.
    const dots = useDotBounce(label !== "")

    return (
        // Fixed-height row that is always present so the indicator can appear and clear without shifting the layout.
        <box width="100%" height={1} flexShrink={0} paddingLeft={1}>
            <text fg={Colors.accent}>{label === "" ? "" : `${label}${dots}`}</text>
        </box>
    )
}
