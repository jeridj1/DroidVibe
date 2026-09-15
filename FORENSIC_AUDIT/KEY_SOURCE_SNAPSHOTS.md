# Key source snapshots from main

These excerpts are included so an AI with limited GitHub browsing can still see the critical implementation shape. The live repository remains authoritative.

## README claims

The README describes DroidVibe as an Android-native Arduino development workstation for writing, compiling, flashing, serial monitoring, and RP2040 logic-analyzer capture over USB-OTG without a laptop. It advertises STK500v1, AVR109, ESP ROM loader, RP2040 PICOBOOT, offline-first sketches, AI-assisted code generation, tablet/DeX, and accessibility.

The README also says the native USB module is only available in a custom Expo dev/production build and not Expo Go.

## TypeScript native boundary

`packages/native-usb/src/index.ts` exposes methods for USB enumeration/permission, serial I/O, upload, capture, UF2 flashing, helper firmware, RP2040 BOOTSEL/mode detection, SWD, JTAG, local compilation, toolchain state, and Arduino board-manager operations.

It resolves `DroidVibeUsb` and `DroidVibeCompiler` through Expo's optional native-module mechanism. `compileLocal` explicitly rejects when the compiler module is absent, saying to use a DroidVibe APK build rather than Expo Go.

## Local compiler architecture

`LocalToolchain.kt` stores a Debian-style rootfs under the app's internal files directory and extracts a bundled ARM64 proot binary plus a gzipped tar rootfs from Android assets. It then invokes Arduino CLI through proot with `/work` bound to a per-job cache directory.

The current main version marker is:

`2026-09-local-cli-1.5.1-avr-megaavr-pico6.1-python3-chunked-stream-symlinkfix`

The archive extractor rejects `..` path components, validates output paths under the rootfs, handles symbolic and hard links, and restores executable/readable bits on regular files.

Compilation writes user-supplied relative source paths after rejecting absolute paths and `..` components. It invokes Arduino CLI with the selected FQBN and then searches the build directory for `.hex`, `.bin`, or `.uf2` output.

## Important implementation detail to investigate

`LocalToolchain.compile()` starts the process and immediately reads the entire merged stdout/stderr stream with `readText()` before calling `waitFor()` with the five-minute timeout. An auditor should determine whether this ordering can defeat the intended timeout when a child process hangs or keeps its pipe open, and whether process termination/stream handling should be redesigned.

`findFirmware()` chooses the largest matching firmware file by extension. An auditor should verify whether that can ever select the wrong artifact when a build directory contains multiple firmware outputs.

## Compiler bridge

`DroidVibeCompilerModule.kt` converts the JSON array of `{path,content}` objects into Kotlin pairs and delegates to `LocalToolchain.compile()`. Board-manager methods delegate to `LocalToolchain.runCli()` with fixed fifteen-minute operation timeouts.

## USB module

`DroidVibeUsbModule.kt` wraps Android's `UsbManager`, registers attach/detach/permission broadcasts, tracks serial connections by Android device ID, checks permission before serial/upload operations, and delegates flashing/capture/debug functions to helper classes.

The TypeScript API therefore depends on a native module that cannot exist in Expo Go. A complete audit should trace the app's feature gating and user messaging around this boundary.

## CI architecture

The CI workflow installs dependencies without `--frozen-lockfile`, runs quality/web/tests/prebuild, builds the ARM64 local toolchain on an ARM64 Ubuntu runner, uploads the chunked toolchain as an artifact, then on a separate Ubuntu runner performs another Expo prebuild, downloads the toolchain, builds the RP2040 helper firmware, generates a TypeScript embedded UF2, patches Android Gradle configuration, bundles JavaScript, and assembles the debug APK.

The audit should examine whether rebuilding prebuild output in the APK job can diverge from the prebuild validation job and whether runtime-generated files are correctly included in the final APK.
