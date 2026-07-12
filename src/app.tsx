import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ActivityLog, ControlTower, HelpHint, StatusLine, TextInput, type TextInputHandle } from "./components"
import { useCtrlCExit, useSessionConfig, useTowerKeybinds } from "./hooks"
import { createActivityStore } from "./lib/activity-store"
import { fetchSessionActivities, type AgentWSClient, type ServerHandle } from "./lib/server"
import type { ActivityCreatedEvent, ErrorActivity, StatusId, TaskActivity, TaskPermission } from "./schemas/activities"
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
    // Tool calls the server has paused for the user's approval, surfaced in the Control tower.
    const pendingApprovals = useMemo(
        () =>
            Array.from(activities.values()).filter(
                (activity): activity is TaskActivity => activity.type === "task" && activity.permission === "pending",
            ),
        [activities],
    )
    // Ref to the TextInput component used to manage the user input handling logic outside of the component.
    const inputRef = useRef<TextInputHandle | null>(null)
    const agentWSClientRef = useRef<AgentWSClient | null>(null)
    // Tears down the subscriptions on the currently wired client; replaced whenever we wire a new one.
    const teardownRef = useRef<() => void>(() => {})
    // Session config shown and edited in the Control tower.
    const {
        state: sessionConfigState,
        load: loadSessionConfig,
        reset: resetSessionConfig,
        setLocal: setLocalSessionConfig,
        applyConfirmed: applyConfirmedSessionConfig,
    } = useSessionConfig()
    const applyConfirmedRef = useRef(applyConfirmedSessionConfig)
    applyConfirmedRef.current = applyConfirmedSessionConfig
    // Database path of the currently wired session.
    const [sessionDatabase, setSessionDatabase] = useState<string | null>(null)
    // True once the agent worker has entered its run loop (agent_running) for the current connection. Only then
    // does the session database file exist, so it is the safe point to read the session config over HTTP.
    const [dbReady, setDbReady] = useState(false)
    const [ready, setReady] = useState(false)
    // Latest server lifecycle status. Null means there is nothing to show (idle, or after agent_turn_ended).
    const [status, setStatus] = useState<StatusId | null>(null)
    // The control tower side panel is shown by default.
    const [towerOpen, setTowerOpen] = useState(true)
    // Which region owns keyboard focus. The chat textarea is focused only in "chat".
    const [region, setRegion] = useState<"chat" | "tower">("chat")
    // Id of the task shown in the expanded overlay, or null when closed.
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    // The overlay only applies to task activities; a missing or non-task id keeps it closed. The chat input releases
    // its focus while the overlay is open.
    const expandedActivity = expandedTaskId !== null ? activities.get(expandedTaskId) : undefined
    const overlayOpen = expandedActivity?.type === "task"

    // Hook that registers a global keyboard listener. It returns the currently armed Ctrl-C step.
    const ctrlCHint = useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        isWorking: () => status !== null,
        cancel: () => {
            agentWSClientRef.current?.cancel()
        },
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
            setSessionDatabase(client.sessionDatabase)
            setDbReady(false)
            logRef.current = (message) => client.warn(message)
            setReady(client.isReady())
            const unsubscribes = [
                client.subscribeReady(() => {
                    setReady(client.isReady())
                    // A closed socket means the server is gone; drop any stale status and re-arm the config gate.
                    if (!client.isReady()) {
                        setStatus(null)
                        setDbReady(false)
                    }
                }),
                client.subscribeActivities((event) => {
                    // Track the latest phase for the status line; agent_running is a sentinel that clears the status.
                    if (event.type === "status" && event.agent_id === "main") {
                        setStatus(event.status_id === "agent_running" ? null : event.status_id)
                        // agent_running is emitted from the worker's run loop, so the session database now exists.
                        if (event.status_id === "agent_running") setDbReady(true)
                    }
                    if (event.type === "session_config_changed" && event.agent_id === "main") {
                        applyConfirmedRef.current(event.config_key, event.new_value)
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

    // Load the session's config once the agent worker is running so the Control tower reflects real state
    useEffect(() => {
        if (!dbReady) {
            resetSessionConfig()
            return
        }
        const baseUrl = server.httpBaseUrl()
        if (baseUrl === null || sessionDatabase === null) return
        loadSessionConfig({ baseUrl, sessionDatabase })
    }, [dbReady, sessionDatabase, server, loadSessionConfig, resetSessionConfig])

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

    const handleChangeConfig = useCallback(
        (key: string, value: string) => {
            // Update the tower immediately, then send the change; the server echoes a confirmation that reconciles it.
            setLocalSessionConfig(key, value)
            agentWSClientRef.current?.sendSessionConfigChange(key, value)
        },
        [setLocalSessionConfig],
    )

    const handlePermissionChange = useCallback(
        (id: string, permission: TaskPermission) => {
            // Optimistically apply the decision so the card leaves the list instantly, but only once the send
            // succeeds: a closed socket means the server will never process it, so the card must stay pending.
            // The server's echoed activity update reconciles the authoritative state and result.
            const activity = store.getSnapshot().get(id)
            if (activity === undefined || activity.type !== "task") {
                logRef.current(`permission change for unknown task activity ${id}; ignoring it`)
                return
            }
            const sent =
                agentWSClientRef.current?.sendPermissionChange(activity.agent_id, activity.id, permission) ?? false
            if (sent) store.setTaskPermission(activity.agent_id, activity.id, permission)
        },
        [store],
    )

    return (
        <box flexDirection="column" flexGrow={1}>
            <box flexDirection="row" flexGrow={1}>
                <box flexDirection="column" flexGrow={1} onMouseDown={() => setRegion("chat")}>
                    <ActivityLog
                        activities={activities}
                        expandedTaskId={expandedTaskId}
                        onExpandTask={setExpandedTaskId}
                        onPermissionChange={handlePermissionChange}
                    />
                    <TextInput
                        ref={inputRef}
                        onSubmit={handleSubmit}
                        ready={ready}
                        focused={region === "chat" && !overlayOpen}
                    />
                    <StatusLine ready={ready} status={status} />
                    <HelpHint hint={ctrlCHint} />
                </box>
                {towerOpen ? (
                    <ControlTower
                        region={region}
                        cwd={server.workingDir}
                        config={sessionConfigState}
                        onChangeConfig={handleChangeConfig}
                        pendingApprovals={pendingApprovals}
                        onPermissionChange={handlePermissionChange}
                        onExpandTask={setExpandedTaskId}
                        onEnterTower={() => setRegion("tower")}
                        onExitToChat={() => setRegion("chat")}
                        onResume={handleResumeSelect}
                    />
                ) : null}
            </box>
        </box>
    )
}

function buildResumeError(err: unknown): ActivityCreatedEvent {
    const activity: ErrorActivity = {
        id: crypto.randomUUID(),
        agent_id: "main",
        type: "error",
        state: "error",
        timestamp: nowIso(),
        error_type: "resume_failed",
        detail: err instanceof Error ? err.message : String(err),
    }
    return { type: "activity_created", agent_id: "main", activity }
}
