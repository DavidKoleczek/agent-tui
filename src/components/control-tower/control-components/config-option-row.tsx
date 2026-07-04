// One Control tab option row. A label plus a horizontal list of buttons for each value
import { useState } from "react"
import { TextAttributes } from "@opentui/core"
import { Colors } from "../../../lib/constants"

interface ConfigValueButtonProps {
    label: string
    // The current, applied value for this option. Marked with bold text.
    selected: boolean
    // Whether the keyboard cursor currently rests on this button.
    focused: boolean
    onActivate: () => void
}

function ConfigValueButton({ label, selected, focused, onActivate }: ConfigValueButtonProps) {
    const [hovered, setHovered] = useState(false)
    const highlighted = focused || hovered

    // Mirror the tower tabs: the accent background marks where the cursor is (focus or hover) and bold marks the
    // selected value, so the two states read independently and the tower shares one visual language.
    const backgroundColor = highlighted ? Colors.accent : undefined
    const textColor = highlighted ? Colors.onAccentText : selected ? Colors.activeText : Colors.mutedText

    return (
        <box
            backgroundColor={backgroundColor}
            flexShrink={0}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                // Keep the click from bubbling to the app's region-focus handler behind the tower.
                event.stopPropagation()
                onActivate()
            }}
        >
            <text fg={textColor} attributes={selected ? TextAttributes.BOLD : undefined}>
                {label}
            </text>
        </box>
    )
}

interface ConfigOptionRowProps {
    label: string
    values: string[]
    // The currently applied value for this option.
    current: string
    // Index of the value holding the keyboard cursor, or null when the cursor is not on this row.
    focusedValueIndex: number | null
    onSelect: (valueIndex: number) => void
}

export function ConfigOptionRow({ label, values, current, focusedValueIndex, onSelect }: ConfigOptionRowProps) {
    return (
        <box flexDirection="column" flexShrink={0} marginBottom={1}>
            <text attributes={TextAttributes.BOLD}>{label}</text>
            <box flexDirection="row" flexWrap="wrap" columnGap={2}>
                {values.map((value, index) => (
                    <ConfigValueButton
                        key={value}
                        label={value}
                        selected={value === current}
                        focused={index === focusedValueIndex}
                        onActivate={() => onSelect(index)}
                    />
                ))}
            </box>
        </box>
    )
}
