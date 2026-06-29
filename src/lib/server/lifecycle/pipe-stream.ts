import type { LogFile } from "../session/server-log"

// Drains a ReadableStream<Uint8Array> into the log, decoding as streaming UTF-8 so multi-byte sequences split across chunks aren't corrupted.
// The log's internal write queue serializes against any other stdio stream sharing the same writer.
export async function pipeStream(stream: ReadableStream<Uint8Array>, log: LogFile): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder("utf-8")
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            if (value !== undefined && value.byteLength > 0) {
                log.write(decoder.decode(value, { stream: true }))
            }
        }
        const tail = decoder.decode()
        if (tail.length > 0) log.write(tail)
    } finally {
        reader.releaseLock()
    }
}
