import { Colors } from "../../lib/constants"
import { type ControlConfigState } from "../../hooks"
import { ConfigOptionRow, type ControlFocus } from "./control-components"

interface ControlPanelProps {
    config: ControlConfigState
    // Focused option/value when the tower owns focus and the control area is active; null otherwise.
    focus: ControlFocus | null
    onActivateValue: (rowIndex: number, valueIndex: number) => void
}

export function ControlPanel({ config, focus, onActivateValue }: ControlPanelProps) {
    if (!config.loaded) {
        return (
            <box flexGrow={1} paddingTop={1}>
                <text fg={Colors.mutedText}>Loading...</text>
            </box>
        )
    }

    return (
        <box flexDirection="column" flexGrow={1} paddingTop={1}>
            {config.options.map((option, rowIndex) => (
                <ConfigOptionRow
                    key={option.key}
                    label={option.label}
                    values={option.values}
                    current={config.current[option.key] ?? ""}
                    focusedValueIndex={focus?.rowIndex === rowIndex ? focus.valueIndex : null}
                    onSelect={(valueIndex) => onActivateValue(rowIndex, valueIndex)}
                />
            ))}
        </box>
    )
}
