# DroidVibe Forensic Audit Evidence

This directory is a compact, public, read-only evidence bundle for independent AI/software-engineering audits of DroidVibe.

## Purpose

Give external reviewers a common starting point without requiring the repository owner to upload a large archive or grant write access. Reviewers should read `AUDIT_PROMPT.md` first, then inspect the live repository, Git history, pull requests, issues, and Actions where accessible.

## Collection baseline

Repository: `jeridj1/DroidVibe`
Default branch: `main`
Visibility: public
Collection baseline main SHA: `fb41dd2bcc76aa1bd55a0bbc0c989b90bb34461f`
Known failed Actions run: `34722004569` (run number 4355)
Known relevant PR: #122

## Contents

`AUDIT_PROMPT.md` is the reusable forensic-review instruction set.

`EVIDENCE_MANIFEST.md` explains what is intentionally included and excluded.

`KNOWN_FAILURES.md` records high-value verified observations from the audit so far.

`PR-122-EVIDENCE.md` records the relevant proposed fix and its relationship to the known CI failure.

`REPOSITORY_BASELINE.md` records the important stack and repository configuration observed during collection.

## Important limitation

This is deliberately not a full source archive or complete Git history dump. The live public repository is the primary source of truth. Reviewers should verify every finding against the current repository rather than treating this evidence directory as authoritative for code that may have changed.

## Safety

Do not place credentials, API keys, access tokens, signing keys, private user data, or environment secrets in this directory. Everything here is intentionally public.
