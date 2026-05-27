import { CliRenderEvents, createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import { createRoot } from "@opentui/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { type TextInputHandle, TextInput } from "./components/TextInput"
import { useCtrlCExit } from "./hooks/use-ctrl-c-exit"
import { startServer } from "./lib/server"
import type { WsClient } from "./lib/server/ws-client"
import { installVSCodeInputShims } from "./lib/vscode-shift-enter"

interface AppProps {
    ws: Promise<WsClient | null>
    onBeforeExit: () => void
}

function App({ ws, onBeforeExit }: AppProps) {
    const inputRef = useRef<TextInputHandle | null>(null)
    const wsClientRef = useRef<WsClient | null>(null)
    const [ready, setReady] = useState(false)

    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    useEffect(() => {
        let unsubscribe: (() => void) | null = null
        let cancelled = false
        void ws.then((client) => {
            if (cancelled || client === null) return
            wsClientRef.current = client
            setReady(client.isReady())
            unsubscribe = client.subscribeReady(() => {
                setReady(client.isReady())
            })
        })
        return () => {
            cancelled = true
            unsubscribe?.()
        }
    }, [ws])

    const handleSubmit = useCallback((value: string) => {
        // Silent no-op until the websocket is open.
        // We intentionally don't surface a "not ready" indicator in the UI yet
        // canSubmit blocks submission via TextInput
        wsClientRef.current?.sendUserMessage(value)
    }, [])

    const canSubmit = useCallback(() => ready, [ready])

    return (
        <box flexDirection="column" flexGrow={1}>
            <box flexGrow={1} />
            <TextInput ref={inputRef} onSubmit={handleSubmit} canSubmit={canSubmit} />
        </box>
    )
}

// Runs the agent-server, resolving uv automatically.
const server = startServer()

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const keymap = createDefaultOpenTuiKeymap(renderer)
const uninstallVSCodeShims = installVSCodeInputShims()

let stopping = false
const stopServer = (): void => {
    if (stopping) return
    stopping = true
    void server.stop()
}

renderer.on(CliRenderEvents.DESTROY, stopServer)
process.on("SIGINT", stopServer)
process.on("SIGTERM", stopServer)

createRoot(renderer).render(
    <KeymapProvider keymap={keymap}>
        <App ws={server.ws} onBeforeExit={uninstallVSCodeShims} />
    </KeymapProvider>,
)
