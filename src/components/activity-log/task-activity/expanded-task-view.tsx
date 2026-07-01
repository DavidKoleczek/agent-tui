// This is the UX component for when a task is selected so the user can see the full args and result.

import { fg, t, TextAttributes, type KeyEvent, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useMemo, useRef, useState } from "react"
import { Colors, DEFAULT_SCROLL_SPEED } from "../../../lib/constants"
import { type TaskActivity } from "../../../schemas/activities"
import { CustomSpeedScroll, enforceMinimumThumbSize } from "../scroll-helpers"
import { formatTaskName, fullArgumentEntries } from "./task-format"
import { formatStateLabel, resolveDotStyle } from "./task-status"

interface ExpandedTaskViewProps {
    activity: TaskActivity
    onClose: () => void
}

const STATUS_DOT = "\u25CF"

export function ExpandedTaskView({ activity, onClose }: ExpandedTaskViewProps) {
    const scrollRef = useRef<ScrollBoxRenderable | null>(null)
    const scrollAcceleration = useMemo(() => new CustomSpeedScroll(DEFAULT_SCROLL_SPEED), [])

    // Claim ESC and page scrolling before the keymap layer so the covered activity log never reacts to them.
    useKeyboard((key: KeyEvent) => {
        if (key.name === "escape") {
            key.preventDefault()
            key.stopPropagation()
            onClose()
            return
        }
        if (key.name === "pageup") {
            key.preventDefault()
            key.stopPropagation()
            scrollRef.current?.scrollBy(-1, "viewport")
            return
        }
        if (key.name === "pagedown") {
            key.preventDefault()
            key.stopPropagation()
            scrollRef.current?.scrollBy(1, "viewport")
        }
    })

    const dotColor = resolveDotStyle(activity.state, activity.permission).color
    const header = t`${fg(dotColor)(STATUS_DOT)} ${formatTaskName(activity.name)}  ${fg(Colors.mutedText)(
        `${formatStateLabel(activity.state)}  ${activity.permission}`,
    )}`

    const entries = fullArgumentEntries(activity.arguments ?? {})
    const result = activity.result ?? ""

    return (
        <box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundColor={Colors.overlayBackground}
            border
            borderStyle="rounded"
            borderColor={Colors.border}
            flexDirection="column"
            // Absorb clicks so they do not fall through to the activity log or the region-focus handler behind the overlay.
            onMouseDown={(event) => event.stopPropagation()}
        >
            {/* Everything scrolls together; the header is just the first line of the scroll content. */}
            <scrollbox
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
                paddingLeft={1}
                paddingRight={1}
                scrollAcceleration={scrollAcceleration}
            >
                <text content={header} />
                <text fg={Colors.accent} attributes={TextAttributes.BOLD} marginTop={1}>
                    Arguments
                </text>
                {entries.length > 0 ? (
                    entries.map((entry) => (
                        <text key={entry.key} content={t`${fg(Colors.accent)(`${entry.key}:`)} ${entry.value}`} />
                    ))
                ) : (
                    <text fg={Colors.mutedText}>(none)</text>
                )}
                <text fg={Colors.accent} attributes={TextAttributes.BOLD} marginTop={1}>
                    Result
                </text>
                {result.trim().length > 0 ? <text>{result}</text> : <text fg={Colors.mutedText}>(none)</text>}
            </scrollbox>
            {/* Pinned out of flex flow so it stays clickable at any scroll position and cannot collapse the layout. */}
            <CloseButton onClose={onClose} />
        </box>
    )
}

function CloseButton({ onClose }: { onClose: () => void }) {
    const [hovered, setHovered] = useState(false)
    return (
        <text
            position="absolute"
            top={0}
            right={1}
            fg={hovered ? Colors.activeText : Colors.mutedText}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                event.stopPropagation()
                onClose()
            }}
        >
            [x]
        </text>
    )
}
