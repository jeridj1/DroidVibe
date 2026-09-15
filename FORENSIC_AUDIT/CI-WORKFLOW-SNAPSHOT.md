# CI workflow snapshot from main

Source path: `.github/workflows/ci.yml`
Source blob SHA: `ce8d7ad8c31a638dc231bcedc498542fa2e851ba`

The workflow triggers on pushes to `main`, pull requests to `main`, and manual dispatch. It uses concurrency group `ci-main` with cancel-in-progress.

Permissions are `contents: read` and `issues: write`.

The quality job uses pnpm 9.12.0 and Node twenty-two, but installs with `pnpm install --no-frozen-lockfile`. It runs typecheck and lint and can create a GitHub issue containing typecheck output.

Web build and unit-test jobs depend on quality and also use `--no-frozen-lockfile`.

Mobile prebuild validates Expo prebuild on Ubuntu and generates PNG assets with a temporary `sharp` install.

The ARM64 toolchain job runs on `ubuntu-24.04-arm`. It executes `scripts/build-mobile-toolchain.sh`, verifies the proot binary and chunked rootfs parts, and uploads them as the `droidvibe-local-toolchain` artifact.

The Android APK job runs on Ubuntu and depends on both mobile prebuild and toolchain. It installs Java seventeen, restores a Gradle cache, installs dependencies with `--no-frozen-lockfile`, generates assets again, performs a fresh Expo prebuild, downloads the ARM64 toolchain artifact into Android assets, builds the RP2040 logic-analyzer helper with Pico SDK version `2.1.1`, generates a TypeScript base64 firmware asset, patches Android Gradle configuration with shell `sed`, installs the latest React Native CLI package dynamically with `pnpm add -D @react-native-community/cli@latest`, bundles JavaScript manually, and runs `./gradlew assembleDebug`.

The build job uploads the debug APK and can create a GitHub issue containing bundle output and the last one hundred Android build-output lines.

## Audit targets suggested by this workflow

Determine whether mutable dependency installation (`--no-frozen-lockfile` and `@latest`) undermines reproducibility.

Determine whether the prebuild validation job and APK job can produce different native projects because the APK job regenerates the project independently.

Determine whether shell patching of generated Gradle files is robust across Expo/RN upgrades.

Determine whether the toolchain artifact is guaranteed to be complete, correctly ordered, and usable by Android asset extraction.

Determine whether embedding a complete ARM64 Debian/Arduino toolchain plus base64 firmware in the APK creates practical size/storage/performance problems.

Determine whether the RP2040 helper firmware generated during CI is guaranteed to correspond to the mobile code expecting it.

Determine whether the release workflow has stronger reproducibility and signing controls than the debug pipeline.
