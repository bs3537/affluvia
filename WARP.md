# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Start development server
npm run dev

# Build for production  
npm run build

# Run production server
npm start

# Type checking
npm run check

# Run tests
npm test
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage

# Database operations
npm run db:push        # Push schema changes to database
```

### Testing Specific Files
```bash
# Run a specific test file
NODE_OPTIONS=--experimental-vm-modules jest server/__tests__/monte-carlo.test.ts

# Run tests matching a pattern
NODE_OPTIONS=--experimental-vm-modules jest --testNamePattern="Monte Carlo"
```

## Architecture Overview

### Technology Stack
- **Frontend**: React 18.3 + TypeScript, Wouter routing, Radix UI components, Tailwind CSS
- **Backend**: Express.js + TypeScript, Drizzle ORM, Neon PostgreSQL  
- **AI Integration**: Google Gemini API for financial assistant and document analysis
- **Authentication**: Passport.js with local strategy, bcrypt hashing, PostgreSQL session store
- **Build Tools**: Vite for frontend, esbuild for backend

### Project Structure
```
affluvia/
├── client/               # Frontend React application
│   └── src/
│       ├── components/   # UI components (58+ components)
│       ├── pages/        # Route pages
│       ├── hooks/        # Custom React hooks
│       ├── services/     # API service layer
│       └── contexts/     # React contexts
├── server/               # Backend Express server
│   ├── routes/           # API route handlers
│   ├── __tests__/        # Backend tests
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
│   └── schema.ts         # Drizzle database schema
└── migrations/           # Database migrations
```

### Core System Components

#### Financial Calculation Engines
- **Monte Carlo Simulation**: `server/monte-carlo-enhanced.ts` - Runs 1000+ retirement scenarios
- **Tax Optimization**: Roth conversion engine, tax-loss harvesting, IRMAA threshold monitoring
- **Retirement Planning**: Social Security optimization, withdrawal sequencing, LTC impact modeling
- **Education Planning**: 529 optimization with state-specific tax benefits

#### Key API Endpoints
- `/api/financial-profile` - User financial data management
- `/api/calculate-retirement-monte-carlo` - Monte Carlo simulations
- `/api/optimize-retirement-score` - Retirement optimization
- `/api/chat-messages` - AI assistant interaction
- `/api/goals` - Financial goals management
- `/api/estate-plan` - Estate planning features

## Database Setup

### Configuration
```bash
# Required environment variable
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

### Schema Management
```bash
# Push schema changes to database
npm run db:push

# Generate migrations (if using migrations)
npx drizzle-kit generate

# Run migrations
npx drizzle-kit migrate
```

### Key Tables
- `users` - Authentication and user management
- `financial_profiles` - Comprehensive financial data (JSON fields for complex data)
- `chat_messages` - AI conversation history
- `goals`, `education_goals`, `estate_plans` - Planning features
- `user_achievements`, `user_progress` - Gamification system

## Environment Configuration

Create `.env` file based on `.env.example`:
```bash
# Database
DATABASE_URL=your_neon_database_url

# Session
SESSION_SECRET=your_session_secret

# Google Gemini API
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Email (optional, for admin notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Environment
NODE_ENV=development
```

## Automatic Undo/Revert System

### Git Checkpoint Commands
```bash
# Create checkpoint before code changes (MANDATORY)
git checkpoint "About to [describe changes]"

# Undo last changes
git undo-last

# Interactive undo with checkpoint selection
git undo

# Alternative undo script
./claude-undo.sh undo
./claude-undo.sh undo list     # View checkpoints
./claude-undo.sh undo [number] # Revert to specific checkpoint
```

### User Undo Keywords
When users type these commands, immediately execute undo:
- "undo" → `git undo-last`
- "revert" → `git undo-last`
- "rollback" → `git undo`
- "undo changes" → `git undo-last`

## MCP Server Configuration

