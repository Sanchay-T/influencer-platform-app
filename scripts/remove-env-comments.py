#!/usr/bin/env python3
"""
Script to remove comment lines from .env.local and create .env.local.copy

Removes lines where the first non-whitespace character is '#'.
Preserves empty lines and lines with actual environment variables.
"""

import sys
from pathlib import Path


def remove_comments(input_file: str, output_file: str) -> None:
    """
    Read input file, remove comment lines, and write to output file.
    
    Args:
        input_file: Path to the input .env file
        output_file: Path to the output file
    """
    input_path = Path(input_file)
    
    if not input_path.exists():
        print(f"Error: Input file '{input_file}' does not exist.", file=sys.stderr)
        sys.exit(1)
    
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Filter out comment lines (lines where first non-whitespace char is '#')
        filtered_lines = []
        for line in lines:
            stripped = line.lstrip()
            # Keep the line if it's empty or doesn't start with '#'
            if not stripped or not stripped.startswith('#'):
                filtered_lines.append(line)
        
        # Write to output file
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.writelines(filtered_lines)
        
        print(f"Successfully created '{output_file}' with {len(filtered_lines)} lines (removed {len(lines) - len(filtered_lines)} comment lines).")
    
    except Exception as e:
        print(f"Error processing file: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    input_file = '.env.local'
    output_file = '.env.local.copy'
    
    remove_comments(input_file, output_file)











