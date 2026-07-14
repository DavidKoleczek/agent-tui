import { TextAttributes } from "@opentui/core"
import { memo } from "react"
import { Colors } from "../../lib/constants"

interface ReasoningActivityProps {
    content: string
    index: number
}

function ReasoningActivityImpl({ content, index }: ReasoningActivityProps) {
    return (
        <box paddingLeft={1} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <text content={content} fg={Colors.mutedText} />
        </box>
    )
}

export const ReasoningActivity = memo(ReasoningActivityImpl)
