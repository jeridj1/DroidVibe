# PR #122 Evidence

Title: Fix Android toolchain root-relative symlinks
State: open
Draft: yes
Merged: no
Base: `main`
Base SHA at inspection: `fb41dd2bcc76aa1bd55a0bbc0c989b90bb34461f`
Head branch: `fix/android-toolchain-symlink-resolution-main`
Head SHA at inspection: `65c9bd5c2077aaa2876128c7d5736ce0b483ed7d`
Commits: 3
Changed files: 2

## Stated problem

The PR body reports an on-device compile failure where `ld.bfd` was resolving to a path resembling `avr/bin/opt/droidvibe/...`, indicating that a root-relative toolchain symlink had been extracted as an ordinary relative symlink.

## Proposed symlink fix

The changed LocalToolchain extraction logic normalizes `./` prefixes, recognizes top-level root-relative targets such as `bin`, `sbin`, `lib`, `lib64`, `usr`, `opt`, `etc`, `var`, `home`, `root`, `tmp`, and `work`, maps those targets against the extracted root filesystem, validates that the resulting target remains under the rootfs, and otherwise preserves safe relative links.

The installation marker version was also bumped from the earlier symlink-fix value to `...symlinkfix3`.

## Proposed CI permission fix

The PR also removes the host-side `chmod 0644 "$ARCHIVE"` and the later chmod loop over split archive parts. Its rationale is that the archive is created by a root Docker container and a mounted output can remain root-owned or otherwise immutable to the host runner, while `split` only requires read access.

## Relationship to known CI failure

The exact host-side chmod failure in Actions run `34722004569` is:

`chmod: changing permissions of '/home/runner/work/_temp/droidvibe-assets/droidvibe-toolchain-rootfs.tar.gz': Operation not permitted`

Therefore the PR's removal of the host-side chmod is directly relevant to that observed failure.

## Forensic status

VERIFIED: PR #122 contains changes addressing both the known symlink behavior and the exact host-side chmod operation implicated by run `34722004569`.

NOT VERIFIED: The fix has not been declared successful merely from the PR description. At inspection time the PR was still draft/open and unmerged. A fresh CI run and on-device compile test are required to establish that both problems are actually resolved and that no regression was introduced.