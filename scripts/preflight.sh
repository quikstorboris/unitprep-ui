#!/usr/bin/env bash
# Tier 0 of the UnitPrep CI/CD framework -- see the vault's
# reference/UnitPrep CI-CD Framework.md for the full design and why
# each step exists. Run this before every push, not every commit
# (matches this project's own "batch, don't checkpoint" cadence).
set -euo pipefail

cd "$(dirname "$0")/.."

# nvm's native Linux Node, not the Windows toolchain a bare `npx`
# would silently fall through to under WSL -- see the vault's
# WSL Execution Technique / Gotchas notes.
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
    nvm use default > /dev/null
fi

fail=0

step() {
    echo
    echo "==> $1"
}

step "1/5 tsc --noEmit"
if ! npx tsc --noEmit; then
    echo "FAILED: fix the type errors above."
    fail=1
fi

step "2/5 eslint ."
if ! npx eslint .; then
    echo "FAILED: fix the lint errors above (eslint also covers formatting in this repo)."
    fail=1
fi

step "3/5 vitest run"
if ! npx vitest run; then
    echo "FAILED: fix the failing tests above."
    fail=1
fi

step "4/5 version/tag consistency (advisory, does not block a push)"
current_version=$(node -p "require('./package.json').version")
latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$latest_tag" ]; then
    tag_version="${latest_tag#v}"
    commits_since_tag=$(git rev-list "${latest_tag}..HEAD" --count 2>/dev/null || echo "0")
    if [ "$commits_since_tag" != "0" ] && [ "$current_version" = "$tag_version" ]; then
        echo "NOTE: $commits_since_tag commit(s) since $latest_tag, but package.json is still at $current_version."
        echo "      If any of those are real code changes (not docs-only), bump the version before releasing."
        echo "      This is advisory only -- a docs-only push is expected to look like this."
    else
        echo "OK: version $current_version vs. latest tag $latest_tag (${commits_since_tag} commits since)."
    fi
else
    echo "No tags found yet -- skipping."
fi

step "5/5 secret-pattern scan (grep-based backstop, not a substitute for a real secrets scanner)"
diff_range="$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)..HEAD"
secret_hits=$(git diff "$diff_range" -- . ':!*.lock' ':!package-lock.json' 2>/dev/null | grep -E '^\+' | grep -iE \
    -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
    -e 'AKIA[0-9A-Z]{16}' \
    -e '(password|secret|api_key|apikey)\s*[:=]\s*"[^"$][^"]{7,}"' \
    || true)
if [ -n "$secret_hits" ]; then
    echo "POSSIBLE SECRET FOUND in the diff about to be pushed:"
    echo "$secret_hits"
    echo "FAILED: review the lines above before pushing."
    fail=1
else
    echo "OK: no obvious secret patterns found."
fi

echo
if [ "$fail" -ne 0 ]; then
    echo "preflight FAILED -- fix the issues above before pushing."
    exit 1
fi
echo "preflight passed."
