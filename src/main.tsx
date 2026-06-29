import { CliRenderEvents, createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { runPreBootCli } from "./cli"
import { installVSCodeInputShims } from "./lib/tui"
import { startServer } from "./lib/server"

// Handle pre-boot flags like --version
if (runPreBootCli(process.argv)) {
    process.exit(0)
}

// Runs the agent-server
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
        <App server={server} onBeforeExit={uninstallVSCodeShims} />
    </KeymapProvider>,
)
