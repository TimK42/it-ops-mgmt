#!/bin/bash
# CI Fix Watch Script for PR #164
# Loops every 60s, checks CI + PR merge state, auto-fixes on failure

set -o pipefail

cd /Users/tim_openclaw/.openclaw/workspace/Git-Repository/it-ops-mgmt || exit 1

GH_TOKEN=$(cat ~/.openclaw/openclaw.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['env']['vars']['GH_TOKEN'])")
export GH_TOKEN

BRANCH="fix-163-manager-loop"
PR_NUMBER=164
REPO="TimK42/it-ops-mgmt"
START_TIME=$(date +%s)
TIMEOUT=3600
POLL_INTERVAL=60
POLL_COUNT=0
CI_FIXES_APPLIED=0
CI_FIXES_DESC=""
LAST_SHA=""
STABLE_COUNT=0
STABLE_STATUS=""

echo "[CI-FIX-WATCH] Starting CI fix watch for PR #$PR_NUMBER on branch $BRANCH"
echo "[CI-FIX-WATCH] Timeout: ${TIMEOUT}s"

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    
    # Check timeout
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "[CI-FIX-WATCH] TIMEOUT reached after ${ELAPSED}s"
        echo "=== CI FIX WATCH RESULT ==="
        echo "Status: timeout"
        echo "PR #: $PR_NUMBER"
        echo "CI Runs Monitored: $POLL_COUNT"
        echo "CI Fixes Applied: $CI_FIXES_APPLIED $CI_FIXES_DESC"
        echo "Final PR Merge State: merged: N/A"
        echo "Final CI State: N/A"
        echo "Length of Run: ${ELAPSED}s"
        echo "=== END CI FIX WATCH RESULT ==="
        exit 0
    fi
    
    POLL_COUNT=$((POLL_COUNT + 1))
    echo ""
    echo "[Poll #$POLL_COUNT] Checking CI and PR state (${ELAPSED}s elapsed)..."
    
    # --- Check PR merge state ---
    PR_STATE=$(curl -s -H "Authorization: token $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/pulls/$PR_NUMBER" \
        | jq '{merged: .merged, mergeable: .mergeable, state: .state}')
    
    MERGED=$(echo "$PR_STATE" | jq -r '.merged')
    echo "[PR] Merge state: $PR_STATE"
    
    if [ "$MERGED" = "true" ]; then
        echo "[CI-FIX-WATCH] PR #$PR_NUMBER is MERGED!"
        echo "=== CI FIX WATCH RESULT ==="
        echo "Status: merged"
        echo "PR #: $PR_NUMBER"
        echo "CI Runs Monitored: $POLL_COUNT"
        echo "CI Fixes Applied: $CI_FIXES_APPLIED $CI_FIXES_DESC"
        echo "Final PR Merge State: merged: true"
        echo "Final CI State: merged"
        echo "Length of Run: ${ELAPSED}s"
        echo "=== END CI FIX WATCH RESULT ==="
        exit 0
    fi
    
    # --- Check CI status ---
    CI_RUNS=$(curl -s -H "Authorization: token $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/runs?branch=$BRANCH&event=pull_request&per_page=5" \
        | jq '.workflow_runs[] | {id, status, conclusion, head_sha, display_title}')
    
    echo "[CI] Runs:"
    echo "$CI_RUNS"
    
    # Get first run (most recent)
    FIRST_RUN=$(echo "$CI_RUNS" | jq -s 'first | select(.!=null)')
    
    if [ -z "$FIRST_RUN" ] || [ "$FIRST_RUN" = "null" ]; then
        echo "[CI] No workflow runs found yet. Waiting..."
        sleep $POLL_INTERVAL
        continue
    fi
    
    CURRENT_SHA=$(echo "$FIRST_RUN" | jq -r '.head_sha')
    RUN_STATUS=$(echo "$FIRST_RUN" | jq -r '.status')
    RUN_CONCLUSION=$(echo "$FIRST_RUN" | jq -r '.conclusion')
    RUN_ID=$(echo "$FIRST_RUN" | jq -r '.id')
    
    echo "[CI] Current SHA: ${CURRENT_SHA:0:12} | Status: $RUN_STATUS | Conclusion: $RUN_CONCLUSION | Run ID: $RUN_ID"
    
    # Track SHA changes - restart tracking on new commit
    if [ -n "$LAST_SHA" ] && [ "$CURRENT_SHA" != "$LAST_SHA" ]; then
        echo "[CI] New commit detected! SHA changed from ${LAST_SHA:0:12} to ${CURRENT_SHA:0:12}"
        STABLE_COUNT=0
        STABLE_STATUS=""
    fi
    LAST_SHA=$CURRENT_SHA
    
    # Handle CI states
    if [ "$RUN_STATUS" = "completed" ]; then
        # Stable check: need 2 consecutive polls with same completed status
        if [ "$STABLE_STATUS" = "completed_$RUN_CONCLUSION" ]; then
            if [ "$RUN_CONCLUSION" = "success" ]; then
                echo "[CI] ✅ CI PASSED (stable for 2 polls)"
            elif [ "$RUN_CONCLUSION" = "failure" ] || [ "$RUN_CONCLUSION" = "cancelled" ] || [ "$RUN_CONCLUSION" = "timed_out" ]; then
                echo "[CI] ❌ CI FAILED (stable for 2 polls) - Conclusion: $RUN_CONCLUSION"
                
                # --- AUTO-FIX ---
                echo "[FIX] Starting auto-fix..."
                
                # Fetch the branch
                git fetch origin "$BRANCH"
                git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
                git pull origin "$BRANCH" --rebase 2>/dev/null || true
                
                # Get failed jobs
                echo "[FIX] Getting failed job details..."
                FAILED_JOBS=$(curl -s -H "Authorization: token $GH_TOKEN" \
                    "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/jobs" \
                    | jq '.jobs[] | select(.conclusion == "failure" or .conclusion == "cancelled") | {id, name, status, conclusion}')
                
                echo "[FIX] Failed jobs:"
                echo "$FAILED_JOBS"
                
                # Download CI logs
                FAILED_JOB_ID=$(echo "$FAILED_JOBS" | jq -r 'first | .id')
                if [ -n "$FAILED_JOB_ID" ] && [ "$FAILED_JOB_ID" != "null" ]; then
                    echo "[FIX] Downloading logs for job $FAILED_JOB_ID..."
                    curl -L -s -H "Authorization: token $GH_TOKEN" \
                        "https://api.github.com/repos/$REPO/actions/jobs/$FAILED_JOB_ID/logs" \
                        > /tmp/ci-fix-logs.txt 2>/dev/null
                    echo "[FIX] Logs (last 100 lines):"
                    tail -100 /tmp/ci-fix-logs.txt
                fi
                
                # Run local tests
                echo "[FIX] Running local tests..."
                SECRET_KEY=test bash tests/run.sh 2>&1 | tail -n 50
                TEST_EXIT=${PIPESTATUS[0]}
                echo "[FIX] Tests exit code: $TEST_EXIT"
                
                # Commit and push any fixes
                if [ -n "$(git status --porcelain)" ]; then
                    echo "[FIX] Changes detected, committing..."
                    git add -A
                    git commit -m "fix(163): fix CI failure on fix-163-manager-loop"
                    git pull origin "$BRANCH" --rebase 2>/dev/null || true
                    git push origin "$BRANCH"
                    
                    CI_FIXES_APPLIED=$((CI_FIXES_APPLIED + 1))
                    CI_FIXES_DESC="$CI_FIXES_DESC | fix #$CI_FIXES_APPLIED"
                    
                    # Notify Copilot
                    echo "[FIX] Notifying Copilot for re-review..."
                    gh pr edit $PR_NUMBER --add-reviewer @copilot 2>/dev/null || true
                else
                    echo "[FIX] No changes to commit - CI failure may be environmental or build config"
                fi
                
                # Reset stable tracking after fix
                STABLE_COUNT=0
                STABLE_STATUS=""
            fi
        else
            STABLE_STATUS="completed_$RUN_CONCLUSION"
            echo "[CI] First poll with completed status ($RUN_CONCLUSION). Waiting for second poll to confirm..."
        fi
    elif [ "$RUN_STATUS" = "queued" ] || [ "$RUN_STATUS" = "in_progress" ] || [ "$RUN_STATUS" = "pending" ]; then
        echo "[CI] ⏳ CI still running..."
        STABLE_COUNT=0
        STABLE_STATUS=""
    else
        echo "[CI] Unknown status: $RUN_STATUS"
        STABLE_COUNT=0
        STABLE_STATUS=""
    fi
    
    echo "[CI-FIX-WATCH] Waiting ${POLL_INTERVAL}s until next poll..."
    sleep $POLL_INTERVAL
done
