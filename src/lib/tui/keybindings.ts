import { type UseBindingsLayer } from "@opentui/keymap/react"

export interface ActivityLogBindingDeps {
    scrollByViewport: (direction: -1 | 1) => void
}

export function activityLogBindings(deps: ActivityLogBindingDeps): UseBindingsLayer {
    return {
        bindings: [
            {
                key: "pageup",
                cmd() {
                    deps.scrollByViewport(-1)
                },
            },
            {
                key: "pagedown",
                cmd() {
                    deps.scrollByViewport(1)
                },
            },
        ],
    }
}
