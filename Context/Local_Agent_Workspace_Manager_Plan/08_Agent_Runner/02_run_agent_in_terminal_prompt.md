# Prompt: Run Agent in Terminal

You are a desktop process automation engineer.

Implement running an agent inside a selected terminal pane.

User flow:

1. Select task
2. Select terminal pane
3. Select agent profile
4. App builds command from template
5. App writes command to terminal
6. Agent runs inside terminal
7. Session log records command and output

Requirements:

- Show command preview before run unless unsafe mode is enabled
- Support variables:
  - {{workspacePath}}
  - {{taskTitle}}
  - {{taskDescription}}
  - {{sessionName}}
- Escape dangerous characters where needed

Output code and safety rules.
