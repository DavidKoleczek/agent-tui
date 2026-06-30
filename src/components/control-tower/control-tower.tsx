import { useBindings, type UseBindingsLayer } from "@opentui/keymap/react"
import { useEffect, useRef, useState } from "react"
import { TowerTabs, type TowerTab } from "./tower-tabs"
import { ControlPanel } from "./control-panel"
import { SettingsPanel, type SettingsMenuItem } from "./settings-panel"
import { Colors } from "../../lib/constants"

export interface ControlTowerProps {
    // Whether the tower currently holds keyboard focus. Drives navigation gating and highlight state.
    region: "chat" | "tower"
    // Working directory used by the embedded session picker.
    cwd: string
    // Asks the app to move keyboard focus into the tower (used by mouse interactions).
    onEnterTower: () => void
    // Asks the app to move keyboard focus back to the chat.
    onExitToChat: () => void
    // Loads the chosen session and reconnects the agent.
    onResume: (sessionPath: string) => void
}

const TABS: readonly TowerTab[] = [
    { id: "control", label: "Control" },
    { id: "settings", label: "Settings" },
]

const SETTINGS_INDEX = 1
const SETTINGS_ITEMS: readonly SettingsMenuItem[] = [
    { id: "resume", label: "Resume" },
    { id: "update", label: "Check for updates" },
]

type Focus = { area: "tabs"; tabIndex: number } | { area: "menu"; itemIndex: number }

function itemsForTab(tabIndex: number): readonly SettingsMenuItem[] {
    return tabIndex === SETTINGS_INDEX ? SETTINGS_ITEMS : []
}

export function ControlTower({ region, cwd, onEnterTower, onExitToChat, onResume }: ControlTowerProps) {
    const [activeTab, setActiveTab] = useState(0)
    const [mode, setMode] = useState<"browse" | "resume" | "update">("browse")
    const [focus, setFocus] = useState<Focus>({ area: "tabs", tabIndex: 0 })

    // Latest values for the key handlers, so the navigation layer registers once per (region, mode) rather than per keypress.
    const stateRef = useRef({ activeTab, focus })
    stateRef.current = { activeTab, focus }

    // When focus first enters the tower (chat -> tower) in browse mode, land on the active tab. Tracking the previous
    // region avoids fighting focus changes that happen while already inside the tower (e.g. backing out of the picker).
    const prevRegionRef = useRef(region)
    useEffect(() => {
        const entered = prevRegionRef.current !== "tower" && region === "tower"
        prevRegionRef.current = region
        if (entered && mode === "browse") {
            setFocus({ area: "tabs", tabIndex: stateRef.current.activeTab })
        }
    }, [region, mode])

    const activateTab = (index: number): void => {
        setActiveTab(index)
        setMode("browse")
        setFocus({ area: "tabs", tabIndex: index })
    }

    const activateMenuItem = (tabIndex: number, itemIndex: number): void => {
        const item = itemsForTab(tabIndex)[itemIndex]
        if (item?.id === "resume") setMode("resume")
        if (item?.id === "update") setMode("update")
    }

    const handleResume = (sessionPath: string): void => {
        onResume(sessionPath)
        setMode("browse")
    }

    const cancelResume = (): void => {
        setMode("browse")
        setFocus({ area: "menu", itemIndex: 0 })
    }

    const cancelUpdate = (): void => {
        setMode("browse")
        setFocus({ area: "menu", itemIndex: SETTINGS_ITEMS.findIndex((item) => item.id === "update") })
    }

    const browseActive = region === "tower" && mode === "browse"

    useBindings(
        (): UseBindingsLayer =>
            browseActive
                ? {
                      bindings: [
                          {
                              key: "left",
                              cmd() {
                                  const current = stateRef.current.focus
                                  if (current.area === "tabs") {
                                      setFocus({ area: "tabs", tabIndex: Math.max(0, current.tabIndex - 1) })
                                  }
                              },
                          },
                          {
                              key: "right",
                              cmd() {
                                  const current = stateRef.current.focus
                                  if (current.area === "tabs") {
                                      setFocus({
                                          area: "tabs",
                                          tabIndex: Math.min(TABS.length - 1, current.tabIndex + 1),
                                      })
                                  }
                              },
                          },
                          {
                              key: "up",
                              cmd() {
                                  const current = stateRef.current.focus
                                  if (current.area !== "menu") return
                                  if (current.itemIndex === 0) {
                                      setFocus({ area: "tabs", tabIndex: stateRef.current.activeTab })
                                  } else {
                                      setFocus({ area: "menu", itemIndex: current.itemIndex - 1 })
                                  }
                              },
                          },
                          {
                              key: "down",
                              cmd() {
                                  const current = stateRef.current.focus
                                  const items = itemsForTab(stateRef.current.activeTab)
                                  if (current.area === "tabs") {
                                      if (items.length > 0) setFocus({ area: "menu", itemIndex: 0 })
                                  } else {
                                      setFocus({
                                          area: "menu",
                                          itemIndex: Math.min(items.length - 1, current.itemIndex + 1),
                                      })
                                  }
                              },
                          },
                          {
                              key: "return",
                              cmd() {
                                  const current = stateRef.current.focus
                                  if (current.area === "tabs") {
                                      activateTab(current.tabIndex)
                                  } else {
                                      activateMenuItem(stateRef.current.activeTab, current.itemIndex)
                                  }
                              },
                          },
                          {
                              key: "escape",
                              cmd() {
                                  onExitToChat()
                              },
                          },
                      ],
                  }
                : { bindings: [] },
        [browseActive],
    )

    const focusedTabIndex = region === "tower" && focus.area === "tabs" ? focus.tabIndex : null
    const focusedMenuIndex = region === "tower" && focus.area === "menu" ? focus.itemIndex : null

    return (
        <box
            width="25%"
            flexDirection="column"
            flexShrink={0}
            border={["left"]}
            borderColor={Colors.border}
            paddingLeft={1}
            paddingRight={1}
        >
            <TowerTabs
                tabs={TABS}
                activeIndex={activeTab}
                focusedIndex={focusedTabIndex}
                onActivate={(index) => {
                    onEnterTower()
                    activateTab(index)
                }}
            />
            {activeTab === SETTINGS_INDEX ? (
                <SettingsPanel
                    mode={mode}
                    items={SETTINGS_ITEMS}
                    focusedIndex={focusedMenuIndex}
                    onActivateItem={(index) => {
                        onEnterTower()
                        setFocus({ area: "menu", itemIndex: index })
                        activateMenuItem(SETTINGS_INDEX, index)
                    }}
                    cwd={cwd}
                    resumeActive={region === "tower" && mode === "resume"}
                    onResume={handleResume}
                    onCancelResume={cancelResume}
                    onExitResumeTop={cancelResume}
                    updateActive={region === "tower" && mode === "update"}
                    onCancelUpdate={cancelUpdate}
                    onExitUpdateTop={cancelUpdate}
                />
            ) : (
                <ControlPanel />
            )}
        </box>
    )
}
