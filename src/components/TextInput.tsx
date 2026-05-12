import { type TextareaRenderable } from "@opentui/core"
import { useRef } from "react"

interface TextInputProps {
    placeholder?: string
    onSubmit: (value: string) => void
}

const MAX_VISIBLE_ROWS = 10

// Override the textarea default (Enter -> newline). Newlines only via wrap or paste.
const SUBMIT_KEY_BINDINGS = [
    { name: "return", action: "submit" as const },
    { name: "linefeed", action: "submit" as const },
]

export function TextInput({ placeholder, onSubmit }: TextInputProps) {
    const textareaRef = useRef<TextareaRenderable | null>(null)

    const handleSubmit = () => {
        const textarea = textareaRef.current
        if (!textarea) return
        const value = textarea.plainText
        if (value.length === 0) return
        onSubmit(value)
        textarea.setText("")
    }

    return (
        <box
            width="100%"
            // +2 for the top/bottom borders.
            maxHeight={MAX_VISIBLE_ROWS + 2}
            border={["top", "bottom"]}
            borderStyle="rounded"
            // Reserves space for the absolute prompt marker.
            paddingLeft={3}
            paddingRight={1}
            flexShrink={0}
            position="relative"
        >
            {/* Absolute keeps the marker out of flex sizing*/}
            <text position="absolute" left={1} top={0}>
                ❯
            </text>
            <textarea
                ref={textareaRef}
                focused
                placeholder={placeholder}
                wrapMode="word"
                keyBindings={SUBMIT_KEY_BINDINGS}
                onSubmit={handleSubmit}
                width="100%"
                maxHeight={MAX_VISIBLE_ROWS}
            />
        </box>
    )
}
