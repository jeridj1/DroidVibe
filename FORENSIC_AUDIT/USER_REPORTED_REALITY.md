# Owner-Reported Reality and Product Target

This file records observations supplied by the DroidVibe owner. These are valuable test evidence, but they are NOT treated as independently verified until reproduced or supported by logs/source.

## Real-device DroidVibe observations

The owner has installed more than one DroidVibe APK on an Android phone and attempted the compile workflow.

An earlier APK produced a relatively large compiler/error message described by the owner as indicating the wrong source or an otherwise incorrect source/path target. The exact historical message was not preserved verbatim in this dossier, so auditors must not quote it as an exact error. Search GitHub history and source for the relevant compiler/path handling and, if possible, reproduce it.

A newer APK produces a much shorter error described approximately as `invalid relative system link target` (wording may not be exact). The owner reports that this happens during compile and appears to happen regardless of whether compatible hardware is connected. The owner suspects the error may be associated with one Arduino/toolchain target rather than USB hardware. This is a particularly important clue because a local compile should not require a physical board to be connected.

The owner reports that the newer APK is substantially smaller than the earlier APK. Auditors should determine whether this reflects an intentional toolchain packaging change, missing bundled assets, a different build variant, or something else.

The owner has also observed that the application can appear to detect or interact with a connected board to some degree, but the overall application currently does not provide the expected end-to-end useful behavior. The owner wants the basic workflow to be at least as dependable as a working Android Arduino IDE, while adding DroidVibe's intended advanced capabilities.

## Working reference baseline

The owner reports that the existing ArduinoDroid application available through Google Play works for the basic Android Arduino workflow. This should be treated as a practical baseline for expected user behavior, not proof of ArduinoDroid's internal implementation.

The current Google Play listing for ArduinoDroid advertises, among other things: sketch editing, examples/libraries, syntax highlighting, code completion, real-time diagnostics, file navigation, local compilation without root, USB uploading, Wi-Fi OTA for supported ESP boards, serial monitoring, offline operation, Library Manager, and cloud-drive integrations. The listing says SDKs are downloaded when a board is selected and then can operate without internet. It also states that the application is a third-party app rather than an official Arduino application.

Reference: https://play.google.com/store/apps/details?id=name.antonsmirnov.android.arduinodroid2
Reference app site: https://www.arduinodroid.app/

Auditors should compare DroidVibe's workflow and architecture against the observable capabilities of this working reference, especially:

- how board/toolchain packages are obtained and installed;
- how the app behaves before any board is connected;
- how compile and upload are separated;
- how serial monitoring is exposed;
- how offline operation is maintained after initial package installation;
- how errors are shown to the user;
- how USB permission and device detection are handled;
- how libraries and board definitions are managed;
- how large toolchains are packaged without making the application unusable.

Do not assume ArduinoDroid's implementation is technically superior. The point is to identify proven user-facing behavior and investigate which design choices are worth reproducing.

## Product target

The desired DroidVibe product is a phone-first Arduino development workstation. It should retain the practical basics that already work in a competent Android Arduino IDE:

- create/open/edit sketches;
- select a board;
- compile locally on the phone;
- install/manage required board packages and libraries;
- upload over USB where supported;
- monitor serial output;
- work offline after required packages are present;
- present useful compiler and hardware errors.

DroidVibe should then add capabilities that are materially beyond that baseline, including broader board/toolchain support, RP2040 tooling and logic analysis, deeper USB/device capabilities, AI assistance, and eventually programmer/debugger functionality such as SWD/JTAG where technically practical.

The product should not require a connected board merely to compile a sketch. Board connection is required for hardware operations, not for ordinary local compilation.

## Important interpretation rule

The approximate phrase `invalid relative system link target` must be investigated as a path/symlink/toolchain extraction clue, especially because the repository contains explicit root-relative symlink handling work in PR #122. Do not assume the wording is exact. Capture the exact current APK error if a reproduction is available.
