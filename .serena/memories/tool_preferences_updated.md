# Tool Usage Preferences (Updated 2025-08-18)

## Code Editing
- **PRIMARY**: Use Claude's built-in Edit/MultiEdit tools for all code editing
- **DO NOT USE**: ast-grep, Serena's replace_regex, or other external editing tools

## Code Searching & Navigation
- **PRIMARY**: Use Serena MCP server tools for codebase operations:
  - `mcp__serena__search_for_pattern` - For searching code patterns
  - `mcp__serena__find_symbol` - For finding symbols/functions/classes
  - `mcp__serena__read_file` - For reading files
  - `mcp__serena__get_symbols_overview` - For understanding file structure
  - `mcp__serena__find_referencing_symbols` - For finding references
  - `mcp__serena__list_dir` - For directory listings
  - `mcp__serena__find_file` - For finding files by name

## Documentation
- **PRIMARY**: Use Context7 MCP server for library documentation:
  - `mcp__context7__resolve-library-id` - To get library IDs
  - `mcp__context7__get-library-docs` - To retrieve documentation

## Fallback Tools
- Only use Claude's built-in tools (Read, Grep, LS) if Serena is unavailable
- Use Bash for system operations and git commands

## Important Notes
- Always create git checkpoints before code changes
- Serena is already activated for the affluvia project
- Context7 is available for documentation lookups