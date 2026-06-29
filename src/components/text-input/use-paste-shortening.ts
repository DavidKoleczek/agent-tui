import { decodePasteBytes, type PasteEvent, type TextareaRenderable } from "@opentui/core"
import { type RefObject, useCallback, useRef } from "react"

export interface PasteShorteningHandle {
    onPaste: (event: PasteEvent) => void
    expand: () => string
    reset: () => void
}

const PASTE_LINE_THRESHOLD = 5
const PASTE_EXTMARK_TYPE = "paste-shortened"

interface PasteExtmarkData {
    content: string
}

// Substitutes any of our paste extmarks back to their original content.
// Walks marks in descending start order so each splice does not shift the offsets of marks we have not visited yet.
function expandPlaceholders(textarea: TextareaRenderable, typeId: number): string {
    const text = textarea.plainText
    const marks = textarea.extmarks.getAllForTypeId(typeId)
    if (marks.length === 0) return text

    const sorted = [...marks].sort((a, b) => b.start - a.start)
    let result = text
    for (const mark of sorted) {
        const data = mark.data as PasteExtmarkData | undefined
        if (!data || typeof data.content !== "string") continue
        result = result.slice(0, mark.start) + data.content + result.slice(mark.end)
    }
    return result
}

// Shortens long pastes to a compact placeholder marked by a virtual extmark (https://github.com/anomalyco/opentui/blob/main/packages/core/src/lib/extmarks.ts),
// and substitutes the original content back at submit time.
//
// OpenTUI's virtual extmarks already give us atomic editing for free:
// the cursor snaps around them, backspace at the right edge or Delete at the left edge removes the whole span,
// and `setText("")` clears them on submit/clear.
// The hook only owns the per-input counter and the registered extmark type id.
export function usePasteShortening(
    textareaRef: RefObject<TextareaRenderable | null>,
    threshold: number = PASTE_LINE_THRESHOLD,
): PasteShorteningHandle {
    const counterRef = useRef(0)
    const typeIdRef = useRef<number | null>(null)

    const ensureTypeId = (textarea: TextareaRenderable): number => {
        if (typeIdRef.current === null) {
            typeIdRef.current = textarea.extmarks.registerType(PASTE_EXTMARK_TYPE)
        }
        return typeIdRef.current
    }

    const onPaste = useCallback(
        (event: PasteEvent) => {
            const textarea = textareaRef.current
            if (!textarea) return

            const normalized = decodePasteBytes(event.bytes).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
            if (normalized.length === 0) return

            const lineCount = (normalized.match(/\n/g)?.length ?? 0) + 1
            if (lineCount < threshold) return

            event.preventDefault()

            counterRef.current += 1
            const placeholder = `[Paste #${counterRef.current} - ${lineCount} lines]`

            // Capture the offset after insertion so a paste-over-selection still anchors
            // the extmark to the actual placeholder span (the selection is deleted as part of insertText).
            // Placeholder is pure ASCII, so JS length matches the display-width offset used by extmarks.
            textarea.insertText(placeholder)
            const endOffset = textarea.cursorOffset
            const startOffset = endOffset - placeholder.length

            textarea.extmarks.create({
                start: startOffset,
                end: endOffset,
                virtual: true,
                typeId: ensureTypeId(textarea),
                data: { content: normalized } satisfies PasteExtmarkData,
            })
        },
        [textareaRef, threshold],
    )

    const expand = useCallback((): string => {
        const textarea = textareaRef.current
        if (!textarea) return ""
        if (typeIdRef.current === null) return textarea.plainText
        return expandPlaceholders(textarea, typeIdRef.current)
    }, [textareaRef])

    const reset = useCallback(() => {
        counterRef.current = 0
    }, [])

    return { onPaste, expand, reset }
}
