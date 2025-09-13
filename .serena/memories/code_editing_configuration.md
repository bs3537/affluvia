# Code Editing Configuration (PERMANENT - Updated 2025-01-19)

## ✅ APPROVED EDITING METHODS (IN STRICT PRIORITY ORDER)

### 1. PRIMARY METHOD - AST-BASED CODE EDITING
**ALWAYS TRY FIRST:**
- **ast-grep CLI** - Primary AST tool
  ```bash
  ast-grep --pattern '[pattern]' --rewrite '[replacement]'
  ```
- **Serena AST Methods** (if ast-grep unavailable):
  - ✅ `replace_symbol_body` - Replace entire functions/methods/classes
  - ✅ `insert_before_symbol` - Add code before symbols
  - ✅ `insert_after_symbol` - Add code after symbols

**Benefits of AST-based editing:**
- Understands code structure, not just text
- Preserves syntax and formatting
- Prevents breaking code with partial matches
- More reliable for complex refactoring

### 2. SECONDARY METHOD - DIFF-BASED CODE EDITING
**USE IF AST METHODS UNAVAILABLE:**
- Generate and apply diffs for code changes
- Useful for reviewing changes before applying
- Good for multi-line modifications with context

**How to use diff-based editing:**
1. Read the current code
2. Create a diff showing old vs new code
3. Apply the diff to make changes

### 3. TERTIARY METHOD - Claude's Built-in Tools
**FALLBACK OPTIONS:**
- `Edit` tool - For simple text replacements
- `MultiEdit` tool - For multiple edits in one file

## ⛔ PERMANENTLY DISABLED FUNCTIONS
**NEVER USE THESE - NO EXCEPTIONS:**
- ❌ `replace_regex` (Serena) - PERMANENTLY DISABLED
- ❌ `replace_lines` (Serena) - PERMANENTLY DISABLED
- ❌ `Write` tool - Only for creating NEW files, never for editing

## ✅ APPROVED SERENA FUNCTIONS FOR READING/SEARCHING
- `search_for_pattern` - Search for code patterns
- `find_symbol` - Locate specific symbols
- `get_symbols_overview` - Understand file structure
- `read_file` - Read file contents
- `find_file` - Find files by name
- `list_dir` - List directory contents
- `find_referencing_symbols` - Find symbol references

## EDITING WORKFLOW
1. **Search/Read** - Use Serena search tools to understand code
2. **Choose Method**:
   - First: Try AST-based editing (ast-grep or Serena AST methods)
   - Second: Use diff-based editing if AST unavailable
   - Third: Use Claude's Edit/MultiEdit as last resort
3. **Verify** - Check changes were applied correctly

## ENFORCEMENT RULES
1. **STRICT PRIORITY**: Always try AST-based first, then diff-based
2. **BANNED FOREVER**: replace_regex and replace_lines are permanently disabled
3. **NO EXCEPTIONS**: Even if user requests regex replacement, use AST or diff instead
4. **QUALITY FOCUS**: Prioritize code structure understanding over text manipulation

## RATIONALE
- AST-based editing understands code semantics, not just text patterns
- Diff-based editing provides clear change visualization
- Both methods are more reliable than regex for code modifications
- This hierarchy ensures maximum code safety and quality

---
**THIS CONFIGURATION IS PERMANENT AND APPLIES TO ALL FUTURE SESSIONS**