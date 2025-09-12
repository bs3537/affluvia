# Tool Preferences for Code Search (Updated 2025-08-20)

## Search Tool Priority Order

### PRIMARY TOOL: Zoekt (Installed and Configured)
**Use Zoekt FIRST for all code searches**

Zoekt is a fast, indexed code search engine from Sourcegraph that provides:
- Lightning-fast regex and literal searches
- Pre-indexed codebase for instant results
- Web interface for visual searching
- Support for complex queries

#### Zoekt Installation Details:
- **Location**: ~/go/bin/zoekt, ~/go/bin/zoekt-index, ~/go/bin/zoekt-webserver
- **Index Location**: ~/.zoekt-index
- **Helper Script**: ./zoekt-search.sh (in project root)

#### How to use Zoekt:
```bash
# Search for a pattern
./zoekt-search.sh "SelfEmployedStrategiesTab"

# Search for files
./zoekt-search.sh -f "*.tsx"

# Regex search
./zoekt-search.sh -r "useQuery.*financial-profile"

# Start web interface (http://localhost:6070)
./zoekt-search.sh -web

# Reindex after major changes
./zoekt-search.sh -reindex

# Direct commands (if needed)
~/go/bin/zoekt -index_dir ~/.zoekt-index "search term"
```

### SECONDARY TOOL: Serena MCP
**Use Serena as fallback when Zoekt is not suitable**

Serena is good for:
- AST-based symbol searches
- Code editing and refactoring
- Understanding code structure
- When you need context around symbols

### TERTIARY TOOLS: Built-in Claude Tools
**Use only when Zoekt and Serena are not appropriate**

- Grep tool
- Glob tool
- Read tool

## Search Strategy

1. **For finding code/patterns**: Use Zoekt first
   - `./zoekt-search.sh "pattern"`
   
2. **For symbol understanding**: Use Serena
   - `find_symbol`, `get_symbols_overview`
   
3. **For simple file reads**: Use Read tool directly
   - When you know exact file path

## Important Notes
- Zoekt index needs to be updated after significant code changes
- Run `./zoekt-search.sh -reindex` periodically
- Web interface at http://localhost:6070 is great for interactive searching
- Zoekt is especially fast for regex searches across the entire codebase