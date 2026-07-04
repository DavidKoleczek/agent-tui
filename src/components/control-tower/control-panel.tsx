import { useMemo } from "react"
import { type ScrollBoxRenderable } from "@opentui/core"
import { Colors, DEFAULT_SCROLL_SPEED } from "../../lib/constants"
import { type ControlConfigState } from "../../hooks"
import { type TaskActivity, type TaskPermission } from "../../schemas/activities"
import { CustomSpeedScroll, enforceMinimumThumbSize } from "../activity-log/scroll-helpers"
import { ConfigOptionRow, PendingApprovals, type ControlFocus } from "./control-components"

interface ControlPanelProps {
    config: ControlConfigState
    // Focused option/value when the tower owns focus and the control area is active; null otherwise.
    focus: ControlFocus | null
    onActivateValue: (rowIndex: number, valueIndex: number) => void
    // Tool calls awaiting the user's approval, shown below the config rows.
    pendingApprovals: readonly TaskActivity[]
    onPermissionChange: (id: string, permission: TaskPermission) => void
    // Opens a tool's expanded view from its approval card.
    onExpandTask: (id: string) => void
}

export function ControlPanel({
    config,
    focus,
    onActivateValue,
    pendingApprovals,
    onPermissionChange,
    onExpandTask,
}: ControlPanelProps) {
    const scrollAcceleration = useMemo(() => new CustomSpeedScroll(DEFAULT_SCROLL_SPEED), [])

    // Config rows and the approvals section share one scroll region so the whole tab scrolls as it overflows.
    // Scroll-wheel scrolling does not need focus, so the box stays unfocusable and keyboard focus remains on the chat.
    return (
        <scrollbox
            ref={(node: ScrollBoxRenderable | null) => {
                if (node) {
                    node.focusable = false
                    enforceMinimumThumbSize(node)
                }
            }}
            flexGrow={1}
            flexShrink={1}
            width="100%"
            paddingTop={1}
            paddingRight={1}
            scrollAcceleration={scrollAcceleration}
        >
            {config.loaded ? (
                config.options.map((option, rowIndex) => (
                    <ConfigOptionRow
                        key={option.key}
                        label={option.label}
                        values={option.values}
                        current={config.current[option.key] ?? ""}
                        focusedValueIndex={focus?.rowIndex === rowIndex ? focus.valueIndex : null}
                        onSelect={(valueIndex) => onActivateValue(rowIndex, valueIndex)}
                    />
                ))
            ) : (
                <text fg={Colors.mutedText}>Loading...</text>
            )}
            {pendingApprovals.length > 0 ? (
                <PendingApprovals
                    tasks={pendingApprovals}
                    onPermissionChange={onPermissionChange}
                    onExpandTask={onExpandTask}
                />
            ) : null}
        </scrollbox>
    )
}
