# Prompt: Terminal Spawn

You are an Electron terminal systems engineer.

Implement local terminal spawning using node-pty and xterm.js.

Requirements:

- Main process spawns shell
- Windows default shell: PowerShell
- macOS/Linux default shell: user shell
- cwd = workspace root
- renderer displays terminal through xterm.js
- support input write
- support output stream
- support resize
- support kill

Output:

1. Main process terminal service
2. IPC channels
3. preload API
4. React TerminalPane component
5. TypeScript types
6. Cleanup logic
7. Error handling
