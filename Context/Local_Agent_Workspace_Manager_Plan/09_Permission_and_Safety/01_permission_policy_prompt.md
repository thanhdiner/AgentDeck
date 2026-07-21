# Prompt: Command Permission Policy

You are a security engineer.

Design command permission policies for this local desktop app.

Modes:

1. Ask every time
2. Allow safe commands
3. Workspace trusted
4. Bypass permissions

Command categories:

- safe read commands
- package install commands
- build/test commands
- file write commands
- git commands
- delete commands
- system commands
- network commands

Output:

1. Permission model
2. Rules table
3. UI warnings
4. Dangerous command detection
5. How to override
6. Logs for permission decisions

Be strict. The app controls local shell access.
