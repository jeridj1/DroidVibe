# Current On-Device Compile Error Clue

## Owner report

The owner reports that the newest DroidVibe APK reaches the compile path but now produces a short error approximately resembling:

`invalid relative system link target`

The wording above is NOT guaranteed to be exact. It is preserved as an approximate clue because the exact device log was not captured in the conversation.

The owner says the error occurs regardless of whether hardware is connected. That makes a USB upload/device-detection failure an unlikely direct explanation for this particular compile-time error. A physical board should not be necessary for local compilation.

## Why this is unusually relevant

The repository contains recent work specifically addressing root-relative symlinks in the extracted Android toolchain. PR #122 describes a previous on-device compile failure in which `ld.bfd` resolved a root-relative toolchain link incorrectly, producing a path resembling:

`avr/bin/opt/droidvibe/...`

The same PR also removes host-side `chmod` operations that can fail after Docker creates the archive on the CI runner.

Therefore the current short error should be investigated as a possible continuation of the toolchain/symlink problem, not automatically as a board-selection or USB problem.

## Questions an auditor should answer

Determine the exact source of the current `invalid relative system link target`-like message.

Determine whether it originates in Kotlin extraction code, archive inspection, symlink validation, proot, the Linux loader/linker, Arduino CLI, or a wrapped user-facing error.

Determine which exact symlink target is being rejected, its stored target string, its containing directory, and the expected resolved location.

Determine whether PR #122's root-relative classification recognizes that target and whether its security validation can reject a valid toolchain link.

Determine whether the APK contains the expected toolchain archive/parts and whether the newer, smaller APK is missing or excluding assets.

Determine whether the toolchain is extracted once and reused, or rebuilt/re-extracted for each compile.

Determine whether the app can compile a trivial Uno sketch with no board connected. This is a critical acceptance test.

Determine whether selecting a board before connecting hardware changes only compilation target configuration or incorrectly gates compilation on USB state.

## Minimum reproduction to request from the owner

If a physical test is available, capture the complete raw compile error from the newest APK, including all lines before and after the short message. Also capture:

- selected board/FQBN;
- sketch name;
- whether the board is connected;
- whether toolchain installation completed;
- free internal storage before compile;
- exact APK version/build identifier;
- whether this is the first compile after installation;
- whether the same sketch compiles in ArduinoDroid on the same phone.

Do not require all of these before investigating the repository. They simply turn the current clue into reproducible evidence.
