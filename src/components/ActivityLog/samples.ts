import { fraction, nowIso } from "../../lib/branded-types"
import { type Activity } from "../../schemas/activities"

export const sampleActivities: readonly Activity[] = [
    {
        id: "u-1",
        type: "user",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: "How does the activity log component work right now?",
    },
    {
        id: "r-1",
        type: "reasoning",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: "Read the ActivityLog source and the schema it consumes before answering.",
    },
    {
        id: "t-1",
        type: "tool",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        toolName: "read",
        toolArguments: { path: "src/components/ActivityLog/index.tsx" },
        toolOutput: "export function ActivityLog({ activities }: ActivityLogProps) { ... }",
    },
    {
        id: "a-1",
        type: "assistant",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: `## How \`ActivityLog\` works

\`ActivityLog\` takes a \`readonly Activity[]\` and renders one row per item. Each row is chosen by switching on \`activity.type\`, so each variant gets its own component:

- \`user\` -> \`UserActivity\`
- \`reasoning\` -> \`ReasoningActivity\`
- \`tool\` -> \`ToolActivity\`
- \`assistant\` -> \`AssistantActivity\`

It is **intentionally stateless**. Scroll, focus, and selection all live above it, which keeps the schema decoupled from view concerns.`,
    },
    {
        id: "u-2",
        type: "user",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: "Where are the activity types defined and how is progress modeled?",
    },
    {
        id: "r-2",
        type: "reasoning",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content:
            "The schema sits under src/schemas/activities. Progress lives on ActivityBase as a Fraction in [0, 1].\n\nFraction is a branded number constructed via fraction(value), so consumers cannot accidentally pass a raw number. 0 means not started or in flight, 1 means complete. Lifecycle is now tracked separately on ActivityBase.state, which is the primary signal; progress is a finer-grained complement.",
    },
    {
        id: "t-2",
        type: "tool",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        toolName: "grep",
        toolArguments: { pattern: "Fraction", path: "src" },
        toolOutput:
            "src/lib/branded-types.ts: export type Fraction = number & { readonly __brand: 'Fraction' }\nsrc/schemas/activities/types.ts: progress: Fraction",
    },
    {
        id: "t-3",
        type: "tool",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        toolName: "read",
        toolArguments: { path: "src/lib/branded-types.ts" },
        toolOutput:
            "export type IsoTimestamp = string & { readonly __brand: 'IsoTimestamp' }\nexport function nowIso(): IsoTimestamp { ... }\nexport type Fraction = number & { readonly __brand: 'Fraction' }\nexport function fraction(value: number): Fraction { ... }",
    },
    {
        id: "a-2",
        type: "assistant",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: `## Activity schema

The schema lives in \`src/schemas/activities/types.ts\`. \`ActivityBase\` carries \`id\`, \`createdAt\` (\`IsoTimestamp\`), and \`progress\` (\`Fraction\` in \`[0, 1]\`). Each variant extends the base:

\`\`\`ts
interface ToolActivity extends ActivityBase {
    type: "tool"
    toolName: string
    toolArguments: Record<string, unknown>
    toolOutput: string
}
\`\`\`

\`IsoTimestamp\` and \`Fraction\` are *branded types* from \`src/lib/branded-types.ts\`. The brand is a **phantom field**, so it costs nothing at runtime but forces every callsite through \`nowIso\` and \`fraction\`.`,
    },
    {
        id: "u-3",
        type: "user",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: "Can you summarize what each file owns and what is still pending?",
    },
    {
        id: "a-4",
        type: "assistant",
        createdAt: nowIso(),
        state: "complete",
        progress: fraction(1),
        content: `# Component map

## File responsibilities

Here is a quick map of which files own what:

| File | Role |
| --- | --- |
| \`src/lib/branded-types.ts\` | Brand definitions: \`IsoTimestamp\`, \`Fraction\` |
| \`src/schemas/activities/types.ts\` | Discriminated union for activity variants |
| \`src/components/ActivityLog/index.tsx\` | Top-level switch dispatcher |
| \`src/components/ActivityLog/AssistantActivity.tsx\` | Renders markdown for \`assistant\` activities |

## Outstanding work

- [x] Wire up the discriminated union
- [x] Render \`assistant\` messages through \`<markdown>\`
- [ ] Hook \`TextInput\` into the activity stream
- [ ] Replace ~~optimistic updates~~ with proper streaming for tool calls
    - [ ] Per-message progress
    - [ ] Cancellation support

> Heads up: the streaming approach must keep ordering deterministic so reasoning blocks do not get reattributed to the wrong tool call.

## References

See the [OpenTUI docs](https://opentui.com/docs/getting-started) for the underlying primitives, and the [marked grammar](https://github.com/markedjs/marked) for what is actually parsed.

To show a literal asterisk in prose, escape it with a backslash: \\*not italic\\*. Common HTML entities also survive: &lt;, &gt;, &amp;, &nbsp;.

---

### Next priorities

1. Factory module for activity construction
2. Real \`TextInput\` wiring
3. Streaming tool output rendering`,
    },
    {
        id: "a-3",
        type: "assistant",
        createdAt: nowIso(),
        state: "in_progress",
        progress: fraction(0.4),
        content: `**Next:** drafting a small factory module so \`TextInput.onSubmit\` can push a real \`UserActivity\` without callers reaching into the schema directly.

Will keep it in \`src/schemas/activities/factories.ts\` so the construction`,
    },
]
