# Known High-Value Failure Evidence

## Actions run 34722004569

Run number: 4355
Workflow: CI
Event: pull_request
Branch: `fix/android-toolchain-symlink-resolution-main`
Head SHA: `087b9ef5c2cb0480224642a0592a498fe4b2e940`
Conclusion: failure

Jobs observed:

Typecheck and Lint: success
Build Web Backend: success
Unit Tests: success
Expo Prebuild Validation: success
Build ARM64 Arduino Toolchain: failure
Build Android APK: skipped

The failed toolchain job successfully installed the Arduino AVR, megaAVR, and RP2040/RP2350 cores; verified ARM64 proot; compiled Uno, Mega, and RP2040 test sketches; printed `LOCAL_TOOLCHAIN_PRROOT_TEST_OK`; and reported Arduino CLI version 1.5.1 and the proot SHA256.

The failure occurred afterward at the host-side permission change:

`chmod: changing permissions of '/home/runner/work/_temp/droidvibe-assets/droidvibe-toolchain-rootfs.tar.gz': Operation not permitted`

This means the failure was not caused by the earlier Arduino/proot self-tests in this run. The archive had been produced inside a Docker container and the host runner then attempted to change its permissions.

## Toolchain script observation

`scripts/build-mobile-toolchain.sh` creates the ARM64 Debian rootfs in Docker, creates the compressed rootfs archive, verifies it, then performs a host-side `chmod 0644` on the archive before splitting it into 128 MiB pieces. It later applies another host-side chmod loop to the split pieces.

These permission-changing steps are therefore directly relevant to the observed failure.

## Forensic interpretation

Classification: VERIFIED for the exact failure sequence above.

Likely significance: HIGH. The Android APK job was skipped because the toolchain job failed, so this single CI failure blocks the downstream Android artifact in this run.

Do not infer from this evidence alone that PR #122 fixes the problem. Verify the actual branch contents and run a fresh CI build.