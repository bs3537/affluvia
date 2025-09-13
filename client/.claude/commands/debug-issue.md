# Debug Issue Task

Invoke the specialized debugger expert agent for error investigation and troubleshooting.

## Usage
Use this command for debugging and troubleshooting tasks:

- **Error Investigation**: Stack trace analysis and error diagnosis
- **Performance Issues**: Slow queries, rendering problems, and bottleneck identification
- **System Problems**: Server issues, database connectivity, and integration failures
- **Bug Reproduction**: Creating minimal reproduction cases for issues
- **Root Cause Analysis**: Deep investigation of complex system problems
- **Testing Issues**: Test failures and quality assurance problems

## Command Arguments
$ARGUMENTS should describe the specific issue, error, or problem to be debugged.

## Example Usage
```
/debug-issue Investigate why the Monte Carlo simulation is returning inconsistent results for certain user profiles
```

Invoke @agent-debugger-expert to investigate and resolve: $ARGUMENTS

The debugger expert should:
1. Use extended thinking to systematically analyze the problem
2. Gather relevant logs, error messages, and system state information
3. Form and test hypotheses about potential root causes
4. Create reproduction steps and minimal test cases
5. Identify the underlying issue and propose targeted solutions
6. Implement fixes and validation procedures to prevent regression