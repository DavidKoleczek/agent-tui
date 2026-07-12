// Tracks the latest lifecycle status for each agent.
import { useCallback, useMemo, useState } from "react"
import { type StatusId } from "../schemas/activities"

export interface AgentStatuses {
    statuses: ReadonlyMap<string, StatusId>
    setStatus: (agentId: string, status: StatusId) => void
    clear: () => void
}

export function isWorkingStatus(status: StatusId | null | undefined): boolean {
    return (
        status !== undefined &&
        status !== null &&
        status !== "agent_running" &&
        status !== "agent_turn_ended" &&
        status !== "agent_cancelled" &&
        status !== "agent_stopped"
    )
}

export function useAgentStatuses(): AgentStatuses {
    const [statuses, setStatuses] = useState<ReadonlyMap<string, StatusId>>(() => new Map())

    const setStatus = useCallback((agentId: string, status: StatusId) => {
        setStatuses((current) => {
            if (current.get(agentId) === status) return current
            const next = new Map(current)
            next.set(agentId, status)
            return next
        })
    }, [])

    const clear = useCallback(() => {
        setStatuses((current) => (current.size === 0 ? current : new Map()))
    }, [])

    return useMemo(() => ({ statuses, setStatus, clear }), [statuses, setStatus, clear])
}
