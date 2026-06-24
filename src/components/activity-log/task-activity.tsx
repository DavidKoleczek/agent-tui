import { Colors } from "../../lib/constants"

interface TaskActivityProps {
    taskName: string
    taskArguments: Record<string, unknown>
    taskResult: string
    index: number
}

export function TaskActivity({ taskName, taskArguments, taskResult, index }: TaskActivityProps) {
    const hasArgs = Object.keys(taskArguments).length > 0
    const hasResult = taskResult.trim().length > 0
    return (
        <box
            backgroundColor={Colors.taskBackground}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            marginTop={index === 0 ? 0 : 1}
            flexDirection="column"
            flexShrink={0}
        >
            <text>task: {taskName}</text>
            {hasArgs && <text fg={Colors.mutedText}>{JSON.stringify(taskArguments)}</text>}
            {hasResult && <text marginTop={1}>{taskResult}</text>}
        </box>
    )
}
