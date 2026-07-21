# Master Prompt: Build the App From Scratch

You are a senior Electron + React + TypeScript developer.

Build a local-first desktop application called Local Agent Workspace Manager.

The app should eventually support:

- Workspace sidebar
- Multi-pane terminal layout
- xterm.js terminal panes
- node-pty local shell process management
- Workspace save/restore
- Task panel
- Agent profiles
- Agent command runner
- Logs
- Permission policy
- Review reports

But for the first implementation, focus only on the MVP:

1. Electron app foundation
2. React renderer
3. Safe preload IPC
4. Workspace CRUD
5. Folder picker
6. Spawn terminal in workspace root
7. xterm.js output/input
8. Split panes vertically/horizontally
9. Save and restore layout
10. Basic task list

Rules:

- Use TypeScript.
- Use npm.
- Keep UI clean and neutral.
- Do not add cloud features.
- Do not add login.
- Do not add voice.
- Do not add a code editor.
- Do not overbuild.

Work phase by phase. After each phase, summarize:

- Files created
- Files modified
- What works
- What is not done yet
- Next step
