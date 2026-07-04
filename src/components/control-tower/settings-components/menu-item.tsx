// A selectable row in the Settings menu.
import { Colors } from "../../../lib/constants"

interface MenuItemProps {
    label: string
    // Whether this row currently holds the tower's focus highlight.
    focused: boolean
    onActivate: () => void
}

export function MenuItem({ label, focused, onActivate }: MenuItemProps) {
    const marker = focused ? ">" : " "
    return (
        <box
            backgroundColor={focused ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseDown={onActivate}
        >
            <text fg={focused ? Colors.onAccentText : undefined}>{`${marker} ${label}`}</text>
        </box>
    )
}