### Available MCP Servers
- **Serena**: Primary tool for codebase operations
  - Project path: `/Users/bhavneesh/Desktop/affluvia/affluvia`
  - Language: TypeScript
  - Config: `.serena/project.yml`
- **Context7**: For library documentation and examples

### Tool Usage Priority
1. **Codebase operations**: Use Serena tools
   - `search_for_pattern` instead of grep
   - `read_file` (Serena) for file reading
   - Symbol-based editing methods
2. **Documentation**: Use Context7
3. **Fallback**: Built-in tools only if MCP unavailable

## Code Editing Priorities

### Priority Order for Code Edits
1. **ast-grep CLI tool** - PRIMARY method for structural code modifications
2. **Claude's built-in Edit/MultiEdit tools** - Secondary fallback
3. **Serena AST methods** (if ast-grep unavailable):
   - `replace_symbol_body` - Modify functions/methods/classes
   - `insert_before_symbol` - Add imports or code before symbols
   - `insert_after_symbol` - Add new functions after existing ones

### NEVER Use These Methods
- ❌ `replace_regex` (Serena)
- ❌ `replace_lines` (Serena)  
- ❌ Diff-based editing
- ❌ Write tool (except for new files)

## Search Tools

### 🎯 COMPREHENSIVE INDEXING SYSTEM (ACTIVE)

Your codebase is now fully indexed with **27,807 source files** across multiple search engines.

#### Primary Search Interface
```bash
# Unified search across all engines (RECOMMENDED)
npx tsx unified-codebase-search.ts "search_term"

# Examples:
npx tsx unified-codebase-search.ts "runEnhancedMonteCarloSimulation"
npx tsx unified-codebase-search.ts "RetirementConfidenceScore" zoekt
npx tsx unified-codebase-search.ts "/api/financial-profile" enhanced
```

#### Direct Zoekt Search (Fastest)
```bash
# Financial functions
$HOME/go/bin/zoekt -index_dir ~/.zoekt "runEnhanced.*Simulation"

# React components
$HOME/go/bin/zoekt -index_dir ~/.zoekt "function.*Component"

# API endpoints
$HOME/go/bin/zoekt -index_dir ~/.zoekt "app\\.(get|post)"
```

#### Legacy Search Helpers (Still Available)
```bash
# Command-line search tool with multiple modes
./search-helper.sh [search_term]

# Enhanced TypeScript search API
./enhanced-codebase-search.ts

# Warp-specific search
./warp-search.sh

# Zoekt indexed search scripts
./scripts/zoekt-index.sh     # Re-index codebase
./scripts/zoekt-search.sh    # Search with Zoekt
```

#### Search Categories Optimized
- **Financial**: Monte Carlo, retirement calculations, tax optimization
- **Components**: React components, hooks, contexts
- **API**: Express routes, endpoints, middleware
- **Database**: Drizzle ORM, queries, schema

#### Performance Guide
- **Zoekt**: Lightning-fast exact matches (~26MB index)
- **Enhanced**: Semantic/contextual searches with categorization
- **Grep**: Complex regex patterns and fallback
- **Unified**: Combines all engines for comprehensive results

## Key Development Patterns

### Financial Calculations
- All retirement projections use **nominal approach** (not inflation-adjusted)
- Monte Carlo simulations run 1000 scenarios minimum
- Success probability target: 80%+ for retirement confidence

### Data Persistence
- Complex financial data stored as JSON in PostgreSQL
- Monte Carlo results cached in `financial_profiles` table
- Optimization variables persisted across sessions

### Testing Approach
- Backend tests in `server/__tests__/`
- Jest with ts-jest for TypeScript support
- ESM modules require `NODE_OPTIONS=--experimental-vm-modules`

### Code Patterns to Follow
- Maintain existing patterns found in codebase
- Never create documentation files unless explicitly requested
- Prefer editing existing files over creating new ones
- Follow TypeScript strict mode requirements
