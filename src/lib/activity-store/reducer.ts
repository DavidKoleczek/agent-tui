/** Handles incoming StreamingEvents and folds them into the activity map. */

import {
    type ActivityDelta,
    type SessionActivity,
    type StreamingEvent,
    type TaskActivity,
} from "../../schemas/activities"

export interface ReducerLog {
    warn(message: string): void
}

export const noopLog: ReducerLog = {
    warn() {},
}

// region: Event reducer

// Translates a single StreamingEvent into the next activity map. Returns the current map unchanged when the
// event does not affect activity state, preserving snapshot identity for React's useSyncExternalStore.
export function applyStreamingEvent(
    streamingEvent: StreamingEvent,
    current: ReadonlyMap<string, SessionActivity>,
    log: ReducerLog = noopLog,
): ReadonlyMap<string, SessionActivity> {
    switch (streamingEvent.type) {
        case "status":
            // Lifecycle signals carry no activity; the store tracks only activities.
            return current

        case "activity_created": {
            const { activity } = streamingEvent
            if (current.has(activity.id)) {
                log.warn(`activity_created for existing activity ${activity.id}; replacing it`)
            }
            return setActivity(current, activity)
        }

        case "activity_updated": {
            const { activity } = streamingEvent
            if (!current.has(activity.id)) {
                log.warn(`activity_updated for unknown activity ${activity.id}; inserting it`)
            }
            return setActivity(current, activity)
        }

        case "activity_delta": {
            const existing = current.get(streamingEvent.activity_id)
            if (existing === undefined) {
                log.warn(`activity_delta for unknown activity ${streamingEvent.activity_id}; ignoring it`)
                return current
            }
            return setActivity(current, applyDelta(existing, streamingEvent.delta, log))
        }
    }
}

export function setActivity(
    current: ReadonlyMap<string, SessionActivity>,
    activity: SessionActivity,
): ReadonlyMap<string, SessionActivity> {
    // Copy-on-write update helper. Returning the current map preserves snapshot identity for no-op updates.
    if (current.get(activity.id) === activity) return current

    const next = new Map(current)
    next.set(activity.id, activity)
    return next
}

// endregion

// region: Delta application

// `ActivityDelta` does not statically tie its fields to the activity type they target,
// so we branch on the activity's `type` and apply only the fields that make sense.
// Returns the same reference when nothing changed so callers can preserve snapshot identity.
function applyDelta(activity: SessionActivity, delta: ActivityDelta, log: ReducerLog): SessionActivity {
    switch (activity.type) {
        case "user":
        case "assistant":
        case "reasoning":
            return applyContentDelta(activity, delta, log)
        case "task":
            return applyTaskDelta(activity, delta, log)
        case "error":
            // Error activities are terminal and never patched.
            warnFields(log, activity, delta, [])
            return activity
    }
}

type ContentActivity = Extract<SessionActivity, { content: string }>

function applyContentDelta(activity: ContentActivity, delta: ActivityDelta, log: ReducerLog): SessionActivity {
    warnFields(log, activity, delta, ["content_delta"])

    const contentDelta = delta.content_delta
    if (contentDelta === undefined || contentDelta === null || contentDelta === "") return activity
    return { ...activity, content: activity.content + contentDelta }
}

function applyTaskDelta(activity: TaskActivity, delta: ActivityDelta, log: ReducerLog): SessionActivity {
    warnFields(log, activity, delta, ["argument_delta", "result_delta", "permission"])

    let next = activity

    // Set a single argument key to its current value, initializing `arguments` from null on the first delta.
    if (delta.argument_delta !== undefined && delta.argument_delta !== null) {
        const { key, value } = delta.argument_delta
        // The value replaces any prior value for that key; this is not a deep merge.
        next = { ...next, arguments: { ...(next.arguments ?? {}), [key]: value } }
    }

    // Append streamed tool output to `result`, treating a null result as the empty string.
    const resultDelta = delta.result_delta
    if (resultDelta !== undefined && resultDelta !== null && resultDelta !== "") {
        next = { ...next, result: (next.result ?? "") + resultDelta }
    }

    // Replace the permission decision with the latest one from the server.
    if (delta.permission !== undefined && delta.permission !== null) {
        next = { ...next, permission: delta.permission }
    }

    return next
}

// Logs any delta field that carries a value but is not applicable to the target activity type.
function warnFields(
    log: ReducerLog,
    activity: SessionActivity,
    delta: ActivityDelta,
    applicable: ReadonlyArray<keyof ActivityDelta>,
): void {
    for (const field of ["content_delta", "argument_delta", "result_delta", "permission"] as const) {
        if (delta[field] === undefined || delta[field] === null) continue
        if (applicable.includes(field)) continue
        log.warn(
            `activity_delta field "${field}" is not applicable to ${activity.type} activity ${activity.id}; ignoring it`,
        )
    }
}

// endregion
