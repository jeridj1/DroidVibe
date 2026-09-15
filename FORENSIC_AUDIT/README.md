# DroidVibe Forensic Audit Evidence

This directory is the shared public evidence room for independent AI/software-engineering audits of DroidVibe.

## How this is meant to be used

An outside AI should start with `AUDIT_PROMPT.md`, then read the other dossier files and independently inspect the live public repository. The evidence branch is intentionally separate from `main` and contains evidence/documentation only. It is not a proposed application-code change.

The live repository is the source of truth for current code. The dossier exists mainly to preserve hard-to-find context, ephemeral CI evidence, owner-reported test observations, critical source navigation, and a standardized audit method.

## Collection baseline

Repository: `jeridj1/DroidVibe`

Default branch: `main`

Evidence branch: `forensic-audit/evidence`

Visibility: public

Collection baseline main SHA: `fb41dd2bcc76aa1bd55a0bbc0c989b90bb34461f`

Known failed Actions run: `34722004569` (run number 4355), failed job `103629714317`

Known relevant PR: #122

## Dossier contents

`AUDIT_PROMPT.md` is the full fine-tooth-comb investigation prompt. It requires independent verification, confidence classification, exact evidence references, end-to-end feature tracing, CI/history analysis, security review, and research into better implementation approaches.

`MANIFEST.md` explains what is and is not intentionally included.

`REPOSITORY_BASELINE.md` records the baseline stack and known discrepancies.

`SOURCE_MAP.md` points reviewers toward the highest-value native Android, mobile, shared, backend, firmware, and CI files.

`KEY_SOURCE_SNAPSHOTS.md` exposes critical implementation details for AIs whose GitHub browsing is limited.

`CI-RUN-34722004569.md` preserves the important failed-toolchain sequence, including the successful ARM64/proot compilation self-test followed by the archive chmod failure.

`USER_REPORTED_REALITY.md` records the owner's real-device observations and product target. Those observations are explicitly labeled as unverified until independently reproduced.

`KNOWN_FAILURES.md` and `PR-122-EVIDENCE.md` preserve earlier high-value findings about the toolchain and proposed fix.

`REPORT_TEMPLATE.md` gives reviewers a common report format so multiple independent AI reports can be compared later.

## Product target

The goal is not merely a green CI badge or an APK that installs. DroidVibe is intended to be a practical Android Arduino workstation. The owner reports that the existing Arduino app available from the Play Store works for the basic workflow; DroidVibe is intended to retain that practicality while adding local/offline compilation, broader USB flashing and serial support, RP2040 logic-analyzer capability, AI assistance, and eventually deeper programmer/debugger functions.

## Public-data warning

Everything in this directory is public. Never put passwords, API keys, access tokens, signing keys, private user information, or environment secrets here.

## Important limitation

This is not a full source archive or complete Git history dump. That is deliberate. A giant duplicate source archive becomes stale. Reviewers should inspect all relevant current source, branches, tags, commits, pull requests, issues, Actions runs/logs/artifacts, and external primary documentation that they can access.
