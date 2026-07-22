import type { BrowserWindow } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pty from 'node-pty';
import type { TerminalLifecycleEvent, TerminalLifecycleKind, TerminalStartOptions } from '../../shared/types.js';
import { appendPaneLogEntry, flushPaneLogQueue, queuePaneLogEntry, readState } from './storageService.js';

const terminals = new Map<string, pty.IPty>();
const killedPaneIds = new Set<string>();
/** Panes killed as part of restart/start — onExit must not emit killed/exited UI events */
const silentKillPaneIds = new Set<string>();
const idleTimers = new Map<string, NodeJS.Timeout>();
const idleDelayMs = 1200;

function hasExecutableInPath(name: string): boolean {
  const pathEnv = process.env.PATH || '';
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(delimiter);
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

  for (const dir of paths) {
    const cleanDir = dir.replace(/"/g, '');
    for (const ext of extensions) {
      const fullPath = path.join(cleanDir, `${name}${ext}`);
      try {
        if (fs.existsSync(fullPath)) {
          return true;
        }
      } catch {
        // ignore
      }
    }
  }
  return false;
}

function getWindowsShell(): string {
  if (hasExecutableInPath('pwsh')) {
    return 'pwsh.exe';
  }

  const homeDir = os.homedir();
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const commonPwshPaths = [
    path.join(programFiles, 'PowerShell', '7', 'pwsh.exe'),
    path.join(programFilesX86, 'PowerShell', '7', 'pwsh.exe'),
    path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'pwsh.exe')
  ];

  for (const p of commonPwshPaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      // ignore
    }
  }

  return process.env.PSModulePath ? 'powershell.exe' : process.env.ComSpec || 'powershell.exe';
}

function getGitBashPath(): string {
  const homeDir = os.homedir();
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');

  const commonGitBashPaths = [
    path.join(programFiles, 'Git', 'bin', 'bash.exe'),
    path.join(programFilesX86, 'Git', 'bin', 'bash.exe'),
    path.join(programFiles, 'Git', 'git-bash.exe'),
    path.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe'),
    path.join(localAppData, 'Programs', 'Git', 'git-bash.exe')
  ];

  for (const p of commonGitBashPaths) {
    try {
      if (fs.existsSync(p)) {
        return p;
      }
    } catch {
      // ignore
    }
  }

  if (hasExecutableInPath('bash')) {
    return 'bash.exe';
  }

  return 'powershell.exe'; // fallback
}

function getWslPath(): string {
  const system32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const wslExe = path.join(system32, 'wsl.exe');
  try {
    if (fs.existsSync(wslExe)) {
      return wslExe;
    }
  } catch {
    // ignore
  }
  return 'wsl.exe'; // fallback
}

function resolveShellFromPreference(pref: string | null): string {
  const platform = process.platform;

  if (!pref || pref === 'default') {
    return shellForPlatform();
  }

  if (platform === 'win32') {
    switch (pref) {
      case 'pwsh':
        return getWindowsShell();
      case 'powershell':
        return 'powershell.exe';
      case 'git-bash':
        return getGitBashPath();
      case 'wsl':
        return getWslPath();
      case 'cmd':
        return process.env.ComSpec || 'cmd.exe';
      default:
        return shellForPlatform();
    }
  } else {
    switch (pref) {
      case 'zsh':
        return hasExecutableInPath('zsh') ? 'zsh' : '/bin/zsh';
      case 'bash':
        return hasExecutableInPath('bash') ? 'bash' : '/bin/bash';
      default:
        return process.env.SHELL || 'sh';
    }
  }
}

function shellForPlatform() {
  if (process.platform === 'win32') {
    return getWindowsShell();
  }

  return process.env.SHELL || 'sh';
}

function terminalEvent(
  paneId: string,
  kind: TerminalLifecycleKind,
  options: Pick<TerminalStartOptions, 'cwd' | 'shell'>,
  patch: Partial<TerminalLifecycleEvent> = {}
): TerminalLifecycleEvent {
  return {
    paneId,
    kind,
    shell: options.shell ?? shellForPlatform(),
    cwd: options.cwd,
    exitCode: null,
    signal: null,
    message: null,
    ...patch
  };
}

export const terminalStates = new Map<string, TerminalLifecycleKind>();

