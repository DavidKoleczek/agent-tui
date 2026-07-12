// The resume-session picker: browse prior sessions and reopen the chosen one.
import { type BoxRenderable } from "@opentui/core"
import { useBindings, type UseBindingsLayer } from "@opentui/keymap/react"
import { useEffect, useRef, useState } from "react"
import { formatRelativeTime, listSessionFiles, readNonEmptySessions } from "../../../lib/tui"
import type { SessionFile, SessionPreview } from "../../../lib/tui"
import { Colors } from "../../../lib/constants"

export interface SessionPickerProps {
    // Working directory whose `.agents/sessions` is searched for session databases.
    cwd: string
    // Whether the picker currently has keyboard focus. When false its key bindings are inert so another
    // region (e.g. the chat) can own the arrow keys.
    active: boolean
    // Called with the absolute path of the chosen session database.
    onSelect: (sessionPath: string) => void
    // Called when the user dismisses the picker without choosing.
    onCancel: () => void
    // Called when the user presses Up while on the first row, to hand focus back to the surrounding navigation.
    onExitTop?: () => void
    // Maximum characters of the message preview to display. Lower values suit the narrow tower panel.
    maxPreviewChars?: number
    // Number of sessions shown per page. When omitted, the page size fills the available height automatically.
    pageSize?: number
}

// Page size used until the list height has been measured for the first time.
const FALLBACK_PAGE_SIZE = 5
const DEFAULT_MAX_PREVIEW_CHARS = 28

interface SessionRowProps {
    selected: boolean
    relativeTime: string
    preview: string | null
    loading: boolean
    onActivate: () => void
}

function SessionRow({ selected, relativeTime, preview, loading, onActivate }: SessionRowProps) {
    const [hovered, setHovered] = useState(false)
    const highlighted = selected || hovered
    const marker = selected ? ">" : " "
    const body = preview ?? (loading ? "Loading..." : "(no messages)")
    const bodyColor = highlighted ? Colors.onAccentText : preview === null ? Colors.mutedText : undefined
    const timeColor = highlighted ? Colors.onAccentText : Colors.mutedText

    return (
        <box
            backgroundColor={highlighted ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={onActivate}
        >
            <text fg={bodyColor}>{`${marker} ${body}`}</text>
            <text fg={timeColor}>{`  ${relativeTime}`}</text>
        </box>
    )
}

interface PageButtonProps {
    label: string
    onPress: () => void
}

function PageButton({ label, onPress }: PageButtonProps) {
    const [hovered, setHovered] = useState(false)

    return (
        <box
            backgroundColor={hovered ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                // Keep the click from bubbling to the tower's region-focus handler behind the picker.
                event.stopPropagation()
                onPress()
            }}
        >
            <text fg={hovered ? Colors.onAccentText : Colors.mutedText}>{label}</text>
        </box>
    )
}

