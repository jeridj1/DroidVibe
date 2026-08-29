# DroidVibe

> A flagship Android development workstation for Arduino-class hardware.

Write, compile, and flash Arduino sketches — all from your phone. DroidVibe
turns an Android device with USB-OTG into a portable electronics bench with a
code editor, compiler, serial monitor, plotter, and logic analyzer.

## Features

- **Code editor** — Syntax-highlighted editor with line numbers, error gutter, and AI-assisted code generation, fixing, and error explanation.
- **Cloud compilation** — Real `arduino-cli` compilation in a sandboxed backend. Supports Arduino Uno, Nano, Mega, Leonardo, ESP32, and RP2040.
- **USB firmware flashing** — Direct USB-OTG flashing via native Kotlin module. Protocols: STK500v1 (Uno/Mega), AVR109/Caterina (Leonardo/Micro), ESP ROM loader (ESP32/ESP8266), PICOBOOT/UF2 (RP2040).
- **Serial monitor** — Connect to any supported board, send/receive data, adjustable baud rates.
- **Serial plotter** — Numeric value visualization with pause and CSV export.
- **Logic analyzer** — Waveform viewer with pinch zoom/pan, dual cursors, delta-time/frequency/duty measurement, and UART/I2C/SPI protocol decode lanes.
- **Offline sketch library** — Create and edit sketches locally with AsyncStorage persistence. Works without a backend connection.
- **Theme system** — Dark/light/system themes with adjustable text scale and tablet/DeX two-pane layout support.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile Client   │────▶│  Web Backend      │────▶│  arduino-cli     │
│  (Expo/RN 0.76)  │     │  (Hono + oRPC)    │     │  (sandboxed)    │
│                  │     │                   │     ├─────────────────┤
│  Native USB mod  │     │  Drizzle ORM      │────▶│  Turso (libSQL)  │
│  (Kotlin)        │     │                   │     └─────────────────┘
└─────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  USB Hardware    │
│  (Arduino, ESP,  │
│   RP2040, etc.)  │
└─────────────────┘
```

### Monorepo structure

| Package | Description |
|---------|-------------|
| `apps/mobile` | Expo SDK 52 / React Native 0.76.5 app with Expo Router tabs |
| `packages/web` | Hono + oRPC backend with arduino-cli integration |
| `packages/db` | Drizzle ORM schema over Turso (libSQL) |
| `packages/shared` | Pure TypeScript core: types, HEX/UF2 parsers, board DB, protocols |
| `packages/native-usb` | Expo native module (Kotlin) for USB serial and flashing |

## Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm 9.x
- Android Studio (for emulator / dev builds)
- Java 17 (for Android builds)

### Install & develop

```bash
pnpm install --no-frozen-lockfile

# Start web backend
pnpm web:dev

# Start mobile dev client (requires a dev build for USB access)
pnpm mobile:dev

# Generate native Android project
pnpm mobile:prebuild
```

### CI

GitHub Actions runs typecheck, lint, unit tests, web build, Expo prebuild
validation, and a debug APK build on every push to `main`. Build failures
auto-create GitHub issues with the Gradle log for debugging.

### Docker (backend only)

```bash
docker compose up --build
# Backend listens on http://localhost:3000
```

## Supported boards

| Board | FQBN | Upload protocol |
|-------|------|-----------------|
| Arduino Uno | `arduino:avr:uno` | STK500v1 |
| Arduino Nano | `arduino:avr:nano` | STK500v1 / AVR109 |
| Arduino Mega 2560 | `arduino:avr:mega` | STK500v1 |
| Arduino Leonardo | `arduino:avr:leonardo` | AVR109 |
| Raspberry Pi Pico | `rp2040:rp2040:rpipico` | PICOBOOT / UF2 |
| ESP32 | `esp32:esp32:esp32` | ESP ROM loader |

## Reliability contract

DroidVibe never displays fake success. Any unconfirmed hardware operation
surfaces as `unknown` or `failed`. Firmware is only reported as successfully
written when read-back verification (where supported) confirms it, or the
device acknowledges completion per its documented protocol.

## License

Private project.
