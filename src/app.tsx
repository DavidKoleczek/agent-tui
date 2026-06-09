import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ActivityLog, StatusLine, TextInput, type TextInputHandle } from "./components"
import { useCtrlCExit } from "./hooks"
import { createActivityStore } from "./lib/activity-store"
import type { AgentWSClient } from "./lib/server/agent"
import type { StatusId } from "./schemas/activities"

export interface AppProps {
    ws: Promise<AgentWSClient | null>
    onBeforeExit: () => void
}

export function App({ ws, onBeforeExit }: AppProps) {
    // Holds the list of Activities shown in the UI with a goal to keep state logic separate from React and prevent re-renders. Components subscribe to this.
    const logRef = useRef<(message: string) => void>(() => {})
    const store = useMemo(() => createActivityStore({ log: { warn: (m) => logRef.current(m) } }), [])
    // useExternalStore let's us manage our own subscription logic and only re-render when activities change.
    const activities = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    // Ref to the TextInput component used to manage the user input handling logic outside of the component.
    const inputRef = useRef<TextInputHandle | null>(null)
    const agentWSClientRef = useRef<AgentWSClient | null>(null)
    const [ready, setReady] = useState(false)
    // Latest server lifecycle status. Null means there is nothing to show (idle, or after agent_run_ended).
    const [status, setStatus] = useState<StatusId | null>(null)

    // Hook that registers a global keyboard listener and implements the correct behavior (described in the hook).
    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    useEffect(() => {
        const unsubscribes: Array<() => void> = []
        let cancelled = false
        void ws.then((client) => {
            if (cancelled || client === null) return
            // Store the websocket client in a ref so it can be used in other parts of the app.
            agentWSClientRef.current = client
            // Forward reducer anomaly logs into this connection's transcript.
            logRef.current = (message) => client.warn(message)
            // Once the websocket is ready, we update the state to indicate "loading" is complete and the user can submit messages.
            setReady(client.isReady())
            unsubscribes.push(
                // Whenever the socket opens or closes, we update the ready state.
                client.subscribeReady(() => {
                    setReady(client.isReady())
                    // A closed socket means the server is gone; drop any stale status so it cannot linger on reconnect.
                    if (!client.isReady()) setStatus(null)
                }),
                // On each incoming StreamingEvent from the server, this feeds it into the store, which then updates the UI.
                client.subscribeActivities((event) => {
                    // Track the latest phase for the status line; agent_run_ended is a sentinel that clears the status.
                    if (event.type === "status") {
                        setStatus(event.status_id === "agent_run_ended" ? null : event.status_id)
                    }
                    store.applyStreamingEvent(event)
                }),
            )
        })
        return () => {
            cancelled = true
            logRef.current = () => {}
            for (const unsubscribe of unsubscribes) unsubscribe()
        }
    }, [ws, store])

    const handleSubmit = useCallback(
        (value: string) => {
            // When a submission happens, optimistically add the user's message to the store so it appears in the UI immediately,
            // then send it to the server via the websocket client.
            store.pushUserMessage(value)
            agentWSClientRef.current?.sendUserMessage(value)
        },
        [store],
    )

    return (
        <box flexDirection="column" flexGrow={1}>
            <ActivityLog activities={activities} />
            <TextInput ref={inputRef} onSubmit={handleSubmit} ready={ready} />
            <StatusLine ready={ready} status={status} />
        </box>
    )
}
