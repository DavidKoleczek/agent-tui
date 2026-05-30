import { fraction, nowIso } from "../../lib/branded-types"
import { type Activity } from "../../schemas/activities"

export function createUserActivity(id: string, content: string): Activity {
    return {
        id,
        type: "user",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content,
    }
}

export function createInProgressReasoning(id: string, initialContent: string): Activity {
    return {
        id,
        type: "reasoning",
        createdAt: nowIso(),
        state: "in_progress",
        progress: fraction(0),
        content: initialContent,
    }
}

export function createInProgressAssistant(id: string, initialContent: string): Activity {
    return {
        id,
        type: "assistant",
        createdAt: nowIso(),
        state: "in_progress",
        progress: fraction(0),
        content: initialContent,
    }
}
