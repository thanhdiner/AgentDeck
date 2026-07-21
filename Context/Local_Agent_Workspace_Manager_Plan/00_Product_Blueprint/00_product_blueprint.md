# Product Blueprint

## Product Name

Local Agent Workspace Manager

## One Sentence

A desktop app that manages project workspaces, terminal panes, AI coding agents, tasks, logs, and review flows in one local-first development cockpit.

## Core User

A solo developer who works with multiple full-stack projects and wants one place to run FE, BE, database, Git, Codex, Claude, or custom agents without terminal chaos.

## Main Problem

Normal terminals become messy when a project needs many parallel processes. AI coding agents make this worse because each agent needs its own shell, logs, permissions, task context, and result review.

## Main Solution

Create a desktop app with:

- Workspace sidebar
- Multi-pane terminal layout
- Terminal session restore
- Task board
- Agent runner
- Log viewer
- Review panel
- Safe command permissions
- Project memory notes
- Exportable reports

## MVP Boundary

The MVP must only include:

- Create workspace
- Open local folder
- Spawn terminal in workspace folder
- Split terminal pane vertically/horizontally
- Close terminal pane
- Rename terminal session
- Save workspace layout
- Restore workspace layout on app restart
- Basic task list
- Basic logs per terminal session

Do not add voice, cloud sync, team collaboration, plugin marketplace, or fancy analytics in MVP.

## First Stable Version

After MVP:

- Agent profiles
- Run selected agent in selected pane
- Command permission policy
- Task-to-agent assignment
- Session transcript logs
- Review report generation
- Git checkpoint helper
- Workspace templates

## Non-Goals

- Do not build a full IDE.
- Do not build a code editor first.
- Do not replace VS Code.
- Do not create cloud accounts in the first version.
- Do not overbuild authentication.
- Do not add chat UI before terminal workflow is stable.

## Success Criteria

The app is useful when it can open one full-stack project and run:

- Frontend dev server
- Backend dev server
- Database shell
- Git terminal
- AI agent terminal

All inside one saved workspace that restores correctly after restart.
