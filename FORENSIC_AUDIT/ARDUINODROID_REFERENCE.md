# ArduinoDroid Working Reference

This is a reference point for user-facing behavior, not an endorsement and not an assumption that DroidVibe should copy its implementation.

## Current public listing

Application: ArduinoDroid - Arduino/ESP IDE
Google Play package: `name.antonsmirnov.android.arduinodroid2`

Google Play: https://play.google.com/store/apps/details?id=name.antonsmirnov.android.arduinodroid2
App site: https://www.arduinodroid.app/

The current Google Play listing describes ArduinoDroid as a third-party Android Arduino/ESP development environment. It advertises sketch editing, examples and libraries, syntax highlighting, code completion, real-time diagnostics, file navigation, local compilation without root, USB upload, Wi-Fi OTA for supported ESP boards, serial monitoring, offline operation, on-device AI, Library Manager, and cloud-drive integrations. It says board SDKs are downloaded when the board is selected and can then be used without internet.

The listing explicitly states that the application is not an official Arduino-team application.

## Why this matters to DroidVibe

DroidVibe should be evaluated against the basic user workflow that a working Android Arduino environment already demonstrates:

1. Start the app without hardware connected.
2. Open or create a sketch.
3. Select the intended board/target.
4. Ensure the required compiler/core/tool package exists, downloading it if necessary.
5. Compile locally without requiring a board connection.
6. Show actionable compiler diagnostics.
7. Connect a board over Android USB host/OTG.
8. Request and retain USB permission correctly.
9. Upload the already-built firmware using the correct protocol for that board.
10. Reconnect/re-enumerate the device when bootloader mode changes its USB identity.
11. Provide serial monitoring independently of compilation.
12. Continue working offline once required packages are installed.

The most important architectural lesson is the separation of concerns. Compilation, package management, USB detection, upload, and serial monitoring are related but should not be so tightly coupled that a missing USB device prevents compilation.

## Specific investigation questions

Auditors should determine whether DroidVibe currently has a similarly complete path or whether it has UI screens whose backend/native/toolchain pieces are incomplete.

Investigate whether DroidVibe's local compiler should behave more like a persistent installed SDK/toolchain manager rather than treating the entire compiler as an opaque APK asset extraction step.

Investigate whether board selection should own a package manifest containing the exact core version, compiler tools, uploader tools, and required libraries, with explicit installed/not-installed/offline-ready states.

Investigate whether compile errors should expose the raw compiler output plus a concise human-readable summary, rather than replacing the useful diagnostic with a generic path/extraction error.

Investigate whether USB upload should operate on a compiled artifact produced independently of the editor/compiler subsystem.

## Important caution

The public ArduinoDroid listing is evidence of advertised behavior, not proof of internal design quality. A reviewer must not infer its implementation merely from the feature list. If implementation details are needed, research the application's official documentation, release notes, public technical material, or other lawful public sources and label conclusions appropriately.
