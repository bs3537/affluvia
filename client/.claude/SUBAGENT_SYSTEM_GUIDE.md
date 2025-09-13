# Affluvia Subagent System - Complete Implementation Guide

## Overview

The Affluvia Subagent System is a permanent, multi-agent architecture that provides specialized AI assistance across all aspects of software development. This system is designed to work across sessions and projects, maintaining context and knowledge to deliver consistent, high-quality results.

## Architecture

### Supervisor Agent (Claude Opus 4.1)
- **Main Orchestrator**: Coordinates all subagents and complex multi-domain tasks
- **Extended Thinking**: Uses extended thinking for complex planning and analysis
- **Global Context**: Maintains project-wide understanding and architectural consistency
- **Quality Assurance**: Ensures all work meets standards and integrates properly

### Specialized Subagents (Claude Sonnet 4)
Each subagent uses extended thinking and focuses on specific domains:

1. **Frontend Developer** - React, TypeScript, UI implementation
2. **Backend Engineer** - Node.js, Express, database operations  
3. **Code Reviewer** - Quality assurance, best practices, security
4. **Debugger Expert** - Error detection, troubleshooting, root cause analysis
5. **UI/UX Designer** - Interface design, user experience, accessibility
6. **Database Architect** - Schema design, query optimization, performance
7. **Security Specialist** - Security analysis, compliance, vulnerability assessment
8. **Performance Engineer** - Optimization, scalability, monitoring

## Usage Patterns

### 1. Complex Multi-Domain Tasks
Use `/orchestrate` for tasks requiring multiple specialists:
```bash
/orchestrate Implement a new retirement calculator feature with real-time Monte Carlo simulations, responsive UI, secure data handling, and performance optimization
```

**Process Flow:**
1. Supervisor analyzes requirements using extended thinking
2. Assigns tasks to relevant specialists (Frontend, Backend, Database, Performance)
3. Coordinates parallel execution and dependencies
4. Code Reviewer validates all implementations
5. Supervisor integrates and delivers final solution

### 2. Domain-Specific Tasks
Use specialized commands for focused work:

```bash
# Frontend work
/frontend-task Create a responsive financial dashboard widget with interactive charts

# Backend development  
/backend-task Create a Monte Carlo simulation API with caching and error handling

# Database optimization
/database-task Optimize financial_profiles queries for better performance

# Security review
/security-audit Review authentication flow for vulnerabilities and compliance

# Performance optimization
/performance-optimize Improve dashboard loading performance with large datasets

# UI/UX improvements
/design-review Improve retirement planning wizard user experience

# Code quality review
/review-code Review Monte Carlo calculation service for quality and security

# Debugging and troubleshooting
/debug-issue Investigate inconsistent Monte Carlo simulation results
```

### 3. Direct Agent Invocation
You can also invoke agents directly:
```bash
@agent-frontend-developer [task description]
@agent-backend-engineer [task description]  
@agent-supervisor-opus [complex coordination task]
```

## Key Benefits

### 1. Specialized Expertise
- Each agent has deep domain knowledge and follows best practices
- Extended thinking provides thorough analysis and planning
- Consistent quality across different aspects of development

### 2. Parallel Processing  
- Multiple agents can work simultaneously on different aspects
- Reduces development time for complex features
- Maintains quality through specialized focus

### 3. Persistent Knowledge
- Agents maintain context across sessions
- Learn from successful patterns and solutions
- Build institutional knowledge over time

### 4. Quality Assurance
- Built-in code review and quality validation
- Security and performance considerations integrated
- Architectural consistency maintained

## Real-World Examples

### Example 1: New Feature Implementation
**Task**: Add social security optimization calculator

**Orchestration**:
```bash
/orchestrate Add a social security optimization calculator that analyzes optimal claiming strategies, integrates with existing retirement projections, and provides interactive comparisons
```

**Agent Coordination**:
1. **Supervisor** - Plans architecture and coordinates agents
2. **Backend Engineer** - Creates calculation APIs and database integration  
3. **Frontend Developer** - Builds interactive UI components
4. **Database Architect** - Optimizes data storage and queries
5. **UI/UX Designer** - Ensures intuitive user experience
6. **Performance Engineer** - Optimizes calculation performance
7. **Security Specialist** - Reviews data handling security
8. **Code Reviewer** - Validates all implementations

### Example 2: Performance Issue Resolution
**Task**: Dashboard loading slowly with large datasets

