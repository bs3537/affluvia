#!/bin/bash

# Zoekt search script for affluvia codebase
# Usage: ./zoekt-search.sh "search query"

export PATH="$HOME/go/bin:$PATH"

# If no arguments, show help
if [ $# -eq 0 ]; then
    echo "Zoekt Codebase Search Tool"
    echo "=========================="
    echo "Usage:"
    echo "  ./zoekt-search.sh \"search query\"     - Search for a pattern"
    echo "  ./zoekt-search.sh -f \"filename\"      - Search for files"
    echo "  ./zoekt-search.sh -r \"regex\"         - Search with regex"
    echo "  ./zoekt-search.sh -web               - Start web interface"
    echo "  ./zoekt-search.sh -reindex            - Reindex the codebase"
    echo ""
    echo "Examples:"
    echo "  ./zoekt-search.sh \"SelfEmployedStrategiesTab\""
    echo "  ./zoekt-search.sh -f \"*.tsx\""
    echo "  ./zoekt-search.sh -r \"class.*Component\""
    exit 0
fi

# Handle special commands
if [ "$1" = "-web" ]; then
    echo "Starting Zoekt web server at http://localhost:6070"
    exec ~/go/bin/zoekt-webserver -index ~/.zoekt-index -listen :6070
elif [ "$1" = "-reindex" ]; then
    echo "Reindexing codebase..."
    ~/go/bin/zoekt-index -index ~/.zoekt-index .
    echo "Reindexing complete!"
elif [ "$1" = "-f" ]; then
    # File search
    ~/go/bin/zoekt -index_dir ~/.zoekt-index -f "$2"
elif [ "$1" = "-r" ]; then
    # Regex search
    ~/go/bin/zoekt -index_dir ~/.zoekt-index -e "$2"
else
    # Regular search
    ~/go/bin/zoekt -index_dir ~/.zoekt-index "$@"
fi