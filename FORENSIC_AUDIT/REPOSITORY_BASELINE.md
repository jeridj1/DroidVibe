# Repository Baseline

Observed repository: `jeridj1/DroidVibe`
Default branch: `main`
Visibility: public
Repository size reported by GitHub: about 901 KB

## Stack observed

Expo SDK 52 / React Native 0.76.9
pnpm workspaces / Turborepo
Kotlin native USB module
Hono / oRPC / Turso / Drizzle
Expo Router
Arduino CLI based mobile toolchain
RP2040 logic-analyzer helper
GitHub Actions CI

## Root package configuration observed

Package name: `droidvibe`
Version: `1.0.0`
Package manager: `pnpm@9.12.0`
Node requirement: `>=20`
Expo override: `52.0.49`
expo-modules-core override: `2.2.3`
React Native override: `0.76.9`

## Workspace configuration

Packages are under `packages/*` and `apps/*`.

## CI baseline

The CI workflow includes typecheck/lint, web/backend build, tests, Expo prebuild validation, ARM64 Arduino toolchain construction, RP2040 logic-analyzer helper work, and Android APK assembly.

The Android build depends on the generated toolchain job completing successfully.

## Documentation discrepancy to investigate

The README has described the project as `Private` in its license/documentation wording while the GitHub repository itself is public. This is a documentation/policy discrepancy to verify, not a legal conclusion.

## Historical context worth investigating

The project has had a very large number of GitHub Actions runs, with many failures observed. Historical analysis should correlate failures by branch, commit, workflow job, and date rather than treating the aggregate failure count as a single defect.

Known earlier concerns include Android USB permission/native-module behavior on an S23, missing onboarding/upload pieces, logic-analyzer demo data, and an earlier suspected bad automated commit involving `branch.ps1`. These should be independently verified against Git history rather than assumed true.