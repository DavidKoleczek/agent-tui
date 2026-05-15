// `__brand` is a phantom field used only by TypeScript to give each branded type a distinct identity so a plain string
// or number cannot be assigned where a branded type is expected. It does not exist at runtime.

export type IsoTimestamp = string & { readonly __brand: "IsoTimestamp" }

export function nowIso(): IsoTimestamp {
    return new Date().toISOString() as IsoTimestamp
}

// Fractional value in the closed interval [0, 1]. 0 means not started or in progress, 1 means complete.
export type Fraction = number & { readonly __brand: "Fraction" }

export function fraction(value: number): Fraction {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new RangeError(`Fraction must be a finite number between 0 and 1, got ${value}`)
    }
    return value as Fraction
}
