#!/bin/bash

# Warp-optimized search script for the codebase
# Uses ripgrep (rg) which Warp indexes efficiently

echo "🔍 Warp Codebase Search Tool"
echo "=========================="

# Function to search for optimization-related code
search_optimization() {
    echo "📊 Searching for optimization variables persistence..."
    rg "optimizationVariables|handleLockToggle|Lock Variables.*Save" \
        --type ts \
        --type tsx \
        --type js \
        --type jsx \
        -C 3 \
        --pretty \
        --stats
}

# Function to find database persistence
search_persistence() {
    echo "💾 Searching for database persistence..."
    rg "updateFinancialProfile.*optimization|optimization_variables.*jsonb" \
        --type ts \
        --type sql \
        -C 3 \
        --pretty
}

# Function to find API endpoints
search_endpoints() {
    echo "🌐 Searching for API endpoints..."
    rg "PUT.*financial-profile|optimizationVariables.*PUT" \
        --type ts \
        -C 5 \
        --pretty
}

# Main menu
case "$1" in
    "optimize")
        search_optimization
        ;;
    "persist")
        search_persistence
        ;;
    "api")
        search_endpoints
        ;;
    "all")
        search_optimization
        echo ""
        search_persistence
        echo ""
        search_endpoints
        ;;
    *)
        echo "Usage: ./warp-search.sh [optimize|persist|api|all]"
        echo ""
        echo "Commands:"
        echo "  optimize - Search for optimization variable handling"
        echo "  persist  - Search for database persistence code"
        echo "  api      - Search for API endpoints"
        echo "  all      - Run all searches"
        echo ""
        echo "Warp Terminal Tips:"
        echo "  • Press # to use AI search"
        echo "  • Press Cmd+Shift+Space for Warp AI"
        echo "  • Use 'rg' for fast indexed searches"
        ;;
esac