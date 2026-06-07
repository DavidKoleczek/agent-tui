// `__brand` is a phantom field used only by TypeScript to give each branded type a distinct identity so a plain string
// or number cannot be assigned where a branded type is expected. It does not exist at runtime.

export type IsoTimestamp = string & { readonly __brand: "IsoTimestamp" }

export function nowIso(): IsoTimestamp {
    return new Date().toISOString() as IsoTimestamp
}
