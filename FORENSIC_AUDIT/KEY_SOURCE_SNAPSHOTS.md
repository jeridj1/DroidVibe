# Key Source Snapshots

These are compact observations from the baseline source. They are navigation clues, not substitutes for reading the live files.

## Root package

Observed root `package.json`:

- name: `droidvibe`
- version: `1.0.0`
- private: `true`
- package manager: `pnpm@9.12.0`
- Node requirement: `>=20`
- Turborepo: `^2.3.3`
- TypeScript: `^5.6.3`
- Prettier: `^3.3.3`
- pnpm overrides pin Expo `52.0.49`, `expo-modules-core 2.2.3`, and React Native `0.76.9`.

## Workspace

`pnpm-workspace.yaml` uses `packages/*` and `apps/*`.

`turbo.json` defines build/lint/typecheck/test tasks. Build outputs include `dist/**`, `build/**`, and `.expo/**`; dev is persistent and uncached.

## CI dependency installation

The observed CI jobs use `pnpm install --no-frozen-lockfile`. Reviewers should determine whether a lockfile exists and whether this undermines reproducibility.

## ARM64 toolchain construction

`scripts/build-mobile-toolchain.sh` creates an ARM64 Debian rootfs, installs Python and Arduino CLI 1.5.1, installs AVR/megaAVR/RP2040 cores, obtains static ARM64 proot, runs compilation self-tests, creates a compressed rootfs archive in Docker, verifies it, then splits it into 128 MiB parts.

The historical version observed in the known failed run performed host-side:

`chmod 0644 "$ARCHIVE"`

then `split`, removed the unsplit archive, and chmoded the split parts. The Docker-created archive triggered `Operation not permitted` on that host-side chmod.

PR #122 removes those chmod operations.

## Toolchain self-test evidence

Known failed CI run `34722004569` successfully compiled:

- an AVR Uno test;
- a megaAVR test;
- an RP2040 test.

It printed `LOCAL_TOOLCHAIN_PRROOT_TEST_OK` before the later packaging failure.

This separates at least one CI packaging defect from the earlier compiler construction/self-test path.

## PR #122 symlink work

PR #122 changes Android LocalToolchain extraction so root-relative targets such as `/bin/...`, `/usr/...`, `/opt/...`, and other recognized top-level system paths are resolved against the extracted toolchain root while ordinary relative links remain relative. It validates the resulting target remains under the rootfs.

The reviewer must inspect the actual diff and test edge cases rather than trusting this summary.

## Current owner clue

The owner reports a newer APK error approximately resembling `invalid relative system link target`. This wording is not exact and is preserved separately in `CURRENT_DEVICE_ERROR.md`.

Because PR #122 specifically modifies root-relative symlink handling, this is a high-priority investigation target.

## Product separation that should exist

Compilation should be possible without a board connected. USB enumeration/permission/upload/serial operations should be separate hardware stages. A missing board should not cause a local compiler/toolchain extraction error.

## Working reference

ArduinoDroid's current public Play listing advertises local compilation without root, USB upload, serial monitoring, offline operation after required SDKs are downloaded, board/library management, and diagnostics. See `ARDUINODROID_REFERENCE.md` for the reference links and comparison questions.
