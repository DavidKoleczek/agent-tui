import { type Fraction, type IsoTimestamp } from "../../lib/branded-types"

export type ActivityState = "in_progress" | "complete" | "error" | "cancelled"

export interface ActivityBase {
    id: string
    createdAt: IsoTimestamp
    /** Primary lifecycle signal. Renderers and downstream logic should branch on this. */
    state: ActivityState
    /** Fine-grained complement to `state` for continuous indicators while `state` is `"in_progress"`. 0 means no progress and 1 means done. */
    progress: Fraction
}

interface UserActivity extends ActivityBase {
    type: "user"
    content: string
}

interface AssistantActivity extends ActivityBase {
    type: "assistant"
    content: string
}

interface ReasoningActivity extends ActivityBase {
    type: "reasoning"
    content: string
}

interface ToolActivity extends ActivityBase {
    type: "tool"
    toolName: string
    toolArguments: Record<string, unknown>
    toolOutput: string
}

export type Activity = UserActivity | AssistantActivity | ToolActivity | ReasoningActivity
