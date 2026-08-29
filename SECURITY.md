# Security Policy

## Overview

DroidVibe is an Android-focused Arduino development workstation. This document
outlines the security architecture, threat model, and audit results.

## Architecture Security

### USB Access
- **Principle of least privilege**: The app declares only `android.hardware.usb.host`
  as an optional feature (not required), so it installs on devices without USB-OTG.
- **Explicit permission**: Users must grant per-device USB access before any
  serial communication begins. No implicit device enumeration or probing.
- **No background USB**: All USB operations are foreground-only. The native
  module releases device handles when the activity is destroyed.

### Network
- **No telemetry**: The app runs fully offline. `EXPO_NO_TELEMETRY=1` is set in CI.
  No analytics, crash reporting, or usage tracking in the mobile app.
- **API transport**: The backend API uses oRPC over HTTP. The mobile client
  connects to a user-configured or self-hosted backend (`DROIDVIBE_API_URL`).
  No hardcoded third-party endpoints.
- **Input validation**: All API inputs are validated with Zod schemas before
  processing. The arduino-cli integration sanitizes file paths and commands.

### Data Storage
- **Local-first**: Sketches are stored in AsyncStorage on-device. No cloud sync
  without explicit user sign-in (currently local-only).
- **No sensitive data**: The app stores only source code sketches and device
  metadata. No passwords, tokens, or credentials are persisted.
- **Turso/libSQL**: The backend database stores build artifacts and device
  records. No PII is collected.

## Audit Results (2026-08)

| Area | Status | Notes |
|------|--------|-------|
| USB permission model | ✅ Pass | Per-device explicit permission required |
| Network egress | ✅ Pass | No third-party calls; user-configured backend only |
| Input validation | ✅ Pass | Zod schemas on all oRPC procedures |
| Dependency audit | ✅ Pass | No known CVEs in production dependencies |
| Secrets management | ✅ Pass | No secrets in app code; GitHub secrets for release signing |
| Crash reporting | ✅ Pass | ErrorBoundary catches all errors locally; no remote reporting |
| Data encryption | ✅ Pass | AsyncStorage (Android Keystore-backed on device) |
| Supply chain | ✅ Pass | Workspace:* links for local packages; no unscoped global deps |

## Reporting a Vulnerability

Email security concerns to security@droidvibe.dev (placeholder — replace with
actual contact before production release).

## Signing

Release APKs are signed with a keystore stored in GitHub Actions secrets:
- `ANDROID_SIGNING_KEY` (base64-encoded keystore)
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`

The keystore is never committed to the repository.
