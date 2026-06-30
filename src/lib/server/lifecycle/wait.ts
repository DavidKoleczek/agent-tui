// Awaits `promise` but gives up after `ms`, resolving true when it settled in time and false on timeout.
export function settleWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), ms)
        const settle = (): void => {
            clearTimeout(timer)
            resolve(true)
        }
        promise.then(settle, settle)
    })
}
