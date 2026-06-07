import { useEffect, useState } from "react"

const FRAMES = [".  ", ".. ", "..."]
const FRAME_INTERVAL_MS = 300

// Drives the ping-pong dot animation. Returns the current padded frame while active, otherwise an empty string.
// The interval only runs while active, so a connected app keeps no background timer and never re-renders from here.
export function useDotBounce(active: boolean): string {
    const [frame, setFrame] = useState(0)

    useEffect(() => {
        if (!active) {
            setFrame(0)
            return
        }
        const interval = setInterval(() => {
            setFrame((current) => (current + 1) % FRAMES.length)
        }, FRAME_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [active])

    return active ? (FRAMES[frame] ?? "") : ""
}
