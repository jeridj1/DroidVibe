# DroidVibe AI recovery protocol

This repository was recovered to the known-good RP2040 baseline from September first, twenty twenty-six. The historical main branch is preserved in `archive-pre-recovery`.

AI agents must work in small, independently validated changes. Never run an autonomous repair loop. Never regenerate an entire source file to make a one-line fix. Restore corruption from Git history first, then make the smallest functional change.

Recommended handoff sequence:

1. Auditor: read-only history, architecture, and failure analysis.
2. Implementer: one narrowly scoped fix only.
3. Validator: run typecheck/tests/prebuild/build and report the first real failure.
4. Reviewer: inspect the diff and confirm no unrelated changes.
5. Next implementer: only after validation passes.

The build is the gate. Agent confidence is not the gate.
