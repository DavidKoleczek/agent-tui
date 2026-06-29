import { dlopen, FFIType, type Pointer, ptr } from "bun:ffi"

// Win32 constants. References:
//   https://learn.microsoft.com/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information
//   https://learn.microsoft.com/windows/win32/api/jobapi2/nf-jobapi2-setinformationjobobject
//   https://learn.microsoft.com/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject

const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9

const PROCESS_TERMINATE = 0x0001
const PROCESS_SET_QUOTA = 0x0100

// JOBOBJECT_EXTENDED_LIMIT_INFORMATION on x64 is 144 bytes:
//   64 (JOBOBJECT_BASIC_LIMIT_INFORMATION with x64 padding)
// + 48 (IO_COUNTERS: six ULONGLONG fields)
// + 32 (four SIZE_T fields).
// The 32-bit LimitFlags lives inside the embedded basic limit at offset 16.
const EXTENDED_INFO_SIZE = 144
const LIMIT_FLAGS_OFFSET = 16

const symbolDefs = {
    CreateJobObjectW: { args: [FFIType.pointer, FFIType.pointer], returns: FFIType.pointer },
    SetInformationJobObject: {
        args: [FFIType.pointer, FFIType.u32, FFIType.pointer, FFIType.u32],
        returns: FFIType.i32,
    },
    OpenProcess: { args: [FFIType.u32, FFIType.i32, FFIType.u32], returns: FFIType.pointer },
    AssignProcessToJobObject: { args: [FFIType.pointer, FFIType.pointer], returns: FFIType.i32 },
    CloseHandle: { args: [FFIType.pointer], returns: FFIType.i32 },
    GetLastError: { args: [], returns: FFIType.u32 },
} as const

type Kernel32 = ReturnType<typeof dlopen<typeof symbolDefs>>
let cached: Kernel32 | null = null

function load(): Kernel32 {
    if (cached !== null) return cached
    cached = dlopen("kernel32.dll", symbolDefs)
    return cached
}

export interface JobHandle {
    // Assigns an existing process (identified by PID) to this job.
    // The child inherits KILL_ON_JOB_CLOSE for itself and its own descendants,
    // which is why assigning the top-level uv.exe is enough to cover python.exe and uvicorn workers it spawns.
    assign(pid: number): void
    // Closes the job handle.
    // Once the last handle to a KILL_ON_JOB_CLOSE job is released, the OS terminates every assigned process.
    // We call this explicitly on graceful shutdown; the kernel calls it for us on hard process death.
    close(): void
}

// Creates a Windows Job Object configured so that when the last handle to the job is released
// (explicitly here or implicitly when this process dies for any reason),
// every process assigned to the job is terminated by the OS.
export function createKillOnCloseJob(): JobHandle {
    const { symbols } = load()
    const handle = symbols.CreateJobObjectW(null, null)
    if (handle === null) {
        throw new Error(`CreateJobObjectW returned NULL (GetLastError=${symbols.GetLastError()})`)
    }

    const info = new Uint8Array(EXTENDED_INFO_SIZE)
    new DataView(info.buffer).setUint32(LIMIT_FLAGS_OFFSET, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, true)

    const ok = symbols.SetInformationJobObject(
        handle,
        JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
        ptr(info),
        EXTENDED_INFO_SIZE,
    )
    if (ok === 0) {
        const code = symbols.GetLastError()
        symbols.CloseHandle(handle)
        throw new Error(`SetInformationJobObject(KILL_ON_JOB_CLOSE) failed (GetLastError=${code})`)
    }

    let closed = false
    return {
        assign(pid: number): void {
            if (closed) throw new Error("Cannot assign to a closed job handle")
            const procHandle: Pointer | null = symbols.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid)
            if (procHandle === null) {
                const code = symbols.GetLastError()
                throw new Error(`OpenProcess(${pid}) returned NULL (GetLastError=${code})`)
            }
            try {
                const assigned = symbols.AssignProcessToJobObject(handle, procHandle)
                if (assigned === 0) {
                    const code = symbols.GetLastError()
                    throw new Error(`AssignProcessToJobObject(pid=${pid}) failed (GetLastError=${code})`)
                }
            } finally {
                symbols.CloseHandle(procHandle)
            }
        },
        close(): void {
            if (closed) return
            closed = true
            symbols.CloseHandle(handle)
        },
    }
}
