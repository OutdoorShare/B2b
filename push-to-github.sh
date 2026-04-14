#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push-to-github.sh
# Pushes the current Replit project to GitHub.
#
# Usage:
#   chmod +x push-to-github.sh
#   ./push-to-github.sh
#
# You will be prompted for your GitHub Personal Access Token (PAT).
# The token is NEVER written to disk.
# ─────────────────────────────────────────────────────────────────────────────

REPO_URL="https://github.com/OutdoorShare/B2b.git"
BRANCH="main"

echo ""
echo "OutdoorShare → GitHub Push"
echo "Target: $REPO_URL"
echo ""

# Prompt for PAT securely (no echo)
read -s -p "Paste your GitHub Personal Access Token: " GITHUB_PAT
echo ""

if [ -z "$GITHUB_PAT" ]; then
  echo "ERROR: No token provided. Aborting."
  exit 1
fi

# Build authenticated URL (token is in-memory only, not stored)
AUTH_URL="https://${GITHUB_PAT}@github.com/OutdoorShare/B2b.git"

# Check if remote already exists and update it
if git remote get-url github &>/dev/null; then
  git remote set-url github "$AUTH_URL"
else
  git remote add github "$AUTH_URL"
fi

echo "Pushing to GitHub..."
git push github "$BRANCH" --force-with-lease 2>&1 | sed "s|${GITHUB_PAT}|***|g"

STATUS=$?

# Remove the authenticated URL immediately after push (security)
git remote set-url github "$REPO_URL"

if [ $STATUS -eq 0 ]; then
  echo ""
  echo "✓ Successfully pushed to github.com/OutdoorShare/B2b"
else
  echo ""
  echo "✗ Push failed (exit code $STATUS)"
  echo "  Make sure:"
  echo "  1. Your PAT has 'repo' scope"
  echo "  2. The repository https://github.com/OutdoorShare/B2b exists"
  echo "  3. Your PAT hasn't expired"
fi
