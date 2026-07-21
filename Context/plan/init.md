Build a desktop app named AgentDeck.

Goal:

AgentDeck is a local desktop workspace manager for developers. It manages multiple coding workspaces, terminal panes, AI agent sessions, task lists, logs, and review panels in one app.

Tech stack:

\- Electron

\- React

\- TypeScript

\- xterm.js

\- node-pty

\- Zustand

\- SQLite or local JSON storage

\- CSS modules or plain CSS

Core UI:

\- Left sidebar: workspace list

\- Center: resizable terminal pane grid with split horizontal / split vertical / close / maximize

\- Right sidebar: tabs for Tasks, Agents, Logs, Review, Settings

MVP requirements:

1\. User can create a workspace by selecting a local folder.

2\. User can create multiple terminal panes inside a workspace.

3\. Each terminal pane runs a real local shell using node-pty.

4\. User can split panes horizontally and vertically.

5\. User can rename, close, clear, and restart a pane.

6\. Workspace layout and pane config are saved locally.

7\. Reopening the app restores the previous workspace layout.

8\. Right panel has a task list with todo/running/review/done status.

9\. User can assign a task to a terminal pane.

10\. User can send task text into the selected terminal pane.

11\. Logs from each terminal pane are saved locally.

12\. Keep the UI simple, clean, dark, dense, and practical.

Do not build AI API integration yet.

Do not build cloud sync.

Do not build authentication.

Focus only on local desktop functionality first.
