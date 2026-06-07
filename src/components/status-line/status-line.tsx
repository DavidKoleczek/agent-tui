import { useDotBounce } from "./use-dot-bounce"

interface StatusLineProps {
    // Whether the agent connection is ready. While false, the loading indicator animates; when true, the line is blank.
    ready: boolean
}

const STATUS_TEXT_COLOR = "#2EA6E0"
const LOADING_LABEL = "Agent starting"

export function StatusLine({ ready }: StatusLineProps) {
    const dots = useDotBounce(!ready)

    return (
        // Fixed-height row that is always present so the indicator can appear and clear without shifting the layout.
        <box width="100%" height={1} flexShrink={0} paddingLeft={1}>
            <text fg={STATUS_TEXT_COLOR}>{ready ? "" : `${LOADING_LABEL}${dots}`}</text>
        </box>
    )
}
