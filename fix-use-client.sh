#!/bin/bash

# Script to fix 'use client' directive placement issues
# The directive must come BEFORE any imports

echo "🔧 Fixing 'use client' directive placement issues..."

# Find all TypeScript/JavaScript files with the pattern
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.next/*" \
  -not -path "*/dist/*" \
  -exec grep -l "^import.*$" {} \; | while read -r file; do

  # Check if file has 'use client' directive after imports
  if grep -q "^import" "$file" && grep -q "^'use client'" "$file"; then
    # Check if 'use client' comes after any import
    first_import_line=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
    use_client_line=$(grep -n "^'use client'" "$file" | cut -d: -f1)

    if [ "$use_client_line" -gt "$first_import_line" ]; then
      echo "  📝 Fixing: $file"

      # Create a temporary file
      temp_file=$(mktemp)

      # Extract the 'use client' line
      use_client_directive=$(grep "^'use client'" "$file")

      # Remove the 'use client' line from the file
      grep -v "^'use client'" "$file" > "$temp_file"

      # Add 'use client' at the top, then the rest of the file
      {
        echo "$use_client_directive"
        echo ""
        cat "$temp_file"
      } > "$file"

      # Clean up
      rm "$temp_file"

      echo "  ✅ Fixed: $file"
    fi
  fi
done

echo ""
echo "✅ All 'use client' directives have been fixed!"
