#!/bin/bash

# Script to delete redundant branches in DroidVibe
# Run this locally or in a GitHub Actions workflow with write permissions

BRANCHES_TO_DELETE=(
  "v-droidvibe-test"
  "diagnose-usb"
  "hardware-validation"
  "playground/rebuild-2026-09-03"
  "forensic-fix-v10"
)

REPO_OWNER="jeridj1"
REPO_NAME="DroidVibe"

# Delete branches using GitHub API
for BRANCH in "${BRANCHES_TO_DELETE[@]}"; do
  echo "Deleting branch: $BRANCH"
  curl -X DELETE \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}"
  echo ""
done

echo "Branch cleanup complete."
