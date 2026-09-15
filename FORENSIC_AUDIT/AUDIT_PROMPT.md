# Independent DroidVibe Forensic Audit Prompt

You are an independent forensic software engineer, Android engineer, build/release engineer, and embedded-tooling reviewer auditing the public GitHub repository `jeridj1/DroidVibe`.

This is a SECOND-OPINION investigation. Do not assume previous AI conclusions, developer claims, PR descriptions, or this evidence bundle are correct. Verify them against the live repository and history.

## Rules

READ-ONLY. Do not modify the repository, create commits, open/merge PRs, change settings, run destructive commands, use credentials, or attempt exploitation against real systems.

The public repository is the source of truth for source code. `FORENSIC_AUDIT/` is a curated starting dossier, including some ephemeral CI/history evidence that is otherwise inconvenient to inspect.

Separate facts from inference. Never call something fixed merely because a PR says it is fixed.

For every substantive finding use exactly one confidence class: VERIFIED, STRONGLY INDICATED, POSSIBLE, or SPECULATIVE.

Cite exact repository paths, commit SHAs, PR numbers, workflow run IDs, job IDs, log excerpts, and external primary sources whenever possible. Include line numbers when your browsing interface supplies them.

## Mission

Determine what DroidVibe is supposed to be, what is actually implemented, what actually works, what is only UI scaffolding, what is broken, what is unnecessarily complicated, and what architecture would produce the most reliable phone-first Arduino workstation.

The target is not merely “make CI green.” The target is a genuinely useful Android Arduino development environment that retains the practical strengths of the working Arduino-on-Android experience while adding DroidVibe's intended extra capabilities.

## First read

Read these files in `FORENSIC_AUDIT/` before starting:

`README.md`
`AUDIT_PROMPT.md`
`REPOSITORY_BASELINE.md`
`KNOWN_FAILURES.md`
`PR-122-EVIDENCE.md`
`CI-RUN-34722004569.md`
`USER_REPORTED_REALITY.md`
`SOURCE_MAP.md`
`KEY_SOURCE_SNAPSHOTS.md`

Then inspect the live repository, not just these summaries.

## Phase one: reconstruct the project

Map the complete repository tree. Identify apps, packages, firmware, scripts, documentation, tests, generated files, native modules, backend services, database code, configuration, and build outputs.

Identify the actual dependency graph. Determine which packages are used by mobile, web, native Android, firmware, and CI.

Compare README claims against implementation. Mark every important mismatch.

Determine whether a lockfile exists and whether CI/builds actually honor it.

Determine the exact Expo SDK, React Native, Kotlin, Gradle, Android SDK, Node, pnpm, Java, and other material versions from source rather than trusting README text.

## Phase two: trace real user workflows end to end

For each major feature, trace the complete path from UI action to TypeScript state/orchestration to native module/backend to actual hardware/tool operation and back to visible success/failure.

At minimum trace:

Sketch creation/open/save/delete.

Editor changes and persistence.

Local compile.

Backend compile.

Board/FQBN selection.

USB enumeration.

Android USB permission request and persistence.

Serial open/read/write/close.

AVR upload.

ESP upload.

RP2040 UF2/PICOBOOT upload.

RP2040 BOOTSEL detection and transitions.

Logic-analyzer helper firmware installation.

Logic-analyzer capture and waveform rendering.

SWD/JTAG paths.

Board-manager index/core installation.

Offline behavior.

AI features.

Settings and backend configuration.

Error/diagnostic display.

Onboarding and first-run behavior.

For each, explicitly say whether it is real, partial, simulated/demo-only, unreachable, dependent on Expo Go versus custom APK, dependent on network access, or otherwise blocked.

## Phase three: Android/native forensic audit

Inspect every Kotlin/Java native source file under the native module.

Audit Android USB APIs, permission PendingIntents, broadcast receiver lifecycle, device IDs, interface selection, endpoint selection, concurrent access, thread safety, blocking I/O, timeouts, cancellation, detach handling, reconnect behavior, permission denial, device disappearance, and cleanup.

Audit CDC-ACM, CH340, CP210x, FTDI, and any other advertised serial support against actual implementation.

Audit every upload protocol implementation for protocol correctness, reset/bootloader entry, baud assumptions, timeouts, retries, verification, and behavior after USB re-enumeration.

Audit RP2040 PICOBOOT, UF2, BOOTSEL, SWD, JTAG, and logic-analyzer implementation separately. Do not assume that having a method with the right name means the feature works.

