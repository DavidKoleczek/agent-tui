import { useKeyboard } from "@opentui/react"
import { useState } from "react"
import { SessionPicker } from "./session-picker"

const MAX_PREVIEW_CHARS = 80

export interface ResumeScreenProps {
    cwd: string
    onSelect: (sessionPath: string) => void
    onCancel: () => void
}

export function ResumeScreen({ cwd, onSelect, onCancel }: ResumeScreenProps) {
    const [submitting, setSubmitting] = useState(false)

    useKeyboard((key) => {
        if (!key.ctrl || key.name !== "c" || key.repeated) return
        key.preventDefault()
        key.stopPropagation()
        onCancel()
    })

    const handleSelect = (sessionPath: string): void => {
        if (submitting) return
        setSubmitting(true)
        onSelect(sessionPath)
    }

    return (
        <box flexDirection="column" flexGrow={1} paddingTop={1} paddingLeft={1} paddingRight={1}>
            <SessionPicker
                cwd={cwd}
                active={!submitting}
                onSelect={handleSelect}
                onCancel={onCancel}
                maxPreviewChars={MAX_PREVIEW_CHARS}
            />
        </box>
    )
}
