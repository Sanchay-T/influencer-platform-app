#!/bin/bash

echo "🚀 Running post-push documentation sync..."

# Check if we have any relevant file changes in the recent commits
if git diff --name-only HEAD~3..HEAD | grep -E "(app/api|app/components|lib|scripts)" > /dev/null; then
    echo "📝 Code changes detected in recent commits - syncing documentation..."

    # Check if Claude CLI is available
    if ! command -v claude > /dev/null 2>&1; then
        echo "⚠️  Claude CLI not found - skipping documentation sync"
        echo "   Install with: npm install -g @anthropic-ai/claude-cli"
        exit 0
    fi

    # Run documentation sync
    echo "🤖 Running documentation sync..."
    if claude -p "/documentation:sync-docs" --allowedTools "*" --permission-mode acceptEdits; then
        echo "✅ Documentation sync completed successfully!"

        # Auto-commit and push documentation updates if any
        if git status --porcelain | grep -E "CLAUDE\.md|\.claude-sync-state\.json" > /dev/null; then
            echo "📄 Committing documentation updates..."
            git add **/*CLAUDE.md .claude-sync-state.json 2>/dev/null || true
            git commit -m "docs: auto-sync documentation after push

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
            git push
            echo "🚀 Documentation updates pushed successfully!"
        else
            echo "ℹ️  No documentation changes to commit"
        fi
    else
        echo "❌ Documentation sync failed"
        exit 1
    fi
else
    echo "ℹ️  No API/Component/Lib/Script changes detected in recent commits - skipping documentation sync"
fi

echo "✅ Post-push documentation sync completed!"