Inspect Expo Modules API registration and whether generated Android projects actually include the native module in the APK.

Check package names, namespaces, manifests, permissions, exported/non-exported receivers, Gradle configuration, generated-source behavior, ABI assumptions, and Android version compatibility.

## Phase four: local compiler/toolchain forensic audit

Inspect `scripts/build-mobile-toolchain.sh` and `LocalToolchain.kt` together as one system.

Understand exactly how Debian rootfs, Arduino CLI, board cores, Python, proot, archives, symlinks, hard links, permissions, Android assets, extraction, and `/work` binding interact.

Audit archive path traversal protection, symlink traversal, hard-link safety, absolute versus root-relative versus ordinary relative symlinks, ordering dependencies, missing targets, filesystem support, executable bits, read/write permissions, and Android filesystem behavior.

Audit chunked asset concatenation, asset ordering, archive splitting/reassembly, APK packaging, APK size, extraction time, storage requirements, and failure recovery.

Determine exactly which Arduino cores and tool versions are embedded and whether they cover the boards the UI advertises.

Determine whether board-manager operations are genuinely useful offline or unexpectedly require network access.

Inspect whether local compilation can safely run multiple jobs, whether output directories collide, whether cleanup can race, and whether process cancellation is real.

Pay particular attention to the current `compile()` process handling: it reads the entire merged process stream before invoking the timeout `waitFor()`. Determine whether this can cause a hang that bypasses the intended timeout. If you think it cannot, explain why.

Audit firmware artifact discovery. Determine whether selecting the largest `.hex`, `.bin`, or `.uf2` is safe for every supported build or could select the wrong file.

## Phase five: CI/CD forensic audit

Inspect every workflow, not only CI.

Audit triggers, concurrency, permissions, runner OS/architecture, Node runtime versions, dependency installation mode, caches, generated files, artifact boundaries, artifact retention, job dependencies, shell behavior, environment variables, ownership/permissions, Docker mounts, archive creation, and release signing.

Trace the exact known failed run `34722004569` and job `103629714317`.

The important observed fact is that the ARM64 toolchain self-test reached `LOCAL_TOOLCHAIN_PRROOT_TEST_OK`, successfully compiled Uno, Mega, and RP2040 test sketches, and then failed later at host-side `chmod` on the Docker-created archive. Explain what this proves and what it does not prove.

Inspect PR #122 independently. Determine whether its removal of the host-side chmod commands addresses the exact failure and whether its symlink logic actually covers the failure described in the PR. Look for edge cases in the proposed symlink classification.

Do not stop at PR #122. Search earlier and later workflow failures to identify recurring failure families and regressions. Measure failure patterns where possible.

Inspect whether CI's Android build job rebuilds or regenerates files after validation in ways that can produce a different result. Inspect generated RP2040 firmware embedding and JavaScript bundling.

Inspect release workflow, signing, versioning, tags, artifacts, and whether a reproducible installable APK is actually produced.

## Phase six: Git/history forensic audit

Inspect recent commits, all relevant branches, open/closed PRs, merge commits, review comments, issues, and workflow history.

Look for:

stale branches;

reverted changes;

duplicate fixes;

fix-after-fix chains;

changes that solve symptoms but leave root causes;

files repeatedly rewritten by automation;

generated-file churn;

unexpected commits;

suspicious or malformed files;

large changes with tiny commit messages;

changes that appear unrelated to the claimed goal;

code present in one branch but absent in main;

PR descriptions that no longer match the code.

The owner has reported suspected automated corruption involving `branch.ps1` after a URL-fetch failure. Treat this as a hypothesis. Search Git history for the file, suspicious commits, content anomalies, timing, authorship, and surrounding automation. Do not assert causality without evidence.

## Phase seven: dependency/configuration audit

Check all package manifests, overrides, lockfiles, TypeScript configs, Expo config, Metro/Babel config, Android Gradle files, native-module Gradle configuration, scripts, environment handling, and workspace configuration.

Look for incompatible or unnecessarily pinned versions, overrides hiding incompatibilities, mutable `@latest` installs inside CI, `--no-frozen-lockfile`, generated configuration patched with `sed`, duplicate version declarations, and assumptions about runner images.

Flag anything that makes a build non-reproducible.

## Phase eight: backend/database/API audit

Inspect Hono/oRPC endpoints, authentication/trust boundaries, compile service, board data, AI endpoints, sketch storage, Turso/Drizzle, error handling, validation, and offline/cloud separation.

