import { useEffect, useState } from "react"
import type { StatusId } from "../../schemas/activities"
import { useDotBounce } from "./use-dot-bounce"
import { Colors } from "../../lib/constants"
import { StatusBackButton } from "./status-back-button"

const HIDDEN_STATUS_IDS = ["agent_turn_ended"] as const satisfies readonly StatusId[]
const NON_ANIMATED_STATUS_IDS = ["agent_stopped"] as const satisfies readonly StatusId[]
const AGENT_RUNNING_VISIBLE_MS = 2_000

type HiddenStatusId = (typeof HIDDEN_STATUS_IDS)[number]

interface StatusLineProps {
    // Whether the WebSocket connection is open. While false, the line shows the out-of-band initialization label.
    ready: boolean
    // The latest server lifecycle status. agent_running is shown briefly, while agent_turn_ended renders without a label.
    status: StatusId | null
    onBack?: () => void
}

// This label lives outside the server-sent status set because it is shown before the WebSocket opens.
const LOADING_LABEL = "Server initializing"

const STATUS_LABELS: Record<Exclude<StatusId, HiddenStatusId>, string> = {
    agent_starting: "Agent starting",
    agent_ready: "Agent almost ready",
    agent_running: "Agent running",
    agent_cancelling: "Agent cancelling",
    agent_cancelled: "Agent cancelled",
    agent_stopping: "Agent stopping",
    agent_stopped: "Agent successfully finished",
    processing_message: "Processing message",
    waiting_for_llm_response: "Waiting for LLM response",
    processing_llm_response: "Processing LLM response",
    executing_tool: "Executing tool",
    starting_new_turn: "Starting new turn",
}

function resolveLabel(ready: boolean, status: StatusId | null): string {
    if (!ready) return LOADING_LABEL
    if (status === null || isHiddenStatus(status)) return ""
    return STATUS_LABELS[status]
}

export function StatusLine({ ready, status, onBack }: StatusLineProps) {
    const label = resolveLabel(ready, status)
    const agentRunning = ready && status === "agent_running"
    // A stopped agent is stable; initialization and transitional statuses retain the activity indicator.
    const dots = useDotBounce(!agentRunning && label !== "" && (!ready || !isNonAnimatedStatus(status)))

    return (
        // Fixed-height row that is always present so the indicator can appear and clear without shifting the layout.
        <box width="100%" height={1} flexShrink={0} paddingLeft={1} flexDirection="row" columnGap={1}>
            {onBack === undefined ? null : <StatusBackButton onPress={onBack} />}
            {agentRunning ? (
                <TransientAgentRunningStatus />
            ) : (
                <text fg={Colors.accent}>{label === "" ? "" : `${label}${dots}`}</text>
            )}
        </box>
    )
}

function TransientAgentRunningStatus() {
    const [visible, setVisible] = useState(true)
    const dots = useDotBounce(visible)

    useEffect(() => {
        const timeout = setTimeout(() => setVisible(false), AGENT_RUNNING_VISIBLE_MS)
        return () => clearTimeout(timeout)
    }, [])

    return <text fg={Colors.accent}>{visible ? `${STATUS_LABELS.agent_running}${dots}` : ""}</text>
}

function isHiddenStatus(status: StatusId): status is HiddenStatusId {
    return HIDDEN_STATUS_IDS.some((hiddenStatus) => hiddenStatus === status)
}

function isNonAnimatedStatus(status: StatusId | null): boolean {
    return status !== null && NON_ANIMATED_STATUS_IDS.some((nonAnimatedStatus) => nonAnimatedStatus === status)
}
