# Context7 MCP Server Setup Guide

Context7 is a Model Context Protocol (MCP) server that provides real-time, version-specific documentation directly to Claude Code, improving code generation accuracy by 30-50%.

## Quick Setup

Run the automated setup script:
```bash
./setup-context7.sh
```

## Manual Setup

### 1. Install Context7

Choose one of these methods:

```bash
# Method 1: Quick test (runs immediately)
npx -y @upstash/context7-mcp@latest

# Method 2: Global installation (recommended)
npm install -g @upstash/context7-mcp

# Method 3: Via Docker
docker run -d -p 3000:3000 ghcr.io/upstash/context7-mcp:latest
```

### 2. Configure Claude

Create the configuration file:
```bash
mkdir -p ~/.config/claude
```

Add to `~/.config/claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "transportType": "stdio",
      "timeout": 60,
      "autoApprove": ["resolve-library-id", "get-library-docs"]
    }
  }
}
```

### 3. Restart Claude Code

After configuration, restart Claude Code for changes to take effect.

## Usage

Start prompts with "use context7" to activate documentation fetching:

### Basic Examples
- `use context7 Create a React component with TypeScript`
- `use context7 Setup PostgreSQL with Drizzle ORM`
- `use context7 Configure Vite for production`

### For Affluvia Project
- `use context7 Implement Drizzle schema for financial profiles`
- `use context7 Create React Query mutations with TypeScript`
- `use context7 Setup Express.js middleware for authentication`
- `use context7 Configure Neon PostgreSQL connection`

### Advanced Usage
- Version-specific: `use context7 Next.js 14 app router patterns`
- Multi-library: `use context7 Integrate Stripe with Express.js and TypeScript`
- With reasoning: `use context7 ultra think Optimize React performance`

## Benefits for Your Stack

Context7 will provide accurate, up-to-date documentation for:
- **React 18+**: Hooks, patterns, performance
- **TypeScript 5+**: Type inference, generics, decorators
- **Drizzle ORM**: Schema definition, queries, migrations
- **Vite**: Build optimization, plugins, config
- **Express.js**: Middleware, routing, error handling
- **Tailwind CSS**: Utilities, components, themes
- **Framer Motion**: Animations, gestures, transitions

## Troubleshooting

### Context7 not working?
1. Check Node version: `node --version` (should be 18+)
2. Verify config file exists: `cat ~/.config/claude/claude_desktop_config.json`
3. Test server: `npx @upstash/context7-mcp@latest --version`

### Claude not recognizing "use context7"?
1. Restart Claude Code completely
2. Check for syntax errors in config JSON
3. Try with explicit path: `"command": "/usr/local/bin/npx"`

### Performance issues?
- Use local installation instead of npx
- Limit queries to specific libraries
- Clear cache with `/clear` command

## Token Usage Optimization

Context7 increases token usage by 20-50% due to injected documentation. To optimize:
1. Be specific in prompts (e.g., "Drizzle PostgreSQL connection" vs "database setup")
2. Use version numbers when needed
3. Combine related queries in one prompt

## Security Notes

- Context7 runs locally by default (no data leaves your machine)
- Auto-approve is limited to documentation tools only
- No authentication required for local usage
- Remote hosting requires proper security configuration

## Next Steps

After setup:
1. Test with: `use context7 Show React 18 concurrent features`
2. Integrate into workflow for all library-specific tasks
3. Combine with other MCP servers for enhanced capabilities

For questions or issues, check:
- GitHub: https://github.com/upstash/context7
- Discord: Upstash community
- Claude Code docs: /help command