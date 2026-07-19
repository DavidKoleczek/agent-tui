import { CliRenderEvents, createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import { createRoot } from "@opentui/react"
import { App } from "./app"
import { runPreBootCli } from "./cli"
import { ResumeScreen } from "./components"
import { cleanupStaleBackup, installVSCodeInputShims } from "./lib/tui"
import { startServer, type ServerHandle } from "./lib/server"

const cliResult = await runPreBootCli(process.argv)
if ("exitCode" in cliResult) {
    process.exit(cliResult.exitCode)
}

cleanupStaleBackup(process.execPath)

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const keymap = createDefaultOpenTuiKeymap(renderer)
const uninstallVSCodeShims = installVSCodeInputShims()
const root = createRoot(renderer)

let server: ServerHandle | null = null
let stopping = false
const stopServer = (): void => {
    if (stopping || server === null) return
    stopping = true
    void server.stop()
}

renderer.on(CliRenderEvents.DESTROY, stopServer)
process.on("SIGINT", stopServer)
process.on("SIGTERM", stopServer)

const handleInitialResumeError = (err: unknown): void => {
    process.exitCode = 1
    uninstallVSCodeShims()
    renderer.destroy()
    const detail = err instanceof Error ? err.message : String(err)
    process.stderr.write(`floppy: failed to resume conversation: ${detail}\n`)
}

const renderApp = (activeServer: ServerHandle, initialSessionDatabase: string | null): void => {
    root.render(
        <KeymapProvider keymap={keymap}>
            <App
                server={activeServer}
                initialSessionDatabase={initialSessionDatabase}
                onInitialResumeError={handleInitialResumeError}
                onBeforeExit={uninstallVSCodeShims}
            />
        </KeymapProvider>,
    )
}

if (cliResult.launchMode === "resume") {
    root.render(
        <KeymapProvider keymap={keymap}>
            <ResumeScreen
                cwd={process.cwd()}
                onSelect={(sessionPath) => {
                    if (server !== null) return
                    server = startServer({ initialSessionDatabase: sessionPath })
                    renderApp(server, sessionPath)
                }}
                onCancel={() => {
                    uninstallVSCodeShims()
                    renderer.destroy()
                }}
            />
        </KeymapProvider>,
    )
} else {
    server = startServer()
    renderApp(server, null)
}
