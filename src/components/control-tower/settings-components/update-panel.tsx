// The updater panel: check for and install a new version of the app.
import { useBindings, type UseBindingsLayer } from "@opentui/keymap/react"
import { useEffect, useRef, useState } from "react"
import { applyUpdate, checkForUpdate, isDevBuild, type UpdateCheck } from "../../../lib/tui"
import { appVersion, Colors } from "../../../lib/constants"

export interface UpdatePanelProps {
    // Whether the tower (and thus this panel) currently holds keyboard focus.
    active: boolean
    // Dismisses the panel back to the settings menu.
    onCancel: () => void
    // Invoked when the user navigates up past the top, to hand focus back to the menu.
    onExitTop: () => void
}

type Phase =
    | { kind: "checking" }
    | { kind: "result"; check: UpdateCheck }
    | { kind: "downloading"; check: UpdateCheck }
    | { kind: "installed"; version: string }
    | { kind: "error"; message: string }

interface UpdateButtonProps {
    focused: boolean
    onPress: () => void
}

function UpdateButton({ focused, onPress }: UpdateButtonProps) {
    const [hovered, setHovered] = useState(false)
    const highlighted = focused || hovered
    const onPressRef = useRef(onPress)
    onPressRef.current = onPress

    useBindings(
        (): UseBindingsLayer =>
            focused
                ? {
                      bindings: [{ key: "return", cmd: () => onPressRef.current() }],
                  }
                : { bindings: [] },
        [focused],
    )

    return (
        <box
            backgroundColor={highlighted ? Colors.accent : undefined}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            onMouseOver={() => setHovered(true)}
            onMouseOut={() => setHovered(false)}
            onMouseDown={(event) => {
                event.stopPropagation()
                onPress()
            }}
        >
            <text fg={highlighted ? Colors.onAccentText : Colors.mutedText}>Update</text>
        </box>
    )
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
}

export function UpdatePanel({ active, onCancel, onExitTop }: UpdatePanelProps) {
    // In a dev build process.execPath is the bun runtime, so the apply path is disabled and no network check runs.
    const dev = isDevBuild()
    const [phase, setPhase] = useState<Phase>({ kind: "checking" })

    // Tracks the in-flight request so a new action or unmount can cancel it.
    const abortRef = useRef<AbortController | null>(null)

    const runRequest = (run: (signal: AbortSignal) => Promise<void>): void => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        run(controller.signal).catch((err) => {
            if (controller.signal.aborted) return
            setPhase({ kind: "error", message: errorMessage(err) })
        })
    }

    const runCheck = (): void => {
        setPhase({ kind: "checking" })
        runRequest(async (signal) => {
            const check = await checkForUpdate(signal)
            if (signal.aborted) return
            setPhase({ kind: "result", check })
        })
    }

    const runApply = (check: UpdateCheck): void => {
        setPhase({ kind: "downloading", check })
        runRequest(async (signal) => {
            await applyUpdate(check, signal)
            if (signal.aborted) return
            setPhase({ kind: "installed", version: check.remote ?? "" })
        })
    }

    // Selecting the menu item is the manual trigger, so check once on open.
    // Aborts on unmount so a navigated-away request never lands on an unmounted component.
    // Runs once on mount; runCheck only touches refs and stable setters, so it needs no dependencies.
    useEffect(() => {
        if (!dev) runCheck()
        return () => {
            abortRef.current?.abort()
        }
    }, [])

    // Latest handlers for the bindings layer, so it registers once per active state.
    const actionsRef = useRef({ onCancel, onExitTop })
    actionsRef.current = { onCancel, onExitTop }

    useBindings(
        (): UseBindingsLayer =>
            active
                ? {
                      bindings: [
                          { key: "up", cmd: () => actionsRef.current.onExitTop() },
                          { key: "escape", cmd: () => actionsRef.current.onCancel() },
                      ],
                  }
                : { bindings: [] },
        [active],
    )

    return (
        <box flexDirection="column" flexGrow={1}>
            <text fg={Colors.mutedText}>{`Current version  ${appVersion}`}</text>
            <box height={1} flexShrink={0} />
            {renderBody(dev, phase)}
            {!dev && phase.kind === "result" && phase.check.status === "available" ? (
                <box flexDirection="row" flexShrink={0} marginTop={1}>
                    <UpdateButton focused={active} onPress={() => runApply(phase.check)} />
                </box>
            ) : null}
        </box>
    )
}

function renderBody(dev: boolean, phase: Phase) {
    if (dev) {
        return <text fg={Colors.mutedText}>Updates unavailable in dev builds.</text>
    }
    switch (phase.kind) {
        case "checking":
            return <text fg={Colors.mutedText}>Checking for updates...</text>
        case "downloading":
            return <text fg={Colors.mutedText}>{`Downloading and installing ${phase.check.remote ?? ""}...`}</text>
        case "installed":
            return (
                <box flexDirection="column" flexShrink={0}>
                    <text fg={Colors.accent}>{`Update installed: ${phase.version}`}</text>
                    <text fg={Colors.mutedText}>Restart to use the new version.</text>
                </box>
            )
        case "error":
            return <text fg={Colors.errorBackground}>{`Update failed: ${phase.message}`}</text>
        case "result":
            return renderResult(phase.check)
    }
}

function renderResult(check: UpdateCheck) {
    if (check.status === "available") {
        return <text fg={Colors.accent}>{`Update available  ${check.remote}`}</text>
    }
    if (check.status === "unsupported") {
        return <text fg={Colors.mutedText}>No build is available for your platform.</text>
    }
    return <text fg={Colors.mutedText}>You are on the latest version.</text>
}
