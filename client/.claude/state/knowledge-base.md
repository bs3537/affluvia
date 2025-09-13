# Affluvia Subagent Knowledge Base

This document serves as the centralized knowledge base for the Affluvia subagent system, maintaining context, patterns, and learnings across sessions.

## Project Context

### Application Overview
Affluvia is an AI-powered financial planning application that democratizes financial planning by making it accessible and affordable for retail investors. The application provides comprehensive financial analysis, retirement planning, and personalized recommendations.

### Technology Stack
- **Frontend**: React 18.3.1, TypeScript, Tailwind CSS 3.4.17, Radix UI
- **Backend**: Node.js, Express.js 4.21.2, TypeScript 5.6.3
- **Database**: Neon PostgreSQL with Drizzle ORM 0.39.1
- **Build Tool**: Vite 5.4.14
- **Authentication**: Passport.js with bcrypt
- **AI Integration**: Google Generative AI SDK 0.24.1
- **Charts**: Chart.js 4.5.0, Recharts
- **Animation**: Framer Motion 11.13.1

### Core Features
1. Comprehensive financial dashboard with real-time metrics
2. Advanced Monte Carlo retirement simulations (1000+ scenarios)
3. AI-powered financial assistant using Google Gemini
4. Tax optimization tools and Roth conversion calculators
5. Education planning with 529 optimization
6. Estate planning with document management
7. Investment portfolio analysis and recommendations
8. Gamification system with achievements and progress tracking

## Domain Knowledge

### Financial Domain Expertise
- **Monte Carlo Simulations**: 1000-scenario retirement projections with market volatility modeling
- **Tax Calculations**: Federal and state tax optimization with bracket analysis
- **Social Security Optimization**: Claiming strategy analysis and timing optimization
- **Asset Allocation**: Risk-based portfolio recommendations for users and spouses
- **Life Insurance**: Adequate coverage analysis with estate planning integration
- **Long-term Care (LTC)**: Impact modeling on retirement projections
- **Education Funding**: College cost projections with financial aid optimization

### Database Schema Patterns
```sql
-- Key tables and their relationships
users (authentication) → financial_profiles (comprehensive data)
financial_profiles.calculations (JSON) → dashboard metrics
financial_profiles.monte_carlo_results (JSON) → simulation data
financial_profiles.optimization_variables (JSON) → planning parameters

-- Complex JSON structures for flexibility
calculations: net_worth, cash_flow, risk_scores, allocations
monte_carlo_results: scenarios, percentiles, success_probability
optimization_variables: retirement_age, savings_rate, risk_level
```

### Component Architecture Patterns
```typescript
// Established patterns in the codebase
- Dashboard widgets with metric displays and loading states
- Form components with Zod validation and React Hook Form
- Chart components with responsive design and interactive features
- Modal dialogs using Radix UI with consistent styling
- AI chat interfaces with streaming responses
```

## Successful Implementation Patterns

### Frontend Patterns
1. **Component Structure**: Consistent use of TypeScript interfaces for props
2. **State Management**: React Query for server state, Context API for global UI state
3. **Form Handling**: React Hook Form with Zod schema validation
4. **Error Handling**: Comprehensive error boundaries and user-friendly error states
5. **Performance**: Proper memoization and lazy loading for complex calculations

### Backend Patterns
1. **API Design**: RESTful endpoints with consistent error handling
2. **Authentication**: Session-based auth with PostgreSQL session store
3. **Data Processing**: Efficient handling of complex financial calculations
4. **File Processing**: PDF analysis and document management
5. **Caching**: Strategic caching for expensive Monte Carlo calculations

### Database Patterns
1. **JSON Fields**: Effective use of PostgreSQL JSONB for complex nested data
2. **Indexing**: GIN indexes for JSON field queries, B-tree for standard queries
3. **Relationships**: Proper foreign key constraints with cascade options
4. **Migrations**: Safe, reversible schema changes with Drizzle

## Common Challenges and Solutions

### Performance Optimization
- **Challenge**: Slow Monte Carlo simulations with 1000 scenarios
- **Solution**: Web Workers for background processing, result caching
- **Pattern**: Batch processing with progress indicators

### Data Complexity
- **Challenge**: Complex financial data relationships and calculations
- **Solution**: JSON fields for flexible data, TypeScript for type safety
- **Pattern**: Layered data transformation with validation

### User Experience
- **Challenge**: Complex financial concepts for general users
- **Solution**: Progressive disclosure, contextual help, gamification
- **Pattern**: Step-by-step wizards with clear progress indicators

### Integration Complexity
- **Challenge**: Multiple data sources and calculation engines
- **Solution**: Service layer abstraction, consistent error handling
- **Pattern**: Modular architecture with clear interfaces

## Quality Standards

### Code Quality
- TypeScript strict mode compliance
- Comprehensive error handling and validation
- Proper logging and debugging information
- Performance considerations for financial calculations
- Accessibility compliance (WCAG 2.1 AA)

### Security Requirements
- Input validation and sanitization
- Secure authentication and session management
- Financial data encryption and protection
- CORS and security headers configuration
- Regular security audits and updates

### Testing Standards
- Unit tests for calculation engines
- Integration tests for API endpoints
- Component tests for React components
- End-to-end tests for critical user flows
- Performance testing for complex operations

## Agent Coordination History

### Successful Collaborations
1. **Monte Carlo Enhancement**: Performance Engineer + Backend Engineer + Database Architect
   - Result: 60% performance improvement through caching and optimization
   - Pattern: Cross-domain optimization with shared metrics

2. **Dashboard Redesign**: UI/UX Designer + Frontend Developer + Performance Engineer
   - Result: Improved user engagement and 40% faster load times
   - Pattern: Design-driven development with performance validation

3. **Security Audit**: Security Specialist + Code Reviewer + Backend Engineer
   - Result: Comprehensive security improvements and compliance validation
   - Pattern: Multi-layer security review with actionable recommendations

### Lessons Learned
1. **Early Collaboration**: Involve multiple agents in planning phase for better outcomes
2. **Clear Interfaces**: Define clear contracts between agents to avoid integration issues
3. **Iterative Refinement**: Complex features benefit from multiple review cycles
4. **Documentation**: Comprehensive documentation reduces coordination overhead

## Future Considerations

### Scalability Planning
- Database sharding strategies for growth
- Microservices architecture considerations
- CDN implementation for global reach
- Real-time features with WebSocket integration

### Feature Roadmap Context
- Advanced AI features with improved personalization
- Mobile application development
- Third-party integrations (banks, brokers)
- Advanced analytics and reporting features

### Technical Debt Management
- React 19 migration planning
- Database optimization opportunities
- Code consolidation and refactoring needs
- Documentation improvements

## Knowledge Maintenance

This knowledge base should be updated by agents when:
- New successful patterns are discovered
- Complex problems are solved with novel approaches
- Architectural decisions are made that affect multiple domains
- Performance or security improvements are implemented
- User feedback reveals important insights

Each agent should contribute domain-specific insights while maintaining awareness of the broader system context and user value proposition.