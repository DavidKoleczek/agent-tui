import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useRef, useState } from "react"
import { type TextInputHandle, TextInput } from "./components/TextInput"
import { useCtrlCExit } from "./hooks/use-ctrl-c-exit"
import { installVSCodeInputShims } from "./lib/vscode-shift-enter"

interface AppProps {
    onBeforeExit: () => void
}

function App({ onBeforeExit }: AppProps) {
    const [submitted, setSubmitted] = useState("")
    const inputRef = useRef<TextInputHandle | null>(null)

    useCtrlCExit({
        isEmpty: () => inputRef.current?.isEmpty() ?? true,
        clear: () => inputRef.current?.clear(),
        onBeforeExit,
    })

    return (
        <box flexDirection="column" flexGrow={1}>
            <box flexGrow={1} alignItems="center" justifyContent="center">
                {submitted.length > 0 && (
                    <box border borderStyle="rounded" padding={1}>
                        <text>{submitted}</text>
                    </box>
                )}
            </box>
            <TextInput ref={inputRef} onSubmit={setSubmitted} />
        </box>
    )
}

const renderer = await createCliRenderer({ exitOnCtrlC: false })
const uninstallVSCodeShims = installVSCodeInputShims()
createRoot(renderer).render(<App onBeforeExit={uninstallVSCodeShims} />)
