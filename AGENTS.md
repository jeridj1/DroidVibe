# DroidVibe AI Development Rules

## Non-negotiable rules

1. Never rewrite, regenerate, or replace an entire source file when a localized edit is sufficient.
2. Never modify a file until its current contents have been read in full when the task concerns that file.
3. Never overwrite a working file with generated, guessed, reconstructed, or partially remembered content.
4. Never change more than one subsystem at a time. After each change, run the narrowest relevant validation before proceeding.
5. Never fix a build error by changing unrelated files or by adding speculative compatibility hacks.
6. Never edit generated Android files as a permanent source of truth. Prefer Expo config plugins or source configuration.
7. Never alter package versions or the lockfile unless dependency changes are actually required.
8. Treat binary files, lockfiles, workflows, Gradle files, and TypeScript source as protected. Inspect before editing.
9. If a file becomes unexpectedly tiny, binary, malformed, or radically different, STOP and restore it from Git before doing anything else.
10. Do not create automated commits, branches, issues, or repeated retries merely because CI failed.
11. Do not run autonomous repair loops. A failed validation produces evidence for the next deliberate change.
12. Preserve the last known-good commit. Never force-reset or rewrite main unless explicitly instructed by the repository owner.

## Recovery workflow

Use this order:

READ -> PLAN -> ONE CHANGE -> VALIDATE -> COMMIT -> STOP.

For build failures, identify the first real error in the log. Fix that error only. Do not chase downstream errors until the first error is gone.

For corrupted files, use Git history to restore the last known-good version before making any functional change.

For Android/Expo problems, keep configuration declarative and deterministic. Avoid post-prebuild text surgery unless there is no supported configuration mechanism.

## Agent delegation

Read-only agents may audit architecture, history, tests, and build logs. A coding agent may edit only the specific files assigned to it. A reviewer must validate the resulting diff and tests without rewriting the implementation. No agent may undo another agent's validated work without evidence.

## Definition of done

A change is not complete because an agent says it is complete. It is complete only when the relevant source validation, typecheck, tests, Expo prebuild, and Android APK build pass as applicable.
