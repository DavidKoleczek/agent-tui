interface UserActivityProps {
    content: string
    index: number
}

const BACKGROUND_COLOR = "#2da4f481"

export function UserActivity({ content, index }: UserActivityProps) {
    return (
        <box
            backgroundColor={BACKGROUND_COLOR}
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
