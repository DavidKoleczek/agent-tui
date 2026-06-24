import { Colors } from "../../lib/constants"

interface UserActivityProps {
    content: string
    index: number
}

export function UserActivity({ content, index }: UserActivityProps) {
    return (
        <box
            backgroundColor={Colors.accentTranslucent}
            paddingTop={1}
            paddingBottom={1}
            paddingLeft={2}
            paddingRight={2}
            flexShrink={0}
            marginTop={index === 0 ? 0 : 1}
        >
            <text>{content}</text>
        </box>
    )
}
