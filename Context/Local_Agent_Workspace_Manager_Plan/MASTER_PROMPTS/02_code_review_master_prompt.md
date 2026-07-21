# Master Prompt: Code Review

You are a strict senior reviewer.

Review this Local Agent Workspace Manager codebase.

Focus only on real issues:

- Compile errors
- Runtime errors
- Wrong imports
- Broken IPC types
- Unsafe Electron exposure
- node-pty lifecycle bugs
- terminal process leaks
- layout restore bugs
- database schema issues
- broken state management
- dangerous command execution risk
- missing cleanup on app quit

Do not waste time on tiny style opinions.

Output:

1. Critical issues
2. High issues
3. Medium issues
4. Low issues
5. Exact files to fix
6. Recommended patch order