function emitLifecycle(
  getWindow: () => BrowserWindow | null,
  paneId: string,
  kind: TerminalLifecycleKind,
  options: Pick<TerminalStartOptions, 'cwd' | 'shell'>,
  patch: Partial<TerminalLifecycleEvent> = {}
) {
  terminalStates.set(paneId, kind);
  const activeCwd = paneActiveCwds.get(paneId) || options.cwd;
  const event = terminalEvent(paneId, kind, { ...options, cwd: activeCwd }, patch);
  if (kind !== 'running') {
    void appendPaneLogEntry(paneId, 'system', `${kind}${event.message ? `: ${event.message}` : ''}`);
  }
  getWindow()?.webContents.send('terminal:lifecycle', event);
}

function clearIdleTimer(paneId: string) {
  const timer = idleTimers.get(paneId);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(paneId);
  }
}

const paneOutputBuffers = new Map<string, string>();
const paneActiveCwds = new Map<string, string>();

function cleanAnsi(data: string): string {
  return data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

function parseCwd(data: string): string | null {
  const clean = cleanAnsi(data);
  
  // PowerShell & CMD
  const pwshCmdRegex = /(?:^|[\r\n])(?:PS\s+)?([a-zA-Z]:\\[^>\r\n]+)>\s*$/;
  const match = clean.match(pwshCmdRegex);
  if (match) {
    return match[1].trim();
  }
  
  // Git Bash MINGW64
  const gitBashRegex = /(?:^|[\r\n])[^@]+@[^\s]+\s+MINGW64\s+(\/[a-zA-Z]\/[^\r\n]+)\r?\n\$\s*$/;
  const gitBashMatch = clean.match(gitBashRegex);
  if (gitBashMatch) {
    const unixPath = gitBashMatch[1];
    const drive = unixPath[1].toUpperCase();
    const rest = unixPath.substring(2).replace(/\//g, '\\');
    return `${drive}:${rest}`;
  }
  
  return null;
}

/**
 * Optimized idle scheduler — only stamps lastActivity and lets existing
 * timer self-check. No clearing/recreating timers on every data chunk.
 */
const lastActivity = new Map<string, number>();

function scheduleIdle(getWindow: () => BrowserWindow | null, options: TerminalStartOptions) {
  lastActivity.set(options.paneId, Date.now());

  if (idleTimers.has(options.paneId)) {
    return; // timer already running, it will self-check
  }

  const checkIdle = () => {
    const last = lastActivity.get(options.paneId) || 0;
    const elapsed = Date.now() - last;

    if (elapsed >= idleDelayMs) {
      idleTimers.delete(options.paneId);
      if (terminals.has(options.paneId)) {
        // Parse CWD when the terminal becomes idle
        const buf = paneOutputBuffers.get(options.paneId) || '';
        if (buf) {
          try {
            const parsed = parseCwd(buf);
            if (parsed && fs.existsSync(parsed) && fs.statSync(parsed).isDirectory()) {
              paneActiveCwds.set(options.paneId, parsed);
            }
          } catch (err) {
            console.error('[ERROR] Failed to parse and validate terminal CWD:', err);
          }
        }
        emitLifecycle(getWindow, options.paneId, 'idle', options);
      }
    } else {
      idleTimers.set(options.paneId, setTimeout(checkIdle, idleDelayMs - elapsed));
    }
  };

  idleTimers.set(options.paneId, setTimeout(checkIdle, idleDelayMs));
}

export function sanitizeCwd(cwd: string) {
  const resolved = cwd ? cwd.trim() : '';
  if (!resolved) {
    return os.homedir();
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Terminal cwd is not an accessible folder: ${resolved}`);
  }

  return resolved;
}

// Keep track of pending write queues for each pane to prevent interleaving
const writeQueues = new Map<string, string[]>();
const writeActive = new Map<string, boolean>();

function processQueue(paneId: string, ptyProcess: pty.IPty) {
  // Check if terminal is still registered and matches the one we started writing to
  if (terminals.get(paneId) !== ptyProcess) {
    writeQueues.delete(paneId);
    writeActive.delete(paneId);
    return;
  }

  const queue = writeQueues.get(paneId) || [];
  if (queue.length === 0) {
    writeActive.set(paneId, false);
    return;
  }

  writeActive.set(paneId, true);
  const nextChunk = queue.shift()!;
  try {
    ptyProcess.write(nextChunk);
  } catch (err) {
    console.error(`[TERMINAL] Failed to write chunk to pane ${paneId}:`, err);
    writeQueues.delete(paneId);
    writeActive.delete(paneId);
    return;
  }

  // Schedule the next chunk if queue is not empty, otherwise release active status
  if (queue.length > 0) {
    setTimeout(() => processQueue(paneId, ptyProcess), 5);
  } else {
    writeActive.set(paneId, false);
  }
}

export function killTerminal(
  paneId: string,
  getWindow?: () => BrowserWindow | null,
  options?: { silent?: boolean }
) {
  const terminal = terminals.get(paneId);
  if (!terminal) {
    return;
  }

  killedPaneIds.add(paneId);
  if (options?.silent) {
    silentKillPaneIds.add(paneId);
  } else {
    silentKillPaneIds.delete(paneId);
  }
  terminal.kill();
  terminals.delete(paneId);
  terminalStates.delete(paneId);
  lastActivity.delete(paneId);
  paneOutputBuffers.delete(paneId);
  clearIdleTimer(paneId);
  writeQueues.delete(paneId);
  writeActive.delete(paneId);

  // Silent kill used by restart — avoid flashing "killed" UI mid-transition
  if (options?.silent) {
    return;
  }

  const event = {
    paneId,
    kind: 'killed',
    shell: null,
    cwd: null,
    exitCode: null,
    signal: null,
    message: 'Terminal killed by user.'
  } satisfies TerminalLifecycleEvent;
  void appendPaneLogEntry(paneId, 'system', event.message);
  void flushPaneLogQueue(paneId);
  getWindow?.()?.webContents.send('terminal:lifecycle', event);
}

export function killAllTerminals() {
  for (const paneId of Array.from(terminals.keys())) {
    killTerminal(paneId);
  }
}

export function resizeTerminal(paneId: string, cols: number, rows: number) {
  const terminal = terminals.get(paneId);
  if (!terminal) {
    return;
  }
  const nextCols = Math.max(1, cols);
  const nextRows = Math.max(1, rows);
  if (terminal.cols !== nextCols || terminal.rows !== nextRows) {
    terminal.resize(nextCols, nextRows);
  }
}

export function writeTerminal(paneId: string, data: string): boolean {
  const ptyProcess = terminals.get(paneId);
  if (!ptyProcess) {
    if (terminalStates.get(paneId) === 'spawning') {
      const chunkSize = 2048;
      const newChunks: string[] = [];
      for (let i = 0; i < data.length; i += chunkSize) {
        newChunks.push(data.substring(i, i + chunkSize));
      }
      const currentQueue = writeQueues.get(paneId) || [];
      currentQueue.push(...newChunks);
      writeQueues.set(paneId, currentQueue);
      return true;
    }
    return false;
  }

  // Write payload directly to PTY process
  const writePayload = data;

  // Fast path: for normal typing, commands, and prompts (<= 4096 chars) when queue is idle,
  // write directly to pty process for immediate 0ms response time.
  const queue = writeQueues.get(paneId);
  const isQueueEmpty = !queue || queue.length === 0;
  if (writePayload.length <= 4096 && isQueueEmpty && !writeActive.get(paneId)) {
    try {
      ptyProcess.write(writePayload);
      return true;
    } catch (err) {
      console.error(`[TERMINAL] Failed to write short input to pane ${paneId}:`, err);
      return false;
    }
  }

  // For very large inputs (> 4096 chars like huge pasted files), slice into 2048-char chunks
  // to avoid choking ConPTY buffers.
  const chunkSize = 2048;
  const newChunks: string[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    newChunks.push(data.substring(i, i + chunkSize));
  }

  const currentQueue = queue || [];
  currentQueue.push(...newChunks);
  writeQueues.set(paneId, currentQueue);

  if (!writeActive.get(paneId)) {
    processQueue(paneId, ptyProcess);
  }

  // Input keystrokes are NOT individually logged — output already
  // contains the echo. This eliminates JSON.stringify + promise
  // overhead on every single keystroke for native-like typing speed.
  return true;
}

export async function startTerminal(options: TerminalStartOptions, getWindow: () => BrowserWindow | null) {
  // Silent kill so restart does not flash inactive/killed overlay between PTY swaps
  killTerminal(options.paneId, getWindow, { silent: true });
  killedPaneIds.delete(options.paneId);
  clearIdleTimer(options.paneId);

  let preferredShell: string | null = null;
  try {
    const state = await readState();
    const shellSetting = state.appSettings.find((s) => s.key === 'terminal.shell');
    if (shellSetting && typeof shellSetting.value === 'string') {
      preferredShell = shellSetting.value;
    }
  } catch (error) {
    console.error('[ERROR] Failed to read terminal shell preference:', error);
  }

  let shell = options.shell || resolveShellFromPreference(preferredShell);

  const resolvedOptions = { ...options, shell };
  emitLifecycle(getWindow, options.paneId, 'spawning', resolvedOptions);

  const cwd = sanitizeCwd(options.cwd);

  try {
    const terminal = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cwd,
      cols: Math.max(1, options.cols),
      rows: Math.max(1, options.rows),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      },
      useConptyDll: false,
      conptyInheritCursor: true
    });

    terminals.set(options.paneId, terminal);
    paneActiveCwds.set(options.paneId, cwd);
    emitLifecycle(getWindow, options.paneId, 'ready', { ...resolvedOptions, cwd });
    scheduleIdle(getWindow, { ...resolvedOptions, cwd });

    if (writeQueues.has(options.paneId) && !writeActive.get(options.paneId)) {
      processQueue(options.paneId, terminal);
    }

    terminal.onData((data) => {
      let buf = paneOutputBuffers.get(options.paneId) || '';
      buf += data;
      if (buf.length > 2000) {
        buf = buf.substring(buf.length - 2000);
      }
      paneOutputBuffers.set(options.paneId, buf);

      if (terminalStates.get(options.paneId) !== 'running') {
        emitLifecycle(getWindow, options.paneId, 'running', { ...resolvedOptions, cwd });
      }
      scheduleIdle(getWindow, { ...resolvedOptions, cwd });
      // Synchronous queue — zero async overhead on every chunk
      queuePaneLogEntry(options.paneId, 'output', data);
      getWindow()?.webContents.send('terminal:data', { paneId: options.paneId, data });
    });

    terminal.onExit(({ exitCode, signal }) => {
      // Stale exit from a prior PTY after restart, or already replaced
      if (terminals.get(options.paneId) !== terminal && !killedPaneIds.has(options.paneId)) {
        return;
      }

      // Restart/start swapped the process — swallow exit so UI stays on spawning→ready
      if (silentKillPaneIds.delete(options.paneId)) {
        killedPaneIds.delete(options.paneId);
        if (terminals.get(options.paneId) === terminal) {
          terminals.delete(options.paneId);
        }
        lastActivity.delete(options.paneId);
        clearIdleTimer(options.paneId);
        return;
      }

      terminals.delete(options.paneId);
      lastActivity.delete(options.paneId);
      clearIdleTimer(options.paneId);
      const killed = killedPaneIds.delete(options.paneId);
      const kind = killed ? 'killed' : exitCode && exitCode !== 0 ? 'crashed' : 'exited';
      emitLifecycle(getWindow, options.paneId, kind, { ...resolvedOptions, cwd }, { exitCode, signal });
    });
  } catch (error) {
    clearIdleTimer(options.paneId);
    terminals.delete(options.paneId);
    const message = error instanceof Error ? error.message : 'Failed to start terminal.';
    emitLifecycle(getWindow, options.paneId, 'crashed', { ...resolvedOptions, cwd }, { message });
    throw error;
  }
}

export function pauseTerminal(paneId: string) {
  const terminal = terminals.get(paneId);
  if (!terminal) {
    return;
  }
  try {
    if (process.platform !== 'win32') {
      terminal.kill('SIGSTOP');
    }
  } catch (error) {
    console.error(`Failed to send SIGSTOP:`, error);
  }
}

export function resumeTerminal(paneId: string) {
  const terminal = terminals.get(paneId);
  if (!terminal) {
    return;
  }
  try {
    if (process.platform !== 'win32') {
      terminal.kill('SIGCONT');
    }
  } catch (error) {
    console.error(`Failed to send SIGCONT:`, error);
  }
}
