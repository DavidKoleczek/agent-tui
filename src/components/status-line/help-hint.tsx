import type { CtrlCHint } from "../../hooks"
import { Colors } from "../../lib/constants"

interface HelpHintProps {
    // The armed Ctrl-C step to surface, or "none" to show nothing.
    hint: CtrlCHint
}

const HINT_LABELS: Record<Exclude<CtrlCHint, "none">, string> = {
    cancel: "Ctrl-C again to cancel",
    quit: "Ctrl-C again to quit",
}

function resolveLabel(hint: CtrlCHint): string {
    return hint === "none" ? "" : HINT_LABELS[hint]
}

// Sits directly below the status line and surfaces the next Ctrl-C action while a sequence is armed.
// A fixed-height row that is always present so the hint can appear and clear without shifting the layout.
export function HelpHint({ hint }: HelpHintProps) {
    const label = resolveLabel(hint)

    return (
        <box width="100%" height={1} flexShrink={0} paddingLeft={1}>
            <text fg={Colors.mutedText}>{label}</text>
        </box>
    )
}
