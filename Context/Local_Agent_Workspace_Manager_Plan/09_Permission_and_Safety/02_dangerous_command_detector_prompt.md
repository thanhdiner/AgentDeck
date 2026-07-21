# Prompt: Dangerous Command Detector

You are a security-focused TypeScript developer.

Implement a basic dangerous command detector.

Detect risky patterns including:

- rm -rf
- del /s
- rmdir /s
- format
- diskpart
- powershell encoded commands
- curl pipe shell
- wget pipe shell
- npm scripts with unknown destructive commands
- git reset --hard
- git clean -fd
- deleting node_modules without confirmation
- environment variable exfiltration patterns

Output:

- TypeScript function
- Test cases
- False positive handling
- Warning messages
