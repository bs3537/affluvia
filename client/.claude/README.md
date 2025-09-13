# Affluvia Claude Subagent System

This directory contains a comprehensive subagent architecture for the Affluvia financial planning application, featuring:

## 🏗️ Architecture
- **Supervisor Agent**: Claude Opus 4.1 with extended thinking for orchestration
- **8 Specialized Subagents**: Claude Sonnet 4 with extended thinking for domain expertise
- **Coordination System**: Hub-and-spoke pattern with intelligent task routing
- **Persistent Knowledge**: Maintains context and learning across sessions

## 📁 Directory Structure

### `/agents/` - Subagent Definitions
- `supervisor-opus.md` - Main orchestrator (Opus 4.1 + Extended Thinking)
- `frontend-developer.md` - React/TypeScript specialist
- `backend-engineer.md` - Node.js/Express specialist
- `code-reviewer.md` - Quality assurance specialist
- `debugger-expert.md` - Debugging and troubleshooting expert
- `ui-ux-designer.md` - Interface design and UX specialist
- `database-architect.md` - Database design and optimization expert
- `security-specialist.md` - Security analysis and compliance expert
- `performance-engineer.md` - Performance optimization and scalability expert

### `/commands/` - Slash Commands
- `/orchestrate` - Multi-agent coordination for complex tasks
- `/frontend-task` - Frontend development tasks
- `/backend-task` - Backend development tasks
- `/review-code` - Code quality and security review
- `/debug-issue` - Error investigation and troubleshooting
- `/design-review` - UI/UX design and user experience tasks
- `/database-task` - Database architecture and optimization
- `/security-audit` - Security analysis and compliance
- `/performance-optimize` - Performance optimization and monitoring

### `/state/` - Persistent Knowledge
- `subagent-coordination.md` - Coordination patterns and protocols
- `knowledge-base.md` - Shared knowledge and successful patterns

## 🚀 Quick Start

### Simple Tasks
```bash
/frontend-task Create a responsive dashboard widget
/backend-task Add authentication to the API
/review-code Audit the payment processing module
```

### Complex Multi-Domain Tasks
```bash
/orchestrate Implement a complete user authentication system with secure session management, responsive UI, and performance optimization
```

### Direct Agent Invocation
```bash
@agent-supervisor-opus Plan the architecture for a new feature
@agent-frontend-developer Optimize React component performance
@agent-security-specialist Review API security measures
```

## ✨ Key Features

- **Extended Thinking**: All agents use extended thinking for thorough analysis
- **Domain Expertise**: Each agent specializes in specific technology domains
- **Parallel Processing**: Multiple agents work simultaneously on complex tasks
- **Quality Assurance**: Built-in code review and security validation
- **Persistent Learning**: Knowledge accumulates across sessions and projects
- **Flexible Coordination**: Supports sequential, parallel, and iterative workflows

## 📖 Complete Documentation

See `SUBAGENT_SYSTEM_GUIDE.md` for comprehensive usage patterns, examples, and best practices.

## 🔄 How It Works

1. **Task Analysis**: Supervisor agent (Opus 4.1) analyzes complex requirements
2. **Agent Assignment**: Specialized agents assigned based on domain expertise  
3. **Parallel Execution**: Agents work simultaneously where possible
4. **Quality Gates**: Code reviewer validates all implementations
5. **Integration**: Supervisor coordinates final integration and delivery

This system provides enterprise-grade AI assistance for full-stack development, security, performance, and user experience across the entire software development lifecycle.