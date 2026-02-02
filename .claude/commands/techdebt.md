---
name: techdebt
description: Scan for technical debt, duplicated code, and code smells
---

Scan this codebase for technical debt and code quality issues:

1. **Duplicated Code**: Find repeated logic that should be extracted into shared utilities
2. **Dead Code**: Find unused functions, components, or exports
3. **Type Issues**: Find `any` types, missing types, or type assertions that could be improved
4. **TODO/FIXME**: Find all TODO and FIXME comments and list them
5. **Large Files**: Find files over 300 lines that might need splitting
6. **Complex Functions**: Find functions with high cyclomatic complexity

For each issue found:
- State the file and line
- Explain the problem
- Suggest a fix

At the end, provide a prioritized list of the top 5 issues to address first.
