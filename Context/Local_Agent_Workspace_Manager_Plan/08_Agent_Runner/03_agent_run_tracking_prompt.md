# Prompt: Agent Run Tracking

You are an application state engineer.

Implement AgentRun tracking.

AgentRun fields:

- id
- workspaceId
- taskId
- agentProfileId
- terminalSessionId
- command
- status: queued | running | finished | failed | cancelled
- startedAt
- finishedAt
- logPath
- summary

Track agent runs when commands are launched through the app.

Output:

- SQLite schema
- Service logic
- UI status display
- Log link behavior
- Failure handling
