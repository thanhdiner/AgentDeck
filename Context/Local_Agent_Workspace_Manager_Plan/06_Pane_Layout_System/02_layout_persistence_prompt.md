# Prompt: Layout Persistence

You are a state management engineer.

Implement layout persistence.

When user changes layout:

- Debounce save
- Store layoutJson in workspace
- Preserve terminal session IDs
- Restore layout after app restart
- Handle missing/deleted sessions gracefully

Output full implementation plan and code.
