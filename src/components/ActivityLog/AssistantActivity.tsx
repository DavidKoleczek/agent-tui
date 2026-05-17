import { memo } from "react"
import { getMarkdownSyntaxStyle } from "../../lib/syntax-style"
import { type ActivityState } from "../../schemas/activities"

interface AssistantActivityProps {
    content: string
    state: ActivityState
    index: number
}

function AssistantActivityImpl({ content, state, index }: AssistantActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <markdown content={content} syntaxStyle={getMarkdownSyntaxStyle()} streaming={state === "in_progress"} />
        </box>
    )
}

export const AssistantActivity = memo(AssistantActivityImpl)
