import type { StatusId } from "../../schemas/activities"
import { useDotBounce } from "./use-dot-bounce"
import { Colors } from "../../lib/constants"

interface StatusLineProps {
    // Whether the agent connection is ready. While false, the line shows the out-of-band "Server initializing" label.
    ready: boolean
    // The latest server lifecycle status, or null when there is nothing to show (idle or after agent_run_ended).
    status: StatusId | null
}

// Shown while the connection is not ready.
// This status lives outside the server-sent set and signals that the agent server has not started yet.
const LOADING_LABEL = "Server initializing"

const STATUS_LABELS: Record<Exclude<StatusId, "agent_run_ended">, string> = {
    agent_starting: "Agent starting",
    agent_running: "Agent running",
    starting_new_turn: "Starting new turn",
    waiting_for_llm_response: "Waiting for LLM response",
    processing_llm_response: "Processing LLM response",
    executing_tool: "Executing tool",
}

function resolveLabel(ready: boolean, status: StatusId | null): string {
    if (!ready) return LOADING_LABEL
    if (status === null || status === "agent_run_ended") return ""
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
