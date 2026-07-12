// Builds agent-scoped activity views and parent-child relationships from the flat activity store.
import { MAIN_AGENT_ID, type SessionActivity, type TaskActivity } from "../../schemas/activities"

const EMPTY_ACTIVITIES: ReadonlyMap<string, SessionActivity> = new Map()

export interface ActivityIndex {
    byAgent: ReadonlyMap<string, ReadonlyMap<string, SessionActivity>>
    parentTaskByAgent: ReadonlyMap<string, TaskActivity>
    pendingApprovals: readonly TaskActivity[]
}

export function buildActivityIndex(activities: ReadonlyMap<string, SessionActivity>): ActivityIndex {
    const byAgent = new Map<string, Map<string, SessionActivity>>()
    const parentTaskByAgent = new Map<string, TaskActivity>()
    const pendingApprovals: TaskActivity[] = []

    for (const activity of activities.values()) {
        let agentActivities = byAgent.get(activity.agent_id)
        if (agentActivities === undefined) {
            agentActivities = new Map()
            byAgent.set(activity.agent_id, agentActivities)
        }
        agentActivities.set(activity.id, activity)

        if (activity.type !== "task") continue
        if (activity.permission === "pending") pendingApprovals.push(activity)
        if (activity.sub_agent_id !== null) parentTaskByAgent.set(activity.sub_agent_id, activity)
    }

    return { byAgent, parentTaskByAgent, pendingApprovals }
}

export function getAgentActivities(index: ActivityIndex, agentId: string): ReadonlyMap<string, SessionActivity> {
    return index.byAgent.get(agentId) ?? EMPTY_ACTIVITIES
}

export type AgentPathResult =
    | { ok: true; path: readonly string[] }
    | { ok: false; reason: "cycle" | "orphan"; agentId: string }

export function resolveAgentPath(
    parentTaskByAgent: ReadonlyMap<string, TaskActivity>,
    targetAgentId: string,
    rootAgentId: string = MAIN_AGENT_ID,
): AgentPathResult {
    if (targetAgentId === rootAgentId) return { ok: true, path: [rootAgentId] }

    const reversedPath = [targetAgentId]
    const visited = new Set(reversedPath)
    let currentAgentId = targetAgentId

    while (currentAgentId !== rootAgentId) {
        const parentTask = parentTaskByAgent.get(currentAgentId)
        if (parentTask === undefined) return { ok: false, reason: "orphan", agentId: currentAgentId }

        currentAgentId = parentTask.agent_id
        if (visited.has(currentAgentId)) return { ok: false, reason: "cycle", agentId: currentAgentId }

        visited.add(currentAgentId)
        reversedPath.push(currentAgentId)
    }

    return { ok: true, path: reversedPath.reverse() }
}
