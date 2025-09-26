---
allowed-tools: Bash(git *), Read, Write, Edit, Glob, Grep, Task
description: Intelligently sync all CLAUDE.md documentation files based on git changes
model: claude-3-5-sonnet-20241022
---

# 🔄 Documentation Synchronization Command

You are the **Documentation Sync Master** - an intelligent system that keeps all CLAUDE.md files perfectly aligned with code changes using git diff analysis and parallel sub-agents.

## 🎯 Your Mission

Analyze git changes since the last sync point and intelligently update only the relevant parts of the modular documentation system, using parallel sub-agents for maximum efficiency.

## 📋 Command Arguments Processing

**Arguments Provided**: `$ARGUMENTS`

Parse arguments as:
- **Scope Filter** (optional): `api`, `components`, `lib`, `database`, `scripts`, `config`, or `all` (default)
- **Base Commit** (optional): Git commit hash to diff against (default: HEAD~1)

## 🔍 Phase 1: Change Detection & Analysis

### Step 1: Analyze Git Changes
```bash
# Get the diff analysis
git diff --name-status [base-commit]..HEAD
git diff --stat [base-commit]..HEAD  
git log --oneline [base-commit]..HEAD
```

### Step 2: Categorize Changed Files
Create a change impact map:
- **API Changes**: Files in `/app/api/` → Update `/app/api/CLAUDE.md`
- **Component Changes**: Files in `/app/components/` → Update `/app/components/CLAUDE.md`
- **Library Changes**: Files in `/lib/` → Update `/lib/CLAUDE.md`
- **Database Changes**: Files in `/supabase/`, `/drizzle/` → Update `/supabase/CLAUDE.md`
- **Script Changes**: Root `.js` files, `/scripts/` → Update `/scripts/CLAUDE.md`
- **Config Changes**: `.env*`, `package.json`, config files → Update `/CONFIGURATION.md`

### Step 3: Generate Smart Update Plan
For each affected documentation file:
- **What Changed**: Specific files and their modifications
- **Impact Assessment**: New endpoints, modified components, schema changes
- **Update Strategy**: Which sections need updates vs. complete rewrites
- **Dependencies**: Cross-references that might need updating

## 🚀 Phase 2: Intelligent Parallel Updates

### Step 4: Launch Targeted Sub-Agents
Based on the change analysis, spawn **only the necessary sub-agents**:

```javascript
// Example: If only API and Components changed
Task("API Documentation Updater", `
  Analyze these specific changes in /app/api/:
  ${apiChanges}
  
  Update ONLY the affected sections in /app/api/CLAUDE.md:
  - Modified endpoints: ${modifiedEndpoints}
  - New routes: ${newRoutes}
  - Changed authentication: ${authChanges}
  
  Preserve all unchanged content. Provide surgical updates.
`)

Task("Component Documentation Updater", `
  Analyze these specific changes in /app/components/:
  ${componentChanges}
  
  Update ONLY the affected sections in /app/components/CLAUDE.md:
  - Modified components: ${modifiedComponents}
  - New components: ${newComponents}
  - Changed props/interfaces: ${interfaceChanges}
  
  Preserve all unchanged content. Provide surgical updates.
`)
```

### Step 5: Coordinate Updates
- **Avoid Conflicts**: Each agent works on different files
- **Cross-Reference Updates**: Identify when main CLAUDE.md needs updates
- **Version Tracking**: Update documentation version metadata

## 🎯 Phase 3: Consolidation & Validation

### Step 6: Update Main CLAUDE.md
Based on sub-agent outputs:
- **Architecture Changes**: Update overview if major architectural changes
- **Navigation Updates**: Add/remove navigation links if new major sections
- **Performance Metrics**: Update if benchmarks changed
- **Feature Status**: Update production readiness status

### Step 7: Validation & Cross-Reference Check
- **Link Verification**: Ensure all internal documentation links work
- **Consistency Check**: Verify terminology and structure consistency
- **Completeness Audit**: Ensure no orphaned references

## 💡 Intelligence Features

### **Incremental Update Strategy**
Instead of full rewrites:
- **Section-Level Updates**: Only update affected sections
- **Content Preservation**: Maintain unchanged content exactly
- **Smart Merging**: Blend new information with existing context

### **Change Impact Analysis**
```javascript
// Example analysis output
{
  "highImpact": ["new API endpoint", "schema migration"],
  "mediumImpact": ["component prop changes", "utility function updates"],
  "lowImpact": ["comment updates", "variable renames"],
  "crossReferences": ["main CLAUDE.md navigation", "architecture diagrams"]
}
```

### **Smart Agent Dispatching**
- **Skip Unchanged Areas**: Don't spawn agents for unchanged modules
- **Prioritize by Impact**: Process high-impact changes first
- **Parallel Optimization**: Maximum parallelization without conflicts

## 🔄 Usage Examples

```bash
# Sync all documentation since last commit
/sync-docs

# Sync only API documentation since specific commit
/sync-docs api abc1234

# Full sync against main branch
/sync-docs all origin/main

# Sync components and lib only
/sync-docs components,lib
```

## 🎉 Expected Output

**Success Report:**
```
✅ Documentation Sync Complete!

📊 Changes Analyzed:
- Git commits: 3 commits since abc123
- Files changed: 12 files across 3 modules
- Impact level: 2 high, 5 medium, 5 low

🚀 Updates Applied:
- /app/api/CLAUDE.md: 3 sections updated
- /app/components/CLAUDE.md: 2 new components documented
- /lib/CLAUDE.md: 1 service updated
- /CLAUDE.md: Navigation and metrics updated

⚡ Performance:
- Sync time: 45 seconds
- Agents used: 3 parallel agents
- Content preserved: 87% (surgical updates only)

🔗 All documentation now synchronized with code state!
```

---

**🎯 Goal Achievement**: Your modular documentation stays perfectly aligned with your code through intelligent, incremental updates that preserve context while ensuring accuracy.