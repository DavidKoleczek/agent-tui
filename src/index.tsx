import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useState } from "react"
import { TextInput } from "./components/TextInput"
import { installVSCodeInputShims } from "./lib/vscode-shift-enter"

function App() {
    const [submitted, setSubmitted] = useState("")

    return (
        <box flexDirection="column" flexGrow={1}>
            <box flexGrow={1} alignItems="center" justifyContent="center">
                {submitted.length > 0 && (
                    <box border borderStyle="rounded" padding={1}>
                        <text>{submitted}</text>
                    </box>
                )}
            </box>
            <TextInput onSubmit={setSubmitted} />
        </box>
    )
}

const renderer = await createCliRenderer()
installVSCodeInputShims()
createRoot(renderer).render(<App />)
