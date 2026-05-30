/** Handles new activities as they come in and updates the activity list accordingly. */

import type OpenAI from "openai"
import { fraction } from "../../lib/branded-types"
import { type Activity, type AssistantActivity } from "../../schemas/activities"
import { createInProgressAssistant, createInProgressReasoning, createUserActivity } from "./factories"

type ReasoningDeltaEvent = OpenAI.Responses.ResponseReasoningSummaryTextDeltaEvent
type TextDeltaEvent = OpenAI.Responses.ResponseTextDeltaEvent

function lastInProgress(current: readonly Activity[]): Activity | undefined {
    const last = current[current.length - 1]
    if (last === undefined) return undefined
    if (last.state !== "in_progress") return undefined
    return last
}

function closeCurrent(current: readonly Activity[]): readonly Activity[] {
    const last = lastInProgress(current)
    if (last === undefined) return current
    const next = current.slice()
    next[next.length - 1] = { ...last, state: "complete", progress: fraction(1) }
    return next
}

function appendDelta(
    current: readonly Activity[],
    kind: "reasoning" | "assistant",
    delta: string,
    nextId: () => string,
): readonly Activity[] {
    if (delta.length === 0) return current

    const last = lastInProgress(current)
    if (last !== undefined && last.type === kind) {
        // `kind` constrains `last.type` to either "reasoning" or "assistant", both of which
        // expose a `content: string` field, so this object spread stays type-safe.
        const next = current.slice()
        next[next.length - 1] = { ...last, content: last.content + delta }
        return next
    }

    const closed = closeCurrent(current)
    const fresh =
        kind === "reasoning" ? createInProgressReasoning(nextId(), delta) : createInProgressAssistant(nextId(), delta)
    return [...closed, fresh]
}

function applyOpenAiEvent(
    event: OpenAI.Responses.ResponseStreamEvent,
    current: readonly Activity[],
    nextId: () => string,
): readonly Activity[] {
    switch (event.type) {
        case "response.reasoning_summary_text.delta": {
            const delta = (event as ReasoningDeltaEvent).delta
            return appendDelta(current, "reasoning", delta, nextId)
        }
        case "response.output_text.delta": {
            const delta = (event as TextDeltaEvent).delta
            return appendDelta(current, "assistant", delta, nextId)
        }
        default:
            return closeCurrent(current)
    }
}

/** Handles the new activity, optionally creates a new list of activities. */
export function applyServer(
    activity: AssistantActivity,
    current: readonly Activity[],
    nextId: () => string,
): readonly Activity[] {
    switch (activity.type) {
        case "openai_stream":
            return applyOpenAiEvent(activity.stream_event, current, nextId)
        case "ready":
        case "turn_start":
        case "turn_end":
        case "error":
        case "router_response":
            return closeCurrent(current)
    }
}

export function applyUserMessage(content: string, id: string, current: readonly Activity[]): readonly Activity[] {
    // Defensive close-current: between turns there should be no in-progress activity, but if
    // the previous turn dropped its `turn_end` we don't want a lingering streaming block.
    const closed = closeCurrent(current)
    return [...closed, createUserActivity(id, content)]
}
