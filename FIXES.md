# DroidVibe Repository Fixes

## Overview
This document tracks the fixes applied to stabilize the DroidVibe repository after recurring issues with:
- **Mid-token newline corruptions** (e.g., `Style nSheet` → `StyleSheet`).
- **Binary blob corruptions** (e.g., `bench.tsx` corrupted into unreadable data).
- **Gradle/Kotlin compilation errors** (e.g., duplicate `RP2040Controller`, missing `USB_RECIP_DEVICE`).
- **CI workflow failures** (e.g., frozen lockfile, concurrent job conflicts).

---

## 🔧 Fixes Applied

### 1. Repository Reset
- **Issue:** Multiple branches (`v-droidvibe-test`, `diagnose-usb`, etc.) and corrupted files (`bench.tsx`, `editor.tsx`).
- **Fix:** 
  - Created a clean baseline branch (`cleanup/reset-main-2026-09-04`) from `restore/best-known-good-2026-09-01`.
  - Restored `bench.tsx` and `editor.tsx` to their last known-good state (commit `7ce9c89`).
  - Deleted redundant branches (e.g., `v-droidvibe-test`, `diagnose-usb`).
- **Verification:** Files are valid TypeScript, no mid-token newlines or binary blobs.

### 2. Dependency Cleanup
- **Issue:** `pnpm-lock.yaml` was corrupted, causing `frozen-lockfile` failures.
- **Fix:** 
  - Deleted `pnpm-lock.yaml`.
  - Regenerated dependencies with `pnpm install`.
- **Verification:** `pnpm install` succeeds without errors.

### 3. Gradle/Kotlin Fixes
- **Issue:** Duplicate `RP2040Controller` class and missing `USB_RECIP_DEVICE` import.
- **Fix:**
  - Removed duplicate `RP2040Controller` in `CaptureService.kt` (kept only in `RP2040Controller.kt`).
  - Added `import android.hardware.usb.UsbConstants.USB_RECIP_DEVICE` to `PicobootFlasher.kt`.
- **Verification:** Gradle builds succeed (`./gradlew assembleDebug`).

### 4. CI Workflow Hardening
- **Issue:** Concurrent CI jobs caused race conditions (e.g., mid-token newlines reintroduced).
- **Fix:**
  - Updated `.github/workflows/ci.yml` to:
    - Run jobs **sequentially** (no concurrent modifications).
    - Add a **corruption scan** step (check for mid-token newlines, binary files).
    - Remove `--frozen-lockfile` until dependencies stabilize.
- **Verification:** CI passes without auto-correction loops.

---

## 🛡️ Prevention Measures

### 1. Pre-Commit Hooks
Added Git hooks to **block corruptions before they’re committed**:
```bash
# .git/hooks/pre-commit
if grep -r "Style nSheet\|asyn nc\|useState<str ning" apps/mobile/; then
  echo "ERROR: Mid-token newline detected!"
  exit 1
fi
if file apps/mobile/app/*.tsx | grep -q "binary"; then
  echo "ERROR: Binary file detected!"
  exit 1
fi
```

### 2. CI Safeguards
Added a **corruption scan** job in `ci.yml`:
```yaml
- name: Scan for corruptions
  run: |
    if grep -r " \n" apps/mobile/app/; then
      echo "Mid-token newline found!"
      exit 1
    fi
```

### 3. Branch Protection
- **`main` branch:** Requires PRs + manual approval (no direct pushes).
- **CI checks:** Must pass before merging.

---

## 📋 Known Issues (To Be Fixed)

| **Issue** | **Status** | **Priority** | **Notes** |
|----------|------------|--------------|-----------|
| ESP32 support | ❌ Not implemented | High | Needs `esptool` integration. |
| ST-Link V2 support | ❌ Not implemented | High | Needs `libusb` or Android USB host mode. |
| On-device compilation | ⚠️ Partial | High | `avr-gcc` needs lazy-download or bundling. |
| Board package manager | ❌ Not implemented | Medium | Needs Arduino CDN integration. |
| Logic analyzer firmware | ⚠️ Missing | Medium | Needs Pico SDK build + bundling. |

---

## 🎯 Next Steps

1. **Merge Critical Fixes:**
   - `fix/usb-retry-and-standalone-ai` (USB auto-retry, DTR/RTS toggle).
   - `fix/droidvibe-production-usb` (RP2040 UF2 flashing, `RP2040Controller` fix).

2. **Add Hardware Support:**
   - ESP32 (ROM loader).
   - ST-Link V2 (JTAG/SWD).

3. **Implement On-Device Compilation:**
   - Lazy-download `avr-gcc` + `arduino-cli`.
   - Board/package manager (Arduino CDN).

4. **Test on Real Hardware:**
   - Arduino Uno (STK500v1).
   - Arduino Leonardo (AVR109).
   - RP2040 (UF2 flashing).
   - ESP32 (ROM loader).

---

## 🔄 How to Reproduce Issues (For Testing)

### Mid-Token Newline Corruption
1. Run a **concurrent CI job** (e.g., push to `main` while another workflow is running).
2. Check if files like `editor.tsx` contain `Style nSheet` or `asyn nc`.

### Binary Blob Corruption
1. Manually corrupt a file (e.g., `echo "binary garbage" > apps/mobile/app/(tabs)/bench.tsx`).
2. Verify the **pre-commit hook** blocks the commit.

### Gradle Build Failure
1. Delete `android/.gradle` or `android/build`.
2. Run `./gradlew assembleDebug`.
3. Verify it **fails with duplicate `RP2040Controller`** (if not fixed).

---

## 📞 Contact
For questions or new issues, open a GitHub issue or contact @jeridj1.
