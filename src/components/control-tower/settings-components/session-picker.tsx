import { useBindings, type UseBindingsLayer } from "@opentui/keymap/react"
import { useEffect, useRef, useState } from "react"
import { formatRelativeTime, listSessionFiles, readSessionPreviews } from "../../../lib/tui"
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
    // Number of sessions shown per page.
    pageSize?: number
}

const DEFAULT_PAGE_SIZE = 5
const DEFAULT_MAX_PREVIEW_CHARS = 28

interface SessionRowProps {
    selected: boolean
    relativeTime: string
    // The session's last user message, or null when it has none or could not be read.
    preview: string | null
    // True while the preview for this page is still being read from disk.
    loading: boolean
    onActivate: () => void
}

function SessionRow({ selected, relativeTime, preview, loading, onActivate }: SessionRowProps) {
    const marker = selected ? ">" : " "
    const body = preview ?? (loading ? "Loading..." : "(no messages)")
    const bodyColor = selected ? Colors.onAccentText : preview === null ? Colors.mutedText : undefined
    const timeColor = selected ? Colors.onAccentText : Colors.mutedText

    return (
        <box
            backgroundColor={selected ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseDown={onActivate}
        >
            <text fg={bodyColor}>{`${marker} ${body}`}</text>
            <text fg={timeColor}>{`  ${relativeTime}`}</text>
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
    pageSize = DEFAULT_PAGE_SIZE,
}: SessionPickerProps) {
    // Discovery is cheap (stat only) and stable for the lifetime of the picker, so it runs once.
    const [files] = useState<SessionFile[]>(() => listSessionFiles(cwd))
    const [page, setPage] = useState(0)
    const [selected, setSelected] = useState(0)
    // Null while the current page's previews are loading.
    const [previews, setPreviews] = useState<SessionPreview[] | null>(null)

    const pageCount = Math.max(1, Math.ceil(files.length / pageSize))
    const pageFiles = files.slice(page * pageSize, page * pageSize + pageSize)

    useEffect(() => {
        let cancelled = false
        const slice = files.slice(page * pageSize, page * pageSize + pageSize)
        setPreviews(null)
        setSelected(0)
        void readSessionPreviews(slice, maxPreviewChars).then((loaded) => {
            if (!cancelled) setPreviews(loaded)
        })
        return () => {
            cancelled = true
        }
    }, [page, files, pageSize, maxPreviewChars])

    // Refs hold the latest values the key handlers need, so the bindings layer can be registered once per active state.
    const navRef = useRef({ pageFiles, pageCount, selected })
    navRef.current = { pageFiles, pageCount, selected }
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
                                  const max = navRef.current.pageFiles.length - 1
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
                                  const max = navRef.current.pageCount - 1
                                  setPage((value) => Math.min(max, value + 1))
                              },
                          },
                          {
                              key: "return",
                              cmd() {
                                  const file = navRef.current.pageFiles[navRef.current.selected]
                                  if (file !== undefined) handlersRef.current.onSelect(file.path)
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
            {files.length === 0 ? (
                <text fg={Colors.mutedText}>No sessions found</text>
            ) : (
                <box flexDirection="column" flexGrow={1}>
                    {pageFiles.map((file, index) => (
                        <SessionRow
                            key={file.path}
                            selected={index === selected}
                            relativeTime={formatRelativeTime(file.modifiedMs)}
                            preview={previews === null ? null : (previews[index]?.lastUserMessage ?? null)}
                            loading={previews === null}
                            onActivate={() => onSelect(file.path)}
                        />
                    ))}
                </box>
            )}
            <box height={1} flexShrink={0} />
            <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
                <text fg={Colors.mutedText}>{`Page ${page + 1}/${pageCount}`}</text>
            </box>
        </box>
    )
}