Determine whether the backend is required for features that are supposed to work offline.

Check whether local and backend compilation use the same board definitions, compiler versions, flags, libraries, and diagnostic formats. Identify divergence.

## Phase nine: security audit

Audit all trust boundaries without attacking real systems.

Pay special attention to:

archive extraction;

symlink and hard-link creation;

user-controlled sketch paths;

FQBN and command arguments;

shell/process invocation;

downloaded binaries and version pinning;

remote board indexes;

AI/backend URLs;

API keys and secrets handling;

GitHub tokens in CI;

release signing;

APK assets;

USB device input;

base64 decoding and size limits.

Distinguish a theoretical hardening opportunity from an actual exploitable defect.

## Phase ten: research better approaches

Do not merely find bugs. Research better ways to build the system.

Use primary official documentation and high-quality technical sources. Cite them.

Consider whether DroidVibe should keep the current proot/rootfs model, simplify it, change how toolchains are packaged, split toolchains by board family, use a different Android-compatible execution model, or use another architecture entirely.

Consider alternatives for USB serial, flashing, Arduino CLI, board packages, RP2040 tooling, ESP flashing, AVR flashing, SWD/JTAG, logic analysis, local databases, offline package management, and AI integration.

Compare options by reliability on Android, offline capability, APK/storage size, implementation complexity, performance, licensing, maintainability, device compatibility, and ability to run without root.

Consider the possibility that some features should be native Android/Kotlin, some TypeScript, and some external helper binaries or firmware.

Consider whether an Arduino-IDE-like experience should have a simpler core architecture with optional advanced subsystems rather than one tightly coupled stack.

Generate genuinely new ideas. It is acceptable to recommend replacing a subsystem if that is materially better, but prove the reason.

## Required finding format

Give each finding a stable ID such as `CI-001`, `ANDROID-001`, `USB-001`, `TOOLCHAIN-001`, `HISTORY-001`, `SECURITY-001`, `ARCH-001`, etc.

For every important finding provide:

Finding ID.

Confidence class.

Severity: BLOCKER, CRITICAL, HIGH, MEDIUM, LOW, or INFO.

Short title.

Exact evidence.

Repository path/commit/PR/run/job reference.

What is actually happening.

Why it matters to the real phone-first product.

Likely root cause.

Next check needed to prove/disprove it.

Recommended repair.

Alternative repair if materially different.

Tradeoffs and risks.

Whether the issue blocks a working APK, a working compile, a working flash, or only a secondary feature.

## Required report structure

A. Executive summary

B. Top ten findings, ranked by practical importance

C. Current blockers to a genuinely usable APK

D. Build and CI timeline

E. Git/history and regression analysis

F. Android/Expo/native architecture

G. USB/device detection/permissions

H. Toolchain/assets/archive/symlink analysis

I. Backend/database/API

J. UI and end-to-end functionality

K. Security/trust boundaries

L. Dependencies/version/configuration/reproducibility

M. Documentation versus reality

N. Architecture alternatives and new implementation ideas

O. Prioritized repair plan

P. Verification/test plan

Q. Unresolved questions and missing evidence

R. Novel findings or ideas not already obvious from the evidence bundle

## Repair-plan requirements

Give a staged plan, not a giant undifferentiated wish list.

Identify the minimum changes required to get a trustworthy compile/install/test loop.

Then identify the minimum changes required for reliable USB flashing and serial use.

Then address offline toolchain robustness.

Then address RP2040 logic analyzer.

Then address advanced programmer/debugger features.

Then polish UI/AI/backend features.

If you think this order is wrong, explain why.

## Critical comparison question

The owner reports that the existing Arduino Android app from the Play Store works. Treat that as a useful baseline hypothesis, not as proof of its internal design.

Explain what DroidVibe should copy conceptually from a working basic Android Arduino workflow, what it should deliberately do differently, and which DroidVibe additions are worth their complexity.

The objective is a real, useful application on a phone, not an impressive repository that merely contains implementations with matching names.

## Final discipline

Be skeptical but fair. Do not manufacture defects. Do not hide defects because they are inconvenient. Do not confuse a successful TypeScript build with a functioning Android feature. Do not confuse a compiled APK with a working hardware workflow. Do not confuse a PR description with a verified fix.

At the end, state clearly which conclusions are VERIFIED versus inferred, what you would test first on a physical Android device, and what architectural changes you would make if you were responsible for bringing DroidVibe to a stable release.