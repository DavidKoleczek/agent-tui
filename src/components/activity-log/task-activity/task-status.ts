import { Colors } from "../../../lib/constants"
import { type ActivityState, type TaskPermission } from "../../../schemas/activities"

export interface DotStyle {
    color: string
    pulse: boolean
}

// Resolves the status dot color and whether it pulses, in strict precedence order:
// error overrules everything, then a denied permission, then the in-progress states, then the settled states.
export function resolveDotStyle(state: ActivityState, permission: TaskPermission): DotStyle {
    if (state === "error") return { color: Colors.danger, pulse: false }
    if (permission === "denied") return { color: Colors.warning, pulse: false }
    if (state === "in_progress") {
        if (permission === "pending") return { color: Colors.warning, pulse: true }
        return { color: Colors.accent, pulse: true }
    }
    if (state === "complete") return { color: Colors.accent, pulse: false }
    // "cancelled" and any unexpected state settle to an inert gray dot.
    return { color: Colors.mutedText, pulse: false }
}

const STATE_LABELS: Record<ActivityState, string> = {
    in_progress: "in progress",
    complete: "complete",
    error: "error",
    cancelled: "cancelled",
}

export function formatStateLabel(state: ActivityState): string {
    return STATE_LABELS[state]
}
