# Code Editing Preferences and Instructions

## Tool Usage Priority for Code Edits

### Priority Order for Code Editing (ALWAYS follow this order):

#### 1. **AST-Based Edits (FIRST CHOICE)**
Use Serena's AST-based symbol editing tools:
- `replace_symbol_body` - Replace entire function/class/method bodies
- `insert_before_symbol` - Insert code before a symbol
- `insert_after_symbol` - Insert code after a symbol

**Advantages:**
- Understands code structure semantically
- Preserves proper indentation automatically
- Less error-prone for structural changes
- Works with symbol names, not text patterns

#### 2. **Diff-Based Edits (SECOND CHOICE)**
Use Claude's built-in editing tools when AST edits aren't suitable:
- `Edit` tool - For single file edits
- `MultiEdit` tool - For multiple edits in one file

**Use when:**
- Making small, precise changes within a function
- AST-based edits would be overkill
- Need to change parts of code that aren't complete symbols

#### 3. **Regex-Based Edits (LAST RESORT)**
Use Serena's `replace_regex` only when absolutely necessary:
- When neither AST nor diff-based edits work
- For complex pattern-based replacements across files
- For non-code files where AST doesn't apply

## Tool Usage Guidelines

### For Code Search and Navigation
**ALWAYS USE SERENA MCP SERVER:**
- `search_for_pattern` - Search for code patterns
- `find_symbol` - Find symbols by name
- `read_file` - Read file contents
- `get_symbols_overview` - Understand file structure
- `find_referencing_symbols` - Find symbol references
- `list_dir` - List directory contents
- `find_file` - Find files by name pattern

### Decision Tree for Edits

1. **Is it a complete symbol (function/class/method)?**
   → Use AST-based: `replace_symbol_body`

2. **Adding new code around existing symbols?**
   → Use AST-based: `insert_before_symbol` or `insert_after_symbol`

3. **Small changes within a function/method?**
   → Use diff-based: `Edit` or `MultiEdit`

4. **Complex pattern replacement or non-code files?**
   → Use regex-based: `replace_regex` (last resort)

## Example Workflows

### Example 1: Updating a Function
```
1. Use find_symbol to locate the function
2. Use replace_symbol_body to replace entire function (AST-based)
```

### Example 2: Adding an Import
```
1. Use get_symbols_overview to find first symbol
2. Use insert_before_symbol to add import before it (AST-based)
```

### Example 3: Fixing a Bug Inside a Function
```
1. Use read_file to see the code
2. Use Edit tool for precise line changes (diff-based)
```

### Example 4: Renaming Variables Across File
```
1. Try find_symbol first (if it's a class property)
2. If not a symbol, use Edit with replace_all flag (diff-based)
3. Only use replace_regex if pattern is complex (last resort)
```

## Important Notes
- Always prefer semantic/structural edits over text manipulation
- AST-based edits preserve code structure better
- Test after each edit to ensure correctness
- Use Serena for reading/searching, appropriate tools for editing