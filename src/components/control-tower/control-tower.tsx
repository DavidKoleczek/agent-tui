import { useBindings, type UseBindingsLayer } from "@opentui/keymap/react"
import { useEffect, useRef, useState } from "react"
import { TowerTabs, type TowerTab } from "./tower-tabs"
import { ControlPanel } from "./control-panel"
import { SettingsPanel, type SettingsMenuItem } from "./settings-panel"
import { enterControl, moveControlRow, moveControlValue } from "./control-components"
import { Colors } from "../../lib/constants"
import { type ControlConfigState } from "../../hooks"
import { type TaskActivity, type TaskPermission } from "../../schemas/activities"

export interface ControlTowerProps {
    // Whether the tower currently holds keyboard focus. Drives navigation gating and highlight state.
    region: "chat" | "tower"
    // Working directory used by the embedded session picker.
    cwd: string
    // Current session config view-model shown in the Control tab.
    config: ControlConfigState
    // Applies a config change: optimistic locally and sent to the server.
    onChangeConfig: (key: string, value: string) => void
    // Tool calls awaiting the user's approval, shown in the Control tab.
    pendingApprovals: readonly TaskActivity[]
    // Sends the user's accept/deny decision for a pending tool to the server.
    onPermissionChange: (id: string, permission: TaskPermission) => void
    // Opens the owning agent view for a task selected from the Control tab.
    onOpenTask: (id: string) => void
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

const CONTROL_INDEX = 0
const SETTINGS_INDEX = 1
const SETTINGS_ITEMS: readonly SettingsMenuItem[] = [
    { id: "resume", label: "Resume" },
    { id: "update", label: "Check for updates" },
]

type Focus =
    | { area: "tabs"; tabIndex: number }
    | { area: "menu"; itemIndex: number }
    | { area: "control"; rowIndex: number; valueIndex: number }

function itemsForTab(tabIndex: number): readonly SettingsMenuItem[] {
    return tabIndex === SETTINGS_INDEX ? SETTINGS_ITEMS : []
}

export function ControlTower({
    region,
    cwd,
    config,
    onChangeConfig,
    pendingApprovals,
    onPermissionChange,
    onOpenTask,
    onEnterTower,
    onExitToChat,
    onResume,
}: ControlTowerProps) {
    const [activeTab, setActiveTab] = useState(0)
    const [mode, setMode] = useState<"browse" | "resume" | "update">("browse")
    const [focus, setFocus] = useState<Focus>({ area: "tabs", tabIndex: 0 })

    // Latest values for the key handlers, so the navigation layer registers once per (region, mode) rather than per keypress.
    const stateRef = useRef({ activeTab, focus, config, onChangeConfig })
    stateRef.current = { activeTab, focus, config, onChangeConfig }

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
                                  const { focus: current, config: currentConfig } = stateRef.current
                                  if (current.area === "control") {
                                      setFocus({
                                          area: "control",
                                          ...moveControlValue(current, -1, currentConfig.options),
                                      })
                                  } else if (current.area === "tabs") {
                                      setFocus({ area: "tabs", tabIndex: Math.max(0, current.tabIndex - 1) })
                                  }
                              },
                          },
                          {
                              key: "right",
                              cmd() {
                                  const { focus: current, config: currentConfig } = stateRef.current
                                  if (current.area === "control") {
                                      setFocus({
                                          area: "control",
                                          ...moveControlValue(current, 1, currentConfig.options),
                                      })
                                  } else if (current.area === "tabs") {
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
                                  const { activeTab: tab, focus: current, config: currentConfig } = stateRef.current
                                  if (current.area === "control") {
                                      const next = moveControlRow(
                                          current,
                                          -1,
                                          currentConfig.options,
                                          currentConfig.current,
                                      )
                                      if (next === "exit-top") {
                                          setFocus({ area: "tabs", tabIndex: tab })
                                      } else {
                                          setFocus({ area: "control", ...next })
                                      }
                                      return
                                  }
                                  if (current.area !== "menu") return
                                  if (current.itemIndex === 0) {
                                      setFocus({ area: "tabs", tabIndex: tab })
                                  } else {
                                      setFocus({ area: "menu", itemIndex: current.itemIndex - 1 })
                                  }
                              },
                          },
                          {
                              key: "down",
                              cmd() {
                                  const { activeTab: tab, focus: current, config: currentConfig } = stateRef.current
                                  if (current.area === "control") {
                                      const next = moveControlRow(
                                          current,
                                          1,
                                          currentConfig.options,
                                          currentConfig.current,
                                      )
                                      if (next !== "exit-top") setFocus({ area: "control", ...next })
                                      return
                                  }
                                  const items = itemsForTab(tab)
                                  if (current.area === "tabs") {
                                      if (tab === CONTROL_INDEX) {
                                          if (!currentConfig.loaded) return
                                          const entered = enterControl(currentConfig.options, currentConfig.current)
                                          if (entered !== null) setFocus({ area: "control", ...entered })
                                      } else if (items.length > 0) {
                                          setFocus({ area: "menu", itemIndex: 0 })
                                      }
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
                                  const { activeTab: tab, focus: current, config: currentConfig } = stateRef.current
                                  if (current.area === "control") {
                                      const option = currentConfig.options[current.rowIndex]
                                      const value = option?.values[current.valueIndex]
                                      if (option !== undefined && value !== undefined) {
                                          stateRef.current.onChangeConfig(option.key, value)
                                      }
                                  } else if (current.area === "tabs") {
                                      activateTab(current.tabIndex)
                                  } else {
                                      activateMenuItem(tab, current.itemIndex)
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
    const focusedControl =
        region === "tower" && focus.area === "control"
            ? { rowIndex: focus.rowIndex, valueIndex: focus.valueIndex }
            : null

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
                <ControlPanel
                    config={config}
                    focus={focusedControl}
                    onActivateValue={(rowIndex, valueIndex) => {
                        onEnterTower()
                        setFocus({ area: "control", rowIndex, valueIndex })
                        const option = config.options[rowIndex]
                        const value = option?.values[valueIndex]
                        if (option !== undefined && value !== undefined) onChangeConfig(option.key, value)
                    }}
                    pendingApprovals={pendingApprovals}
                    onPermissionChange={onPermissionChange}
                    onOpenTask={onOpenTask}
                />
            )}
        </box>
    )
}
