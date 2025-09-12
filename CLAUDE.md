

## 🔄 AUTOMATIC UNDO/REVERT SYSTEM (MANDATORY)

### CRITICAL: Checkpoint Before Code Changes
**You MUST create a checkpoint before ANY code modifications:**
```bash
git checkpoint "About to [describe what you're doing]"
```

### User Undo Commands
When users type any of these in the message box, immediately execute the undo:
- "undo" → Run: `git undo-last`
- "revert" → Run: `git undo-last`
- "rollback" → Run: `git undo` (shows checkpoint selection)
- "undo changes" → Run: `git undo-last`

### Available Undo Commands
- `git undo-last` - Instantly revert to last checkpoint (no questions asked)
- `git undo` - Interactive rollback with checkpoint list
- `./claude-undo.sh undo` - Alternative undo with nice formatting
- `./claude-undo.sh undo list` - View all checkpoints
- `./claude-undo.sh undo [number]` - Revert to specific checkpoint

### Checkpoint Best Practices
1. Create checkpoint BEFORE starting code edits
2. Use descriptive messages: `git checkpoint "Adding API endpoint for user settings"`
3. Multiple checkpoints for complex tasks
4. Always checkpoint before risky operations (deletions, major refactors)

### Example Workflow
```bash
# Before making changes
git checkpoint "Implementing new UI component"
# ... make code changes ...
# If user wants to undo
git undo-last  # Instantly back to checkpoint
```

---

Use Context7 MCP server at starting Claude CLI.

MCP Servers to connect at startup:
- **Context7**: For retrieving up-to-date documentation and code examples for any library

## Tool Usage Priority
1. **For documentation**: Use Context7
2. **For codebase operations**: Use built-in Claude tools
3. **Fallback**: Standard toolset as needed

## Code Editing Method (MANDATORY - UPDATED 2025-08-15)
**Code editing priority order for ALL code edits:**

### PRIORITY 1 - PRIMARY METHOD (USE FIRST):
- **`ast-grep CLI tool`**: Preferred AST-based code editing tool for precise structural modifications
  - Use for all function, class, and method modifications
  - Provides reliable AST-based editing with proper syntax preservation

### PRIORITY 2 - SECONDARY METHODS (USE IF AST-GREP UNAVAILABLE):
- **Claude's built-in Edit/MultiEdit tools**: Fallback for code editing


Use Claude Opus 4.1 with extended thinkng model for planning and Claude Sonnet 4 with extended thinking model for making code edits. 

Think step by step.


# Affluvia - AI-Powered Financial Planning App

## Overview
Affluvia is an AI-powered financial planning application designed to democratize financial planning by making it accessible and affordable for retail investors.

## Core User Flow

1. **Data Collection**: Users complete a comprehensive intake form with their financial information
2. **Backend Processing**: The submitted data is processed using backend logic integrated with Google Gemini API
3. **Financial Analysis**: The system calculates various financial metrics including:
   - Financial Health Score
   - Net Worth
   - Monthly Cash Flow
   - Investor Risk Profile (for both user and spouse)
   - Current Asset Allocation
   - Recommended Asset Allocation (personalized for both user and spouse)
   - Emergency Readiness Score
   - Retirement Readiness Score
   - Life Goals Success Probability
   - Personalized Recommendations based on intake form data
   - Retirement Prep Center
   - Education funding center
   - Estate planning center
   - Tax strategies center
   - Investment planning center

4. **Dashboard Display**: All calculated metrics and recommendations are displayed on the financial dashboard
5. **AI Assistant**: After form completion, users can interact with an AI assistant (powered by Gemini API) for personalized financial advice and answers to their questions

## Architecture & Technology Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Routing**: Wouter 3.3.5
- **State Management**: React Context API, React Query (TanStack Query 5.60.5)
- **UI Components**: 
  - Radix UI (extensive component library)
  - Tailwind CSS 3.4.17 for styling
  - Tailwind Merge, Class Variance Authority for dynamic styling
  - Framer Motion 11.13.1 for animations
- **Forms**: React Hook Form 7.55.0 with Zod validation
- **Charts**: Chart.js 4.5.0, React-Chartjs-2, Recharts
- **Icons**: Lucide React, React Icons
- **Build Tool**: Vite 5.4.14

### Backend
- **Runtime**: Node.js with Express.js 4.21.2
- **Language**: TypeScript 5.6.3
- **Database**: Neon (PostgreSQL) with Drizzle ORM 0.39.1
- **Authentication**: Passport.js with local strategy, bcrypt for password hashing
- **Session Management**: Express Session with PostgreSQL store (connect-pg-simple)
- **API Integration**: Google Generative AI SDK 0.24.1
- **File Processing**: Multer for file uploads, PDF-parse for PDF processing

## Core Features

### 1. Comprehensive Financial Dashboard
- Net Worth tracking
- Monthly cash flow analysis
- Financial Health Score
- Emergency & Retirement Readiness scores
- Real-time financial metrics visualization

### 2. Advanced Retirement Planning
- Monte Carlo simulation (1000+ scenarios)
- Social Security optimization
- Dynamic withdrawal strategies (Guyton-Klinger guardrails)
- Tax-efficient withdrawal sequencing
- Long-term care (LTC) impact modeling
- Stochastic life expectancy calculations

### 3. Investment Management Center
- Portfolio analysis & recommendations
- Asset allocation optimization
- Risk profile assessment (user & spouse)
- Tax-efficient investment strategies

