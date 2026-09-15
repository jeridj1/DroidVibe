# DroidVibe Independent Audit Report Template

Reviewer/AI:
Date:
Repository commit reviewed:
Evidence branch commit reviewed:
GitHub browsing limitations:

## A. Executive summary

State in plain language what works, what does not, and what most threatens a useful phone-first release.

## B. Top ten findings

Rank the ten most practically important findings. Use stable IDs.

## C. Current blockers

Separate blockers for:

- installing/launching APK;
- compiling without hardware;
- USB detection/permission;
- uploading firmware;
- serial monitoring;
- offline operation;
- RP2040 logic analysis;
- advanced programmer/debugger functions.

## D. Build and CI timeline

Correlate failures with commit, branch, PR, workflow run, job, date, and failure message.

## E. Git/history/regression analysis

Identify fix-after-fix chains, stale branches, suspicious changes, reverted changes, and automation anomalies.

## F. Android/Expo/native architecture

Trace native-module registration, generated Android project behavior, process execution, filesystem handling, permissions, and ABI/API compatibility.

## G. USB/device/permissions

Trace detection, permission, interface/endpoint selection, serial I/O, detach/reconnect, and bootloader transitions.

## H. Toolchain/assets/archive/symlink analysis

Trace toolchain construction, packaging, extraction, symlink resolution, proot execution, permissions, board cores, compiler versions, and offline package management.

## I. Backend/database/API

Trace cloud/local boundaries and determine which functions genuinely work without a backend or network.

## J. UI/end-to-end functionality

For each advertised feature state: VERIFIED WORKING, PARTIAL, STUB/DEMO, BROKEN, UNREACHABLE, or UNVERIFIED.

## K. Security/trust boundaries

Discuss actual defects separately from theoretical hardening opportunities.

## L. Dependencies/configuration/reproducibility

Identify version drift, mutable dependencies, lockfile problems, generated-file dependence, and environment assumptions.

## M. Documentation versus reality

List important claims that do not match implementation or observed behavior.

## N. Architecture alternatives and new ideas

Research alternative designs. Include options that simplify the system, reduce APK size, improve offline operation, or make Android USB/toolchain behavior more reliable.

## O. Prioritized repair plan

Give a staged plan with dependencies and acceptance criteria. Avoid an undifferentiated wish list.

## P. Verification/test plan

Specify exact tests, expected results, and what evidence would prove each repair.

## Q. Unresolved questions

List missing logs, device tests, source ambiguity, or inaccessible GitHub history.

## R. Novel findings/ideas

Include useful conclusions that were not obvious from the evidence dossier.

## Finding format

### [ID] Short title

Confidence: VERIFIED / STRONGLY INDICATED / POSSIBLE / SPECULATIVE

Severity: BLOCKER / CRITICAL / HIGH / MEDIUM / LOW / INFO

Evidence:

Repository path / commit / PR / workflow run / job:

What is actually happening:

Why it matters:

Likely root cause:

Next check:

Recommended repair:

Alternative repair:

Tradeoffs/risks:

Blocks: APK / compile / USB / upload / serial / offline / secondary feature / none

## Final comparison summary

State:

- the three highest-confidence defects;
- the three most important things that are already correct;
- the first physical-device test you would run;
- the first repository change you would make;
- one subsystem you would consider replacing entirely;
- one genuinely novel idea worth investigating.
