## Workflow
- **Plan First**: For non-trivial tasks (3+ steps or architecture), write a checklist to `.tasks/todo.md`, verify before coding, track progress, and delete the file when done. Stop and re-plan if blocked.
- **Use Subagents**: Offload research, exploration, and parallel analysis to subagents (one focused task per subagent) to keep the main context clean.
- **Autonomous Execution**: Fix bugs and failing tests directly from logs and errors without hand-holding.
- **Verify Before Done**: Prove changes work via tests, logs, and behavior diffs. Fix root causes, not symptoms.

## Engineering Principles
- **Data First**: Design around data layout and memory access first. Shape data to make the common case obvious and eliminate branches/special cases.
- **Simplicity First**: Write the minimum code needed. No speculative abstractions, unrequested configurability, unnecessary hierarchies, or fantasy error handling. Touch only what is necessary.
- **Hardware Truth**: Respect cache locality, branch prediction, and lock costs. Keep hot paths tight and obvious; do not use `#pragma pack` as a substitute for layout design.
- **Review Standard**: Reject regressions, hacky fixes, and "clean it up later" shortcuts. If a non-trivial implementation feels hacky, replace it with the clean design.
