# DroidVibe Deployment Guide

## Prerequisites

- Node.js 20+, pnpm 9.12.0
- Java 17 (JDK)
- Android SDK with API 35, build-tools 35.0.0, CMake 3.22.1
- Docker (for backend deployment)
- A Turso/libSQL database account (for cloud sketches)

## 1. Backend Deployment

### Docker (Recommended)

```bash
# Build the Docker image
docker build -t droidvibe-web packages/web/

# Run with environment variables
docker run -d \
  -p 3001:3001 \
  -e TURSO_DATABASE_URL=libsql://your-db.turso.io \
  -e TURSO_AUTH_TOKEN=your-token \
  -e ARDUINO_CLI_PATH=/usr/bin/arduino-cli \
  --name droidvibe-web \
  droidvibe-web
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | HTTP port | 3001 |
| TURSO_DATABASE_URL | Turso database URL | (required for cloud features) |
| TURSO_AUTH_TOKEN | Turso auth token | (required for cloud features) |
| ARDUINO_CLI_PATH | Path to arduino-cli binary | /usr/local/bin/arduino-cli |

### Health Check

```bash
curl http://localhost:3001/health
```

## 2. Mobile App Build

### Debug APK (CI)

The CI pipeline automatically builds a debug APK on every push to main:

```bash
cd apps/mobile
pnpm exec expo prebuild --platform android --no-install --clean
cd android && ./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk
```

### Release APK (Signed)

Configure GitHub secrets for the release workflow:

| Secret | Description |
|--------|-------------|
| ANDROID_SIGNING_KEY | Base64-encoded keystore file |
| ANDROID_KEY_ALIAS | Keystore key alias |
| ANDROID_KEYSTORE_PASSWORD | Keystore password |
| ANDROID_KEY_PASSWORD | Key password |

Create a release:
```bash
git tag v1.0.0
git push origin v1.0.0
# release.yml workflow builds signed APK and creates GitHub release
```

### Generating PNG Assets

The app icon, splash screen, and adaptive icon are generated from SVG sources:

```bash
pnpm install  # ensures sharp is available
node scripts/generate-assets.js
# Generates: apps/mobile/assets/icon.png, splash.png, adaptive-icon.png
```

## 3. Google Play Store

See `docs/STORE_LISTING.md` for complete store listing metadata.

### Upload Steps

1. Build a signed release APK (or AAB)
2. Create a Google Play Console developer account ($25 one-time fee)
3. Create a new application with package `com.droidvibe.app`
4. Upload the signed APK/AAB
5. Fill in store listing from `docs/STORE_LISTING.md`
6. Set up internal testing track for initial rollout

## 4. CI/CD Pipeline

### CI Workflow (ci.yml)

Jobs run on every push to main:
1. **Quality** — TypeScript typecheck + ESLint
2. **Web Build** — Backend Docker build
3. **Unit Tests** — Shared package tests
4. **Prebuild** — Expo prebuild validation
5. **APK Build** — Debug APK via Gradle

### Release Workflow (release.yml)

Triggered by `v*` tags:
1. Builds signed release APK
2. Creates GitHub release with APK artifact

## 5. Configuration

### App Config (app.config.js)

- `newArchEnabled: true` — React Native new architecture
- `withKotlinVersion` plugin — patches Kotlin 1.9.25 + JVM target
- `minSdkVersion: 24` — Android 7.0+
- `targetSdkVersion: 35` — Android 15

### Backend API URL

Set `DROIDVIBE_API_URL` in app config extra or environment:
```javascript
// app.config.js
expo: { extra: { DROIDVIBE_API_URL: "https://api.droidvibe.app" } }
```

## 6. Troubleshooting

### Kotlin Compilation Error
Ensure `android.kotlinVersion=1.9.25` in gradle.properties (handled by config plugin + CI patch).

### NDK Version Mismatch
CI patches `ndkVersion` to `27.3.13750724` (pre-installed on ubuntu-latest).

### Missing PNG Assets
Run `node scripts/generate-assets.js` to generate icon/splash/adaptive-icon PNGs from SVG sources.

### USB Not Working in Expo Go
Native USB requires a custom dev/production build. Use `expo prebuild` + Gradle, not Expo Go.