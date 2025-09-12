#!/bin/bash

# Schema Drift Check Script
# This script checks for drift between your Drizzle schema and the actual database

echo "🔍 Checking for schema drift between Drizzle and Supabase..."

# Create a temporary directory for introspection
TEMP_DIR="./migrations/_introspect_temp"
mkdir -p $TEMP_DIR

# Run introspection
echo "📊 Introspecting current database schema..."
npx drizzle-kit introspect --out $TEMP_DIR 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ Failed to introspect database"
    rm -rf $TEMP_DIR
    exit 1
fi

# Check if introspected schema exists
if [ ! -f "$TEMP_DIR/schema.ts" ]; then
    echo "❌ No introspected schema found"
    rm -rf $TEMP_DIR
    exit 1
fi

# Compare with existing schema
echo "🔄 Comparing schemas..."
DIFF_OUTPUT=$(diff -u shared/schema.ts $TEMP_DIR/schema.ts 2>&1)

if [ -z "$DIFF_OUTPUT" ]; then
    echo "✅ No schema drift detected!"
    rm -rf $TEMP_DIR
    exit 0
else
    echo "⚠️  Schema drift detected!"
    echo ""
    echo "Differences found:"
    echo "$DIFF_OUTPUT" | head -50
    echo ""
    echo "To fix drift:"
    echo "1. Review the differences above"
    echo "2. Update your schema.ts if needed"
    echo "3. Run: npm run db:push"
    
    # Save the diff for CI
    echo "$DIFF_OUTPUT" > ./migrations/schema-drift.diff
    
    rm -rf $TEMP_DIR
    exit 1
fi