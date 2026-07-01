import { useEffect, useMemo, useState } from "react"

const PULSE_INTERVAL_MS = 120
// Per-frame brightness weights that ping-pong between the dimmed shade (0) and full brightness (1).
const PULSE_WEIGHTS = [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25]
// Lowest brightness the color dims to, as a fraction of the base color.
const PULSE_MIN_SCALE = 0.4

// Oscillates a hex color between a dimmed shade and full brightness to give a status dot a soft pulse.
// The interval only runs while active, so settled rows keep no background timer and never re-render from here.
export function usePulse(baseColor: string, active: boolean): string {
    const frames = useMemo(() => buildFrames(baseColor), [baseColor])
    const [frame, setFrame] = useState(0)

    useEffect(() => {
        if (!active) {
            setFrame(0)
            return
        }
        const interval = setInterval(() => {
            setFrame((current) => (current + 1) % frames.length)
        }, PULSE_INTERVAL_MS)
        return () => clearInterval(interval)
    }, [active, frames.length])

    return active ? (frames[frame] ?? baseColor) : baseColor
}

function buildFrames(baseColor: string): string[] {
    const rgb = parseHex(baseColor)
    if (rgb === null) return [baseColor]
    return PULSE_WEIGHTS.map((weight) => {
        const scale = PULSE_MIN_SCALE + (1 - PULSE_MIN_SCALE) * weight
        return toHex([rgb[0] * scale, rgb[1] * scale, rgb[2] * scale])
    })
}

function parseHex(hex: string): [number, number, number] | null {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
    if (match === null || match[1] === undefined) return null
    const value = match[1]
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function toHex(channels: [number, number, number]): string {
    return `#${channels.map((channel) => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`
}

function clampChannel(channel: number): number {
    return Math.max(0, Math.min(255, Math.round(channel)))
}
