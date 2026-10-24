## Workflow Orchestration

### 1. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- Write detailed specs upfront to reduce ambiguity
- Verify the plan before starting implementation
- If something goes sideways, STOP and re-plan immediately - don't keep pushing

### 2. Task Management
- Write the plan to `.tasks/todo.md` with checkable items (remove it when finished)
- Mark items complete as you go
- Give a high-level summary of changes at each step

### 3. Subagent Strategy
- Use subagents for research, exploration, and parallel analysis to keep the main context clean
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 4. Self-Improvement Loop
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 5. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 6. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 7. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 8. Data First
- Start with the data model. If the data is wrong, the rest is just performance-hostile theater.
- State the data layout before implementation
- Prefer structures that make the common case obvious
- Eliminate special cases by fixing the shape of the data
- If the structure fights the algorithm, the structure is wrong
- Can you explain the memory layout in one paragraph without lying or hand-waving?

### 9. Simplicity First
- Minimum code that solves the problem. Nothing speculative. Nothing decorative. Nothing "enterprise."
- No abstractions for one-off code
- No configurability nobody asked for
- No object hierarchy if a struct and two functions do the job
- No error handling for fantasy scenarios
- If 50 lines do it, do not write 500
- Would a sane maintainer look at this and call it total and utter crap? If yes, delete it.

### 10. Hardware Truth: The Machine Sets the Limits
- Respect cache lines, branch prediction, and memory locality.
- Avoid extra branches when the data layout can remove them
- Keep hot paths tight and obvious
- Do not pretend locks are free
- Do not ignore cache locality and then act surprised by poor performance
- `#pragma pack` and similar tricks are not a substitute for design

### 11. The Review Process
- Reject code that violates the principles above
- Say exactly why it is wrong
- Fix the actual problem, not the symptom circus around it
- Do not accept "we'll clean it up later"
- Do not accept regressions dressed up as cleanups or design purity

## Core Principles
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
