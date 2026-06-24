import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ActivityLog, ControlTower, StatusLine, TextInput, type TextInputHandle } from "./components"
import { useCtrlCExit, useTowerKeybinds } from "./hooks"
import { createActivityStore } from "./lib/activity-store"
import { fetchSessionActivities, type AgentWSClient, type ServerHandle } from "./lib/server"
import type { ActivityCreatedEvent, ErrorActivity, StatusId } from "./schemas/activities"
import { nowIso } from "./schemas/branded-types"

export interface AppProps {
    server: ServerHandle
    onBeforeExit: () => void
}

export function App({ server, onBeforeExit }: AppProps) {
    // Holds the list of Activities shown in the UI with a goal to keep state logic separate from React and prevent re-renders. Components subscribe to this.
    const logRef = useRef<(message: string) => void>(() => {})
    const store = useMemo(() => createActivityStore({ log: { warn: (m) => logRef.current(m) } }), [])
    // useExternalStore let's us manage our own subscription logic and only re-render when activities change.
    const activities = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    // Ref to the TextInput component used to manage the user input handling logic outside of the component.
    const inputRef = useRef<TextInputHandle | null>(null)
    const agentWSClientRef = useRef<AgentWSClient | null>(null)
    // Tears down the subscriptions on the currently wired client; replaced whenever we wire a new one.
    const teardownRef = useRef<() => void>(() => {})
    const [ready, setReady] = useState(false)
    // Latest server lifecycle status. Null means there is nothing to show (idle, or after agent_run_ended).
    const [status, setStatus] = useState<StatusId | null>(null)
    // The control tower side panel is shown by default.
    const [towerOpen, setTowerOpen] = useState(true)
    // Which region owns keyboard focus. The chat textarea is focused only in "chat".
    const [region, setRegion] = useState<"chat" | "tower">("chat")

    // Hook that registers a global keyboard listener and implements the correct behavior (described in the hook).
    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    useTowerKeybinds({
        onToggleOpen: () =>
            setTowerOpen((open) => {
                const next = !open
                // Closing the panel must not leave focus stranded in it.
                if (!next) setRegion("chat")
                return next
            }),
        onToggleFocus: () => {
            // A closed panel opens and takes focus; otherwise focus flips between the two regions.
            setTowerOpen(true)
            setRegion((current) => (current === "chat" ? "tower" : "chat"))
        },
    })

    // Points the app at a websocket client: stores it, routes reducer logs into its transcript, tracks ready/status,
    // and feeds its streaming events into the store. Tears down any previously wired client first.
    const wireClient = useCallback(
        (client: AgentWSClient) => {
            teardownRef.current()
            agentWSClientRef.current = client
            logRef.current = (message) => client.warn(message)
            setReady(client.isReady())
            const unsubscribes = [
                client.subscribeReady(() => {
                    setReady(client.isReady())
                    // A closed socket means the server is gone; drop any stale status so it cannot linger on reconnect.
                    if (!client.isReady()) setStatus(null)
                }),
                client.subscribeActivities((event) => {
                    // Track the latest phase for the status line; agent_run_ended is a sentinel that clears the status.
                    if (event.type === "status") {
                        setStatus(event.status_id === "agent_run_ended" ? null : event.status_id)
                    }
                    store.applyStreamingEvent(event)
                }),
            ]
            teardownRef.current = () => {
                for (const unsubscribe of unsubscribes) unsubscribe()
                teardownRef.current = () => {}
            }
        },
        [store],
    )

    useEffect(() => {
        let cancelled = false
        void server.ws.then((client) => {
            if (cancelled || client === null) return
            wireClient(client)
        })
        return () => {
            cancelled = true
            logRef.current = () => {}
            teardownRef.current()
        }
    }, [server, wireClient])

    // Loads a prior session's activities, renders them, and reconnects the agent so new messages continue that session.
    const handleResumeSelect = useCallback(
        (sessionPath: string) => {
            // Hand focus back to the chat so the user can immediately continue the conversation.
            setRegion("chat")
            const baseUrl = server.httpBaseUrl()
            if (baseUrl === null) return
            void (async () => {
                try {
                    const records = await fetchSessionActivities({
                        baseUrl,
                        workingDir: server.workingDir,
                        sessionDatabase: sessionPath,
                    })
                    store.seedActivities(records.map((record) => record.activity))
                } catch (err) {
                    store.applyStreamingEvent(buildResumeError(err))
                    return
                }
                const client = server.createClient(sessionPath)
                if (client !== null) wireClient(client)
            })()
        },
        [server, store, wireClient],
    )

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
            <box flexDirection="row" flexGrow={1}>
                <box flexDirection="column" flexGrow={1} onMouseDown={() => setRegion("chat")}>
                    <ActivityLog activities={activities} />
                    <TextInput ref={inputRef} onSubmit={handleSubmit} ready={ready} focused={region === "chat"} />
                </box>
                {towerOpen ? (
                    <ControlTower
                        region={region}
                        cwd={server.workingDir}
                        onEnterTower={() => setRegion("tower")}
                        onExitToChat={() => setRegion("chat")}
                        onResume={handleResumeSelect}
                    />
                ) : null}
            </box>
            <StatusLine ready={ready} status={status} />
        </box>
    )
}

function buildResumeError(err: unknown): ActivityCreatedEvent {
    const activity: ErrorActivity = {
        id: crypto.randomUUID(),
        type: "error",
        state: "error",
        timestamp: nowIso(),
        error_type: "resume_failed",
        detail: err instanceof Error ? err.message : String(err),
    }
    return { type: "activity_created", activity }
}
