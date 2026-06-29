import { type ScrollAcceleration, type ScrollBoxRenderable } from "@opentui/core"
import { useBindings } from "@opentui/keymap/react"
import { useMemo, useRef } from "react"
import { DEFAULT_SCROLL_SPEED, MIN_SCROLLBAR_THUMB_CELLS } from "../../lib/constants"
import { activityLogBindings } from "../../lib/tui"
import { type SessionActivity } from "../../schemas/activities"
import { AssistantActivity } from "./assistant-activity"
import { ReasoningActivity } from "./reasoning-activity"
import { TaskActivity } from "./task-activity"
import { UserActivity } from "./user-activity"
import { ErrorActivity } from "./error-activity"

// Tracks sliders whose thumb sizing we have already wrapped, so the re-created ref callback does not stack the override on every render.
const patchedSliders = new WeakSet<object>()

interface ActivityLogProps {
    activities: ReadonlyMap<string, SessionActivity>
}

export function ActivityLog({ activities }: ActivityLogProps) {
    const scrollRef = useRef<ScrollBoxRenderable | null>(null)
    const scrollAcceleration = useMemo(() => new CustomSpeedScroll(DEFAULT_SCROLL_SPEED), [])

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

class CustomSpeedScroll implements ScrollAcceleration {
    constructor(private readonly speed: number) {}

    tick(): number {
        return this.speed
    }

    reset(): void {}
}

// The slider exposes thumb sizing only as a private method, so we reach it through a structural type.
interface MinThumbSlider {
    height: number
    getVirtualThumbSize(): number
}

// Enforce a minimum thumb height by wrapping the slider's size calculation.
function enforceMinimumThumbSize(scrollbox: ScrollBoxRenderable): void {
    const slider = scrollbox.verticalScrollBar.slider as unknown as MinThumbSlider
    if (patchedSliders.has(slider)) return
    patchedSliders.add(slider)

    const minVirtualThumb = MIN_SCROLLBAR_THUMB_CELLS * 2
    const computeThumbSize = slider.getVirtualThumbSize.bind(slider)
    slider.getVirtualThumbSize = () => {
        const virtualTrack = slider.height * 2
        if (virtualTrack <= 0) return computeThumbSize()
        return Math.min(virtualTrack, Math.max(minVirtualThumb, computeThumbSize()))
    }
}
