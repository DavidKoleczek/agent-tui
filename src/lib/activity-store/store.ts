/* Stores a list of SessionActivity objects.
The webserver streams StreamingEvents which will be converted into SessionActivities as they come in.
*/

import {
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
    pushUserMessage: (content: string) => void
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
        pushUserMessage(content) {
            const userActivity: UserActivity = {
                id: crypto.randomUUID(),
                agent_id: "main",
                type: "user",
                state: "complete",
                timestamp: nowIso(),
                content,
            }
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
            notify(applyStreamingEvent(event, activities, log))
        },
        seedActivities(seed) {
            const next = new Map<string, SessionActivity>()
            for (const activity of seed) next.set(activity.id, activity)
            notify(next)
        },
        reset() {
            if (activities.size === 0) return
            notify(new Map())
        },
    }
}
