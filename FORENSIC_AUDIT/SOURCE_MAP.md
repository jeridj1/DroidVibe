# Forensic Source Map

The live `main` repository is the source of truth. This map is a navigation aid, not a duplicate of the repository.

## Build and packaging

`.github/workflows/ci.yml` — main CI pipeline, including validation, ARM64 toolchain construction, RP2040 helper work, and Android APK build.

`.github/workflows/release.yml` — release/versioning/signing/artifact path.

`scripts/build-mobile-toolchain.sh` — constructs the ARM64 Debian/Arduino CLI toolchain, installs board cores, verifies compilation, creates the rootfs archive, and splits it for packaging.

`Dockerfile` — inspect for the build environment and ownership/permission behavior surrounding toolchain construction.

## Mobile application

`apps/mobile/app/(tabs)/editor.tsx` — editor/compile-facing UI and orchestration.

`apps/mobile/app/(tabs)/devices.tsx` — board/device UI and USB-facing workflow.

`apps/mobile/app/(tabs)/bench.tsx` — bench/logic-analyzer-related UI.

`apps/mobile/app/(tabs)/settings.tsx` — settings, AI/backend configuration, and persistence.

`apps/mobile/app/(tabs)/sketches.tsx` — sketch/project management.

`apps/mobile/app/onboarding.tsx` — first-run flow.

`apps/mobile/src/components/CodeEditor.tsx` — editor component.

`apps/mobile/src/components/WaveformViewer.tsx` — waveform rendering.

`apps/mobile/src/lib/api.ts` — mobile API/backend boundary.

`apps/mobile/src/lib/` — inspect all utility/orchestration modules, especially compiler, device, sketch, settings, and storage code.

## Native Android / USB

Search the mobile tree for Kotlin/Java native-module sources and inspect every file involved in USB, local toolchain execution, archive extraction, process execution, and Expo module registration. Do not assume the names remain unchanged across branches.

High-priority search terms:

`LocalToolchain`
`Usb`
`USB`
`UsbManager`
`PendingIntent`
`ExpoModule`
`ProcessBuilder`
`proot`
`rootfs`
`symlink`
`archive`
`compile(`
`avrdude`
`esptool`
`picotool`
`uf2`
`picoboot`
`serial`
`logic analyzer`

## Shared/backend

Inspect all files under `packages/` and `apps/` for Hono, oRPC, Drizzle, Turso, board definitions, compile services, AI endpoints, and shared types. Trace every API call from mobile UI to implementation and back.

## Tests and firmware

Inspect every test and firmware/helper directory. Determine whether tests exercise real compiler/toolchain behavior or only mocks/stubs. Pay particular attention to RP2040 logic-analyzer firmware and any generated/bundled firmware artifacts.

## Config and reproducibility

Root:

`package.json`
`pnpm-workspace.yaml`
`turbo.json`
`.npmrc`

Mobile:

`apps/mobile/package.json`
`apps/mobile/app.json`
`apps/mobile/app.config.js`
`apps/mobile/babel.config.js`
`apps/mobile/metro.config.js`

Also inspect Android Gradle files generated or committed under the mobile/native portions of the repository.

## Evidence-room documents

`FORENSIC_AUDIT/AUDIT_PROMPT.md` — complete audit instructions.

`FORENSIC_AUDIT/USER_REPORTED_REALITY.md` — owner observations and product target, explicitly unverified until reproduced.

`FORENSIC_AUDIT/CURRENT_DEVICE_ERROR.md` — current approximate `invalid relative system link target` clue and why it matters.

`FORENSIC_AUDIT/ARDUINODROID_REFERENCE.md` — working Android Arduino-app behavior to use as a practical comparison point.

`FORENSIC_AUDIT/CI-RUN-34722004569.md` — preserved CI failure sequence.

`FORENSIC_AUDIT/PR-122-EVIDENCE.md` — PR #122 evidence.

`FORENSIC_AUDIT/KNOWN_FAILURES.md` — earlier high-value known/suspected issues.

`FORENSIC_AUDIT/AI_ACCESS_GUIDE.md` — guidance for AIs with different GitHub browsing capabilities.
