# AI Access Guide

This evidence room is deliberately designed for independent AI reviewers with very different browsing capabilities.

## If the AI can browse public GitHub normally

Give it the repository and this branch:

Repository: https://github.com/jeridj1/DroidVibe
Evidence branch: https://github.com/jeridj1/DroidVibe/tree/forensic-audit/evidence

Tell it to read `FORENSIC_AUDIT/AUDIT_PROMPT.md` first and then inspect the live repository and Git history.

The AI should treat the live repository as the source of truth and the dossier as preserved context.

## If the AI can browse GitHub files but cannot inspect Actions history well

The dossier preserves the important known CI failure in `CI-RUN-34722004569.md`. The AI should still inspect the live workflow files and PR #122, but it does not need special GitHub Actions access to understand the documented failure sequence.

## If the AI has weak web/GitHub browsing

It should still read every file under `FORENSIC_AUDIT/` that it can access, then analyze the repository tree and source files it can retrieve. It must clearly identify what it could not inspect rather than pretending the audit was complete.

## If the AI cannot reliably inspect the repository at all

The report should be limited to the dossier evidence and explicitly labeled as a partial review. It should not make strong claims about source code it could not see.

## What reviewers should NOT need

No GitHub write access is needed.

No GitHub account access should be requested merely to read this public repository.

No personal credentials, API tokens, signing keys, or private files are required or should be requested.

## What the final report should contain

The reviewer should return a standalone text report with exact evidence references and stable finding IDs. It should be possible to compare reports from several different AI systems without knowing which reviewer produced which conclusion.

The report should distinguish:

- what the reviewer directly verified;
- what is strongly indicated by multiple pieces of evidence;
- what is plausible but unproven;
- what is merely speculative.

The reviewer should also report important things that appear to be working correctly. A forensic audit is not supposed to manufacture defects.

## Recommended handoff wording

"Read `FORENSIC_AUDIT/AUDIT_PROMPT.md` and perform the requested independent forensic audit. You have read-only access. Do not modify the repository. Inspect the live `main` source, history, PRs, workflows, and the evidence branch as far as your tools permit. Use the evidence dossier to preserve ephemeral information such as the known failed Actions run and owner-reported device behavior. Treat owner observations and prior conclusions as hypotheses to verify. Return the full report in the required A-R structure, including exact references, confidence classes, repair options, tradeoffs, and novel ideas."
