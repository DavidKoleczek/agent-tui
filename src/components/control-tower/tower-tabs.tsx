// The control tower's tab row (Control and Settings).
import { TextAttributes } from "@opentui/core"
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
    return (
        <box flexDirection="row" flexShrink={0} columnGap={2}>
            {tabs.map((tab, index) => {
                const isActive = index === activeIndex
                const isFocused = index === focusedIndex
                const textColor = isFocused ? Colors.onAccentText : isActive ? Colors.activeText : Colors.mutedText
                return (
                    <box
                        key={tab.id}
                        backgroundColor={isFocused ? Colors.accent : undefined}
                        flexShrink={0}
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
