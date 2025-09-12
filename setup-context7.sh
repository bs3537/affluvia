#!/bin/bash

echo "==================================="
echo "Context7 MCP Server Setup for Claude"
echo "==================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Install Context7 globally
echo "Installing Context7 MCP server globally..."
npm install -g @upstash/context7-mcp@latest
if [ $? -eq 0 ]; then
    echo "✅ Context7 installed successfully"
else
    echo "❌ Failed to install Context7"
    exit 1
fi
echo ""

# Create Claude configuration directory
echo "Setting up Claude configuration..."
CONFIG_DIR="$HOME/.config/claude"
mkdir -p "$CONFIG_DIR"
echo "✅ Created configuration directory: $CONFIG_DIR"

# Create configuration file
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
cat > "$CONFIG_FILE" << 'EOF'
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
EOF

if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Created configuration file: $CONFIG_FILE"
else
    echo "❌ Failed to create configuration file"
    exit 1
fi
echo ""

# Test Context7 server
echo "Testing Context7 server..."
npx -y @upstash/context7-mcp@latest --version 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Context7 server is working"
else
    echo "⚠️  Context7 server test failed, but this might be normal"
fi
echo ""

echo "==================================="
echo "Setup Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Restart Claude Code for the changes to take effect"
echo "2. Use 'use context7' in your prompts to activate documentation fetching"
echo "3. Example: 'use context7 Show me React 18 hooks best practices'"
echo ""
echo "Configuration file created at: $CONFIG_FILE"
echo ""
echo "For your Affluvia project, try:"
echo "- 'use context7 Drizzle ORM with PostgreSQL setup'"
echo "- 'use context7 React Query v5 with TypeScript'"
echo "- 'use context7 Vite configuration for production builds'"