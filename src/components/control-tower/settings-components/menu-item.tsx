// A selectable row in the Settings menu.
import { useState } from "react"
import { Colors } from "../../../lib/constants"

interface MenuItemProps {
    label: string
    // Whether this row currently holds the tower's focus highlight.
    focused: boolean
    onActivate: () => void
}

export function MenuItem({ label, focused, onActivate }: MenuItemProps) {
    const [hovered, setHovered] = useState(false)
    const highlighted = focused || hovered

    return (
        <box
            backgroundColor={highlighted ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={onActivate}
        >
            <text fg={highlighted ? Colors.onAccentText : undefined}>{label}</text>
        </box>
    )
}
