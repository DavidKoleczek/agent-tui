import { type ControlOption } from "../../../hooks"
import { type SessionConfigValues } from "../../../schemas/rest-endpoints"

// Cursor position within the Control tab: which option row and which value in that row.
export interface ControlFocus {
    rowIndex: number
    valueIndex: number
}

// Index of the currently-applied value within a row, or 0 when none matches so the cursor still has a home.
export function currentValueIndex(option: ControlOption, current: SessionConfigValues): number {
    const index = option.values.indexOf(current[option.key] ?? "")
    return index < 0 ? 0 : index
}

// Landing position when entering the control area from the tabs: the first row, on its current value.
export function enterControl(options: readonly ControlOption[], current: SessionConfigValues): ControlFocus | null {
    const option = options[0]
    if (option === undefined) return null
    return { rowIndex: 0, valueIndex: currentValueIndex(option, current) }
}

// Moves the row cursor by delta, landing on the target row's current value.
// Returns "exit-top" when moving up past the first row so the caller can hand focus back to the tab row.
export function moveControlRow(
    focus: ControlFocus,
    delta: number,
    options: readonly ControlOption[],
    current: SessionConfigValues,
): ControlFocus | "exit-top" {
    const nextRow = focus.rowIndex + delta
    if (nextRow < 0) return "exit-top"
    const clampedRow = Math.min(options.length - 1, nextRow)
    const option = options[clampedRow]
    if (option === undefined) return focus
    return { rowIndex: clampedRow, valueIndex: currentValueIndex(option, current) }
}

// Moves the value cursor by delta within the focused row, clamped to the row's values.
export function moveControlValue(focus: ControlFocus, delta: number, options: readonly ControlOption[]): ControlFocus {
    const option = options[focus.rowIndex]
    if (option === undefined) return focus
    const nextValue = Math.max(0, Math.min(option.values.length - 1, focus.valueIndex + delta))
    return { rowIndex: focus.rowIndex, valueIndex: nextValue }
}
