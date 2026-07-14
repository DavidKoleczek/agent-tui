import { fg, t } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import { useMemo, useState } from "react"
import { Colors } from "../../../lib/constants"
import { type ActivityState, type TaskPermission } from "../../../schemas/activities"
import { formatArguments, formatResultLines, formatTaskName } from "../../../lib/tui"
import { resolveDotStyle } from "./task-status"
import { usePulse } from "./use-pulse"

interface TaskActivityProps {
    taskName: string
    taskArguments: Record<string, unknown>
    taskResult: string
    state: ActivityState
    permission: TaskPermission
    index: number
    onOpen?: () => void
}

const STATUS_DOT = "\u25CF"

export function TaskActivity({
    taskName,
    taskArguments,
    taskResult,
    state,
    permission,
    index,
    onOpen,
}: TaskActivityProps) {
    const dot = resolveDotStyle(state, permission)
    const dotColor = usePulse(dot.color, dot.pulse)
    const [hovered, setHovered] = useState(false)
    const renderer = useRenderer()

    const displayName = useMemo(() => formatTaskName(taskName), [taskName])
    const argsText = useMemo(
        () =>
            Object.keys(taskArguments).length > 0
                ? formatArguments(taskArguments, { streaming: state === "in_progress" })
                : "",
        [taskArguments, state],
    )
    const resultLines = useMemo(() => formatResultLines(taskResult), [taskResult])

    const header = useMemo(
        () =>
            argsText.length > 0
                ? t`${fg(dotColor)(STATUS_DOT)} ${displayName} ${fg(Colors.mutedText)(`(${argsText})`)}`
                : t`${fg(dotColor)(STATUS_DOT)} ${displayName}`,
        [argsText, displayName, dotColor],
    )

    return (
        <box
            flexDirection="column"
            flexShrink={0}
            marginTop={index === 0 ? 0 : 1}
            paddingLeft={1}
            backgroundColor={hovered ? Colors.rowHover : undefined}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            // Open on release, not press, and skip opening when the release ends a text selection so the user can
            // drag to select and copy the row's text instead of expanding it.
            onMouseUp={() => {
                if ((renderer.getSelection()?.getSelectedText() ?? "") === "") onOpen?.()
            }}
        >
            <text content={header} wrapMode="none" truncate />
            {resultLines.length > 0 && (
                <box flexDirection="column" marginTop={1}>
                    {resultLines.map((line, lineIndex) => (
                        <text key={lineIndex} fg={Colors.mutedText}>
                            {line}
                        </text>
                    ))}
                </box>
            )}
        </box>
    )
}
