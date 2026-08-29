# DroidVibe Roadmap

> Staged plan toward a production-ready Arduino development workstation.

## Phase 1 â Foundation (complete)

- [x] Monorepo setup (pnpm workspaces + Turborepo)
- [x] Shared TypeScript core (types, board database, protocol constants)
- [x] Intel HEX parser + UF2 builder
- [x] Upload protocols: STK500v1, AVR109/Caterina, ESP ROM loader, PICOBOOT
- [x] Diagnostic vocabulary and error-reporting types
- [x] Unit tests for hex, uf2, boards, protocols

## Phase 2 â Backend (complete)

- [x] Hono + oRPC web backend
- [x] arduino-cli integration (compile, libraries, examples)
- [x] Drizzle ORM + Turso schema (sketches, builds, devices)
- [x] AI assist route (generate, fix, explain)
- [x] Backend deployment (Dockerfile + docker-compose + hosting)
- [ ] Auth and multi-user support

## Phase 3 â Native USB Module (complete)

- [x] Expo native module scaffold (Kotlin, android.hardware.usb)
- [x] CDC-ACM / CH340 / CP210x / FTDI serial driver
- [x] STK500v1 uploader (Uno, Mega)
- [x] AVR109 / Caterina uploader (Leonardo, Micro)
- [x] ESP ROM loader (ESP32, ESP8266)
- [x] PICOBOOT / UF2 flasher (RP2040)
- [x] Logic-analyzer capture service (best-effort)

## Phase 4 â Mobile Client (complete)

- [x] Expo Router tab navigation (editor, bench, devices, sketches, settings)
- [x] Code editor with syntax highlighting
- [x] Serial monitor with baud rate selection and send/receive
- [x] Upload flow with device picker and staged progress
- [x] Waveform viewer (zoom, cursors, protocol decode lanes)
- [x] Theme system (dark/light/system) with AsyncStorage persistence
- [x] AI generate/fix/explain features
- [x] S Pen / tablet / DeX-aware layouts (useAdaptive + TwoPaneLayout)
- [x] Onboarding flow (3-slide intro with AsyncStorage)
- [x] Offline sketch library (AsyncStorage CRUD)

## Phase 5 â CI/CD & Release (complete)

- [x] CI pipeline (typecheck, lint, test, web build, prebuild, APK build)
- [x] Failure-to-issue reporting for build visibility
- [x] Signed release APK / AAB pipeline (release.yml)
- [x] GitHub Releases with downloadable APK (release.yml)
- [ ] pnpm-lock.yaml for reproducible installs (pnpm.overrides lock versions; no lockfile committed yet)

## Phase 6 â Production Hardening (complete)

- [x] Error boundaries and crash reporting (ErrorBoundary component)
- [x] Accessibility audit (TalkBack labels, contrast checks, A11y utilities)
- [x] Performance profiling and optimization (stable callbacks, debounce, FlatList helpers)
- [x] Security review (SECURITY.md with audit results)
- [x] App store assets (SVG icon/splash sources + generation script)

## Phase 7 â Polish & Launch (in progress)

- [ ] Generate PNG assets from SVG sources (run scripts/generate-assets.js)
- [ ] Configure signing secrets for release.yml
- [ ] End-to-end USB flashing test on physical hardware
- [ ] Google Play Store listing and metadata
- [ ] User documentation and tutorials
- [ ] Backend deployment to production hosting
