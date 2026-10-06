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

step "1/9 tsc --noEmit"
if ! npx tsc --noEmit; then
    echo "FAILED: fix the type errors above."
    fail=1
fi

step "2/9 eslint ."
if ! npx eslint .; then
    echo "FAILED: fix the lint errors above (eslint also covers formatting in this repo)."
    fail=1
fi

step "3/9 vitest run"
if ! npx vitest run; then
    echo "FAILED: fix the failing tests above."
    fail=1
fi

step "4/9 npm audit (dependency vulnerability scan)"
# Blocks on any real finding -- matches cargo-audit's role in
# unitprep-api -- EXCEPT the one advisory named below.
#
# ======================================================================
# TEMPORARY, DELIBERATE ALLOWANCE -- READ BEFORE CHANGING OR REMOVING
# ======================================================================
# Advisory:  GHSA-vfj7-8cjw-p6xm  ("braces" stack-exhaustion DoS through
#            deeply nested patterns, high, CVSS 7.5, published 2026-09-18).
# Why allowed: it has NO patched version (affects every braces release,
#            latest 3.0.3 from May 2024) and the maintainer has been
#            quiet since January 2025. Our only path to it is the
#            DEV-ONLY lint chain
#                eslint-config-next -> @next/eslint-plugin-next
#                  -> fast-glob 3.3.1 -> micromatch -> braces
#            which never ships to users and only globs files we control,
#            so there is no realistic way to exploit it here. The only
#            offered "fix" is downgrading eslint-config-next 16 -> 14
#            (breaking); Boris decided 2026-10-06 NOT to do that. Even
#            the newest eslint-config-next (16.3.8) / canary still pin
#            the same chain, so upgrading does not help either.
# This is NOT "audit turned off": every OTHER advisory still fails this
#            step, including new ones in the same chain.
# Review:    check roughly MONTHLY whether a fix shipped (a patched
#            braces, or a Next/fast-glob release that drops it). After
#            AUDIT_ALLOW_REVIEW_BY this step prints a warning every run;
#            after AUDIT_ALLOW_EXPIRES the allowance stops applying and
#            this step FAILS again, so it cannot be forgotten.
# Remove:    when the advisory stops being reported (this step says so)
#            or a fix is available, delete this whole allowance block
#            and restore a plain `npm audit`.
AUDIT_ALLOW_ID="GHSA-vfj7-8cjw-p6xm"
AUDIT_ALLOW_REVIEW_BY="2026-11-06"
AUDIT_ALLOW_EXPIRES="2027-01-06"

today="$(date +%F)"
if [[ "$today" > "$AUDIT_ALLOW_EXPIRES" ]]; then
    echo "NOTE: the $AUDIT_ALLOW_ID allowance EXPIRED on $AUDIT_ALLOW_EXPIRES -- running a plain npm audit."
    if ! npm audit; then
        echo "FAILED: a vulnerability was found above -- run 'npm audit fix' before pushing."
        fail=1
    fi
else
    if [[ "$today" > "$AUDIT_ALLOW_REVIEW_BY" ]]; then
        echo "WARNING: the $AUDIT_ALLOW_ID allowance is past its review date ($AUDIT_ALLOW_REVIEW_BY)."
        echo "         Check whether a fix shipped; it stops applying on $AUDIT_ALLOW_EXPIRES."
    fi
    audit_json="$(npm audit --json 2>/dev/null || true)"
    audit_verdict="$(AUDIT_ALLOW_ID="$AUDIT_ALLOW_ID" node -e '
        let raw = "";
        process.stdin.on("data", (c) => (raw += c)).on("end", () => {
            let report;
            try { report = JSON.parse(raw); } catch { console.log("UNPARSEABLE"); return; }
            const allowed = process.env.AUDIT_ALLOW_ID;
            const blocking = new Set();
            let sawAllowed = false;
            for (const [name, v] of Object.entries(report.vulnerabilities || {})) {
                for (const via of v.via || []) {
                    if (typeof via === "string") continue; // derived from another package
                    if ((via.url || "").includes(allowed)) { sawAllowed = true; continue; }
                    blocking.add(name + ": " + (via.title || via.url || "unknown advisory"));
                }
            }
            if (blocking.size) { console.log("BLOCKING\n" + [...blocking].join("\n")); return; }
            console.log(sawAllowed ? "ALLOWED_ONLY" : "CLEAN");
        });
    ' <<<"$audit_json")"

    case "${audit_verdict%%$'\n'*}" in
        CLEAN)
            echo "npm audit: no vulnerabilities reported."
            echo "NOTE: $AUDIT_ALLOW_ID is no longer reported -- delete the allowance block in this step."
            ;;
        ALLOWED_ONLY)
            echo "npm audit: only the allowed advisory $AUDIT_ALLOW_ID is reported (see the comment above; review by $AUDIT_ALLOW_REVIEW_BY)."
            ;;
        BLOCKING)
            echo "$audit_verdict" | tail -n +2
            npm audit || true
            echo "FAILED: a vulnerability other than $AUDIT_ALLOW_ID was found above -- run 'npm audit fix' before pushing."
            fail=1
            ;;
        *)
            echo "FAILED: could not read the npm audit report."
            npm audit || true
            fail=1
            ;;
    esac
fi

step "5/9 gitleaks (real secret scan, diff-scoped)"
# Only scans commits about to be pushed, not the whole history --
# matches the grep backstop below's scope. Known false positives go in
# .gitleaks.toml's allowlist, never a blanket disable.
gitleaks_range="$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD)"
if command -v gitleaks >/dev/null 2>&1; then
    if ! gitleaks git --log-opts="${gitleaks_range}..HEAD"; then
        echo "FAILED: gitleaks found a likely secret above -- review before pushing."
        fail=1
    fi
else
    echo "SKIPPED: gitleaks not installed -- see the vault's CI-CD Framework doc for the install step."
fi

step "6/9 version/tag consistency (advisory, does not block a push)"
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

step "7/9 secret-pattern scan (grep-based backstop, redundant with gitleaks above by design)"
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

step "8/9 workflow secret/permissions guard (CI isolation control #1)"
# No GitHub workflow may reference a secret, a NEON_* name or a bare
# DATABASE_URL, and each must declare least-privilege permissions.
if ! ./scripts/check_workflow_secrets.sh; then
    fail=1
fi

step "9/9 generated TypeScript types match unitprep-api (ts-rs drift check)"
# The check lives in unitprep-api (it needs cargo); skips if the sibling
# checkout is absent.
if [ -x ../unitprep-api/scripts/check_ts_bindings.sh ]; then
    if ! ../unitprep-api/scripts/check_ts_bindings.sh "$PWD"; then
        fail=1
    fi
else
    echo "SKIPPED: ../unitprep-api not found."
fi

echo
if [ "$fail" -ne 0 ]; then
    echo "preflight FAILED -- fix the issues above before pushing."
    exit 1
fi
echo "preflight passed."
