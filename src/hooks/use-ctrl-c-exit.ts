import { type KeyEvent } from "@opentui/core"
import { useKeyboard, useRenderer } from "@opentui/react"
import { useEffect, useRef, useState } from "react"

export interface UseCtrlCExitOptions {
    isEmpty: () => boolean
    clear: () => void
    // Whether the agent is actively working. When true, Ctrl-C on an empty input cancels before it quits.
    isWorking: () => boolean
    // Sends the cancel request to the server (kills the running agent subprocess).
    cancel: () => void
    onBeforeExit?: () => void
    windowMs?: number
}

export type CtrlCHint = "none" | "cancel" | "quit"

const DEFAULT_WINDOW_MS = 1000

// State-aware Ctrl-C.
// A press on a non-empty input clears it and resets the sequence.
// On an empty input the behavior depends on whether the agent is working:
// - idle arms once then quits
// - working arms once, cancels onthe second press, then quits on the third.
//
// A rolling window resets the counter (and clears the hint) if the next press does not arrive in time.
// Held Ctrl-C (key repeat) is ignored so it cannot self-advance.
export function useCtrlCExit({
    isEmpty,
    clear,
    isWorking,
    cancel,
    onBeforeExit,
    windowMs = DEFAULT_WINDOW_MS,
}: UseCtrlCExitOptions): CtrlCHint {
    const renderer = useRenderer()
    const countRef = useRef(0)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [hint, setHint] = useState<CtrlCHint>("none")

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
        key.preventDefault()
        key.stopPropagation()

        const clearTimer = (): void => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current)
                timerRef.current = null
            }
        }

        // (Re)start the rolling window, when it lapses the sequence disarms and the hint clears.
        const arm = (nextHint: CtrlCHint): void => {
            clearTimer()
            setHint(nextHint)
            timerRef.current = setTimeout(() => {
                countRef.current = 0
                timerRef.current = null
                setHint("none")
            }, windowMs)
        }

        const exit = (): void => {
            clearTimer()
            countRef.current = 0
            // Deliberately skip setHint here: the renderer is about to be destroyed.
            onBeforeExit?.()
            renderer.destroy()
        }

        // A press with text present always clears the input and resets the sequence, in both modes.
        if (!isEmpty()) {
            clear()
            clearTimer()
            countRef.current = 0
            setHint("none")
            return
        }

        countRef.current += 1
        const count = countRef.current

        if (isWorking()) {
            if (count === 1) {
                arm("cancel")
                return
            }
            if (count === 2) {
                cancel()
                arm("quit")
                return
            }
            exit()
            return
        }

        if (count === 1) {
            arm("quit")
            return
        }
        exit()
    })

    return hint
}
