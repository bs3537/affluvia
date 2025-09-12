# Code Editing Preferences (Updated 2025-08-20)

## Search Tool Priority (UPDATED - Zoekt is now PRIMARY)

### 1. PRIMARY: Zoekt (FASTEST - Use First!)
```bash
# Use for all code searches
./zoekt-search.sh "search pattern"
./zoekt-search.sh -f "*.tsx"  # File search
./zoekt-search.sh -r "regex"  # Regex search
```

### 2. SECONDARY: Serena MCP Tools
- Use for AST-based operations
- Symbol lookups and references
- Code structure understanding

### 3. TERTIARY: Built-in Tools
- Grep, Glob, Read - use only as fallback

## Code Editing Method (Unchanged)

### PRIORITY 1 - PRIMARY METHOD:
- **Claude's built-in Edit/MultiEdit tools**: Preferred for all code edits

### PRIORITY 2 - SECONDARY METHODS:
- **Serena AST-based methods**:
  - `replace_symbol_body`: Modify entire functions/methods/classes
  - `insert_before_symbol`: Add imports or code before symbols
  - `insert_after_symbol`: Add new functions after existing ones

### PROHIBITED METHODS:
- ❌ `replace_regex` (Serena) - DO NOT USE
- ❌ `replace_lines` (Serena) - DO NOT USE
- ❌ Diff-based editing - DO NOT USE
- ❌ Write tool (except for new files)

## Workflow Example

1. **Search with Zoekt first**:
   ```bash
   ./zoekt-search.sh "ComponentName"
   ```

2. **Read specific file**:
   ```
   Read tool or mcp__serena__read_file
   ```

3. **Edit with Claude's tools**:
   ```
   Edit or MultiEdit tool
   ```

## Remember
- Always create git checkpoint before edits
- Reindex Zoekt after major changes: `./zoekt-search.sh -reindex`
- Web UI available: `./zoekt-search.sh -web`