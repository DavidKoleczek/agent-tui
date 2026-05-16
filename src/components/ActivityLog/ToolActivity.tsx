interface ToolActivityProps {
    toolName: string
    toolArguments: Record<string, unknown>
    toolOutput: string
    index: number
}

const BACKGROUND_COLOR = "#1a1a1a"
const ARGS_COLOR = "#888888"

export function ToolActivity({ toolName, toolArguments, toolOutput, index }: ToolActivityProps) {
    const hasArgs = Object.keys(toolArguments).length > 0
    const hasOutput = toolOutput.trim().length > 0
    return (
        <box
            backgroundColor={BACKGROUND_COLOR}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            marginTop={index === 0 ? 0 : 1}
            flexDirection="column"
            flexShrink={0}
        >
            <text>tool: {toolName}</text>
            {hasArgs && <text fg={ARGS_COLOR}>{JSON.stringify(toolArguments)}</text>}
            {hasOutput && <text marginTop={1}>{toolOutput}</text>}
        </box>
    )
}
