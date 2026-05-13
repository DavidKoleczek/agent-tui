import { type KeyEvent } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/react"
import { useEffect, useRef } from "react"

export interface UseCtrlCExitOptions {
    isEmpty: () => boolean
    clear: () => void
    onBeforeExit?: () => void
    windowMs?: number
}

const DEFAULT_WINDOW_MS = 1000

// First Ctrl+C clears a non-empty input. On an empty input it arms an exit window;
// a second Ctrl+C inside that window destroys the renderer and lets the process exit naturally.
// Held Ctrl+C (key repeat) is ignored so it cannot self-double-tap.
// preventDefault/stopPropagation keep the shortcut exclusive to this handler.
export function useCtrlCExit({ isEmpty, clear, onBeforeExit, windowMs = DEFAULT_WINDOW_MS }: UseCtrlCExitOptions) {
    const renderer = useRenderer()
    const armedRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }
    }, [])

    useKeyboard((key: KeyEvent) => {
        if (!key.ctrl || key.name !== "c") return
        if (key.repeated) return

        if (!isEmpty()) {
            clear()
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            armedRef.current = false
            key.preventDefault()
            key.stopPropagation()
            return
        }

        if (armedRef.current) {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
            armedRef.current = false
            key.preventDefault()
            key.stopPropagation()
            onBeforeExit?.()
            renderer.destroy()
            return
        }

        armedRef.current = true
        timerRef.current = setTimeout(() => {
            armedRef.current = false
            timerRef.current = null
        }, windowMs)
        key.preventDefault()
        key.stopPropagation()
    })
}
