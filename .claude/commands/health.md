Run the codebase health check to see:
- Total files and lines of code
- Oversized files (>300 lines) that need refactoring
- Overall health score

Execute: `bash .claude/hooks/complexity-budget.sh`

Then summarize the results and suggest which files to refactor first (prioritize by size and importance).
