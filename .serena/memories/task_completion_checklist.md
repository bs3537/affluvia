# Task Completion Checklist (Updated 2025-01-18)

## MANDATORY FOR EVERY USER INSTRUCTION

### 1. START OF TASK (REQUIRED)
- [ ] Create git checkpoint IMMEDIATELY
  ```bash
  git checkpoint "About to [task description]"
  ```
- [ ] Use TodoWrite tool if multi-step task
- [ ] Understand requirements fully

### 2. DURING TASK
- [ ] Use Serena for searching only
- [ ] Use ast-grep for editing (primary)
- [ ] Use Edit/MultiEdit as fallback
- [ ] NEVER use replace_regex

### 3. END OF TASK
- [ ] Verify changes work
- [ ] Update TodoWrite if used
- [ ] Remind user about undo options:
  - Type "undo" to revert
  - Type "rollback" for checkpoint list

### 4. UNDO SYSTEM REMINDERS
User can always undo with:
- "undo" - instant revert
- "revert" - instant revert  
- "rollback" - choose checkpoint
- "undo changes" - instant revert

### 5. CHECKPOINT BEST PRACTICES
- Create BEFORE code changes (not after)
- Use descriptive messages
- Multiple checkpoints for complex tasks
- Always checkpoint risky operations

## CRITICAL RULES
1. **ALWAYS create checkpoint first**
2. **NEVER skip checkpoint creation**
3. **Checkpoint BEFORE changes, not after**
4. **Every instruction = new checkpoint**

## Example Workflow
```
User: "Add a new button to the header"
Assistant: 
1. git checkpoint "About to add button to header"
2. [Make changes]
3. "Done! You can undo with 'undo' if needed"
```