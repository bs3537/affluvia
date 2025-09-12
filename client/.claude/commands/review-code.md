# Code Review Task

Invoke the specialized code reviewer agent for comprehensive code quality assessment.

## Usage
Use this command for code review and quality assurance tasks:

- **Quality Review**: Code quality, best practices, and maintainability assessment
- **Security Audit**: Security vulnerability identification and mitigation
- **Performance Analysis**: Code performance and optimization opportunities
- **Architecture Review**: Design patterns, SOLID principles, and architectural decisions
- **Standards Compliance**: Coding standards and team guidelines adherence
- **Refactoring**: Code improvement and technical debt reduction

## Command Arguments
$ARGUMENTS should specify the code, files, or areas to be reviewed.

## Example Usage
```
/review-code Review the new Monte Carlo calculation service for security, performance, and code quality
```

Invoke @agent-code-reviewer to conduct a comprehensive review of: $ARGUMENTS

The code reviewer should:
1. Use extended thinking to analyze the code architecture and implementation
2. Identify potential security vulnerabilities and risks
3. Assess performance implications and optimization opportunities
4. Review code quality, readability, and maintainability
5. Check compliance with coding standards and best practices
6. Provide actionable recommendations for improvements