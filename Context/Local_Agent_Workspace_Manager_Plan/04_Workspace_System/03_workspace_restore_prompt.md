# Prompt: Workspace Restore

You are a desktop app reliability engineer.

Implement workspace restore behavior.

When app starts:

1. Load last opened workspace
2. Restore sidebar state
3. Restore saved pane layout
4. Restore terminal session metadata
5. Do not automatically rerun commands unless user enables it
6. Mark restored sessions as inactive until terminal process is recreated

Output:

- State model
- Startup sequence
- UI behavior
- Storage update rules
- Failure handling
