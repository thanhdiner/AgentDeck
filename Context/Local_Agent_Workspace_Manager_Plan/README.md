# Local Agent Workspace Manager

A complete A-to-Z planning and prompt pack for building a desktop application inspired by multi-pane AI coding workspaces.

The app goal:

Build a local desktop workspace manager that can open projects, manage multiple terminal panes, run AI coding agents, track tasks, store logs, restore sessions, and review outputs.

Recommended stack:

- Desktop shell: Electron
- Frontend: React + TypeScript + Vite
- Terminal UI: xterm.js
- Local process control: node-pty
- Layout: react-mosaic-component or custom split-pane system
- Storage: SQLite for structured data, filesystem for logs
- Agent runner: CLI process runner first, API integration later
- Styling: clean neutral UI, no visual noise

How to use this pack:

1. Open each phase folder in order.
2. Copy the prompt from each `.md` file into your AI coding agent.
3. Do not skip phases.
4. After each phase, run only the allowed checks you choose.
5. Keep a git checkpoint after every major phase.

Important rule:

Start with a boring working MVP. Do not build the entire cockpit on day one. Terminal panes first. AI orchestration later.
