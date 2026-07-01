import { type ScrollAcceleration, type ScrollBoxRenderable } from "@opentui/core"
import { MIN_SCROLLBAR_THUMB_CELLS } from "../../lib/constants"

// Tracks sliders whose thumb sizing we have already wrapped, so the re-created ref callback does not stack the override on every render.
const patchedSliders = new WeakSet<object>()

// Fixed-speed scroll acceleration: every wheel tick advances the same number of cells.
export class CustomSpeedScroll implements ScrollAcceleration {
    constructor(private readonly speed: number) {}

    tick(): number {
        return this.speed
    }

    reset(): void {}
}

// The slider exposes thumb sizing only as a private method, so we reach it through a structural type.
interface MinThumbSlider {
    height: number
    getVirtualThumbSize(): number
}

// Enforce a minimum thumb height by wrapping the slider's size calculation.
export function enforceMinimumThumbSize(scrollbox: ScrollBoxRenderable): void {
    const slider = scrollbox.verticalScrollBar.slider as unknown as MinThumbSlider
    if (patchedSliders.has(slider)) return
    patchedSliders.add(slider)

    const minVirtualThumb = MIN_SCROLLBAR_THUMB_CELLS * 2
    const computeThumbSize = slider.getVirtualThumbSize.bind(slider)
    slider.getVirtualThumbSize = () => {
        const virtualTrack = slider.height * 2
        if (virtualTrack <= 0) return computeThumbSize()
        return Math.min(virtualTrack, Math.max(minVirtualThumb, computeThumbSize()))
    }
}
