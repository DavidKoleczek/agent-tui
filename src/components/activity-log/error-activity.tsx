import { Colors } from "../../lib/constants"

interface ErrorActivityProps {
    error_type: string
    detail: string
    index: number
}

export function ErrorActivity({ error_type, detail, index }: ErrorActivityProps) {
    return (
        <box
            backgroundColor={Colors.errorBackground}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            flexShrink={0}
            marginTop={index === 0 ? 0 : 1}
        >
            <text>error: {error_type}</text>
            <text>{detail}</text>
        </box>
    )
}
