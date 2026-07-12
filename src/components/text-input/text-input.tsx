import { type TextareaRenderable } from "@opentui/core"
import { type Ref, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { usePasteShortening } from "./use-paste-shortening"
import { Colors } from "../../lib/constants"

export interface TextInputHandle {
    clear: () => void
    isEmpty: () => boolean
}

interface TextInputProps {
    placeholder?: string
    onSubmit: (value: string) => void
    // Whether submissions are enabled. While false, the input is greyed out and submissions are suppressed.
    enabled: boolean
    // Whether the textarea holds keyboard focus. Released when another region (e.g. the control tower) is focused.
    focused: boolean
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

export function TextInput({ placeholder, onSubmit, enabled, focused, ref }: TextInputProps) {
    const textareaRef = useRef<TextareaRenderable | null>(null)
    const paste = usePasteShortening(textareaRef)

    // Synchronize OpenTUI's imperative focus state before drawing.
    // Disabled sub-agent views preserve the draft while preventing the textarea from receiving keyboard or mouse focus.
    useLayoutEffect(() => {
        const textarea = textareaRef.current
        if (textarea === null) return
        textarea.focusable = enabled
        if (enabled && focused) textarea.focus()
        else textarea.blur()
    }, [enabled, focused])

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
        if (!enabled) return
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
            borderColor={enabled ? undefined : Colors.mutedText}
            // Reserves space for the absolute prompt marker.
            paddingLeft={3}
            paddingRight={1}
            flexShrink={0}
            position="relative"
        >
            {/* Absolute keeps the marker out of flex sizing*/}
            <text position="absolute" left={1} top={0} fg={enabled ? undefined : Colors.mutedText}>
                ❯
            </text>
            <textarea
                ref={textareaRef}
                placeholder={placeholder}
                wrapMode="word"
                keyBindings={KEY_BINDINGS}
                onSubmit={handleSubmit}
                onPaste={paste.onPaste}
                width="100%"
                maxHeight={MAX_VISIBLE_ROWS}
                // Hold the cursor steady while launching; let it resume blinking once the connection is ready.
                cursorStyle={{ style: "block", blinking: enabled }}
                textColor={enabled ? undefined : Colors.mutedText}
                focusedTextColor={enabled ? undefined : Colors.mutedText}
                placeholderColor={enabled ? undefined : Colors.mutedText}
            />
        </box>
    )
}
