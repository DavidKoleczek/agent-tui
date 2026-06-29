import { Colors } from "../../lib/constants"

// Placeholder for the Control tab. Live controls (model picker, etc.) will live here later.
export function ControlPanel() {
    return (
        <box flexGrow={1} paddingTop={1}>
            <text fg={Colors.mutedText}>None</text>
        </box>
    )
}
