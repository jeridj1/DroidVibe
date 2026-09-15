# DroidVibe forensic source map

This is a navigation map, not a replacement for the live repository. Reviewers should inspect these paths directly on `main` and relevant historical refs.

## Highest-priority native Android paths

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/LocalToolchain.kt`

Local Arduino CLI installation, tar/gzip extraction, symlink/hard-link handling, proot invocation, compile execution, diagnostics parsing, firmware discovery, board-manager commands, cleanup, and installation marker.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/DroidVibeCompilerModule.kt`

Expo native compiler bridge. Check JSON conversion, error propagation, local compiler lifecycle, and board-manager command inputs.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/DroidVibeUsbModule.kt`

Android USB enumeration, permission flow, serial transport, flashing, RP2040 control, SWD/JTAG, and logic-analyzer entry points.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/UsbSerialDriver.kt`

Low-level serial driver. Inspect endpoint/interface selection, control transfers, threading, timeouts, reads/writes, CDC/CH340/CP210x/FTDI handling, and cleanup.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/Uploaders.kt`

Protocol upload implementation. Inspect STK500v1, AVR109, ESP ROM loader, verification, reset behavior, timeouts, and error handling.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/PicobootFlasher.kt`

RP2040 PICOBOOT/UF2 flashing path. Inspect USB protocol assumptions, reset/re-enumeration behavior, verification, and failure recovery.

`packages/native-usb/android/src/main/java/com/droidvibe/nativeusb/CaptureService.kt`

RP2040 logic-analyzer capture path.

## TypeScript/native boundary

`packages/native-usb/src/index.ts`

Public JS API and optional native-module resolution. Verify that every advertised operation has a real native implementation and that missing-module behavior is coherent.

## Mobile application

Inspect `apps/mobile/app/` for router screens and feature wiring.

Inspect `apps/mobile/src/components/` for editor, device, waveform, layout, and settings components.

Inspect `apps/mobile/src/lib/` for API, USB transport, local sketch storage, compile/flash orchestration, board identification, and generated firmware.

Inspect `apps/mobile/src/theme/` for adaptive UI/accessibility behavior.

Search for every call to `compileLocal`, `upload`, `capture`, `flashUf2`, `swdTransfer`, `jtagTransfer`, and board-manager methods. Trace each from UI to TypeScript to Kotlin and back.

## Shared/backend

`packages/shared/` contains shared types, board data, parsers, and protocol definitions. Verify that these agree with native implementations.

`packages/web/` contains the Hono/oRPC backend. Inspect compile, sketches, boards, AI, authentication/trust boundaries, and whether backend compilation duplicates or conflicts with local compilation.

`packages/db/` contains Drizzle/Turso database code.

## Build/release

`.github/workflows/ci.yml` is the primary CI pipeline.

`.github/workflows/release.yml` is the release pipeline.

`scripts/build-mobile-toolchain.sh` creates the ARM64 Debian/Arduino CLI/proot toolchain bundled into the APK.

`scripts/generate-assets.js` generates PNG assets used by the mobile build.

`firmware/rp2040-logic-analyzer/` is the helper firmware built and embedded by CI.

## Configuration to cross-check

Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml` if present, mobile `package.json`, Expo/app configuration, Android Gradle files, native-usb Gradle configuration, TypeScript configs, and any generated Android project files.

## Historical investigation

Do not restrict the audit to `main`. Inspect open and closed PRs, branches, merge commits, recent commits, and CI runs. Pay special attention to the branch `fix/android-toolchain-symlink-resolution-main`, PR #122, and run `34722004569`.
