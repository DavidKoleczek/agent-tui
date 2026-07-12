import { memo } from "react"
import { getMarkdownSyntaxStyle } from "../../lib/tui"

interface AssistantActivityProps {
    content: string
    index: number
}

const TABLE_OPTIONS = { style: "grid" } as const

function AssistantActivityImpl({ content, index }: AssistantActivityProps) {
    // Top-level blocks update in place without flashing raw markdown. Keeping streaming enabled avoids a final rebuild.
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <markdown
                content={content}
                syntaxStyle={getMarkdownSyntaxStyle()}
                streaming
                internalBlockMode="top-level"
                tableOptions={TABLE_OPTIONS}
            />
        </box>
    )
}

export const AssistantActivity = memo(AssistantActivityImpl)
