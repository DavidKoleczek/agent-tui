import { getMarkdownSyntaxStyle } from "../../lib/syntax-style"

interface ReasoningActivityProps {
    content: string
    index: number
}

const TEXT_COLOR = "#888888"

export function ReasoningActivity({ content, index }: ReasoningActivityProps) {
    return (
        <box paddingLeft={2} marginTop={index === 0 ? 0 : 1} flexDirection="column" flexShrink={0}>
            <code
                content={`_Thinking:_ ${content.trim()}`}
                filetype="markdown"
                syntaxStyle={getMarkdownSyntaxStyle()}
                fg={TEXT_COLOR}
            />
        </box>
    )
}
