import { getMarkdownSyntaxStyle } from "../../lib/syntax-style"

interface AssistantActivityProps {
    content: string
    index: number
}

export function AssistantActivity({ content, index }: AssistantActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <markdown content={content} syntaxStyle={getMarkdownSyntaxStyle()} internalBlockMode="top-level" />
        </box>
    )
}
