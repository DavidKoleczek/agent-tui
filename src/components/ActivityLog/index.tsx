import { type Activity } from "../../schemas/activities"

interface ActivityLogProps {
    activities: readonly Activity[]
}

export function ActivityLog({ activities }: ActivityLogProps) {
    return (
        <box flexDirection="column" flexGrow={1} width="100%">
            {activities.map((activity) => {
                switch (activity.type) {
                    case "user":
                        return <text key={activity.id}>{`> ${activity.content}`}</text>
                    case "reasoning":
                        return <text key={activity.id}>{`(reasoning) ${activity.content}`}</text>
                    case "tool":
                        return <text key={activity.id}>{`[tool: ${activity.toolName}] ${activity.toolOutput}`}</text>
                    case "assistant":
                        return <text key={activity.id}>{activity.content}</text>
                    default: {
                        const _exhaustive: never = activity
                        return _exhaustive
                    }
                }
            })}
        </box>
    )
}
