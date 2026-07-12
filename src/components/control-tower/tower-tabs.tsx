// The control tower's tab row (Control and Settings).
import { TextAttributes } from "@opentui/core"
import { useState } from "react"
import { Colors } from "../../lib/constants"

interface TowerTab {
    id: string
    label: string
}

interface TowerTabsProps {
    tabs: readonly TowerTab[]
    // Index of the tab whose panel is currently shown.
    activeIndex: number
    // Index of the tab holding the keyboard focus highlight, or null when focus is in the panel/menu.
    focusedIndex: number | null
    onActivate: (index: number) => void
}

export function TowerTabs({ tabs, activeIndex, focusedIndex, onActivate }: TowerTabsProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

    return (
        <box flexDirection="row" flexShrink={0} columnGap={2}>
            {tabs.map((tab, index) => {
                const isActive = index === activeIndex
                const isFocused = index === focusedIndex
                const isHighlighted = isFocused || index === hoveredIndex
                const textColor = isHighlighted ? Colors.onAccentText : isActive ? Colors.activeText : Colors.mutedText
                return (
                    <box
                        key={tab.id}
                        backgroundColor={isHighlighted ? Colors.accent : undefined}
                        flexShrink={0}
                        onMouseOver={() => setHoveredIndex(index)}
                        onMouseOut={() => setHoveredIndex(null)}
                        onMouseDown={() => onActivate(index)}
                    >
                        <text fg={textColor} attributes={isActive ? TextAttributes.BOLD : undefined}>
                            {tab.label}
                        </text>
                    </box>
                )
            })}
        </box>
    )
}

export type { TowerTab }
