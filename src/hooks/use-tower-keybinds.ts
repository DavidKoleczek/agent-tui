import { type KeyEvent } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useRef } from "react"

export interface UseTowerKeybindsOptions {
    // Toggle the control tower panel open/closed.
    onToggleOpen: () => void
    // Toggle keyboard focus between the chat and the control tower.
    onToggleFocus: () => void
    // Maximum gap, in milliseconds, between the two Tab presses that count as a double-tap.
    doubleTapMs?: number
}

const DEFAULT_DOUBLE_TAP_MS = 400

// Global hotkeys for the control tower:
// - Ctrl+B toggles the panel open/closed.
// - A double-tap of Tab toggles focus between the chat and the tower.
// Both are claimed before the textarea/keymap see them via preventDefault/stopPropagation, matching useCtrlCExit.
// A lone Tab is consumed (no tab character reaches the chat input); this is an accepted trade-off for the chat box.
export function useTowerKeybinds({
    onToggleOpen,
    onToggleFocus,
    doubleTapMs = DEFAULT_DOUBLE_TAP_MS,
}: UseTowerKeybindsOptions) {
    const lastTabAtRef = useRef<number>(0)

    useKeyboard((key: KeyEvent) => {
        if (key.ctrl && key.name === "b") {
            key.preventDefault()
            key.stopPropagation()
            onToggleOpen()
            return
        }

        if (key.name === "tab" && !key.ctrl && !key.meta && !key.shift) {
            key.preventDefault()
            key.stopPropagation()
            // Key-repeat from a held Tab must not self-trigger a double-tap.
            if (key.repeated) return
            const now = Date.now()
            if (now - lastTabAtRef.current <= doubleTapMs) {
                lastTabAtRef.current = 0
                onToggleFocus()
            } else {
                lastTabAtRef.current = now
            }
        }
    })
}
