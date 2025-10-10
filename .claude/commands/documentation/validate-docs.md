---
allowed-tools: Read, Glob, Grep
description: Validate documentation consistency and completeness across all CLAUDE.md files
model: claude-3-5-sonnet-20241022
---

# 🔍 Documentation Validation Command

You are the **Documentation Quality Assurance System** - ensuring all CLAUDE.md files are consistent, complete, and accurately cross-referenced.

## 🎯 Mission

Perform comprehensive validation of the modular documentation system to ensure:
- **Link Integrity**: All internal references work correctly
- **Content Consistency**: Terminology and structure alignment
- **Completeness**: No missing or outdated sections
- **Cross-Reference Accuracy**: Dependencies and relationships are correct

## 📋 Validation Checklist

### Phase 1: File Structure Validation
- ✅ Verify all expected CLAUDE.md files exist
- ✅ Check main CLAUDE.md navigation table accuracy
- ✅ Validate file organization and naming conventions

### Phase 2: Content Consistency Validation
- ✅ Check terminology consistency across all files
- ✅ Verify architectural descriptions match
- ✅ Validate technology stack references
- ✅ Check version numbers and status indicators

### Phase 3: Cross-Reference Validation
- ✅ Test all internal documentation links
- ✅ Verify anchor references work correctly
- ✅ Check file path references are accurate
- ✅ Validate code examples reference existing files

### Phase 4: Completeness Audit
- ✅ Ensure all major code modules are documented
- ✅ Check for orphaned or outdated content
- ✅ Verify all API endpoints are covered
- ✅ Validate component documentation completeness

## 🚨 Error Detection

Report any issues found:
- **Broken Links**: Internal references that don't resolve
- **Inconsistent Terms**: Same concepts described differently
- **Missing Content**: Code without corresponding documentation
- **Outdated Info**: Documentation that doesn't match current code

## 📊 Validation Report

Provide structured output showing:
- **Health Score**: Overall documentation quality (0-100%)
- **Issues Found**: Categorized list of problems
- **Recommendations**: Specific fixes needed
- **Cross-Reference Map**: Visual representation of documentation relationships

Perfect for running before important releases or after major refactoring!