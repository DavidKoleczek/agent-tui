import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { KeymapProvider } from "@opentui/keymap/react"
import { createRoot } from "@opentui/react"
import { useRef, useState } from "react"
import { ActivityLog } from "./components/ActivityLog"
import { sampleActivities } from "./components/ActivityLog/samples"
import { type TextInputHandle, TextInput } from "./components/TextInput"
import { useCtrlCExit } from "./hooks/use-ctrl-c-exit"
import { installVSCodeInputShims } from "./lib/vscode-shift-enter"
import { type Activity } from "./schemas/activities"

interface AppProps {
    onBeforeExit: () => void
}

function App({ onBeforeExit }: AppProps) {
    const [activities] = useState<readonly Activity[]>(sampleActivities)
    const inputRef = useRef<TextInputHandle | null>(null)

    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    return (
        <box flexDirection="column" flexGrow={1}>
            <ActivityLog activities={activities} />
            <TextInput ref={inputRef} onSubmit={() => {}} />
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
