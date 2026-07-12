// Manages stack-based navigation between main and sub-agent activity views.
import { useCallback, useMemo, useState } from "react"
import { MAIN_AGENT_ID } from "../schemas/activities"

export interface AgentNavigation {
    path: readonly string[]
    activeAgentId: string
    canGoBack: boolean
    enter: (agentId: string) => void
    navigate: (path: readonly string[]) => void
    back: () => void
    reset: () => void
}

function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((agentId, index) => agentId === right[index])
}

export function useAgentNavigation(rootAgentId: string = MAIN_AGENT_ID): AgentNavigation {
    const [path, setPath] = useState<readonly string[]>([rootAgentId])

    const enter = useCallback((agentId: string) => {
        setPath((current) => {
            const existingIndex = current.indexOf(agentId)
            const next = existingIndex === -1 ? [...current, agentId] : current.slice(0, existingIndex + 1)
            return pathsEqual(current, next) ? current : next
        })
    }, [])

    const navigate = useCallback(
        (nextPath: readonly string[]) => {
            const normalized = nextPath.length > 0 && nextPath[0] === rootAgentId ? [...nextPath] : [rootAgentId]
            setPath((current) => (pathsEqual(current, normalized) ? current : normalized))
        },
        [rootAgentId],
    )

    const back = useCallback(() => {
        setPath((current) => (current.length > 1 ? current.slice(0, -1) : current))
    }, [])

    const reset = useCallback(() => {
        setPath((current) => (current.length === 1 && current[0] === rootAgentId ? current : [rootAgentId]))
    }, [rootAgentId])

    return useMemo(
        () => ({
            path,
            activeAgentId: path.at(-1) ?? rootAgentId,
            canGoBack: path.length > 1,
            enter,
            navigate,
            back,
            reset,
        }),
        [path, rootAgentId, enter, navigate, back, reset],
    )
}
