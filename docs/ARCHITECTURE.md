# Architecture

## Layers

### Mobile client (`apps/mobile`)
Expo Router tabbed app: **Sketches · Editor · Devices · Bench · Settings**.

- **Sketches** — cloud project list, file tree, version history.
- **Editor** — syntax-highlighted code editor with line numbers, error gutter,
  autocomplete, undo/redo, find/replace, S Pen-friendly hit targets.
- **Devices** — USB attach/detach, Android permission flow, VID/PID board
  identification, port picker.
- **Bench** — serial monitor + numeric plotter (pause/export) and the logic
  analyzer waveform viewer (pinch zoom/pan, dual cursors, delta-time/frequency/
  duty, edge/pattern triggers, UART/I2C/SPI decode lanes, capture export).
- **Settings** — theme, tablet/DeX two-pane layouts, text scale, sign-in.

### Backend (`packages/web`)
Hono + oRPC service exposing typed RPC procedures:

- `compile` — real arduino-cli compilation, board/core installation, firmware
  artifact output.
- `diagnostics` — compiler errors translated into plain-English explanations.
- `boards` / `libraries` — proxy/cache of real Arduino package and library indexes.
- `sketches` — cloud sketch/project synchronization and versions.
- `ai` — explain errors, generate sketches, fix sketches (streaming).
- `examples` — example/template gallery.

### Database (`packages/db`)
Drizzle ORM over Turso (libSQL). Tables: `sketches`, `sketch_files`,
`sketch_versions`, `boards_cache`, `libraries_cache`, `builds`, `captures`,
`devices`.

### Shared core (`packages/shared`)
The hardware vocabulary and pure-logic foundations, usable by both client and
server:

- Device state machine, USB device/transport types, serial options, upload
  protocols, upload stages, capture config.
- Pure parsers: Intel HEX, UF2, arduino-cli JSON diagnostics.
- VID/PID board identification database.
- Human-readable diagnostic translation.
- Protocol constants for STK500v1, AVR109, ESP ROM-loader, PICOBOOT.

### Native USB (`packages/native-usb`)
Expo native module written in Kotlin using `android.hardware.usb`. Exposes
device listing, permissions, serial open/close/write/data events, upload and
capture, and RP2040 UF2/PICOBOOT flashing. Drivers: CDC-ACM, CH340, CP210x,
FTDI; upload backends: STK500v1, AVR109, esptool, UF2, PICOBOOT, DFU. A mock
transport remains available where native USB is unavailable (Expo Go).

## Build/upload state machine

```
detected -> selected -> connected -> compiling -> uploading -> verified
```

Never display fake success. Any unconfirmed condition surfaces as `unknown`
or `failed`.

## Reliability contract

- Detected / selected / supported / connected / compiling / uploaded /
  verified / unknown / failed are all distinct.
- Upload backends are modular; each protocol is an independently validated
  backend.
- Voltage translation and target power are explicit hardware concerns — the
  app never assumes a target is 3.3 V tolerant.
