# AgentDeck

AgentDeck is a local-first Electron desktop app for managing developer workspaces, terminal panes, tasks, local agent profiles, logs, and review reports.

## Stack

- Electron
- React
- TypeScript
- Vite / electron-vite
- xterm.js
- node-pty
- Zustand
- Local JSON state and filesystem logs, with the data model shaped for a later SQLite migration

## Setup

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev                 # Start Electron in development
npm run build               # Typecheck and build main, preload, and renderer
npm run typecheck           # Typecheck all TypeScript projects
npm run typecheck:main      # Typecheck Electron main/preload/shared code
npm run typecheck:renderer  # Typecheck renderer/shared code
npm run lint                # Run ESLint
npm run format              # Format source/config files with Prettier
npm run preview             # Preview production build with electron-vite
```

## Architecture

- `src/main` owns Electron windows, filesystem access, terminal process lifecycle, Git checkpointing, storage, and IPC handlers.
- `src/preload` exposes a narrow `window.agentDeck` bridge. The renderer has no direct Node access.
- `src/renderer` contains the React app shell, terminal grid, workspace sidebar, task board, agent/profile UI, logs, review reports, and settings.
- `src/shared` contains IPC and app state types shared across main, preload, and renderer.

## Local data

AgentDeck stores data under Electron's `app.getPath('userData')`:

- `state.json` for app state
- `logs/{paneId}.log` for terminal transcripts
- `reports/*.md` for exported review reports

## MVP boundaries

AgentDeck phase 1 is local-only. It does not include cloud sync, authentication, remote agent hosting, billing, marketplaces, or enterprise admin features.
