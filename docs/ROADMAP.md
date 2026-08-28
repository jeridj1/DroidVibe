# DroidVibe Roadmap

> Staged plan toward a production-ready Arduino development workstation.

## Phase 1 — Foundation (complete)

- [x] Monorepo setup (pnpm workspaces + Turborepo)
- [x] Shared TypeScript core (types, board database, protocol constants)
- [x] Intel HEX parser + UF2 builder
- [x] Upload protocols: STK500v1, AVR109/Caterina, ESP ROM loader, PICOBOOT
- [x] Diagnostic vocabulary and error-reporting types
- [x] Unit tests for hex, uf2, boards, protocols

## Phase 2 — Backend (complete)

- [x] Hono + oRPC web backend
- [x] arduino-cli integration (compile, libraries, examples)
- [x] Drizzle ORM + Turso schema (sketches, builds, devices)
- [x] AI assist route (generate, fix, explain)
- [ ] Backend deployment (Dockerfile + hosting)
- [ ] Auth and multi-user support

## Phase 3 — Native USB Module (complete)

- [x] Expo native module scaffold (Kotlin, android.hardware.usb)
- [x] CDC-ACM / CH340 / CP210x / FTDI serial driver
- [x] STK500v1 uploader (Uno, Mega)
- [x] AVR109 / Caterina uploader (Leonardo, Micro)
- [x] ESP ROM loader (ESP32, ESP8266)
- [x] PICOBOOT / UF2 flasher (RP2040)
- [x] Logic-analyzer capture service (best-effort)

## Phase 4 — Mobile Client (in progress)

- [x] Expo Router tab navigation (editor, bench, devices, sketches, settings)
- [x] Code editor with syntax highlighting
- [x] Serial monitor with baud rate selection and send/receive
- [x] Upload flow with device picker and staged progress
- [x] Waveform viewer (zoom, cursors, protocol decode lanes)
- [x] Theme system (dark/light/system) with AsyncStorage persistence
- [x] AI generate/fix/explain features
- [ ] S Pen / tablet / DeX-aware layouts
- [ ] Onboarding flow
- [ ] Offline sketch library

## Phase 5 — CI/CD & Release

- [x] CI pipeline (typecheck, lint, test, web build, prebuild, APK build)
- [x] Failure-to-issue reporting for build visibility
- [ ] Signed release APK / AAB pipeline
- [ ] GitHub Releases with downloadable APK
- [ ] pnpm-lock.yaml for reproducible installs

## Phase 6 — Production Hardening

- [ ] Error boundaries and crash reporting
- [ ] Accessibility audit (TalkBack, large text, contrast)
- [ ] Performance profiling and optimization
- [ ] Security review (see SECURITY.md)
- [ ] App store assets (icons, splash, store listing)
