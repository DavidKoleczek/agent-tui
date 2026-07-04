// A small hover-highlighting button shared in the control tower and the expand task overlay used to show either a checkmark or X or accept/deny of a tool.
import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { Colors } from "../../lib/constants"

export const ACCEPT_GLYPH = "✓"
export const DENY_GLYPH = "✗"

interface ApprovalButtonProps {
    label: string
    onPress: () => void
    paddingX?: number
    bold?: boolean
    truncate?: boolean
}

export function ApprovalButton({ label, onPress, paddingX = 0, bold = false, truncate = false }: ApprovalButtonProps) {
    const [hovered, setHovered] = useState(false)

    return (
        <box
            backgroundColor={hovered ? Colors.accent : undefined}
            flexShrink={truncate ? 1 : 0}
            overflow={truncate ? "hidden" : undefined}
            paddingLeft={paddingX}
            paddingRight={paddingX}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                event.stopPropagation()
                onPress()
            }}
        >
            <text
                fg={hovered ? Colors.onAccentText : undefined}
                attributes={bold ? TextAttributes.BOLD : undefined}
                wrapMode={truncate ? "none" : undefined}
                truncate={truncate}
            >
                {label}
            </text>
        </box>
    )
}
