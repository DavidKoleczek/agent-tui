/* Stores a list of SessionActivity objects.
The webserver streams StreamingEvents which will be converted into SessionActivities as they come in.
*/

import {
    MAIN_AGENT_ID,
    type SessionActivity,
    type UserActivity,
    type TaskActivity,
    type TaskPermission,
    type StreamingEvent,
} from "../../schemas/activities"
import { nowIso } from "../../schemas/branded-types"
import { applyStreamingEvent, type ReducerLog, noopLog, setActivity } from "./reducer"

export interface ActivityStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => ReadonlyMap<string, SessionActivity>
    pushOptimisticUserMessage: (content: string) => void
    // Optimistically records a tool approval decision so the UI reacts instantly; reconciled by the server's echo.
    setTaskPermission: (agentId: string, id: string, permission: TaskPermission) => void
    applyStreamingEvent: (event: StreamingEvent) => void
    // Replaces the entire activity map with a known set, used when resuming a prior session.
    seedActivities: (activities: readonly SessionActivity[]) => void
    reset: () => void
}

export interface CreateActivityStoreOptions {
    // Sink for protocol anomalies surfaced by the reducer. Defaults to a no-op.
    log?: ReducerLog
}

export function createActivityStore(options: CreateActivityStoreOptions = {}): ActivityStore {
    const log = options.log ?? noopLog
    let activities: ReadonlyMap<string, SessionActivity> = new Map()
    const pendingOptimisticUserActivityIds: string[] = []
    const listeners = new Set<() => void>()

    const notify = (next: ReadonlyMap<string, SessionActivity>): void => {
        // Reducer returns the current map when an event does not change the activity state.
        // Otherwise, it must create a new map.
        if (next === activities) return
        activities = next
        for (const listener of listeners) listener()
    }

    return {
        // subscribe and getSnapshot are used by React's useSyncExternalStore to read and re-render on changes.
        subscribe(listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        getSnapshot() {
            return activities
        },
        pushOptimisticUserMessage(content) {
            const userActivity: UserActivity = {
                id: crypto.randomUUID(),
                agent_id: MAIN_AGENT_ID,
                type: "user",
                state: "complete",
                timestamp: nowIso(),
                content,
            }
            pendingOptimisticUserActivityIds.push(userActivity.id)
            notify(setActivity(activities, userActivity))
        },
        setTaskPermission(agentId, id, permission) {
            // Patch only the permission: the status dot derives from state + permission, and the server's echoed
            // activity update reconciles the authoritative state and result a moment later.
            const existing = activities.get(id)
            if (existing === undefined) {
                log.warn(`permission change for unknown activity ${id}; ignoring it`)
                return
            }
            if (existing.type !== "task") {
                log.warn(`permission change for non-task activity ${id}; ignoring it`)
                return
            }
            if (existing.agent_id !== agentId) {
                log.warn(
                    `permission change for activity ${id} owned by agent ${existing.agent_id} was attributed to agent ${agentId}; ignoring it`,
                )
                return
            }
            if (existing.permission === permission) return
            const updated: TaskActivity = { ...existing, permission }
            notify(setActivity(activities, updated))
        },
        // Takes a StreamingEvent, runs it through the applyStreamingEvent reducer
        // which either returns a new map, or the current one, and then notifies subscribers.
        applyStreamingEvent(event) {
            if (
                event.type === "activity_created" &&
                event.agent_id === MAIN_AGENT_ID &&
                event.activity.type === "user" &&
                event.activity.agent_id === event.agent_id
            ) {
                // The server assigns its own ID, so reconcile its echo with the oldest optimistic entry.
                const optimisticId = pendingOptimisticUserActivityIds.shift()
                if (optimisticId !== undefined && activities.has(optimisticId)) {
                    notify(replaceActivityPreservingOrder(activities, optimisticId, event.activity))
                    return
                }
            }
            notify(applyStreamingEvent(event, activities, log))
        },
        seedActivities(seed) {
            pendingOptimisticUserActivityIds.length = 0
            const next = new Map<string, SessionActivity>()
            for (const activity of seed) next.set(activity.id, activity)
            notify(next)
        },
        reset() {
            pendingOptimisticUserActivityIds.length = 0
            if (activities.size === 0) return
            notify(new Map())
        },
    }
}

function replaceActivityPreservingOrder(
    current: ReadonlyMap<string, SessionActivity>,
    replacedId: string,
    replacement: SessionActivity,
): ReadonlyMap<string, SessionActivity> {
    const next = new Map<string, SessionActivity>()
    for (const [id, activity] of current) {
        if (id === replacedId) next.set(replacement.id, replacement)
        else next.set(id, activity)
    }
    return next
}
