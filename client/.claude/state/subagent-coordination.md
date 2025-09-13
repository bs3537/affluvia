# Subagent Coordination Protocol

This document defines the coordination patterns and communication protocols for the Affluvia subagent architecture.

## Architecture Overview

- **Supervisor**: Claude Opus 4.1 with extended thinking (Main orchestrator)
- **Subagents**: 8 specialized Claude Sonnet 4 agents with extended thinking
- **Coordination**: Hub-and-spoke pattern with direct communication channels
- **Persistence**: State management across sessions

## Coordination Patterns

### 1. Sequential Processing
Used for tasks with dependencies between different domains:
```
User Request → Supervisor Analysis → Agent A → Agent B → Agent C → Integration → Result
```

### 2. Parallel Processing
Used for independent tasks that can be executed simultaneously:
```
User Request → Supervisor Analysis → [Agent A + Agent B + Agent C] → Integration → Result
```

### 3. Iterative Refinement
Used for complex tasks requiring multiple rounds of improvement:
```
User Request → Initial Implementation → Review Cycle → Refinement → Final Integration
```

## Communication Protocols

### Task Assignment Format
```markdown
## Task Assignment: [Agent Name]

### Context
- Project: Affluvia Financial Planning Application
- Previous Work: [Summary of related work done by other agents]
- Dependencies: [List of dependencies on other agents' work]

### Specific Task
[Clear, specific description of the task]

### Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

### Expected Output
- Format: [Code, analysis, documentation, etc.]
- Quality Standards: [Performance, security, accessibility requirements]
- Integration Points: [How this work connects with other agents' work]

### Constraints
- Technical: [Technology stack limitations]
- Timeline: [Any time constraints]
- Resources: [Available tools and resources]
```

### Result Reporting Format
```markdown
## Task Completion Report: [Agent Name]

### Summary
[Brief summary of work completed]

### Implementation Details
[Specific details about what was implemented/analyzed]

### Quality Assurance
- [Quality checks performed]
- [Testing completed]
- [Standards compliance verified]

### Integration Notes
- [How this work integrates with other components]
- [Dependencies satisfied]
- [Interfaces provided for other agents]

### Recommendations
- [Follow-up work needed]
- [Optimization opportunities]
- [Related tasks for other agents]

### Deliverables
- [Files created/modified]
- [Documentation provided]
- [Code snippets or configurations]
```

## Agent Specialization Matrix

| Task Type | Primary Agent | Secondary Agents | Review Agent |
|-----------|---------------|------------------|--------------|
| Component Development | Frontend Developer | UI/UX Designer | Code Reviewer |
| API Development | Backend Engineer | Database Architect | Security Specialist |
| Database Design | Database Architect | Backend Engineer | Performance Engineer |
| Security Implementation | Security Specialist | Backend Engineer | Code Reviewer |
| Performance Optimization | Performance Engineer | Frontend Developer, Database Architect | Code Reviewer |
| UI/UX Improvements | UI/UX Designer | Frontend Developer | Code Reviewer |
| Bug Investigation | Debugger Expert | Relevant Domain Agent | Code Reviewer |
| Code Quality Review | Code Reviewer | Domain Experts | Security Specialist |

## Escalation Procedures

### Level 1: Domain Expert
- Agent handles task within their specialization
- Uses extended thinking for complex analysis
- Implements solution according to specifications

### Level 2: Cross-Domain Collaboration
- Multiple agents coordinate on interdisciplinary tasks
- Supervisor facilitates communication and integration
- Quality assurance through code reviewer

### Level 3: Supervisor Intervention
- Complex architectural decisions
- Conflicting recommendations between agents
- Major performance or security concerns
- Project-wide changes affecting multiple domains

## State Management

### Session Persistence
```typescript
interface SubagentState {
  sessionId: string;
  activeAgents: AgentInfo[];
  taskHistory: TaskRecord[];
  knowledgeBase: Record<string, any>;
  contextMemory: ContextItem[];
}

interface TaskRecord {
  id: string;
  agentName: string;
  taskDescription: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  dependencies: string[];
  results: any;
  timestamp: string;
}
```

### Knowledge Sharing
- Each agent maintains domain-specific knowledge
- Shared context through supervisor coordination
- Cross-agent learning from successful patterns
- Knowledge base updates for improved future performance

## Quality Gates

### Pre-Task Validation
- Task scope and requirements clarity
- Resource availability and constraint validation
- Dependencies identification and resolution
- Success criteria definition

### Mid-Task Checkpoints
- Progress monitoring and adjustment
- Quality standard compliance verification
- Integration compatibility checking
- Risk assessment and mitigation

### Post-Task Review
- Deliverable quality assurance
- Integration testing and validation
- Knowledge base updates
- Lessons learned documentation

## Best Practices

### For Supervisor Agent
1. Use extended thinking for complex task decomposition
2. Provide clear context and requirements to subagents
3. Monitor progress and facilitate communication
4. Ensure architectural consistency across all work
5. Synthesize results into coherent solutions

### For Subagents
1. Use extended thinking for domain-specific analysis
2. Follow established communication protocols
3. Consider impact on other domains and agents
4. Provide comprehensive result documentation
5. Suggest improvements and optimizations

### For All Agents
1. Maintain focus on user value and business objectives
2. Follow Affluvia coding standards and patterns
3. Prioritize security, performance, and accessibility
4. Document decisions and trade-offs clearly
5. Communicate proactively about blockers and dependencies

## Continuous Improvement

- Regular review of coordination effectiveness
- Pattern recognition for common task types
- Process optimization based on successful workflows
- Knowledge base expansion and refinement
- Agent capability enhancement and specialization