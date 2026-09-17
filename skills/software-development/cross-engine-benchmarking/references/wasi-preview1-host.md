# WASI preview1 host notes (for a TS-side host)

Why a TS host at all: Deno's `node:wasi` is a non-functional stub, node's is experimental, and Bun's differs — one shared TS host makes all engines run identical host code. Measured: node's native `node:wasi` ran a syscall-bound wasm module ~2x SLOWER than a straightforward TS host (unoptimized path), so the TS host is not a strawman.

## What Rust std needs for `fs::read_dir` / `fs::metadata`

Imports actually exercised (wasm32-wasip1, wasilibc): `fd_prestat_get`, `fd_prestat_dir_name`, `path_open`, `fd_readdir`, `path_filestat_get`, `fd_filestat_get`, `fd_fdstat_get`, `fd_close`, `fd_write`, `fd_seek`, `fd_read`, plus inert `args_*/environ_*/clock_*/random_get` stubs. Return 0 (SUCCESS) from stubs; unsupported ops return 58 (ENOTSUP).

Key errno values: SUCCESS=0, EBADF=8, EINVAL=28, EIO=29, ENOENT=44, ENOTDIR=54, ENOTSUP=58, ESPIPE=70.

## fd_readdir (the one that matters)

Signature in the JS import: `(fd, buf, buf_len, cookie: BigInt, bufused_ptr) -> errno` — the u64 cookie arrives as BigInt.

Dirent record written into linear memory (little-endian, 24-byte header + name):

- offset 0: `d_next` u64 — cookie of the NEXT entry (return idx+1)
- offset 8: `d_ino` u64 — unused by std's name path; fake values fine
- offset 16: `d_namlen` u32 — byte length of the name
- offset 20: `d_type` u8 — 0 (unknown) is fine for name-only reads
- offset 24: the name bytes

Rules:

- Never write a truncated entry: if `used + 24 + namlen > buf_len`, stop and report what fit. Rust std detects truncation (namlen beyond buffer) and retries with a bigger buffer; a partially-written header breaks that protocol.
- Include `.` and `..` in listings (std skips them itself).
- Serve from a per-fd snapshot (e.g. sorted readdir cached on first call); cookies are indices into it.

## fdstat layout (fd_fdstat_get)

- offset 0: u8 filetype (0=unknown, 3=dir, 4=file)
- offset 8: u64 rights base, offset 16: u64 rights inheriting (0xffff... to be permissive)
- offset 24: u16 fdflags

## filestat layout (path_filestat_get / fd_filestat_get)

64-bit-aligned fields: dev, ino (u64 each), filetype u8 @16, pad, nlink @24, size @32, atim/mtim/ctim @40/48/56. Only `isDirectory()` (filetype 3 vs 4) and `size` are on the hot path.

## preopens

`fd_prestat_get(fd)` walks fds from 3: return 8 (EBADF) when the fd is not a preopen; else u8 preopentype=0 @0 and u32 name-length @4. `fd_prestat_dir_name` writes the guest-visible name. Map `{ '/': '/' }` to expose the whole fs (bench-only; scope it tighter for anything untrusted).

## path_open / resolution

Resolve guest paths LEXICALLY against the preopen's real path (join + normalize `.`/`..` in JS) — do not call realpath on the host; the guest already sends normalized absolute paths if the JS side resolved them.

## Memory safety in the host

Growth of wasm memory detaches `ArrayBuffer`s. Re-create `DataView`/`Uint8Array` at the top of EVERY imported function (cheap next to a syscall); reading `.byteLength` of a detached view throws.

## Reactor instantiation on node's native host

A cdylib without `_start` needs `wasi.initialize(instance)` (not `.start()`) before exports run, or the first fs call throws ERR_WASI_NOT_STARTED (preopens never populated).
