import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { ActivityLog, ControlTower, HelpHint, StatusLine, TextInput, type TextInputHandle } from "./components"
import {
    isWorkingStatus,
    useAgentNavigation,
    useAgentStatuses,
    useCtrlCExit,
    useSessionConfig,
    useTowerKeybinds,
} from "./hooks"
import { buildActivityIndex, createActivityStore, getAgentActivities, resolveAgentPath } from "./lib/activity-store"
import { Colors } from "./lib/constants"
import { fetchSessionActivities, type AgentWSClient, type ServerHandle } from "./lib/server"
import {
    MAIN_AGENT_ID,
    type ActivityCreatedEvent,
    type ErrorActivity,
    type SessionActivity,
    type TaskPermission,
} from "./schemas/activities"
import { nowIso } from "./schemas/branded-types"

export interface AppProps {
    server: ServerHandle
    initialSessionDatabase: string | null
    onInitialResumeError: (err: unknown) => void
    onBeforeExit: () => void
}

export function App({ server, initialSessionDatabase, onInitialResumeError, onBeforeExit }: AppProps) {
    // Activity data and agent navigation.
    const logRef = useRef<(message: string) => void>(() => {})
    // Activity state lives outside React so subscribers only re-render when its snapshot changes.
    const store = useMemo(() => createActivityStore({ log: { warn: (m) => logRef.current(m) } }), [])
    const activities = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    const activityIndex = useMemo(() => buildActivityIndex(activities), [activities])
    const { path: agentPath, activeAgentId, canGoBack, navigate, back, reset } = useAgentNavigation()
    const activeActivities = getAgentActivities(activityIndex, activeAgentId)
    const { statuses, setStatus: setAgentStatus, clear: clearAgentStatuses } = useAgentStatuses()
    const activeStatus = statuses.get(activeAgentId) ?? null
    const mainStatus = statuses.get(MAIN_AGENT_ID) ?? null
    const rootView = activeAgentId === MAIN_AGENT_ID

    // Agent connection and session state.
    const agentWSClientRef = useRef<AgentWSClient | null>(null)
    // Invalidates asynchronous resume loads when a newer session switch starts.
    const sessionSwitchIdRef = useRef(0)
    // Tears down the subscriptions on the currently wired client; replaced whenever we wire a new one.
    const teardownRef = useRef<() => void>(() => {})
    // Database path of the currently wired session.
    const [sessionDatabase, setSessionDatabase] = useState<string | null>(null)
    // True once the agent worker has entered its run loop and created the session database.
    const [dbReady, setDbReady] = useState(false)
    const [ready, setReady] = useState(false)
    const [initializingResume, setInitializingResume] = useState(initialSessionDatabase !== null)

    // Activity log and input state.
    // Used to inspect and clear the chat draft from global keyboard handling.
    const inputRef = useRef<TextInputHandle | null>(null)
    const ctrlCDraftAcknowledgedAgentRef = useRef<string | null>(null)
    // Which region owns keyboard focus. The chat textarea is focused only in "chat".
    const [region, setRegion] = useState<"chat" | "tower">("chat")
    // Id of the task shown in the expanded overlay, or null when closed.
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [scrollResetKey, setScrollResetKey] = useState(0)
    // A missing or non-task id keeps the overlay closed and leaves the chat input eligible for focus.
    const expandedActivity = expandedTaskId !== null ? activities.get(expandedTaskId) : undefined
    const overlayOpen = expandedActivity?.type === "task"

    // Control Tower state and session config.
    // Session config shown and edited in the Control Tower.
    const {
        state: sessionConfigState,
        load: loadSessionConfig,
        reset: resetSessionConfig,
        setLocal: setLocalSessionConfig,
        applyConfirmed: applyConfirmedSessionConfig,
    } = useSessionConfig()
    const applyConfirmedRef = useRef(applyConfirmedSessionConfig)
    applyConfirmedRef.current = applyConfirmedSessionConfig
    // The Control Tower side panel is shown by default.
    const [towerOpen, setTowerOpen] = useState(true)

    // Agent connection and session lifecycle.
    // Replaces the wired client, routes its events into app state, and tears down the previous subscriptions.
    const wireClient = useCallback(
        (client: AgentWSClient) => {
            teardownRef.current()
            agentWSClientRef.current = client
            setSessionDatabase(client.sessionDatabase)
            setDbReady(false)
            clearAgentStatuses()
            logRef.current = (message) => client.warn(message)
            setReady(client.isReady())
            const unsubscribes = [
                client.subscribeReady(() => {
                    setReady(client.isReady())
                    // A closed socket means the server is gone; drop any stale status and re-arm the config gate.
                    if (!client.isReady()) {
                        clearAgentStatuses()
                        setDbReady(false)
                    }
                }),
                client.subscribeActivities((event) => {
                    if (event.type === "status") {
                        setAgentStatus(event.agent_id, event.status_id)
                        // agent_running is emitted from the worker's run loop, so the session database now exists.
                        if (event.agent_id === MAIN_AGENT_ID && event.status_id === "agent_running") setDbReady(true)
                    }
                    if (event.type === "session_config_changed" && event.agent_id === MAIN_AGENT_ID) {
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
        [store, setAgentStatus, clearAgentStatuses],
    )

    const activateSession = useCallback(
        (client: AgentWSClient, seed: readonly SessionActivity[] | null) => {
            reset()
            setExpandedTaskId(null)
            clearAgentStatuses()
            resetSessionConfig()
            setScrollResetKey((current) => current + 1)
            if (seed === null) store.reset()
            else store.seedActivities(seed)
            wireClient(client)
            // Hand focus back to chat so the user can immediately use the new active session.
            setRegion("chat")
        },
        [store, wireClient, reset, clearAgentStatuses, resetSessionConfig],
    )

    // Normal launches can wire the newly generated session immediately,
    // while --resume must hydrate the selected conversation before revealing the chat.
    useEffect(() => {
        let cancelled = false

        if (initialSessionDatabase === null) {
            // The server owns creation of the default session, so only its initial websocket needs to be attached.
            void server.ws.then((client) => {
                if (cancelled || client === null) return
                wireClient(client)
            })
        } else {
            // Wait for the HTTP API, load persisted history, then activate the websocket opened for the selected database.
            void (async () => {
                await server.process
                const baseUrl = server.httpBaseUrl()
                if (baseUrl === null) throw new Error("agent server failed to start")

                const records = await fetchSessionActivities({
                    baseUrl,
                    workingDir: server.workingDir,
                    sessionDatabase: initialSessionDatabase,
                })
                const client = await server.ws
                if (client === null) throw new Error("agent server failed to connect to the selected conversation")
                if (cancelled) return

                activateSession(
                    client,
                    records.map((record) => record.activity),
                )
                setInitializingResume(false)
            })().catch((err: unknown) => {
                if (!cancelled) onInitialResumeError(err)
            })
        }

        return () => {
            cancelled = true
            sessionSwitchIdRef.current++
            logRef.current = () => {}
            teardownRef.current()
        }
    }, [server, initialSessionDatabase, onInitialResumeError, wireClient, activateSession])

    const handleNewSession = useCallback(() => {
        if (server.httpBaseUrl() === null) return

        sessionSwitchIdRef.current++
        // Ask the old worker tree to stop cleanly before createClient closes its socket as a fallback.
        agentWSClientRef.current?.quit()
        const client = server.createClient()
        if (client !== null) activateSession(client, null)
    }, [server, activateSession])

    const handleResumeSelect = useCallback(
        (sessionPath: string) => {
            const baseUrl = server.httpBaseUrl()
            if (baseUrl === null) return

            const switchId = ++sessionSwitchIdRef.current
            // The picker is done; return focus while the local resume request loads.
            setRegion("chat")
            void (async () => {
                let records
                try {
                    records = await fetchSessionActivities({
                        baseUrl,
                        workingDir: server.workingDir,
                        sessionDatabase: sessionPath,
                    })
                } catch (err) {
                    if (switchId === sessionSwitchIdRef.current) {
                        store.applyStreamingEvent(buildResumeError(err))
                    }
                    return
                }

                if (switchId !== sessionSwitchIdRef.current) return
                agentWSClientRef.current?.quit()
                const client = server.createClient(sessionPath)
                if (client !== null)
                    activateSession(
                        client,
                        records.map((record) => record.activity),
                    )
            })()
        },
        [server, store, activateSession],
    )

    // Agent activities and navigation.
    useEffect(() => {
        if (activeAgentId === MAIN_AGENT_ID) return

        const resolved = resolveAgentPath(activityIndex.parentTaskByAgent, activeAgentId)
        if (!resolved.ok) {
            logRef.current(
                `cannot keep agent view ${activeAgentId}: ${resolved.reason} at ${resolved.agentId}; returning to main`,
            )
            setExpandedTaskId(null)
            reset()
            return
        }
        if (!agentPathsEqual(agentPath, resolved.path)) {
            logRef.current(`agent view path for ${activeAgentId} changed; reconciling it`)
            setExpandedTaskId(null)
            navigate(resolved.path)
        }
    }, [activeAgentId, activityIndex.parentTaskByAgent, agentPath, navigate, reset])

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

    const navigateToAgent = useCallback(
        (agentId: string): boolean => {
            const resolved = resolveAgentPath(activityIndex.parentTaskByAgent, agentId)
            if (!resolved.ok) {
                logRef.current(
                    `cannot navigate to agent ${agentId}: ${resolved.reason} at ${resolved.agentId}; returning to main`,
                )
                setExpandedTaskId(null)
                reset()
                return false
            }
            navigate(resolved.path)
            return true
        },
        [activityIndex.parentTaskByAgent, navigate, reset],
    )

    const handleOpenTask = useCallback(
        (id: string) => {
            const activity = store.getSnapshot().get(id)
            if (activity === undefined || activity.type !== "task") {
                logRef.current(`cannot open unknown task activity ${id}`)
                return
            }

            setRegion("chat")
            if (activity.sub_agent_id !== null) {
                setExpandedTaskId(null)
                navigateToAgent(activity.sub_agent_id)
                return
            }
            if (navigateToAgent(activity.agent_id)) setExpandedTaskId(activity.id)
        },
        [store, navigateToAgent],
    )

    const handleCloseTask = useCallback(() => setExpandedTaskId(null), [])
    const handleAgentBack = useCallback(() => {
        setRegion("chat")
        setExpandedTaskId(null)
        back()
    }, [back])

    // Chat input and exit handling.
    const handleSubmit = useCallback(
        (value: string) => {
            if (activeAgentId !== MAIN_AGENT_ID) {
                logRef.current(`user message submission is disabled while viewing agent ${activeAgentId}`)
                return
            }
            // Show the message immediately, then send it to the server.
            store.pushUserMessage(value)
            agentWSClientRef.current?.sendUserMessage(value)
        },
        [activeAgentId, store],
    )

    // Entering another agent view re-arms the draft-clearing step.
    useEffect(() => {
        ctrlCDraftAcknowledgedAgentRef.current = null
    }, [activeAgentId])

    const ctrlCHint = useCtrlCExit({
        isEmpty: () => {
            const inputEmpty = inputRef.current?.isEmpty() ?? true
            return inputEmpty || (!rootView && ctrlCDraftAcknowledgedAgentRef.current === activeAgentId)
        },
        clear: () => {
            if (rootView) {
                inputRef.current?.clear()
                return
            }
            // Preserve the main draft while consuming the same Ctrl-C press that would clear it in the main view.
            ctrlCDraftAcknowledgedAgentRef.current = activeAgentId
        },
        isWorking: () => isWorkingStatus(mainStatus),
        cancel: () => {
            agentWSClientRef.current?.cancel()
        },
        onBeforeExit,
    })

    // Control Tower behavior.
    // Load config only after the worker has created the session database.
    useEffect(() => {
        if (!dbReady) {
            resetSessionConfig()
            return
        }
        const baseUrl = server.httpBaseUrl()
        if (baseUrl === null || sessionDatabase === null) return
        loadSessionConfig({ baseUrl, sessionDatabase })
    }, [dbReady, sessionDatabase, server, loadSessionConfig, resetSessionConfig])

    const handleChangeConfig = useCallback(
        (key: string, value: string) => {
            // Update the tower immediately, then send the change; the server echoes a confirmation that reconciles it.
            setLocalSessionConfig(key, value)
            agentWSClientRef.current?.sendSessionConfigChange(key, value)
        },
        [setLocalSessionConfig],
    )

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

    // Keep the chat hidden until persisted activities are loaded and the resumed websocket is wired.
    if (initializingResume) {
        return (
            <box flexGrow={1} alignItems="center" justifyContent="center">
                <text fg={Colors.mutedText}>Loading conversation...</text>
            </box>
        )
    }

    return (
        <box flexDirection="column" flexGrow={1}>
            <box flexDirection="row" flexGrow={1}>
                <box flexDirection="column" flexGrow={1} onMouseDown={() => setRegion("chat")}>
                    <ActivityLog
                        agentId={activeAgentId}
                        activities={activeActivities}
                        scrollResetKey={scrollResetKey}
                        expandedTaskId={expandedTaskId}
                        onOpenTask={handleOpenTask}
                        onCloseTask={handleCloseTask}
                        backEnabled={region === "chat" && canGoBack}
                        onBack={handleAgentBack}
                        onPermissionChange={handlePermissionChange}
                    />
                    <TextInput
                        ref={inputRef}
                        onSubmit={handleSubmit}
                        enabled={ready && rootView}
                        focused={rootView && region === "chat" && !overlayOpen}
                    />
                    <StatusLine ready={ready} status={activeStatus} onBack={canGoBack ? handleAgentBack : undefined} />
                    <HelpHint hint={ctrlCHint} />
                </box>
                {towerOpen ? (
                    <ControlTower
                        region={region}
                        cwd={server.workingDir}
                        config={sessionConfigState}
                        onChangeConfig={handleChangeConfig}
                        pendingApprovals={activityIndex.pendingApprovals}
                        onPermissionChange={handlePermissionChange}
                        onOpenTask={handleOpenTask}
                        onEnterTower={() => setRegion("tower")}
                        onExitToChat={() => setRegion("chat")}
                        onNewSession={handleNewSession}
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
        agent_id: MAIN_AGENT_ID,
        type: "error",
        state: "error",
        timestamp: nowIso(),
        error_type: "resume_failed",
        detail: err instanceof Error ? err.message : String(err),
    }
    return { type: "activity_created", agent_id: MAIN_AGENT_ID, activity }
}

function agentPathsEqual(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((agentId, index) => agentId === right[index])
}
