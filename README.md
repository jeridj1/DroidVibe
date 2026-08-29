# DroidVibe

**The Android-native Arduino development workstation.**

DroidVibe turns your Android phone or tablet into a complete Arduino development environment — write code, compile, flash firmware, monitor serial output, and capture logic-analyzer traces, all over USB-OTG with no laptop required.

## Features

- **Code Editor** — Full-screen Arduino IDE with syntax highlighting, compile, and AI-assisted code generation
- **USB Flashing** — Native USB support for STK500v1 (Uno/Mega), AVR109 (Leonardo/Micro), ESP ROM loader, and RP2040 PICOBOOT
- **Serial Monitor** — Real-time serial output with pause/resume and configurable baud rates
- **Logic Analyzer** — RP2040-based signal capture (requires helper firmware)
- **Offline-First** — Sketches persist locally; cloud sync when backend is connected
- **Tablet / DeX** — Adaptive two-pane layout with S Pen support
- **Accessibility** — WCAG AA/AAA contrast, dynamic text scaling, screen reader labels

## Architecture

```
DroidVibe/
├── apps/mobile/          # Expo SDK 52 / React Native 0.76.5
│   ├── app/              # Expo Router (tabs: Sketches, Editor, Devices, Bench, Settings)
│   ├── src/components/   # UI components, CodeEditor, WaveformViewer, TwoPaneLayout
│   ├── src/lib/          # API client, USB transport, offline sketches, accessibility
│   └── src/theme/        # Theme provider (light/dark/system, text scale, two-pane)
├── packages/
│   ├── web/              # Hono + oRPC backend (arduino-cli integration)
│   ├── db/               # Drizzle ORM over Turso (libSQL)
│   ├── shared/           # Pure TS: types, HEX/UF2 parsers, board DB, upload protocols
│   └── native-usb/       # Expo native module (Kotlin) — USB serial + flashing
├── docs/                 # ROADMAP, STORE_LISTING, architecture docs
└── .github/workflows/    # CI (typecheck, lint, test, prebuild, APK build) + release
```

## Prerequisites

- Node.js 20+
- pnpm 9.12.0
- Java 17 (for Android builds)
- Android SDK (API 35, build-tools 35.0.0)
- Expo CLI (installed via pnpm)

## Quick Start

```bash
pnpm install
pnpm typecheck   # TypeScript type checking across all packages
pnpm lint        # ESLint across all packages
pnpm test        # Unit tests

# Start the backend (for cloud features)
pnpm --filter @droidvibe/web dev

# Start the mobile app (Expo Go for development without native USB)
cd apps/mobile && pnpm exec expo start

# Build a development/production APK (enables native USB)
cd apps/mobile && pnpm exec expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

## Native USB Module

The `@droidvibe/native-usb` package provides a Kotlin Expo module that wraps Android USB API for:

- Device enumeration and permission management
- CDC-ACM serial I/O (Arduino Leonardo, native USB, RP2040 CDC)
- Bridge chip support: CH340, CP210x, FTDI
- Upload protocols: STK500v1, AVR109, ESP ROM loader, RP2040 PICOBOOT (UF2)
- Logic-analyzer capture via RP2040 helper firmware

**Only available in a custom Expo dev/production build** — not Expo Go.

## Backend

The web backend (Hono + oRPC) provides:
- `/rpc/compile` — arduino-cli compilation
- `/rpc/sketches/*` — Cloud sketch storage (Turso/libSQL)
- `/rpc/boards/*` — Board database
- `/rpc/ai/*` — AI-assisted code generation and error explanation

Deploy via Docker:

```bash
docker build -t droidvibe-web packages/web/
docker run -p 3001:3001 droidvibe-web
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`): Runs on every push to main — typecheck, lint, unit tests, web build, Expo prebuild validation, and debug APK build
- **Release** (`.github/workflows/release.yml`): Triggered by `v*` tags — builds signed release APK and creates a GitHub release

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo SDK 52, React Native 0.76.5, Expo Router |
| Native | Kotlin, Expo Modules API, Android USB API |
| Backend | Hono, oRPC, arduino-cli |
| Database | Turso (libSQL), Drizzle ORM |
| Monorepo | pnpm, Turborepo |
| CI/CD | GitHub Actions |

## License

Private — © Jerid Johnston