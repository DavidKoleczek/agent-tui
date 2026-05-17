import { type Activity, type ActivityStreamEvent } from "../../schemas/activities"
import { apply } from "./reducer"

export interface ActivityStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => readonly Activity[]
    applyEvent: (event: ActivityStreamEvent) => void
    nextId: (prefix: string) => string
    reset: () => void
}

// In-memory store. Caches the snapshot reference so the reducer's no-op-returns-same-array
// guarantee flows through to `useSyncExternalStore` (which uses Object.is on the snapshot).
// Owns the monotonic id counter so callers never collide and the reducer's id-uniqueness
// precondition cannot be violated.
export function createActivityStore(): ActivityStore {
    let activities: readonly Activity[] = []
    const listeners = new Set<() => void>()
    let counter = 0

    return {
        subscribe(listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        getSnapshot() {
            return activities
        },
        applyEvent(event) {
            const next = apply(event, activities)
            if (next === activities) return
            activities = next
            for (const listener of listeners) listener()
        },
        nextId(prefix) {
            counter += 1
            return `${prefix}-${counter}`
        },
        reset() {
            if (activities.length === 0 && counter === 0) return
            activities = []
            counter = 0
            for (const listener of listeners) listener()
        },
    }
}
