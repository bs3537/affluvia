#!/bin/bash

# Enhanced Codebase Search Helper
# Optimized for fast, comprehensive searches

PROJECT_ROOT="/Users/bhavneesh/Desktop/affluvia/affluvia"
cd "$PROJECT_ROOT"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to perform intelligent search
smart_search() {
    local query="$1"
    local context="${2:-10}"
    
    echo -e "${CYAN}🔍 Smart Search: ${query}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Search in TypeScript/React files
    echo -e "\n${YELLOW}📁 TypeScript/React Files:${NC}"
    rg "$query" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        -C "$context" \
        --pretty \
        --stats \
        --max-count 5 \
        2>/dev/null | head -100
    
    # Search in JavaScript files
    echo -e "\n${YELLOW}📁 JavaScript Files:${NC}"
    rg "$query" \
        --type js \
        -C "$context" \
        --pretty \
        --max-count 3 \
        2>/dev/null | head -50
    
    # Search in SQL files
    echo -e "\n${YELLOW}📁 SQL/Migration Files:${NC}"
    rg "$query" \
        --type sql \
        -C "$context" \
        --pretty \
        2>/dev/null | head -50
}

# Function to find function definitions
find_function() {
    local func_name="$1"
    
    echo -e "${CYAN}🔍 Finding Function: ${func_name}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    rg "(function|const|export|class)\s+${func_name}|${func_name}\s*[=:]\s*(async\s*)?\(" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        --type js \
        -C 15 \
        --pretty
}

# Function to find API endpoints
find_endpoints() {
    local endpoint="$1"
    
    echo -e "${CYAN}🔍 Finding API Endpoints: ${endpoint}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    rg "app\.(get|post|put|delete|patch).*${endpoint}" \
        --type ts \
        -C 20 \
        --pretty
}

# Function to trace data flow
trace_flow() {
    local variable="$1"
    
    echo -e "${CYAN}🔍 Tracing Data Flow: ${variable}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo -e "\n${GREEN}1. Definitions:${NC}"
    rg "const\s+${variable}|let\s+${variable}|var\s+${variable}|${variable}:" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        -C 5 \
        --max-count 5
    
    echo -e "\n${GREEN}2. Assignments:${NC}"
    rg "${variable}\s*=" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        -C 3 \
        --max-count 5
    
    echo -e "\n${GREEN}3. Function Calls:${NC}"
    rg "${variable}\(" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        -C 3 \
        --max-count 5
    
    echo -e "\n${GREEN}4. Imports/Exports:${NC}"
    rg "(import|export).*${variable}" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        --max-count 10
}

# Function to analyze a component
analyze_component() {
    local component="$1"
    
    echo -e "${CYAN}🔍 Analyzing Component: ${component}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo -e "\n${GREEN}Definition:${NC}"
    rg "function ${component}|const ${component}.*=|export.*${component}" \
        --type-add 'tsx:*.tsx' \
        --type tsx \
        -C 20 \
        --max-count 1
    
    echo -e "\n${GREEN}Usage:${NC}"
    rg "<${component}" \
        --type-add 'tsx:*.tsx' \
        --type tsx \
        -C 5 \
        --max-count 5
    
    echo -e "\n${GREEN}Props Interface:${NC}"
    rg "interface.*${component}Props|type.*${component}Props" \
        --type-add 'tsx:*.tsx' \
        --type-add 'ts:*.ts' \
        --type tsx \
        --type ts \
        -C 10 \
        --max-count 1
}

# Function to find database operations
find_db_ops() {
    local table="$1"
    
    echo -e "${CYAN}🔍 Finding Database Operations: ${table}${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo -e "\n${GREEN}Schema Definition:${NC}"
    rg "${table}" shared/schema.ts -C 10 2>/dev/null
    
    echo -e "\n${GREEN}Migrations:${NC}"
    rg "${table}" migrations/*.sql -C 5 2>/dev/null
    
    echo -e "\n${GREEN}Storage Operations:${NC}"
    rg "${table}" server/storage.ts -C 10 2>/dev/null
    
    echo -e "\n${GREEN}API Routes:${NC}"
    rg "${table}" server/routes.ts -C 10 2>/dev/null
}

# Main menu
case "$1" in
    "search")
        smart_search "$2" "${3:-10}"
        ;;
    "function")
        find_function "$2"
        ;;
    "endpoint")
        find_endpoints "$2"
        ;;
    "flow")
        trace_flow "$2"
        ;;
    "component")
        analyze_component "$2"
        ;;
    "db")
        find_db_ops "$2"
        ;;
    "all")
        smart_search "$2" 5
        echo -e "\n${PURPLE}════════════════════════════════════════${NC}\n"
        find_function "$2"
        echo -e "\n${PURPLE}════════════════════════════════════════${NC}\n"
        trace_flow "$2"
        ;;
    *)
        echo -e "${CYAN}Enhanced Codebase Search Helper${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Usage: ./search-helper.sh [command] [query] [options]"
        echo ""
        echo "Commands:"
        echo "  search [query] [context]  - Smart search across all files"
        echo "  function [name]           - Find function definitions"
        echo "  endpoint [path]           - Find API endpoints"
        echo "  flow [variable]           - Trace data flow"
        echo "  component [name]          - Analyze React component"
        echo "  db [table]               - Find database operations"
        echo "  all [query]              - Run all searches"
        echo ""
        echo "Examples:"
        echo "  ./search-helper.sh search optimizationVariables"
        echo "  ./search-helper.sh function handleLockToggle"
        echo "  ./search-helper.sh endpoint financial-profile"
        echo "  ./search-helper.sh flow optimizedScore"
        echo "  ./search-helper.sh component RetirementPlanning"
        echo "  ./search-helper.sh db financial_profiles"
        ;;
esac