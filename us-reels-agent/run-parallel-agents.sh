#!/bin/bash
# Parallel Agent Runner - Runs multiple agents concurrently for different keywords

set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  🚀 PARALLEL AGENT RUNNER"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Clean up any existing log directory
LOG_DIR="logs/parallel-run-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir -p "$LOG_DIR"

echo "📁 Logs will be saved to: $LOG_DIR"
echo ""

# Define keywords
KEYWORDS=(
    "nutritionist"
    "fitness trainer"
    "yoga instructor"
    "airpods"
    "iphone"
)

# Store PIDs for monitoring
declare -a PIDS
declare -a LOGS

echo "🎯 Starting agents for ${#KEYWORDS[@]} keywords..."
echo ""

# Launch each agent in the background
for keyword in "${KEYWORDS[@]}"; do
    # Create safe filename
    safe_name=$(echo "$keyword" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    log_file="$LOG_DIR/${safe_name}.log"

    echo "  🔄 Starting: $keyword"
    echo "     Log: $log_file"

    # Run agent in background and redirect output to log file
    npm run dev -- "$keyword" > "$log_file" 2>&1 &

    # Store PID and log file
    pid=$!
    PIDS+=($pid)
    LOGS+=("$log_file")

    echo "     PID: $pid ✓"
    echo ""

    # Small delay to avoid overwhelming the system
    sleep 2
done

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  ✅ All ${#KEYWORDS[@]} agents launched!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📊 Agent Status:"
for i in "${!KEYWORDS[@]}"; do
    echo "  ${KEYWORDS[$i]}: PID ${PIDS[$i]} | Log: ${LOGS[$i]}"
done
echo ""

# Function to check if process is still running
is_running() {
    kill -0 "$1" 2>/dev/null
}

# Monitor agents
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  ⏳ Monitoring agents (press Ctrl+C to stop monitoring, agents continue)"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Wait for all agents to complete
completed=0
total=${#PIDS[@]}

while [ $completed -lt $total ]; do
    completed=0

    for i in "${!PIDS[@]}"; do
        if ! is_running "${PIDS[$i]}"; then
            completed=$((completed + 1))
        fi
    done

    echo "⏳ Progress: $completed/$total agents completed"

    # Show recent activity from each log
    for i in "${!KEYWORDS[@]}"; do
        if is_running "${PIDS[$i]}"; then
            status="🔄 Running"
        else
            status="✅ Done"
        fi

        # Get last line from log
        last_line=$(tail -n 1 "${LOGS[$i]}" 2>/dev/null | head -c 80 || echo "Starting...")
        echo "  ${KEYWORDS[$i]}: $status | ${last_line}"
    done

    echo ""

    if [ $completed -lt $total ]; then
        sleep 10  # Check every 10 seconds
    fi
done

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  🎉 ALL AGENTS COMPLETED!"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Show final results
echo "📊 Final Results:"
echo ""

for i in "${!KEYWORDS[@]}"; do
    log_file="${LOGS[$i]}"
    keyword="${KEYWORDS[$i]}"

    echo "─────────────────────────────────────────────────────────────────────────────"
    echo "Keyword: $keyword"
    echo "─────────────────────────────────────────────────────────────────────────────"

    # Extract key metrics from log
    if grep -q "Found.*result" "$log_file" 2>/dev/null; then
        results=$(grep "Found.*result" "$log_file" | tail -1)
        echo "✅ $results"
    else
        echo "⚠️  No results found in log"
    fi

    # Check for errors
    if grep -qi "error" "$log_file" 2>/dev/null; then
        error_count=$(grep -ci "error" "$log_file")
        echo "⚠️  Errors detected: $error_count"
    fi

    echo ""
done

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  📁 MASTER CSV STATUS"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if [ -f "data/master.csv" ]; then
    row_count=$(wc -l < data/master.csv)
    row_count=$((row_count - 1))  # Subtract header

    echo "✅ Master CSV exists!"
    echo "📊 Total reels: $row_count"
    echo "📂 Location: data/master.csv"
    echo ""

    # Show first few rows
    echo "Preview (first 5 rows):"
    echo "─────────────────────────────────────────────────────────────────────────────"
    head -6 data/master.csv | column -t -s',' || head -6 data/master.csv
else
    echo "⚠️  Master CSV not found!"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  📝 Session Data"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# List all session folders
echo "Sessions created:"
for keyword in "${KEYWORDS[@]}"; do
    safe_name=$(echo "$keyword" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    session=$(find data/sessions -maxdepth 1 -type d -name "${safe_name}_*" 2>/dev/null | sort -r | head -1)

    if [ -n "$session" ]; then
        csv_file="$session/session.csv"
        if [ -f "$csv_file" ]; then
            count=$(wc -l < "$csv_file")
            count=$((count - 1))
            echo "  ✅ $keyword: $count reels → $session"
        fi
    else
        echo "  ⚠️  $keyword: No session found"
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "  ✅ PARALLEL RUN COMPLETE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Logs saved to: $LOG_DIR"
echo "Master CSV: data/master.csv"
echo ""
