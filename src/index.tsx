import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import { createRoot } from "@opentui/react"
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { ActivityLog } from "./components/ActivityLog"
import { type TextInputHandle, TextInput } from "./components/TextInput"
import { useCtrlCExit } from "./hooks/use-ctrl-c-exit"
import { createActivityStore } from "./lib/activity-store"
import { type ScriptedReply, startScriptedReply } from "./lib/mock-stream/scripted-reply"
import { installVSCodeInputShims } from "./lib/vscode-shift-enter"

interface AppProps {
    onBeforeExit: () => void
}

function App({ onBeforeExit }: AppProps) {
    const store = useMemo(() => createActivityStore(), [])
    // Subscribe to the external activity store; its cached snapshot reference lets useSyncExternalStore skip re-renders when the reducer is a no-op.
    const activities = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    const inputRef = useRef<TextInputHandle | null>(null)
    const producerRef = useRef<ScriptedReply | null>(null)

    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    useEffect(() => {
        return () => {
            producerRef.current?.dispose()
            producerRef.current = null
        }
    }, [])

    const hasInProgressActivity = useCallback(() => {
        for (const activity of store.getSnapshot()) {
            if (activity.state === "in_progress") return true
        }
        return false
    }, [store])

    const handleSubmit = useCallback(
        (value: string) => {
            const userId = store.nextId("user")
            store.applyEvent({ type: "user.submit", id: userId, content: value })
            producerRef.current = startScriptedReply(store, value, () => {
                producerRef.current = null
            })
        },
        [store],
    )

    return (
        <box flexDirection="column" flexGrow={1}>
            <ActivityLog activities={activities} />
            <TextInput ref={inputRef} onSubmit={handleSubmit} canSubmit={() => !hasInProgressActivity()} />
        </box>
    )
}

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const keymap = createDefaultOpenTuiKeymap(renderer)
const uninstallVSCodeShims = installVSCodeInputShims()
createRoot(renderer).render(
    <KeymapProvider keymap={keymap}>
        <App onBeforeExit={uninstallVSCodeShims} />
    </KeymapProvider>,
)
