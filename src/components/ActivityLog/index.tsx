import { type ScrollBoxRenderable } from "@opentui/core"
import { useBindings } from "@opentui/keymap/react"
import { useRef } from "react"
import { activityLogBindings } from "../../lib/keybindings"
import { type Activity } from "../../schemas/activities"

interface ActivityLogProps {
    activities: readonly Activity[]
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
            stickyScroll
            stickyStart="bottom"
            viewportCulling
        >
            {activities.map((activity) => {
                switch (activity.type) {
                    case "user":
                        return <text key={activity.id}>{`> ${activity.content}`}</text>
                    case "reasoning":
                        return <text key={activity.id}>{`(reasoning) ${activity.content}`}</text>
                    case "tool":
                        return <text key={activity.id}>{`[tool: ${activity.toolName}] ${activity.toolOutput}`}</text>
                    case "assistant":
                        return <text key={activity.id}>{activity.content}</text>
                    default: {
                        const _exhaustive: never = activity
                        return _exhaustive
                    }
                }
            })}
        </scrollbox>
    )
}
