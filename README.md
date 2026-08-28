# DroidVibe

> A flagship-quality Android development workstation for Arduino-class hardware.

DroidVibe is a modern, hardware-authentic mobile development environment for
Arduino and Arduino-compatible boards. It pairs a polished Expo/React Native
mobile client with a cloud compilation backend (Hono + oRPC) and a shared
TypeScript core that carries the real upload-protocol, diagnostic and
logic-capture vocabulary.

This is a fresh, flagship redesign — not a port of the legacy Kotlin app. The
legacy `ArduinoMobileWorkshop` repository served as a reference for proven
low-level USB and bootloader behaviour; DroidVibe rebuilds the experience on a
coherent, production-grade stack.

## Stack

| Layer | Technology |
| --- | --- |
| Mobile client | Expo / React Native (TypeScript), Expo Router |
| Backend API | Hono + oRPC, TypeScript |
| Database | Drizzle ORM + Turso (libSQL) |
| Native USB | Custom Expo native module (Kotlin, android.hardware.usb) |
| Shared core | TypeScript (types, protocols, parsers, diagnostics) |
| Monorepo | pnpm workspaces + Turborepo |

## Repository layout

```
apps/mobile            Expo / React Native mobile client
packages/web           Hono + oRPC backend API
packages/db            Drizzle schema + migrations (Turso)
packages/shared        Shared types, protocol constants, parsers, diagnostics
packages/native-usb    Expo native USB transport module (Kotlin)
examples               Starter sketches and templates
.github/workflows      CI pipelines
```

## Getting started

```bash
pnpm install
pnpm --filter @droidvibe/db generate   # generate Drizzle migrations
pnpm web:dev                          # start the backend
pnpm mobile:dev                        # start the Expo dev client
```

## Design principles

- **No fake success.** Hardware behaviour is never reported as successful unless
  it was actually confirmed. Unknown states stay explicitly `unknown`.
- **Real protocols.** STK500v1, AVR109/Caterina, ESP ROM-loader, UF2 and
  PICOBOOT are implemented against their documented behaviour, not guessed.
- **Flagship polish.** Clean hierarchy, deliberate density, strong editor/console
  presentation, S Pen/tablet/DeX-aware layouts, dark/light/system themes.
- **Arduino-authentic palette.** Petrol/teal accent on white, teal retained in
  dark mode; monospace for editor/console; edge-to-edge with safe insets.

## Status

DroidVibe is under active development. See `docs/ROADMAP.md` for the staged plan
and `docs/SECURITY.md` for the security boundary.
