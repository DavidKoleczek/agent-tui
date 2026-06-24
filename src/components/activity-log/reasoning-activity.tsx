import { TextAttributes } from "@opentui/core"
import { memo } from "react"
import { getReasoningMarkdownSyntaxStyle } from "../../lib/tui"
import { type ActivityState } from "../../schemas/activities"
import { Colors } from "../../lib/constants"

interface ReasoningActivityProps {
    content: string
    state: ActivityState
    index: number
}

function ReasoningActivityImpl({ content, state, index }: ReasoningActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <text fg={Colors.mutedText} attributes={TextAttributes.ITALIC}>
                Thinking:
            </text>
            <markdown
                content={content}
                syntaxStyle={getReasoningMarkdownSyntaxStyle()}
                streaming={state === "in_progress"}
                fg={Colors.mutedText}
            />
        </box>
    )
}

export const ReasoningActivity = memo(ReasoningActivityImpl)
