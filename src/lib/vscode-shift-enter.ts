// VSCode's integrated terminal intercepts Shift+Enter at the editor level and
// emits a literal backslash followed by a carriage return (`\<CR>`, bytes
// `0x5c 0x0d`) as a single stdin chunk. That bypasses the modifier-aware Enter
// encodings (CSI u and modifyOtherKeys) that other terminals use, so OpenTUI
// would otherwise see a literal backslash followed by a plain submit.
//
// This shim rewrites the leading byte of that exact 2-byte chunk from `\` to
// `ESC`. The OpenTUI keypress parser already understands `ESC<CR>` and produces
// `{ name: "return", meta: true }`, which our textarea binds to "newline".
//
// The matcher requires a chunk of length 2 with bytes [0x5c, 0x0d]. In raw
// mode terminals deliver each keystroke as its own data event, so a human
// typing `\` then Enter arrives as two separate 1-byte chunks. Bracketed paste
// content arrives in much larger chunks. Combined with the `TERM_PROGRAM`
// gate, this avoids touching anything other than the synthetic VSCode pattern.
//
// `prependListener` puts this handler at the front of stdin's listener queue,
// so it mutates the buffer in place before OpenTUI's listener processes it.

const SHIFT_ENTER_FIRST_BYTE = 0x5c
const SHIFT_ENTER_SECOND_BYTE = 0x0d
const ESC_BYTE = 0x1b

const handleVSCodeShiftEnter = (chunk: Buffer | string): void => {
    if (
        Buffer.isBuffer(chunk) &&
        chunk.length === 2 &&
        chunk[0] === SHIFT_ENTER_FIRST_BYTE &&
        chunk[1] === SHIFT_ENTER_SECOND_BYTE
    ) {
        chunk[0] = ESC_BYTE
    }
}

export function installVSCodeInputShims(): void {
    if (process.env.TERM_PROGRAM !== "vscode") return

    process.stdin.prependListener("data", handleVSCodeShiftEnter)
    process.once("exit", () => {
        process.stdin.removeListener("data", handleVSCodeShiftEnter)
    })
}
