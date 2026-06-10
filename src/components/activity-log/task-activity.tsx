interface TaskActivityProps {
    taskName: string
    taskArguments: Record<string, unknown>
    taskResult: string
    index: number
}

const BACKGROUND_COLOR = "#1a1a1a"
const ARGS_COLOR = "#888888"

export function TaskActivity({ taskName, taskArguments, taskResult, index }: TaskActivityProps) {
    const hasArgs = Object.keys(taskArguments).length > 0
    const hasResult = taskResult.trim().length > 0
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
            <text>task: {taskName}</text>
            {hasArgs && <text fg={ARGS_COLOR}>{JSON.stringify(taskArguments)}</text>}
            {hasResult && <text marginTop={1}>{taskResult}</text>}
        </box>
    )
}
