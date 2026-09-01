# DroidVibe v1.0.0

## What's New

### Routing Fix (PR #47)
- Fixed "Unmatched Route" error on app launch
- Added `app/index.tsx` redirect component (onboarding for first run, editor for returning users)

### Professional App Icon (PR #48)
- Original "Signal Chip" design: dark IC chip + glowing heartbeat waveform
- Arduino teal gradient (#00979D → #00565B)
- Updated icon, adaptive icon, and splash screen SVGs

### Editor Layout & AI Settings (PR #49)
- Editor header restructured: board picker row + wrapping toolbar (fixes off-screen buttons on phones)
- "Verify" button relabeled to "Compile"
- Output panel AI buttons wrapped with flexWrap
- New "AI & Backend" settings section: backend URL, Mistral model picker, API key
- New `appConfig.ts` module for AsyncStorage-based configuration
- `api.ts` now reads user-configured backend URL
- "Sign in" button added (coming soon)

## Install

Download the APK from the GitHub Releases page and install on your Android device.
