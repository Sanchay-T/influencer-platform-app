Analyze the file at $ARGUMENTS and create a detailed split plan.

1. Read the file
2. Identify logical groupings (by function, by domain, by component)
3. Suggest specific splits with:
   - New filename
   - What to move (function names, line ranges)
   - Import/export changes needed
4. Estimate resulting file sizes

Goal: Each resulting file should be under 300 lines.

If no file is specified, find the largest file in the codebase and analyze that.
