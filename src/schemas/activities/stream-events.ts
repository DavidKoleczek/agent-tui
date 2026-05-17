export type ActivityStreamEvent =
    | { type: "user.submit"; id: string; content: string }
    | { type: "assistant.start"; id: string }
    | { type: "reasoning.start"; id: string }
    | { type: "delta"; id: string; text: string }
    | { type: "complete"; id: string }