**Specialized Approach**:
```bash
/performance-optimize Dashboard performance issues with large financial datasets and complex charts
```

**Process**:
1. **Performance Engineer** analyzes bottlenecks
2. Coordinates with **Database Architect** for query optimization
3. Works with **Frontend Developer** for rendering improvements
4. **Code Reviewer** validates optimization implementations

### Example 3: Security Audit
**Task**: Comprehensive security review before production deployment

**Security Focus**:
```bash
/security-audit Complete security review of authentication, data protection, and API security before production launch
```

**Process**:
1. **Security Specialist** conducts comprehensive audit
2. Coordinates with **Backend Engineer** on authentication fixes
3. Works with **Code Reviewer** on code security validation
4. **Database Architect** reviews data protection measures

## Best Practices

### 1. Task Planning
- Use `/orchestrate` for complex, multi-faceted requirements
- Use specialized commands for domain-specific work
- Provide clear requirements and context in your requests

### 2. Quality Assurance
- Always include code review in complex implementations
- Consider security implications for financial data handling
- Plan for performance and scalability from the start

### 3. Communication
- Be specific about requirements and constraints
- Provide context about existing systems and integrations
- Ask for explanations when recommendations are unclear

### 4. Iteration
- Start with basic implementations and iterate
- Use feedback to refine and improve solutions
- Build on successful patterns for consistency

## Advanced Usage

### Custom Agent Combinations
You can request specific agent combinations:
```bash
I need @agent-frontend-developer and @agent-ui-ux-designer to collaborate on improving the dashboard user experience with better data visualization and responsive design
```

### Sequential Processing
For tasks with dependencies:
```bash
/orchestrate First have @agent-database-architect design the schema for new goal tracking, then @agent-backend-engineer implement the APIs, and finally @agent-frontend-developer create the UI components
```

### Iterative Refinement
For complex problems requiring multiple rounds:
```bash
/orchestrate Implement user authentication system, then have @agent-security-specialist audit it, @agent-code-reviewer assess quality, and iterate based on their recommendations
```

## Monitoring and Maintenance

### Knowledge Base Updates
The system automatically maintains knowledge across sessions:
- Successful implementation patterns
- Common challenges and solutions  
- Architectural decisions and rationale
- Performance optimizations and results

### Continuous Improvement
- Agents learn from successful collaborations
- Patterns emerge for common task types
- Quality standards evolve with project needs
- Documentation improves over time

## Getting Started

1. **Simple Tasks**: Start with single-agent commands like `/frontend-task` or `/backend-task`
2. **Complex Features**: Use `/orchestrate` for multi-domain implementations
3. **Quality Assurance**: Include `/review-code` for important implementations
4. **Performance**: Use `/performance-optimize` when speed matters
5. **Security**: Include `/security-audit` for sensitive features

The subagent system is designed to grow with your project, maintaining context and improving over time. Each agent brings specialized expertise while working together to deliver comprehensive, high-quality solutions.

## File Structure

```
.claude/
├── agents/                    # Subagent definitions
│   ├── supervisor-opus.md     # Main orchestrator (Opus 4.1)
│   ├── frontend-developer.md  # React/TypeScript specialist
│   ├── backend-engineer.md    # Node.js/Express specialist
│   ├── code-reviewer.md       # Quality assurance specialist
│   ├── debugger-expert.md     # Debugging and troubleshooting
│   ├── ui-ux-designer.md      # Design and UX specialist
│   ├── database-architect.md  # Database design and optimization
│   ├── security-specialist.md # Security and compliance
│   └── performance-engineer.md # Performance and scalability
├── commands/                  # Slash commands for agent invocation
│   ├── orchestrate.md         # Multi-agent coordination
│   ├── frontend-task.md       # Frontend-specific tasks
│   ├── backend-task.md        # Backend-specific tasks  
│   ├── review-code.md         # Code review tasks
│   ├── debug-issue.md         # Debugging and troubleshooting
│   ├── design-review.md       # UI/UX design tasks
│   ├── database-task.md       # Database-specific tasks
│   ├── security-audit.md      # Security and compliance tasks
│   └── performance-optimize.md # Performance optimization tasks
└── state/                     # Persistent state and knowledge
    ├── subagent-coordination.md # Coordination protocols
    └── knowledge-base.md       # Shared knowledge and patterns
```

This system provides a comprehensive, permanent solution for AI-assisted development that scales with your project needs and maintains quality across all aspects of software development.