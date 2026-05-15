import { type Fraction, type IsoTimestamp } from "../../lib/branded-types"

export interface ActivityBase {
    id: string
    createdAt: IsoTimestamp
    /** progress in [0, 1]. 0 means not started or in progress, 1 means complete. */
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
