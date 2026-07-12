// The Control tab's pending tool approvals: one card per tool awaiting a decision, plus accept-all / deny-all.
import { TextAttributes } from "@opentui/core"
import { Colors } from "../../../lib/constants"
import { type TaskActivity, type TaskPermission } from "../../../schemas/activities"
import { formatTaskName, stringifyValue } from "../../../lib/tui"
import { ACCEPT_GLYPH, ApprovalButton, DENY_GLYPH } from "../../common"

// Arguments shown per card before collapsing the rest into a single "..." line, so a card cannot grow unbounded.
const MAX_APPROVAL_ARG_LINES = 2

// One argument as an indented "key: value" line, with the value flattened to a single line so it cannot inject line breaks
function argumentLine(key: string, value: unknown): string {
    return `  ${key}: ${stringifyValue(value).replace(/\s+/g, " ").trim()}`
}

interface ApprovalCardProps {
    task: TaskActivity
    onDecide: (id: string, permission: TaskPermission) => void
    onOpenTask: (id: string) => void
}

function ApprovalCard({ task, onDecide, onOpenTask }: ApprovalCardProps) {
    const entries = Object.entries(task.arguments ?? {})
    const hasMore = entries.length > MAX_APPROVAL_ARG_LINES + 1
    const shown = hasMore ? entries.slice(0, MAX_APPROVAL_ARG_LINES) : entries

    return (
        <box flexDirection="column" flexShrink={0}>
            <box flexDirection="row" columnGap={1}>
                <ApprovalButton label={formatTaskName(task.name)} bold truncate onPress={() => onOpenTask(task.id)} />
                {/* The check and cross share a gapless row so they sit closer together than the header's columnGap. */}
                <box flexDirection="row" flexShrink={0}>
                    <ApprovalButton label={ACCEPT_GLYPH} paddingX={1} onPress={() => onDecide(task.id, "accepted")} />
                    <ApprovalButton label={DENY_GLYPH} paddingX={1} onPress={() => onDecide(task.id, "denied")} />
                </box>
            </box>
            {shown.map(([key, value]) => (
                <text key={key} fg={Colors.mutedText} wrapMode="none" truncate>
                    {argumentLine(key, value)}
                </text>
            ))}
            {hasMore ? <text fg={Colors.mutedText}>{"  ..."}</text> : null}
        </box>
    )
}

interface PendingApprovalsProps {
    tasks: readonly TaskActivity[]
    onPermissionChange: (id: string, permission: TaskPermission) => void
    onOpenTask: (id: string) => void
}

export function PendingApprovals({ tasks, onPermissionChange, onOpenTask }: PendingApprovalsProps) {
    return (
        <box flexDirection="column" flexShrink={0} marginTop={1}>
            <box flexDirection="row" columnGap={2} flexShrink={0}>
                <text attributes={TextAttributes.BOLD}>Approvals</text>
                <ApprovalButton
                    label="Accept all"
                    onPress={() => {
                        for (const task of tasks) onPermissionChange(task.id, "accepted")
                    }}
                />
                <ApprovalButton
                    label="Deny all"
                    onPress={() => {
                        for (const task of tasks) onPermissionChange(task.id, "denied")
                    }}
                />
            </box>
            {tasks.map((task, index) => (
                <box key={task.id} flexDirection="column" flexShrink={0} marginTop={index === 0 ? 0 : 1}>
                    {index > 0 ? <text fg={Colors.mutedText}>---</text> : null}
                    <ApprovalCard task={task} onDecide={onPermissionChange} onOpenTask={onOpenTask} />
                </box>
            ))}
        </box>
    )
}
