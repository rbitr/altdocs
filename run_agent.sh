#!/bin/bash
set -euo pipefail

# Configuration
AGENT_PROMPT="AGENT_PROMPT.md"
LOG_DIR="agent_logs"
MAX_CONSECUTIVE_FAILURES=3
COOLDOWN_SECONDS=10

mkdir -p "$LOG_DIR"

failure_count=0

while true; do
    COMMIT=$(git rev-parse --short=6 HEAD)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    # Use both timestamp and commit to avoid overwrites if Claude doesn't commit
    LOGFILE="${LOG_DIR}/agent_${TIMESTAMP}_${COMMIT}.log"

    echo "=== Starting agent run at $(date) on commit ${COMMIT} ===" | tee -a "$LOGFILE"

    # Run Claude in non-interactive mode
    if claude --dangerously-skip-permissions \
              -p "$(cat "$AGENT_PROMPT")" \
              --model claude-opus-4-6 &>> "$LOGFILE"; then
        failure_count=0
        echo "=== Agent run completed successfully at $(date) ===" | tee -a "$LOGFILE"
    else
        failure_count=$((failure_count + 1))
        echo "=== Agent run FAILED at $(date) (failure ${failure_count}/${MAX_CONSECUTIVE_FAILURES}) ===" | tee -a "$LOGFILE"

        if [ "$failure_count" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            echo "Too many consecutive failures. Stopping."
            echo "Check the last few logs in ${LOG_DIR}/ for details."
            exit 1
        fi
    fi

    NEW_COMMIT=$(git rev-parse --short=6 HEAD)
    if [ "$COMMIT" = "$NEW_COMMIT" ]; then
        echo "Warning: no new commit was made this run." | tee -a "$LOGFILE"
    fi

    # Brief cooldown to avoid hammering the API if something is wrong
    sleep "$COOLDOWN_SECONDS"
done
