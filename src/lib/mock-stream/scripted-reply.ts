import { type ActivityStore } from "../activity-store"
import { type ActivityStreamEvent } from "../../schemas/activities"

export interface ScriptedReply {
    dispose: () => void
}

const CHUNK_DELAY_MS = 60
const CHUNK_SIZE = 8

const ASSISTANT_REPLY = `## Streaming demo

The text you see here is being **streamed** in small chunks. Each chunk lands every ${CHUNK_DELAY_MS} ms and is appended to a single \`MarkdownRenderable\` whose \`streaming\` flag is true until the final \`complete\` event.

### What this exercises

- The trailing parse horizon stays unstable while new chunks arrive.
- Already-settled blocks above keep their renderable identity, so they do not relayout.
- Setting \`streaming = false\` on completion finalizes the trailing block and refreshes the table.

### Tiny code sample

\`\`\`ts
const greet = (name: string) => \`hello, \${name}\`
greet("world")
\`\`\`

### A small table

| Stage      | Result |
| ---------- | ------ |
| parse      | reuse  |
| layout     | reuse  |
| trailing 2 | reflow |
`

function buildReasoning(prompt: string): string {
    const trimmed = prompt.trim()
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed
    return `Considering: "${preview}"\n\nI will respond with a short markdown document that covers a heading, a list, a fenced code block, and a small table so the streaming behaviour is visible across all of them.`
}

function chunkString(value: string, size: number): string[] {
    const chunks: string[] = []
    for (let i = 0; i < value.length; i += size) {
        chunks.push(value.slice(i, i + size))
    }
    return chunks
}

function buildScript(
    store: ActivityStore,
    prompt: string,
): { events: ActivityStreamEvent[]; reasoningId: string; assistantId: string } {
    const reasoningId = store.nextId("reasoning")
    const assistantId = store.nextId("assistant")

    const events: ActivityStreamEvent[] = []
    events.push({ type: "reasoning.start", id: reasoningId })
    for (const text of chunkString(buildReasoning(prompt), CHUNK_SIZE)) {
        events.push({ type: "delta", id: reasoningId, text })
    }
    events.push({ type: "complete", id: reasoningId })

    events.push({ type: "assistant.start", id: assistantId })
    for (const text of chunkString(ASSISTANT_REPLY, CHUNK_SIZE)) {
        events.push({ type: "delta", id: assistantId, text })
    }
    events.push({ type: "complete", id: assistantId })

    return { events, reasoningId, assistantId }
}

// Side-effect-owning producer. Every callback consults `disposed` before touching the store
// or scheduling more work, so cancellation is race-free. On natural completion the producer
// sets `disposed = true` itself, so a later `dispose()` call from `App` cleanup is a true
// no-op. `dispose()` is idempotent.
export function startScriptedReply(store: ActivityStore, prompt: string, onComplete?: () => void): ScriptedReply {
    const { events } = buildScript(store, prompt)

    let disposed = false
    let pending: ReturnType<typeof setTimeout> | null = null
    let cursor = 0

    const tick = (): void => {
        pending = null
        if (disposed) return
        if (cursor >= events.length) {
            disposed = true
            onComplete?.()
            return
        }
        const event = events[cursor]!
        cursor += 1
        store.applyEvent(event)
        if (disposed) return
        pending = setTimeout(tick, CHUNK_DELAY_MS)
    }

    pending = setTimeout(tick, CHUNK_DELAY_MS)

    return {
        dispose() {
            if (disposed) return
            disposed = true
            if (pending !== null) {
                clearTimeout(pending)
                pending = null
            }
        },
    }
}
