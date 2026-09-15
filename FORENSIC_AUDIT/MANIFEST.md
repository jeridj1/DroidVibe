# Forensic Evidence Manifest

## Purpose

This branch is a public, read-only-oriented evidence room for independent AI review of DroidVibe. It deliberately does not duplicate the entire source tree.

## Source of truth

Current source: `main` at baseline SHA `fb41dd2bcc76aa1bd55a0bbc0c989b90bb34461f` at the time this dossier was started.

Current live repository and later commits may differ. Reviewers must inspect the live repository and relevant history.

## Included evidence

`README.md` — how to use the dossier and its scope.

`AUDIT_PROMPT.md` — full independent fine-tooth-comb audit instructions.

`AI_ACCESS_GUIDE.md` — guidance for AI systems with different GitHub browsing abilities.

`REPOSITORY_BASELINE.md` — baseline stack, configuration, and known discrepancies.

`SOURCE_MAP.md` — high-value source navigation.

`KEY_SOURCE_SNAPSHOTS.md` — selected critical configuration and implementation facts.

`USER_REPORTED_REALITY.md` — owner-reported device behavior and desired product behavior, explicitly unverified until independently reproduced.

`CURRENT_DEVICE_ERROR.md` — approximate current on-device compile error and the symlink/toolchain investigation path it suggests.

`ARDUINODROID_REFERENCE.md` — public working-reference behavior from the current ArduinoDroid Google Play listing and app site.

`CI-RUN-34722004569.md` — preserved failure sequence from the known ARM64 toolchain CI run.

`PR-122-EVIDENCE.md` — evidence about PR #122's proposed toolchain/symlink and chmod fixes.

`KNOWN_FAILURES.md` — previously identified high-value issues/hypotheses.

`REPORT_TEMPLATE.md` — standardized output structure for comparing independent AI reports.

## Intentionally not included

No passwords, access tokens, GitHub secrets, signing keys, private account information, private source, or environment secrets.

No complete binary APK archive is embedded here merely for size. If a reviewer needs a historical artifact and can access it safely, inspect the corresponding GitHub Actions artifact metadata/download through GitHub.

No complete duplicate of the public repository is embedded. The repository itself is public and should be inspected directly so the evidence does not become an obsolete fork of the source.

No claim that owner-reported behavior has been reproduced.

No claim that PR #122 is correct merely because it exists.

## High-value live evidence that should still be inspected

All current source under `apps/`, `packages/`, `scripts/`, and native Android directories.

All workflows under `.github/workflows/`.

All relevant branches and tags.

All open and closed PRs and their review comments.

Relevant issues.

Historical Actions runs, jobs, logs, artifacts, and failure families.

Recent and suspicious Git commits, including any `branch.ps1` history.

Current release/signing/versioning configuration.

External primary documentation for Android USB host APIs, Expo Modules, Arduino CLI, board cores, RP2040 tooling, and other critical dependencies.

## Evidence philosophy

Preserve ephemeral or difficult-to-query facts here. Do not create a giant stale copy of everything. Every reviewer should be able to reproduce or challenge a dossier claim from the public repository wherever possible.
