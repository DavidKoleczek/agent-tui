import { fraction } from "../../lib/branded-types"
import { type Activity, type ActivityStreamEvent } from "../../schemas/activities"
import {
    createInProgressAssistant,
    createInProgressReasoning,
    createUserActivity,
} from "../../schemas/activities/factories"

type MarkdownActivity = Extract<Activity, { type: "assistant" | "reasoning" }>

function isMarkdownBearing(activity: Activity): activity is MarkdownActivity {
    return activity.type === "assistant" || activity.type === "reasoning"
}

function findById(activities: readonly Activity[], id: string): Activity | undefined {
    for (const activity of activities) {
        if (activity.id === id) return activity
    }
    return undefined
}

function replaceById(activities: readonly Activity[], id: string, next: Activity): readonly Activity[] {
    const result = activities.slice()
    for (let i = 0; i < result.length; i += 1) {
        if (result[i]!.id === id) {
            result[i] = next
            return result
        }
    }
    return activities
}

// Pure, side-effect-free reducer. Returns the same array reference for no-op events so
// `useSyncExternalStore` (which uses Object.is on the snapshot) skips work. On mutating
// events returns a new array with every unchanged slot pointing at the previous activity
// object so memoized row components stay referentially equal.
export function apply(event: ActivityStreamEvent, current: readonly Activity[]): readonly Activity[] {
    switch (event.type) {
        case "user.submit": {
            if (findById(current, event.id)) return current
            return [...current, createUserActivity(event.id, event.content)]
        }
        case "assistant.start": {
            if (findById(current, event.id)) return current
            return [...current, createInProgressAssistant(event.id)]
        }
        case "reasoning.start": {
            if (findById(current, event.id)) return current
            return [...current, createInProgressReasoning(event.id)]
        }
        case "delta": {
            const target = findById(current, event.id)
            if (!target || !isMarkdownBearing(target) || target.state !== "in_progress") return current
            if (event.text.length === 0) return current
            const next: MarkdownActivity = { ...target, content: target.content + event.text }
            return replaceById(current, event.id, next)
        }
        case "complete": {
            const target = findById(current, event.id)
            if (!target || target.state !== "in_progress") return current
            const next: Activity = { ...target, state: "complete", progress: fraction(1) }
            return replaceById(current, event.id, next)
        }
    }
}
