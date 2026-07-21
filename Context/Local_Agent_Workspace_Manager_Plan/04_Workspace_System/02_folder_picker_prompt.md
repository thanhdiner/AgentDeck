# Prompt: Folder Picker

You are an Electron developer.

Implement a secure folder picker for selecting local project folders.

Requirements:

- Use Electron dialog in main process
- Renderer calls through preload API
- Validate selected path
- Reject empty path
- Store path in workspace record
- Show error when folder is inaccessible
- Never expose unrestricted filesystem access to renderer

Output code and edge cases.
