# Affluvia Codebase Structure

## Root Directory
- `/client/` - React frontend application
- `/server/` - Node.js Express backend
- `/shared/` - Shared types and utilities
- `/db/` - Database schema and migrations
- `/docs/` - Documentation files

## Frontend Structure (`/client/src/`)
- `/components/` - React components organized by feature
  - `/retirement/` - Retirement planning components
  - `/ui/` - Reusable UI components (Radix-based)
- `/pages/` - Page-level components
- `/hooks/` - Custom React hooks
- `/contexts/` - React context providers
- `/services/` - API service functions
- `/types/` - Frontend-specific types
- `/utils/` - Utility functions
- `/lib/` - Library configurations

## Backend Structure (`/server/`)
- API routes and business logic
- Database connection and queries
- Authentication middleware
- Google Gemini AI integration

## Key Files
- `package.json` - Dependencies and scripts
- `tailwind.config.ts` - Tailwind CSS configuration
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database ORM configuration

## Retirement Planning Components
- `stress-test-content.tsx` - Main stress test container
- `stress-test-scenarios.tsx` - Scenario configuration UI
- `stress-test-overview.tsx` - Automatic stress test results
- `stress-test-results.tsx` - Detailed results display
- `stress-test-comparison-chart.tsx` - Chart visualizations

## Data Flow
- API endpoints in `/server/`
- Shared types in `/shared/`
- React Query for server state management
- Context API for global client state