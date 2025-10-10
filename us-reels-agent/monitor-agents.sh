#!/bin/bash
# Quick agent monitor - Shows current status of all running agents

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  📊 AGENT MONITOR - $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Find the latest log directory
LOG_DIR=$(find logs -maxdepth 1 -type d -name "parallel-run-*" | sort -r | head -1)

if [ -z "$LOG_DIR" ]; then
    echo "❌ No parallel run logs found"
    exit 1
fi

echo "📁 Log directory: $LOG_DIR"
echo ""

# Keywords
KEYWORDS=(
    "nutritionist"
    "fitness_trainer"
    "yoga_instructor"
    "airpods"
    "iphone"
)

# Check each agent
for keyword in "${KEYWORDS[@]}"; do
    log_file="$LOG_DIR/${keyword}.log"
    display_name=$(echo "$keyword" | tr '_' ' ')

    if [ ! -f "$log_file" ]; then
        echo "❌ $display_name: Log file not found"
        continue
    fi

    # Get latest status
    echo "─────────────────────────────────────────────────────────────────────────────"
    echo "🔍 $display_name"
    echo "─────────────────────────────────────────────────────────────────────────────"

    # Check if completed
    if grep -q "AGENT COMPLETE" "$log_file" 2>/dev/null; then
        echo "✅ Status: COMPLETED"

        # Get final results
        if grep -q "Found.*reels" "$log_file" 2>/dev/null; then
            results=$(grep "Found.*reels" "$log_file" | tail -1)
            echo "📊 $results"
        fi
    else
        echo "🔄 Status: RUNNING"

        # Get current iteration
        if grep -q "ITERATION" "$log_file" 2>/dev/null; then
            iteration=$(grep "ITERATION" "$log_file" | tail -1 | grep -o "ITERATION [0-9]*/[0-9]*")
            echo "📍 Current: $iteration"
        fi

        # Get last activity
        last_line=$(tail -n 3 "$log_file" | head -c 150 || echo "Starting...")
        echo "💬 Latest: ${last_line:0:100}..."
    fi

    echo ""
done

echo "════════════════════════════════════════════════════════════════════════════════"
echo "  📈 MASTER CSV STATUS"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

if [ -f "data/master.csv" ]; then
    row_count=$(wc -l < data/master.csv)
    row_count=$((row_count - 1))

    echo "✅ Master CSV: $row_count total reels"

    # Count by keyword
    echo ""
    echo "By keyword:"
    for keyword in "${KEYWORDS[@]}"; do
        display_name=$(echo "$keyword" | tr '_' ' ')
        count=$(grep -c "$display_name" data/master.csv 2>/dev/null || echo "0")
        echo "  • $display_name: $count reels"
    done
else
    echo "⚠️  Master CSV not yet created"
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
