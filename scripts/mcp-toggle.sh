#!/bin/bash

# MCP Toggle Utility Script
# Allows easy switching between MCP configurations for focused work

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

case "$1" in
    "off")
        if [ -f ".mcp.json" ]; then
            # Backup current config
            mv .mcp.json .mcp.json.backup 2>/dev/null
            
            # Create minimal empty config
            echo '{"mcpServers": {}}' > .mcp.json
            
            echo -e "${GREEN}🔇 MCPs disabled${NC}"
            echo -e "${YELLOW}📁 Branch: ${CURRENT_BRANCH}${NC}"
            echo -e "${YELLOW}💾 Configuration backed up to .mcp.json.backup${NC}"
        else
            echo -e "${RED}⚠️  No .mcp.json found to disable${NC}"
        fi
        ;;
    "on")
        if [ -f ".mcp.json.backup" ]; then
            # Restore from backup
            mv .mcp.json.backup .mcp.json
            echo -e "${GREEN}🔌 MCPs restored${NC}"
            echo -e "${YELLOW}📁 Branch: ${CURRENT_BRANCH}${NC}"
            echo -e "${GREEN}✅ Configuration restored from backup${NC}"
        else
            echo -e "${RED}⚠️  No backup found${NC}"
            echo -e "${YELLOW}💡 Try switching branches to restore MCP config:${NC}"
            echo -e "${YELLOW}   git checkout main      # for prod config${NC}"
            echo -e "${YELLOW}   git checkout feature-admin-panel-wt2  # for dev config${NC}"
        fi
        ;;
    "status")
        echo -e "${YELLOW}📋 MCP Status${NC}"
        echo -e "${YELLOW}📁 Current branch: ${CURRENT_BRANCH}${NC}"
        
        if [ -f ".mcp.json" ]; then
            # Check if it's the minimal config (MCPs off)
            if grep -q '{"mcpServers": {}}' .mcp.json; then
                echo -e "${RED}🔇 MCPs: DISABLED${NC}"
                if [ -f ".mcp.json.backup" ]; then
                    echo -e "${YELLOW}💾 Backup available: YES${NC}"
                else
                    echo -e "${RED}💾 Backup available: NO${NC}"
                fi
            else
                echo -e "${GREEN}🔌 MCPs: ENABLED${NC}"
                
                # Show which MCPs are configured
                echo -e "${YELLOW}🛠️  Active MCPs:${NC}"
                if grep -q '"github"' .mcp.json; then
                    echo -e "   ${GREEN}✓${NC} GitHub"
                fi
                if grep -q '"supabase"' .mcp.json; then
                    if grep -q 'DEV_PROJECT_REF' .mcp.json; then
                        echo -e "   ${GREEN}✓${NC} Supabase (DEV)"
                    elif grep -q 'PROD_PROJECT_REF' .mcp.json; then
                        echo -e "   ${GREEN}✓${NC} Supabase (PROD - read-only)"
                    else
                        echo -e "   ${GREEN}✓${NC} Supabase"
                    fi
                fi
                if grep -q '"linear"' .mcp.json; then
                    echo -e "   ${GREEN}✓${NC} Linear"
                fi
                if grep -q '"shadcn"' .mcp.json; then
                    echo -e "   ${GREEN}✓${NC} shadcn"
                fi
            fi
        else
            echo -e "${RED}❌ No .mcp.json found${NC}"
        fi
        ;;
    "info")
        echo -e "${YELLOW}📚 MCP Toggle Utility${NC}"
        echo ""
        echo -e "${GREEN}Branch-Specific MCP System:${NC}"
        echo -e "  ${YELLOW}main${NC}                    → Production MCPs (Supabase read-only)"
        echo -e "  ${YELLOW}feature-admin-panel-wt2${NC} → Development MCPs (full access + Linear)"
        echo ""
        echo -e "${GREEN}Commands:${NC}"
        echo -e "  ${YELLOW}./scripts/mcp-toggle.sh off${NC}     → Disable MCPs for focused work"
        echo -e "  ${YELLOW}./scripts/mcp-toggle.sh on${NC}      → Re-enable MCPs"
        echo -e "  ${YELLOW}./scripts/mcp-toggle.sh status${NC}  → Show current MCP status"
        echo -e "  ${YELLOW}./scripts/mcp-toggle.sh info${NC}    → Show this help"
        echo ""
        echo -e "${GREEN}Git Workflow:${NC}"
        echo -e "  ${YELLOW}git checkout main${NC}                   → Auto-switches to prod MCPs"
        echo -e "  ${YELLOW}git checkout feature-admin-panel-wt2${NC} → Auto-switches to dev MCPs"
        echo -e "  ${YELLOW}git checkout -b feature-xyz${NC}          → Inherits parent branch MCPs"
        ;;
    *)
        echo -e "${YELLOW}🔧 MCP Toggle Utility${NC}"
        echo ""
        echo -e "${GREEN}Usage:${NC} $0 {on|off|status|info}"
        echo ""
        echo -e "${GREEN}Quick Commands:${NC}"
        echo -e "  ${YELLOW}$0 off${NC}     → Disable MCPs (clean context)"
        echo -e "  ${YELLOW}$0 on${NC}      → Re-enable MCPs"
        echo -e "  ${YELLOW}$0 status${NC}  → Show current status"
        echo -e "  ${YELLOW}$0 info${NC}    → Show detailed info"
        echo ""
        echo -e "${YELLOW}💡 Current branch: ${CURRENT_BRANCH}${NC}"
        ;;
esac