import pty from 'node-pty';
import type { BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logsDir } from './storageService.js';

export type ProjectRunStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'stopping';

export type RunConfig = {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'custom';
  workingDirectory: string;
  command: string;
  previewUrl?: string;
  autoOpenPreview?: boolean;
  backendWorkingDirectory?: string;
  backendCommand?: string;
  frontendWorkingDirectory?: string;
  frontendCommand?: string;
  delayBetweenMs?: number;
};

interface ProjectProcess {
  pty: pty.IPty;
  label: string;
}

interface WorkspaceRunState {
  status: ProjectRunStatus;
  activeConfigId: string | null;
  processes: ProjectProcess[];
  errors: string[];
}

const activeStates = new Map<string, WorkspaceRunState>();

function getShell(): string {
  if (process.platform === 'win32') {
    return process.env.PSModulePath ? 'powershell.exe' : process.env.ComSpec || 'cmd.exe';
  }
  return process.env.SHELL || 'sh';
}

function getLogPath(workspaceId: string): string {
  return path.join(logsDir(), `project-run-${workspaceId}.log`);
}

async function writeLog(workspaceId: string, data: string) {
  try {
    const dir = logsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(getLogPath(workspaceId), data, 'utf8');
  } catch (err) {
    console.error(`Failed to write project run logs for workspace ${workspaceId}:`, err);
  }
}

export function getProjectStatus(workspaceId: string) {
  const state = activeStates.get(workspaceId);
  return state
    ? { status: state.status, activeConfigId: state.activeConfigId, errors: state.errors }
    : { status: 'stopped' as const, activeConfigId: null, errors: [] };
}

export async function clearProjectLogs(workspaceId: string) {
  try {
    const file = getLogPath(workspaceId);
    if (fs.existsSync(file)) {
      fs.writeFileSync(file, '', 'utf8');
    }
  } catch (err) {
    console.error(`Failed to clear project run logs for workspace ${workspaceId}:`, err);
  }
}

export async function readProjectLogs(workspaceId: string): Promise<string> {
  try {
    const file = getLogPath(workspaceId);
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, 'utf8');
    }
  } catch (err) {
    console.error(`Failed to read project run logs for workspace ${workspaceId}:`, err);
  }
  return '';
}

function notifyLifecycle(getWindow: () => BrowserWindow | null, workspaceId: string, state: WorkspaceRunState) {
  const window = getWindow();
  if (window) {
    window.webContents.send('project:lifecycle', {
      workspaceId,
      status: state.status,
      activeConfigId: state.activeConfigId,
      errors: state.errors
    });
  }
}

export async function runProject(
  workspaceId: string,
  config: RunConfig,
  getWindow: () => BrowserWindow | null
) {
  // Stop existing run if any
  await stopProject(workspaceId, getWindow);

  // Clear previous logs
  await clearProjectLogs(workspaceId);

  const state: WorkspaceRunState = {
    status: 'starting',
    activeConfigId: config.id,
    processes: [],
    errors: []
  };
  activeStates.set(workspaceId, state);
  notifyLifecycle(getWindow, workspaceId, state);

  const shell = getShell();

  const spawnProcess = (cmd: string, cwd: string, label: string): pty.IPty => {
    const sanitizedCwd = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
    
    // Write starting log
    void writeLog(workspaceId, `\r\n--- STARTING [${label}]: ${cmd} in ${sanitizedCwd} ---\r\n`);

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cwd: sanitizedCwd,
      cols: 100,
      rows: 30,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    });

    ptyProcess.onData((chunk) => {
      void writeLog(workspaceId, chunk);
      getWindow()?.webContents.send('project:data', { workspaceId, data: chunk, label });
    });

    // Execute the command in the shell
    if (process.platform === 'win32') {
      ptyProcess.write(`${cmd}\r`);
    } else {
      ptyProcess.write(`${cmd}\n`);
    }

    ptyProcess.onExit(({ exitCode, signal }) => {
      // Check if this process was manually stopped
      const currentState = activeStates.get(workspaceId);
      if (!currentState || currentState.status === 'stopping' || currentState.status === 'stopped') {
        void writeLog(workspaceId, `\r\n--- STOPPED [${label}] (Manual) ---\r\n`);
        return;
      }

      void writeLog(workspaceId, `\r\n--- PROCESS EXITED [${label}] with code ${exitCode}, signal ${signal} ---\r\n`);

      if (exitCode !== 0) {
        const errorMsg = `Process [${label}] exited with non-zero code ${exitCode}.`;
        currentState.errors.push(errorMsg);
        currentState.status = 'failed';
        notifyLifecycle(getWindow, workspaceId, currentState);
      } else {
        // If all processes exited cleanly, mark as stopped
        const allExited = currentState.processes.every((p) => p.pty.pid === ptyProcess.pid || (p.pty as any)._exited);
        if (allExited) {
          currentState.status = 'stopped';
          notifyLifecycle(getWindow, workspaceId, currentState);
        }
      }
    });

    return ptyProcess;
  };

  try {
    if (config.type === 'fullstack') {
      // Backend first
      if (config.backendCommand) {
        const backendPty = spawnProcess(config.backendCommand, config.backendWorkingDirectory || '', 'Backend');
        state.processes.push({ pty: backendPty, label: 'Backend' });
      }

      // Delay then Frontend
      const delay = config.delayBetweenMs || 2000;
      setTimeout(() => {
        const currentState = activeStates.get(workspaceId);
        if (!currentState || currentState.status !== 'starting') return;

        if (config.frontendCommand) {
          try {
            const frontendPty = spawnProcess(config.frontendCommand, config.frontendWorkingDirectory || '', 'Frontend');
            currentState.processes.push({ pty: frontendPty, label: 'Frontend' });
          } catch (err: any) {
            currentState.errors.push(`Frontend start error: ${err.message}`);
            currentState.status = 'failed';
            notifyLifecycle(getWindow, workspaceId, currentState);
            return;
          }
        }

        currentState.status = 'running';
        notifyLifecycle(getWindow, workspaceId, currentState);
      }, delay);

    } else {
      // Frontend, Backend, Custom
      const ptyProcess = spawnProcess(config.command, config.workingDirectory, config.name);
      state.processes.push({ pty: ptyProcess, label: config.name });
      state.status = 'running';
      notifyLifecycle(getWindow, workspaceId, state);
    }
  } catch (err: any) {
    state.status = 'failed';
    state.errors.push(err.message || 'Failed to spawn project runner.');
    notifyLifecycle(getWindow, workspaceId, state);
  }
}

export async function stopProject(workspaceId: string, getWindow: () => BrowserWindow | null) {
  const state = activeStates.get(workspaceId);
  if (!state || state.status === 'stopped') return;

  state.status = 'stopping';
  notifyLifecycle(getWindow, workspaceId, state);

  void writeLog(workspaceId, `\r\n--- STOPPING PROJECT WORKSPACE ---\r\n`);

  for (const proc of state.processes) {
    try {
      proc.pty.kill();
    } catch (err) {
      console.error(`Failed to kill PTY process for workspace ${workspaceId}:`, err);
    }
  }

  state.processes = [];
  state.status = 'stopped';
  notifyLifecycle(getWindow, workspaceId, state);
}

export function killAllProjects() {
  for (const [workspaceId, state] of activeStates.entries()) {
    for (const proc of state.processes) {
      try {
        proc.pty.kill();
      } catch (err) {
        // ignore
      }
    }
  }
  activeStates.clear();
}
