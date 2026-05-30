import { type Activity, type AssistantActivity } from "../../schemas/activities"
import { applyServer, applyUserMessage } from "./reducer"

export interface ActivityStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => readonly Activity[]
    pushUserMessage: (content: string) => void
    applyServerActivity: (activity: AssistantActivity) => void
    nextId: (prefix: string) => string
    reset: () => void
}

export function createActivityStore(): ActivityStore {
    let activities: readonly Activity[] = []
    const listeners = new Set<() => void>()
    let counter = 0

    const nextId = (prefix: string): string => {
        counter += 1
        return `${prefix}-${counter}`
    }

    const notify = (next: readonly Activity[]): void => {
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
        // Appends user's typed message
        pushUserMessage(content) {
            notify(applyUserMessage(content, nextId("user"), activities))
        },
        // Takes an AssistantActivity, runs it through the applyServer reducer to produce the new list of Activities, and then notifies subscribers.
        applyServerActivity(activity) {
            notify(
                applyServer(activity, activities, () => {
                    const prefix = activity.type === "openai_stream" ? "stream" : "evt"
                    return nextId(prefix)
                }),
            )
        },
        nextId,
        reset() {
            if (activities.length === 0 && counter === 0) return
            activities = []
            counter = 0
            // Notifies each subscriber that the activities have been reset.
            for (const listener of listeners) listener()
        },
    }
}
