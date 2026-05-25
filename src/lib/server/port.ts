import { type AddressInfo, createServer } from "node:net"

// Binds a TCP socket to 127.0.0.1:0, reads the kernel-assigned ephemeral port, and releases it.
// There is a small race window between close and the next caller's bind; for a desktop TUI this is acceptable.
export function pickFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer()
        server.once("error", reject)
        server.listen(0, "127.0.0.1", () => {
            const addr = server.address() as AddressInfo | null
            if (addr === null) {
                server.close()
                reject(new Error("Failed to read ephemeral port from listener"))
                return
            }
            const port = addr.port
            server.close((err) => {
                if (err !== undefined && err !== null) reject(err)
                else resolve(port)
            })
        })
    })
}
