import { getReasoningMarkdownSyntaxStyle } from "../../lib/syntax-style"

interface ReasoningActivityProps {
    content: string
    index: number
}

const TEXT_COLOR = "#888888"

export function ReasoningActivity({ content, index }: ReasoningActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexShrink={0}>
            <markdown
                content={`_Thinking:_ ${content.trim()}`}
                syntaxStyle={getReasoningMarkdownSyntaxStyle()}
                internalBlockMode="top-level"
                fg={TEXT_COLOR}
            />
        </box>
    )
}
