// Preserves each agent activity log's scroll position while navigating between agent views.
import { CliRenderEvents, type ScrollBoxRenderable } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import { type RefObject, useLayoutEffect, useRef } from "react"

interface SavedScrollPosition {
    top: number
    atBottom: boolean
}

export function useAgentScrollPosition(
    scrollRef: RefObject<ScrollBoxRenderable | null>,
    agentId: string,
    resetKey: number,
) {
    const renderer = useRenderer()
    const positionsRef = useRef(new Map<string, SavedScrollPosition>())
    const previousResetKeyRef = useRef(resetKey)

    useLayoutEffect(() => {
        if (previousResetKeyRef.current !== resetKey) {
            positionsRef.current.clear()
            previousResetKeyRef.current = resetKey
        }

        const scrollbox = scrollRef.current
        if (scrollbox === null) return

        const restore = (): void => {
            const savedPosition = positionsRef.current.get(agentId)
            if (savedPosition === undefined || savedPosition.atBottom) {
                scrollbox.scrollTo(Math.max(0, scrollbox.scrollHeight - scrollbox.viewport.height))
            } else {
                scrollbox.scrollTo(savedPosition.top)
            }
        }

        const stopWaitingForLayout = (): void => {
            scrollbox.content.off("resize", restore)
        }

        // Apply immediately when the next log has the same dimensions. I
        // f its layout changes, ContentRenderable emits resize after updating the scrollbar metrics,
        // so the second application establishes the correct manual offset.
        scrollbox.content.on("resize", restore)
        renderer.once(CliRenderEvents.FRAME, stopWaitingForLayout)
        restore()

        return () => {
            scrollbox.content.off("resize", restore)
            renderer.off(CliRenderEvents.FRAME, stopWaitingForLayout)
            const maxScrollTop = Math.max(0, scrollbox.scrollHeight - scrollbox.viewport.height)
            positionsRef.current.set(agentId, {
                top: scrollbox.scrollTop,
                atBottom: scrollbox.scrollTop >= maxScrollTop,
            })
        }
    }, [agentId, resetKey, renderer, scrollRef])
}
