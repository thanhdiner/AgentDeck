# Prompt: Terminal Logging

You are a logging systems engineer.

Implement terminal session logging.

Requirements:

- Save terminal output to file
- Save user commands
- Save agent-launched commands
- Store log path in database
- Rotate large logs
- Allow user to open log
- Allow user to clear log for a session

Log format:

- timestamp
- sessionId
- direction: input | output | system
- text

Output code and file organization.
