import { type ScrollBoxRenderable } from "@opentui/core"
import { useBindings } from "@opentui/keymap/react"
import { useMemo, useRef } from "react"
import { DEFAULT_SCROLL_SPEED } from "../../lib/constants"
import { activityLogBindings } from "../../lib/tui"
import { type SessionActivity, type TaskPermission } from "../../schemas/activities"
import { AssistantActivity } from "./assistant-activity"
import { ReasoningActivity } from "./reasoning-activity"
import { CustomSpeedScroll, enforceMinimumThumbSize } from "./scroll-helpers"
import { TaskActivity } from "./task-activity"
import { ExpandedTaskView } from "./task-activity/expanded-task-view"
import { UserActivity } from "./user-activity"
import { ErrorActivity } from "./error-activity"

interface ActivityLogProps {
    activities: ReadonlyMap<string, SessionActivity>
    // Id of the task shown in the expanded overlay, or null when closed.
    expandedTaskId: string | null
    // Opens or closes (null) the expanded task overlay.
    onExpandTask: (id: string | null) => void
    // Sends the user's accept/deny decision for a tool from inside the expanded overlay.
    onPermissionChange: (id: string, permission: TaskPermission) => void
}

export function ActivityLog({ activities, expandedTaskId, onExpandTask, onPermissionChange }: ActivityLogProps) {
    const scrollRef = useRef<ScrollBoxRenderable | null>(null)
    const scrollAcceleration = useMemo(() => new CustomSpeedScroll(DEFAULT_SCROLL_SPEED), [])

    useBindings(
        () =>
            activityLogBindings({
                scrollByViewport: (direction) => scrollRef.current?.scrollBy(direction, "viewport"),
            }),
        [],
    )

    // The overlay only applies to task activities; a missing or non-task id resolves to undefined and auto-closes it.
    const expanded = expandedTaskId !== null ? activities.get(expandedTaskId) : undefined
    const expandedTask = expanded?.type === "task" ? expanded : undefined

    return (
        <box flexGrow={1} flexShrink={1} position="relative">
            <scrollbox
                // Disable focusability so input focus stays pinned to the textarea
                // Scroll-wheel scrolling does not require focus and the keymap layer above drives keyboard scrolling without going through focus.
                ref={(node: ScrollBoxRenderable | null) => {
                    scrollRef.current = node
                    if (node) {
                        node.focusable = false
                        enforceMinimumThumbSize(node)
                    }
                }}
                flexGrow={1}
                flexShrink={1}
                width="100%"
                // Right padding prevents table borders from overlapping with the scrollbar.
                paddingRight={1}
                scrollAcceleration={scrollAcceleration}
                stickyScroll
                stickyStart="bottom"
                viewportCulling
            >
                {Array.from(activities.values()).map((activity, index) => {
                    switch (activity.type) {
                        case "user":
                            return <UserActivity key={activity.id} index={index} content={activity.content} />
                        case "reasoning":
                            return (
                                <ReasoningActivity
                                    key={activity.id}
                                    index={index}
                                    content={activity.content}
                                    state={activity.state}
                                />
                            )
                        case "task":
                            return (
                                <TaskActivity
                                    key={activity.id}
                                    index={index}
                                    taskName={activity.name}
                                    taskArguments={activity.arguments ?? {}}
                                    taskResult={activity.result ?? ""}
                                    state={activity.state}
                                    permission={activity.permission}
                                    onExpand={() => onExpandTask(activity.id)}
                                />
                            )
                        case "assistant":
                            return (
                                <AssistantActivity
                                    key={activity.id}
                                    index={index}
                                    content={activity.content}
                                    state={activity.state}
                                />
                            )
                        case "error":
                            return (
                                <ErrorActivity
                                    key={activity.id}
                                    index={index}
                                    error_type={activity.error_type}
                                    detail={activity.detail}
                                />
                            )
                        default: {
                            const _exhaustive: never = activity
                            return _exhaustive
                        }
                    }
                })}
            </scrollbox>
            {expandedTask !== undefined ? (
                <ExpandedTaskView
                    activity={expandedTask}
                    onClose={() => onExpandTask(null)}
                    onPermissionChange={onPermissionChange}
                />
            ) : null}
        </box>
    )
}
