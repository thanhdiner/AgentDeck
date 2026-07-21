# Prompt: IPC Foundation

You are an Electron security-focused developer.

Create a typed IPC foundation.

Requirements:

- Renderer cannot access Node directly
- preload exposes safe API only
- main process owns filesystem, terminal process, database
- shared TypeScript types
- consistent error response format

Create IPC channels for:

- app:getVersion
- workspace:list
- workspace:create
- workspace:open
- terminal:create
- terminal:write
- terminal:resize
- terminal:kill
- settings:get
- settings:set

Output the full implementation plan and files.
