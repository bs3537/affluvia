# Affluvia Project Overview

## Purpose
Affluvia is an AI-powered financial planning application designed to democratize financial planning by making it accessible and affordable for retail investors. It provides comprehensive retirement planning, tax optimization, education planning, estate planning, and investment management through an integrated platform.

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Routing**: Wouter 3.3.5
- **State Management**: React Context API, React Query (TanStack Query 5.60.5)
- **UI Components**: Radix UI (extensive component library)
- **Styling**: Tailwind CSS 3.4.17
- **Animations**: Framer Motion 11.13.1
- **Forms**: React Hook Form 7.55.0 with Zod validation
- **Charts**: Chart.js 4.5.0, React-Chartjs-2, Recharts
- **Icons**: Lucide React, React Icons
- **Build Tool**: Vite 5.4.14

### Backend
- **Runtime**: Node.js with Express.js 4.21.2
- **Language**: TypeScript 5.6.3
- **Database**: Neon (PostgreSQL) with Drizzle ORM 0.39.1
- **Authentication**: Passport.js with local strategy
- **AI Integration**: Google Generative AI SDK 0.24.1

## Architecture
- Full-stack TypeScript application
- Component-based React frontend with dark theme
- RESTful API backend
- PostgreSQL database with complex JSON data storage
- Session-based authentication
- AI-powered financial analysis and recommendations

## Key Features
1. Comprehensive Financial Dashboard
2. Advanced Retirement Planning with Monte Carlo simulations
3. Investment Management Center
4. Tax Optimization Tools
5. Education Planning Center
6. Estate Planning Center
7. AI-Powered Financial Assistant

## Financial Calculation Engines
- Monte Carlo Simulation Engine (1000+ scenarios)
- Tax Calculator (Federal & state)
- Roth Conversion Engine
- Net Worth Projections
- Cash Flow Modeling
- Uses nominal approach in retirement projections