import { TextAttributes } from "@opentui/core"
import { memo } from "react"
import { getReasoningMarkdownSyntaxStyle } from "../../lib/syntax-style"
import { type ActivityState } from "../../schemas/activities"

interface ReasoningActivityProps {
    content: string
    state: ActivityState
    index: number
}

const TEXT_COLOR = "#888888"

function ReasoningActivityImpl({ content, state, index }: ReasoningActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <text fg={TEXT_COLOR} attributes={TextAttributes.ITALIC}>
                Thinking:
            </text>
            <markdown
                content={content}
                syntaxStyle={getReasoningMarkdownSyntaxStyle()}
                streaming={state === "in_progress"}
                fg={TEXT_COLOR}
            />
        </box>
    )
}

export const ReasoningActivity = memo(ReasoningActivityImpl)