### 4. Tax Optimization Tools
- Roth conversion calculator & engine
- Tax-loss harvesting recommendations
- IRMAA threshold monitoring
- State-specific tax analysis
- Automated tax return analysis via Gemini AI

### 5. Education Planning Center
- 529 plan optimization
- College cost projections with Monte Carlo analysis
- Financial aid optimization
- State-specific tax benefit calculations

### 6. Estate Planning Center
- Document management & tracking
- Beneficiary management
- Trust planning tools
- Estate tax analysis

### 7. AI-Powered Features
- Personalized financial assistant (Gemini AI)
- Automated financial recommendations
- Document analysis (tax returns, estate docs)
- Context-aware financial insights

## Financial Calculation Engines

- **Monte Carlo Simulation Engine**: Runs retirement scenarios with market volatility modeling
- **Tax Calculator**: Federal & state tax calculations with bracket optimization
- **Roth Conversion Engine**: Multi-year conversion optimization with tax impact analysis
- **Net Worth Projections**: Account-level balance projections with tax considerations
- **Cash Flow Modeling**: Detailed income/expense projections through retirement

We are using nominal approach in retirement projections and retirement planning optimization. 

## Database Schema

### Primary Tables
- `users`: Authentication and user management
- `financial_profiles`: Comprehensive financial data storage with JSON fields for complex data
- `chat_messages`: AI assistant conversation history
- `pdf_reports`: Generated financial reports
- `goals`: User financial goals
- `education_goals`, `education_scenarios`: Education planning
- `estate_plans`, `estate_documents`, `estate_beneficiaries`: Estate planning
- `investment_cache`: Investment recommendations caching
- `user_achievements`, `user_progress`, `section_progress`: Gamification system

### Key Features of Schema
- JSON fields for complex nested data (calculations, monte carlo results, optimization variables)
- Comprehensive relationship management between tables
- Support for spouse data throughout the system

## API Endpoints

### Financial Profile
- GET `/api/financial-profile` - Retrieve user's financial profile
- PUT `/api/financial-profile` - Update financial profile
- POST `/api/financial-profile/recalculate` - Recalculate all financial metrics

### Retirement Planning
- PUT `/api/retirement-planning-data` - Update retirement planning data
- POST `/api/calculate-retirement-monte-carlo` - Run Monte Carlo simulation
- POST `/api/optimize-retirement-score` - Optimize retirement variables
- GET `/api/retirement-optimization-suggestions` - Get AI-powered suggestions
- POST `/api/calculate-net-worth-projections` - Calculate net worth projections
- POST `/api/calculate-withdrawal-sequence` - Calculate optimal withdrawal sequence

### Tax Planning
- POST `/api/analyze-tax-return` - Analyze uploaded tax return
- POST `/api/generate-tax-recommendations` - Generate tax recommendations
- GET `/api/tax-overview` - Get tax overview and analysis

### Goals & Tasks
- GET/POST/PATCH/DELETE `/api/goals` - Goal management
- GET/POST/PATCH/DELETE `/api/goals/:goalId/tasks` - Task management

### Estate Planning
- GET/POST/PATCH `/api/estate-plan` - Estate plan management
- GET/POST/PATCH/DELETE `/api/estate-documents` - Document management
- GET/POST/PATCH/DELETE `/api/estate-beneficiaries` - Beneficiary management

### AI & Chat
- GET/POST `/api/chat-messages` - AI chat functionality
- POST `/api/generate-report` - Generate PDF reports

## Gamification & Engagement

- Achievement system with 50+ financial milestones
- Progress tracking with XP and levels
- Section-specific progress monitoring
- Streak tracking for consistent engagement
- Personalized tips and recommendations

## Data Persistence & Optimization

- Comprehensive profile storage with JSON fields
- Monte Carlo result caching
- Optimization variable persistence
- Session management with PostgreSQL store
- Intelligent caching strategies for expensive calculations

## Key Differentiators

1. **Democratized Financial Planning**: Affordable, AI-powered planning for retail investors
2. **Comprehensive Integration**: All financial aspects in one platform
3. **Advanced Modeling**: Institutional-grade Monte Carlo simulations
4. **Spouse Integration**: Dual risk profiles and coordinated planning
5. **Real-time Optimization**: Dynamic adjustment of retirement variables
6. **CFP Board Alignment**: Follows professional financial planning standards

## Performance Metrics

- Monte Carlo simulations: 1000 scenarios per run
- Success probability targets: 80%+ for retirement confidence
- Tax optimization potential: $15K-50K lifetime savings
- Retirement score improvement: 12-15% average through optimization

## Environment Configuration
The app requires:
- `DATABASE_URL`: Neon PostgreSQL connection string
- `GOOGLE_GEMINI_API_KEY`: For AI features
- `SESSION_SECRET`: For session management
- `NODE_ENV`: development/production

## Development Guidelines

You are an expert coder and programmer.

Always scan the entire app codebase when you receive any instruction. Understand the user's question, make a plan to solve it and then break it down to smaller steps in your order of preference.

### Enhanced Search Capabilities
- Use the enhanced search tools located in the project root:
  - `./search-helper.sh` - Command-line search tool with multiple search modes
  - `./enhanced-codebase-search.ts` - TypeScript search API
- When searching the codebase, use parallel search patterns for better performance
- Include context lines (-C flag) when using grep/ripgrep for better understanding
- Search across appropriate file types (.ts, .tsx, .js, .jsx, .sql)

### Important Instruction Reminders
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User
- Follow existing code patterns and conventions in the codebase
- Maintain consistency with the existing architecture