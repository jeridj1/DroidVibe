# Google Play Store Listing

## App Title (30 chars max)
DroidVibe — Arduino IDE

## Short Description (80 chars max)
Code, compile & flash Arduino on Android with USB-OTG.

## Full Description (4000 chars max)
DroidVibe is a professional Arduino development workstation for Android tablets and phones. Write, compile, and upload code to your Arduino, ESP32, or Raspberry Pi Pico directly from your device — no computer required.

### Features

**Code Editor**
- Syntax-highlighted editor optimized for Arduino sketches
- Pre-loaded example sketches (Blink, Serial, Analog Read, Pico Blink)
- AI-assisted code generation, debugging, and explanation
- Offline sketch library — create and edit without a network

**Compilation**
- Remote compilation via arduino-cli backend
- Supports Arduino Uno, Nano, Mega, Leonardo, ESP32, RP2040
- Build diagnostics with clear error messages
- Firmware artifact management

**USB Flashing**
- Native USB host support via USB-OTG
- STK500v1 protocol (Arduino Uno, Mega)
- AVR109/Caterina protocol (Leonardo, Micro)
- ESP ROM bootloader (ESP32, ESP8266)
- PICOBOOT / UF2 flasher (Raspberry Pi Pico)
- CDC-ACM, CH340, CP210x, FTDI serial drivers

**Serial Monitor**
- Real-time serial output with baud rate selection (9600-230400)
- Send data to connected device
- Pause/resume streaming

**Logic Analyzer (best-effort)**
- Waveform capture and visualization
- Zoom, cursors, and protocol decode lanes

**Device Management**
- Auto-detect connected USB boards
- Per-device permission model
- Board identification by VID/PID

**Tablet & DeX Support**
- Adaptive two-pane master-detail layout
- S Pen / stylus input support
- Samsung DeX desktop mode
- Responsive grid layouts

**Accessibility**
- Full TalkBack screen reader support
- WCAG AA contrast compliance
- Adjustable text scale (0.9x to 1.3x)
- Large touch targets

**Privacy**
- No telemetry or analytics
- No crash reporting to remote servers
- Local-first sketch storage
- User-configured or self-hosted backend

### Supported Boards
Arduino Uno, Nano, Mega 2560, Leonardo, Micro, ESP32, ESP8266, Raspberry Pi Pico, and more.

### Requirements
- Android 7.0+ (API 24)
- USB-OTG capable device (for USB flashing)
- Self-hosted DroidVibe backend (for remote compilation)

## Category
Tools → Developer Tools

## Content Rating
Everyone

## Privacy Policy URL
https://droidvibe.dev/privacy (placeholder)

## Technical Details
- Package: com.droidvibe.app
- Min SDK: 24 (Android 7.0)
- Target SDK: 35 (Android 15)
- Architecture: ARM64, ARM32, x86_64
- Size: ~15-25 MB (estimated)
