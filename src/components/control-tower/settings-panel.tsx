import { SessionPicker, UpdatePanel } from "./settings-components"
import { MenuItem } from "./menu-item"

export interface SettingsMenuItem {
    id: string
    label: string
}

interface SettingsPanelProps {
    mode: "browse" | "resume" | "update"
    items: readonly SettingsMenuItem[]
    // Index of the focused menu item, or null when focus is on the tab row.
    focusedIndex: number | null
    onActivateItem: (index: number) => void
    // Picker wiring (used in "resume" mode).
    cwd: string
    // Whether the embedded session picker currently holds keyboard focus.
    resumeActive: boolean
    onResume: (sessionPath: string) => void
    onCancelResume: () => void
    // Invoked when the user navigates up past the top of the picker, to return focus to the tab row.
    onExitResumeTop: () => void
    // Update panel
    updateActive: boolean
    onCancelUpdate: () => void
    onExitUpdateTop: () => void
}

export function SettingsPanel({
    mode,
    items,
    focusedIndex,
    onActivateItem,
    cwd,
    resumeActive,
    onResume,
    onCancelResume,
    onExitResumeTop,
    updateActive,
    onCancelUpdate,
    onExitUpdateTop,
}: SettingsPanelProps) {
    if (mode === "resume") {
        return (
            <box flexGrow={1} paddingTop={1}>
                <SessionPicker
                    cwd={cwd}
                    active={resumeActive}
                    onSelect={onResume}
                    onCancel={onCancelResume}
                    onExitTop={onExitResumeTop}
                />
            </box>
        )
    }

    if (mode === "update") {
        return (
            <box flexGrow={1} paddingTop={1}>
                <UpdatePanel active={updateActive} onCancel={onCancelUpdate} onExitTop={onExitUpdateTop} />
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
