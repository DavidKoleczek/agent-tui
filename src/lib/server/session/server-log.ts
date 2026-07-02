import { logFileName, openLogStream } from "./log-location"

export interface LogFile {
    path: string
    write(text: string): void
    close(): Promise<void>
}

// Opens an append-only server-stdout log for the given working directory
// Writes are serialized through a promise chain so the two stdio streams that share this writer never interleave a
// partial line and `close()` can await an actual flush.
export function createLogFile(cwd: string): LogFile {
    const opened = openLogStream(cwd, logFileName("agent-server", "log"))
    const stream = opened.stream
    let chain: Promise<void> = Promise.resolve()

    return {
        path: opened.path,
        write(text) {
            const prefix = `[${new Date().toISOString()}] `
            const stamped = prefix + text.replace(/\n(?=[^\n])/g, `\n${prefix}`)
            chain = chain.then(
                () =>
                    new Promise<void>((resolve) => {
                        if (stream.write(stamped)) {
                            resolve()
                        } else {
                            stream.once("drain", () => resolve())
                        }
                    }),
            )
        },
        close: async () => {
            await chain
            await new Promise<void>((resolve) => stream.end(() => resolve()))
        },
    }
}
