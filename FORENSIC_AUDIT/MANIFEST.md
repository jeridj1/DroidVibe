# Forensic audit evidence manifest

Collection purpose: provide multiple independent AIs with the same public, read-only starting dossier for DroidVibe without requiring repeated ZIP uploads or GitHub write access.

Repository: `jeridj1/DroidVibe`
Default branch: `main`
Evidence branch: `forensic-audit/evidence`
Baseline main SHA at collection: `fb41dd2bcc76aa1bd55a0bbc0c989b90bb34461f`
Known relevant PR: #122
Known failed workflow run: `34722004569`, job `103629714317`

## Included

`README.md` explains how to use the dossier.

`AUDIT_PROMPT.md` is the full reusable investigation prompt.

`REPOSITORY_BASELINE.md` records baseline project facts.

`SOURCE_MAP.md` identifies high-value source paths and what to inspect there.

`KEY_SOURCE_SNAPSHOTS.md` exposes critical implementation details for AIs with limited repository browsing.

`CI-RUN-34722004569.md` preserves the important failure sequence from the ARM64 toolchain job.

`KNOWN_FAILURES.md` and `PR-122-EVIDENCE.md` preserve earlier high-value observations.

`USER_REPORTED_REALITY.md` records real-world test observations and product goals supplied by the owner. These are explicitly labeled as unverified until independently reproduced.

## What is intentionally not included

No passwords, API keys, access tokens, signing keys, private credentials, private user data, or environment secrets.

No binary APK or giant toolchain archive is required for the independent source audit. The live public repository and its public GitHub Actions artifacts/history should be inspected when accessible.

## Evidence philosophy

This bundle is deliberately curated rather than a second copy of the entire repository. Duplicating all source would create stale evidence as soon as main changes. Instead, this branch preserves ephemeral/high-value observations and provides enough source context to guide an independent reviewer toward the live implementation.

A reviewer should record the exact main commit, branch, PR, workflow run, and external-source versions used for their own report.

## Important product context

DroidVibe is intended to be a practical Android Arduino workstation. The existing Arduino Android app available through the Play Store is reported by the owner to work for the basic workflow. The investigation should therefore focus on making DroidVibe equally practical at its core while determining whether its additional local/offline compilation, broader USB flashing, RP2040 logic analyzer, AI, and advanced programmer/debugger goals are implemented reliably and worth their complexity.