export function SessionPicker({
    cwd,
    active,
    onSelect,
    onCancel,
    onExitTop,
    maxPreviewChars = DEFAULT_MAX_PREVIEW_CHARS,
    pageSize,
}: SessionPickerProps) {
    // Discovery is cheap (stat only) and stable for the lifetime of the picker, so it runs once.
    const [files] = useState<SessionFile[]>(() => listSessionFiles(cwd))
    const [page, setPage] = useState(0)
    const [selected, setSelected] = useState(0)
    // Non-empty session previews resolved so far, in discovery order.
    // Filled forward on demand as pages are viewed so we never open a database for a page the user has not reached.
    const [resolved, setResolved] = useState<SessionPreview[]>([])
    // Index of the next file to inspect; once it reaches files.length every session has been resolved.
    const [cursor, setCursor] = useState(0)
    // Rows that fit in the measured list height, or null until the first layout pass measures it.
    const [capacity, setCapacity] = useState<number | null>(null)
    const listRef = useRef<BoxRenderable | null>(null)

    // Re-measure how many rows fit whenever the list box resizes.
    // Guarded so it only updates state on a real change,
    // which prevents a setState -> layout -> onSizeChange feedback loop.
    const measure = () => {
        const node = listRef.current
        if (!node) return
        const next = Math.max(1, Math.floor(node.height / 2))
        setCapacity((prev) => (prev === next ? prev : next))
    }

    // Explicit prop wins; otherwise fill the measured height; otherwise the fallback until the first measurement lands.
    const effectivePageSize = pageSize ?? capacity ?? FALLBACK_PAGE_SIZE

    const pageStart = page * effectivePageSize
    const exhausted = cursor >= files.length
    const pageRows = resolved.slice(pageStart, pageStart + effectivePageSize)
    // A page is ready once we have enough resolved rows to fill it, or there are no more files to read.
    const pageReady = resolved.length >= pageStart + effectivePageSize || exhausted
    const canGoNext = resolved.length > pageStart + effectivePageSize || !exhausted

    // Fill the resolved list forward just enough to show the current page.
    // Settles after one read: the fill stops only when the page is satisfied or the files are exhausted, so re-running is a no-op.
    useEffect(() => {
        if (pageReady) return
        let cancelled = false
        const needed = pageStart + effectivePageSize - resolved.length
        void readNonEmptySessions(files, cursor, needed, maxPreviewChars).then((result) => {
            if (cancelled) return
            setResolved((prev) => [...prev, ...result.rows])
            setCursor(result.nextIndex)
        })
        return () => {
            cancelled = true
        }
    }, [pageReady, pageStart, effectivePageSize, resolved.length, cursor, files, maxPreviewChars])

    // Reset the selection to the top whenever the page changes, or when a resize changes how many rows fit.
    useEffect(() => {
        setSelected(0)
    }, [page, effectivePageSize])

    // If the user paged past the end while more files were still being inspected,
    // snap back to the last page that actually has rows once discovery is exhausted.
    useEffect(() => {
        if (!exhausted) return
        const lastPage = Math.max(0, Math.ceil(resolved.length / effectivePageSize) - 1)
        setPage((value) => Math.min(value, lastPage))
    }, [exhausted, resolved.length, effectivePageSize])

    // Refs hold the latest values the key handlers need, so the bindings layer can be registered once per active state.
    const navRef = useRef({ pageRows, canGoNext, selected })
    navRef.current = { pageRows, canGoNext, selected }
    const handlersRef = useRef({ onSelect, onCancel, onExitTop })
    handlersRef.current = { onSelect, onCancel, onExitTop }

    useBindings(
        (): UseBindingsLayer =>
            active
                ? {
                      bindings: [
                          {
                              key: "up",
                              cmd() {
                                  // At the first row, Up hands focus back to the surrounding navigation (the tab/menu).
                                  if (navRef.current.selected === 0) {
                                      handlersRef.current.onExitTop?.()
                                      return
                                  }
                                  setSelected((value) => Math.max(0, value - 1))
                              },
                          },
                          {
                              key: "down",
                              cmd() {
                                  const max = navRef.current.pageRows.length - 1
                                  setSelected((value) => Math.max(0, Math.min(max, value + 1)))
                              },
                          },
                          {
                              key: "left",
                              cmd() {
                                  setPage((value) => Math.max(0, value - 1))
                              },
                          },
                          {
                              key: "right",
                              cmd() {
                                  if (navRef.current.canGoNext) setPage((value) => value + 1)
                              },
                          },
                          {
                              key: "return",
                              cmd() {
                                  const row = navRef.current.pageRows[navRef.current.selected]
                                  if (row !== undefined) handlersRef.current.onSelect(row.path)
                              },
                          },
                          {
                              key: "escape",
                              cmd() {
                                  handlersRef.current.onCancel()
                              },
                          },
                      ],
                  }
                : { bindings: [] },
        [active],
    )

    return (
        <box flexDirection="column" flexGrow={1}>
            <box
                ref={(node: BoxRenderable | null) => {
                    listRef.current = node
                    if (node) measure()
                }}
                onSizeChange={measure}
                flexDirection="column"
                flexGrow={1}
                overflow="hidden"
            >
                {exhausted && resolved.length === 0 ? (
                    <text fg={Colors.mutedText}>No sessions found</text>
                ) : !pageReady ? (
                    <text fg={Colors.mutedText}>Loading...</text>
                ) : (
                    pageRows.map((row, index) => (
                        <SessionRow
                            key={row.path}
                            selected={active && index === selected}
                            relativeTime={formatRelativeTime(row.modifiedMs)}
                            preview={row.lastUserMessage}
                            loading={false}
                            onActivate={() => onSelect(row.path)}
                        />
                    ))
                )}
            </box>
            <box height={1} flexShrink={0} />
            <box flexDirection="row" alignItems="center" justifyContent="flex-end" flexShrink={0}>
                {page > 0 ? (
                    <PageButton label="< Prev" onPress={() => setPage((value) => Math.max(0, value - 1))} />
                ) : null}
                <text fg={Colors.mutedText}>{` Page ${page + 1} `}</text>
                {canGoNext ? <PageButton label="Next >" onPress={() => setPage((value) => value + 1)} /> : null}
            </box>
        </box>
    )
}
