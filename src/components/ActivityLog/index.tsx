import { type ScrollBoxRenderable } from "@opentui/core"
import { useBindings } from "@opentui/keymap/react"
import { useRef } from "react"
import { activityLogBindings } from "../../lib/keybindings"
import { type SessionActivity } from "../../schemas/activities"
import { AssistantActivity } from "./AssistantActivity"
import { ReasoningActivity } from "./ReasoningActivity"
import { ToolActivity } from "./ToolActivity"
import { UserActivity } from "./UserActivity"
import { ErrorActivity } from "./ErrorActivity"

interface ActivityLogProps {
    activities: ReadonlyMap<string, SessionActivity>
}

export function ActivityLog({ activities }: ActivityLogProps) {
    const scrollRef = useRef<ScrollBoxRenderable | null>(null)

    useBindings(
        () =>
            activityLogBindings({
                scrollByViewport: (direction) => scrollRef.current?.scrollBy(direction, "viewport"),
            }),
        [],
    )

    return (
        <scrollbox
            // Disable focusability so input focus stays pinned to the textarea
            // Scroll-wheel scrolling does not require focus and the keymap layer above drives keyboard scrolling without going through focus.
            ref={(node: ScrollBoxRenderable | null) => {
                scrollRef.current = node
                if (node) node.focusable = false
            }}
            flexGrow={1}
            flexShrink={1}
            width="100%"
            // Right padding prevents table borders from overlapping with the scrollbar.
            paddingRight={1}
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
                            <ToolActivity
                                key={activity.id}
                                index={index}
                                toolName={activity.name}
                                toolArguments={activity.arguments ?? {}}
                                toolOutput={activity.result ?? ""}
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
    )
}
