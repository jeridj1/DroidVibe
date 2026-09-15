# Local toolchain snapshot from main

Source: `scripts/build-mobile-toolchain.sh`, main blob SHA `7e281a0f603ec57cb943e1747793c2ea5d195018`.

The script constructs an ARM64 Debian Bookworm rootfs, installs Arduino CLI version 1.5.1, Arduino AVR and megaAVR cores, and the Earle Philhower RP2040 core from its package index. It downloads a static ARM64 proot binary from SourceForge.

It runs an ARM64 Docker self-test through proot and compiles representative Uno, Mega, and Pico sketches before archiving the rootfs.

The rootfs is archived by a root Docker container. The current main script then runs host-side `chmod 0644` on the archive, splits it into 128 MiB pieces, deletes the unsplit archive, and chmods the pieces.

That final host-side chmod is the exact operation that failed in known CI run `34722004569` after the compilation self-test had already succeeded.

## Important design questions for auditors

Does the archive need host-side permission changes at all?

Is Docker-created root ownership on a bind-mounted output portable across GitHub runner images and filesystems?

Would creating the archive with a non-root UID/GID, copying it through a controlled output step, or performing split/archive operations inside the container be more robust?

Are rootfs symlinks represented as absolute paths, `./`-prefixed root-relative paths, or ordinary relative paths by the installed Arduino packages?

Does Android's filesystem support the symbolic/hard-link behavior required by the extracted Linux rootfs?

Does proot correctly emulate all system behavior used by Arduino CLI and every bundled board core on supported Android devices?

What is the real APK/storage cost of the resulting toolchain, and would per-core or on-demand packages be a better design?

Can the app update or repair the local toolchain without requiring a whole APK replacement?

Can compilation be safely cancelled and cleaned up if Arduino CLI, gcc, or a child process hangs?

## Main-source process concern

`LocalToolchain.kt` calls `startProcess(...)`, then reads `process.inputStream` to EOF, and only afterward calls `waitFor(timeout)`. An auditor should examine whether this ordering makes the timeout ineffective for a process that never closes its output stream. A robust implementation may need concurrent output draining plus timed process waiting/cancellation.
