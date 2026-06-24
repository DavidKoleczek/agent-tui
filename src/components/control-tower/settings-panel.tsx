import { SessionPicker } from "./settings-components"
import { MenuItem } from "./menu-item"

export interface SettingsMenuItem {
    id: string
    label: string
}

interface SettingsPanelProps {
    // "browse" shows the menu; "resume" embeds the session picker.
    mode: "browse" | "resume"
    items: readonly SettingsMenuItem[]
    // Index of the focused menu item, or null when focus is on the tab row.
    focusedIndex: number | null
    onActivateItem: (index: number) => void
    // Picker wiring (used in "resume" mode).
    cwd: string
    // Whether the tower (and thus the embedded picker) currently holds keyboard focus.
    active: boolean
    onResume: (sessionPath: string) => void
    onCancelResume: () => void
    // Invoked when the user navigates up past the top of the picker, to return focus to the tab row.
    onExitResumeTop: () => void
}

export function SettingsPanel({
    mode,
    items,
    focusedIndex,
    onActivateItem,
    cwd,
    active,
    onResume,
    onCancelResume,
    onExitResumeTop,
}: SettingsPanelProps) {
    if (mode === "resume") {
        return (
            <box flexGrow={1} paddingTop={1}>
                <SessionPicker
                    cwd={cwd}
                    active={active}
                    onSelect={onResume}
                    onCancel={onCancelResume}
                    onExitTop={onExitResumeTop}
                />
            </box>
        )
    }

    return (
        <box flexDirection="column" flexGrow={1} paddingTop={1}>
            {items.map((item, index) => (
                <MenuItem
                    key={item.id}
                    label={item.label}
                    focused={index === focusedIndex}
                    onActivate={() => onActivateItem(index)}
                />
            ))}
        </box>
    )
}
