import { type TextareaRenderable } from "@opentui/core"
import { type Ref, useImperativeHandle, useRef } from "react"
import { usePasteShortening } from "./use-paste-shortening"

export interface TextInputHandle {
    clear: () => void
    isEmpty: () => boolean
}

interface TextInputProps {
    placeholder?: string
    onSubmit: (value: string) => void
    canSubmit?: () => boolean
    ref?: Ref<TextInputHandle>
}

const MAX_VISIBLE_ROWS = 10

// Plain Enter submits user message.
// Shift+Enter, Ctrl+Enter, and Alt+Enter insert a newline when the terminal sends a distinct sequence
// Without that, terminals collapse every Enter variant to "\r" and only plain submit applies.
const KEY_BINDINGS = [
    { name: "return", action: "submit" as const },
    { name: "linefeed", action: "submit" as const },
    { name: "return", shift: true, action: "newline" as const },
    { name: "return", ctrl: true, action: "newline" as const },
    { name: "return", meta: true, action: "newline" as const },
]

export function TextInput({ placeholder, onSubmit, canSubmit, ref }: TextInputProps) {
    const textareaRef = useRef<TextareaRenderable | null>(null)
    const paste = usePasteShortening(textareaRef)

    // Lets the parent drive Ctrl+C clear-then-exit without exposing the textarea ref or lifting the textarea's text into React state.
    useImperativeHandle(
        ref,
        () => ({
            clear: () => {
                textareaRef.current?.setText("")
                paste.reset()
            },
            isEmpty: () => {
                const textarea = textareaRef.current
                if (!textarea) return true
                return textarea.plainText.length === 0
            },
        }),
        [paste.reset],
    )

    const handleSubmit = () => {
        const textarea = textareaRef.current
        if (!textarea) return
        // Gate before paste.expand() so a suppressed submit does no work and preserves the draft and paste state.
        if (canSubmit && !canSubmit()) return
        const value = paste.expand()
        if (value.length === 0) return
        onSubmit(value)
        textarea.setText("")
        paste.reset()
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
                keyBindings={KEY_BINDINGS}
                onSubmit={handleSubmit}
                onPaste={paste.onPaste}
                width="100%"
                maxHeight={MAX_VISIBLE_ROWS}
            />
        </box>
    )
}
