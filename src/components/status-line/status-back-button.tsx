import { useState } from "react"
import { Colors } from "../../lib/constants"

export function StatusBackButton({ onPress }: { onPress: () => void }) {
    const [hovered, setHovered] = useState(false)

    return (
        <box
            flexShrink={0}
            backgroundColor={hovered ? Colors.accent : undefined}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                event.stopPropagation()
                onPress()
            }}
        >
            <text fg={hovered ? Colors.onAccentText : Colors.accent}>{"< Back"}</text>
        </box>
    )
}
