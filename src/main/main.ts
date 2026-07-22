import { app, BrowserWindow, Menu, ipcMain, shell, webContents, clipboard, nativeImage } from 'electron';
import path from 'node:path';
import type {
  AppSetting,
  AppStateSnapshot,
  IpcResult,
  ReviewReport,
  SettingUpdate,
  TerminalStartOptions,
  AgentInputPayload
} from '../shared/types.js';
import { createGitCheckpoint, getGitWorkspaceStatus, getGitFileDiff, discardGitFileChanges, discardAllGitChanges, commitGitChanges, revertGitHunk, generateCommitMessage, gitFetch, gitPull, gitPush } from './services/gitService.js';
import {
  clearPaneLog,
  ensureStorage,
  getStorageInfo,
  readPaneLog,
  readState,
  writeReportFile,
  writeState,
  appendPaneLogEntry,
  listArtifacts,
  readArtifactBase64,
  readArtifactText,
  deleteArtifact
} from './services/storageService.js';
import {
  killAllTerminals,
  killTerminal,
  resizeTerminal,
  startTerminal,
  writeTerminal,
  pauseTerminal,
  resumeTerminal
} from './services/terminalService.js';
import { selectWorkspaceFolder, validateWorkspacePath, readDirectoryContents, searchWorkspaceFiles, createFile, createDirectory, deletePath, renamePath, readWorkspaceFile, writeWorkspaceFile } from './services/workspaceService.js';
import { generateProjectContext } from './services/contextService.js';
import {
  applyInitAssets,
  loadInitAssets,
  generateDesignLLM,
  generateDesignStream,
  testLLMConnection,
  assistantChatLLM,
  cancelAssistantChat
} from './services/projectInitService.js';
import { analyzeFigmaDesignContext } from './services/figmaOrchestratorService.js';
import { startMcpServer, getActiveMcpClients } from './services/mcpService.js';
import { testMcpConnection, listMcpTools, getFigmaContextFromMcp } from './services/mcpClientService.js';
import { detectDevServers } from './services/previewService.js';
import { extractWebsiteDesign, extractWebsiteDesignMultiSource } from './services/websiteDesignExtractorService.js';
import {
  runProject,
  stopProject,
  readProjectLogs,
  getProjectStatus,
  killAllProjects,
  RunConfig
} from './services/projectRunnerService.js';
import {
  saveAttachment,
  deleteAttachmentFile,
  cleanupOrphanedAttachments,
  deleteWorkspaceAttachments
} from './services/attachmentService.js';
import { processAgentInput } from './adapters/adapterRegistry.js';
import { testDbConnection, runDbQuery, getDbSchema, logDbAudit, encrypt, setDbSecrets, deleteDbSecrets } from './services/databaseService.js';
import { validateSqlQuery } from '../shared/dbSafety.js';
import type { DbConnectionConfig } from '../shared/types.js';
import { detectAdb, listAndroidDevices, reversePort, removeReversePort, listReversePorts, installAdb, captureScreenshot, detectScrcpy, installScrcpy, launchScrcpy, getDeviceScreenSize, sendAdbInput } from './services/androidDeviceService.js';
import { detectMobileStack } from './services/mobileStackService.js';
import {
  syncCompanionFromSettings,
  stopCompanionServer,
  getCompanionStatus,
  generateCompanionToken,
  ensureCompanionTokenInState
} from './services/companionService.js';
import fs from 'node:fs';


// Support custom userData path to prevent file lock/crashes when running multiple dev instances
const customUserDataArg = process.argv.find((arg) => arg.startsWith('--user-data-dir='));
if (customUserDataArg) {
  const customPath = customUserDataArg.split('=')[1];
  if (customPath) {
    app.setPath('userData', path.resolve(customPath));
  }
} else if (process.env.AGENTDECK_USER_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.AGENTDECK_USER_DATA_DIR));
}

// Disable GPU hardware acceleration to bypass AMD/Chromium rendering crashes
app.disableHardwareAcceleration();


let mainWindow: BrowserWindow | null = null;
let cliWorkspacePath: string | null = null;

function parseCliArgs() {
  const args = process.argv.slice(1);
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    if (arg.includes('node_modules') || arg.includes('dist') || arg.includes('main.js') || arg === '.') continue;
    try {
      const resolved = path.resolve(arg);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        cliWorkspacePath = resolved;
        break;
      }
    } catch {
      // ignore
    }
  }
}

parseCliArgs();

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL);
const preloadPath = path.join(__dirname, '../preload/preload.cjs');

function getMainWindow() {
  return mainWindow;
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function fail(error: unknown): IpcResult<never> {
  return {
    ok: false,
    error: {
      code: error instanceof Error && 'code' in error ? String(error.code) : 'IPC_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected IPC error'
    }
  };
}

async function ipcResult<T>(handler: () => Promise<T> | T): Promise<IpcResult<T>> {
  try {
    return ok(await handler());
  } catch (error) {
    return fail(error);
  }
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    title: 'AgentDeck',
    backgroundColor: '#101010',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  mainWindow.setMenu(null);

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Log renderer console messages to terminal for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] (${level}) ${message} (at ${sourceId}:${line})`);
  });

  // DevTools is managed via F12 shortcut on-demand. Do not open automatically on startup.
  // if (isDev) {
  //   mainWindow.webContents.openDevTools({ mode: 'detach' });
  // }

  if (mainWindow) {
    // Force reset main window zoom factor to 1.0 (default 100% scale) on startup
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        mainWindow?.webContents.setZoomFactor(1.0);
      } catch (err) {
        console.error('Failed to reset zoom factor:', err);
      }
    });
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        const isF12 = input.key === 'F12';
        const isReload = (input.control && input.key.toLowerCase() === 'r') || input.key === 'F5';
        const mod = input.control || input.meta;

        // Zoom: Ctrl/Cmd + / - / 0  (Ctrl+ needs "=" key on most layouts — handle both + and =)
        if (mod && !input.alt) {
          const k = input.key;
          const code = input.code || '';
          const isZoomIn =
            k === '+' ||
            k === '=' ||
            k === 'Add' ||
            code === 'Equal' ||
            code === 'NumpadAdd';
          const isZoomOut =
            k === '-' ||
            k === '_' ||
            k === 'Subtract' ||
            code === 'Minus' ||
            code === 'NumpadSubtract';
          const isZoomReset =
            k === '0' ||
            k === ')' ||
            code === 'Digit0' ||
            code === 'Numpad0';

          if (isZoomIn || isZoomOut || isZoomReset) {
            event.preventDefault();
            const wc = mainWindow?.webContents;
            if (wc) {
              try {
                if (isZoomReset) {
                  wc.setZoomLevel(0);
                } else {
                  const level = wc.getZoomLevel();
                  // ~10% per step; clamp so UI stays usable
                  const next = isZoomIn
                    ? Math.min(level + 0.5, 5)
                    : Math.max(level - 0.5, -3);
                  wc.setZoomLevel(next);
                }
              } catch (err) {
                console.error('Failed to change zoom level:', err);
              }
            }
            return;
          }
        }

        if (isF12) {
          event.preventDefault();
          if (mainWindow) {
            const allWebs = webContents.getAllWebContents();
            const webviewContents = allWebs.find((c) => c.getType() === 'webview');
            const targetContents =
              webviewContents || webContents.getFocusedWebContents() || mainWindow.webContents;

            if (targetContents) {
              if (targetContents.isDevToolsOpened()) {
                targetContents.closeDevTools();
              } else {
                targetContents.openDevTools({ mode: 'detach' });
              }
            }
          }
        } else if (isReload) {
          event.preventDefault();
          const allWebs = webContents.getAllWebContents();
          const webviewContents = allWebs.find((c) => c.getType() === 'webview');
          if (webviewContents) {
            webviewContents.reload();
          } else if (isDev && mainWindow) {
            mainWindow.webContents.reload();
          }
        }
      }
    });

    // Register handlers for attached webviews to catch shortcuts inside their own guest processes
    mainWindow.webContents.on('did-attach-webview', (_event, guestWebContents) => {
      guestWebContents.on('before-input-event', (guestEvent, guestInput) => {
        if (guestInput.type === 'keyDown') {
          const isF12 = guestInput.key === 'F12';
          const isReload = (guestInput.control && guestInput.key.toLowerCase() === 'r') || guestInput.key === 'F5';

          if (isF12) {
            guestEvent.preventDefault();
            if (guestWebContents.isDevToolsOpened()) {
              guestWebContents.closeDevTools();
            } else {
              guestWebContents.openDevTools({ mode: 'detach' });
            }
          } else if (isReload) {
            guestEvent.preventDefault();
            guestWebContents.reload();
          }
        }
      });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('app:getVersion', () => ipcResult(() => app.getVersion()));
  ipcMain.handle('workspace:list', () => ipcResult(async () => (await readState()).workspaces));
  ipcMain.handle('workspace:create', () => ipcResult(() => selectWorkspaceFolder(mainWindow)));
  ipcMain.handle('workspace:open', () => ipcResult(() => selectWorkspaceFolder(mainWindow)));
  ipcMain.handle('workspace:validate-path', (_event, folderPath: string) =>
    ipcResult(() => validateWorkspacePath(folderPath))
  );
  ipcMain.handle('terminal:create', (_event, options: TerminalStartOptions) =>
    ipcResult(() => startTerminal(options, getMainWindow))
  );
  ipcMain.handle('settings:get', () => ipcResult(async () => (await readState()).appSettings));
  ipcMain.handle('settings:set', (_event, update: SettingUpdate) =>
    ipcResult(async () => {
      const state = await readState();
      const nextSetting: AppSetting = { ...update, updatedAt: Date.now() };
      await writeState({
        ...state,
        appSettings: [nextSetting, ...state.appSettings.filter((setting) => setting.key !== update.key)]
      });
      // Keep Mobile Companion server in sync when related settings change
      if (
        update.key === 'companion.enabled' ||
        update.key === 'companion.token' ||
        update.key === 'companion.port'
      ) {
        void syncCompanionFromSettings(getMainWindow).catch((err) =>
          console.error('[COMPANION] resync failed:', err)
        );
      }
      return nextSetting;
    })
  );

  ipcMain.handle('companion:get-status', () =>
    ipcResult(async () => {
      await ensureCompanionTokenInState();
      return getCompanionStatus();
    })
  );
  ipcMain.handle('companion:set-enabled', (_event, enabled: boolean) =>
    ipcResult(async () => {
      await ensureCompanionTokenInState();
      const state = await readState();
      await writeState({
        ...state,
        appSettings: [
          { key: 'companion.enabled', value: Boolean(enabled), updatedAt: Date.now() },
          ...state.appSettings.filter((s) => s.key !== 'companion.enabled')
        ]
      });
      return syncCompanionFromSettings(getMainWindow);
    })
  );
  ipcMain.handle('companion:regenerate-token', () =>
    ipcResult(async () => {
      const state = await readState();
      const token = generateCompanionToken();
      await writeState({
        ...state,
        appSettings: [
          { key: 'companion.token', value: token, updatedAt: Date.now() },
          ...state.appSettings.filter((s) => s.key !== 'companion.token')
        ]
      });
      return syncCompanionFromSettings(getMainWindow);
    })
  );

  ipcMain.handle('workspace:select-folder', () => selectWorkspaceFolder(mainWindow));
  ipcMain.handle('state:load', async () => {
    const state = await readState();
    if (cliWorkspacePath) {
      const normalizedPath = path.normalize(cliWorkspacePath);
      const existing = state.workspaces.find(
        (w) => path.normalize(w.rootPath) === normalizedPath || path.normalize(w.path) === normalizedPath
      );
      if (!existing) {
        const workspaceId = `workspace-${crypto.randomUUID()}`;
        const name = path.basename(cliWorkspacePath);
        const newWorkspace = {
          id: workspaceId,
          name,
          path: cliWorkspacePath,
          rootPath: cliWorkspacePath,
          templateId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastOpenedAt: Date.now(),
          panes: {},
          layout: null,
          savedLayout: null,
          layoutJson: '{}',
          settingsJson: '{}',
          workflows: []
        };
        state.workspaces = [newWorkspace, ...state.workspaces];
        state.activeWorkspaceId = workspaceId;
        await writeState(state);
      } else {
        state.activeWorkspaceId = existing.id;
        existing.lastOpenedAt = Date.now();
        await writeState(state);
      }
    }
    return state;
  });
  ipcMain.handle('state:save', (_event, state: AppStateSnapshot) => writeState(state));
  ipcMain.handle('storage:info', () => getStorageInfo());
  ipcMain.handle('logs:read', (_event, paneId: string) => readPaneLog(paneId));
  ipcMain.handle('terminal:start', (_event, options: TerminalStartOptions) => startTerminal(options, getMainWindow));
  ipcMain.handle('terminal:restart', (_event, options: TerminalStartOptions) => startTerminal(options, getMainWindow));
  ipcMain.handle('terminal:kill', (_event, paneId: string) => killTerminal(paneId, getMainWindow));
  ipcMain.handle('terminal:clear-log', (_event, paneId: string) => clearPaneLog(paneId));
  ipcMain.handle('terminal:pause', (_event, paneId: string) => ipcResult(() => pauseTerminal(paneId)));
  ipcMain.handle('terminal:resume', (_event, paneId: string) => ipcResult(() => resumeTerminal(paneId)));
  ipcMain.handle('review:export-report', (_event, report: ReviewReport) =>
    writeReportFile(report.title || report.id, report.body)
  );
  ipcMain.handle('git:status', (_event, workspacePath: string) => getGitWorkspaceStatus(workspacePath));
  ipcMain.handle('git:file-diff', (_event, workspacePath: string, filePath: string, contextLines?: number) => ipcResult(() => getGitFileDiff(workspacePath, filePath, contextLines)));
  ipcMain.handle('git:discard-file-changes', (_event, workspacePath: string, filePath: string) => ipcResult(() => discardGitFileChanges(workspacePath, filePath)));
  ipcMain.handle('git:discard-all-changes', (_event, workspacePath: string) => ipcResult(() => discardAllGitChanges(workspacePath)));
  ipcMain.handle('git:commit-changes', (_event, workspacePath: string, filePaths: string[], message: string) => ipcResult(() => commitGitChanges(workspacePath, filePaths, message)));
  ipcMain.handle('git:revert-hunk', (_event, workspacePath: string, filePath: string, hunkHeader: string, hunkLines: string[]) => ipcResult(() => revertGitHunk(workspacePath, filePath, hunkHeader, hunkLines)));
  ipcMain.handle('git:generate-commit-message', (_event, workspacePath: string, filePaths: string[], settings: any) => ipcResult(() => generateCommitMessage(workspacePath, filePaths, settings)));
  ipcMain.handle('git:fetch', (_event, workspacePath: string) => ipcResult(() => gitFetch(workspacePath)));
  ipcMain.handle('git:pull', (_event, workspacePath: string) => ipcResult(() => gitPull(workspacePath)));
  ipcMain.handle('git:push', (_event, workspacePath: string) => ipcResult(() => gitPush(workspacePath)));
  ipcMain.handle('workspace:list-artifacts', () => ipcResult(() => listArtifacts()));
  ipcMain.handle('workspace:read-artifact-base64', (_event, relPath: string) => ipcResult(() => readArtifactBase64(relPath)));
  ipcMain.handle('workspace:read-artifact-text', (_event, relPath: string) => ipcResult(() => readArtifactText(relPath)));
  ipcMain.handle('workspace:delete-artifact', (_event, relPath: string) => ipcResult(() => deleteArtifact(relPath)));
  ipcMain.handle('git:checkpoint', (_event, workspacePath: string) => createGitCheckpoint(workspacePath));
  ipcMain.handle('workspace:generate-context', (_event, workspacePath: string) => generateProjectContext(workspacePath));
  ipcMain.handle('workspace:apply-init-assets', (_event, workspacePath: string, config: any) =>
    ipcResult(() => applyInitAssets(workspacePath, config))
  );
  ipcMain.handle('workspace:load-init-assets', (_event, workspacePath: string) =>
    ipcResult(() => loadInitAssets(workspacePath))
  );
  ipcMain.handle('workspace:generate-design-llm', (_event, vision: string, settings: any) =>
    ipcResult(() => generateDesignLLM(vision, settings))
  );
  ipcMain.handle('workspace:analyze-figma-design', (_event, importedContext: string, selectionUrl: string, settings: any, workspaceContext?: any) =>
    ipcResult(() => analyzeFigmaDesignContext(importedContext, selectionUrl, settings, workspaceContext))
  );
  ipcMain.handle('workspace:generate-design-stream', (_event, vision: string, mode: string, settings: any) =>
    ipcResult(() => generateDesignStream(vision, mode as any, settings))
  );
  ipcMain.handle('workspace:test-llm-connection', (_event, settings: any) =>
    ipcResult(() => testLLMConnection(settings))
  );
  ipcMain.handle(
    'assistant:chat-llm',
    (
      _event,
      payload: {
        settings: any;
        systemPrompt: string;
        messages: {
          role: 'user' | 'assistant';
          content: string;
          images?: { mimeType: string; data: string }[];
        }[];
        requestId?: string;
      }
    ) => ipcResult(() => assistantChatLLM(payload))
  );
  ipcMain.handle('assistant:cancel-chat', (_event, requestId: string) =>
    ipcResult(() => cancelAssistantChat(requestId))
  );
  ipcMain.handle('workspace:read-dir', (_event, dirPath: string) => ipcResult(() => readDirectoryContents(dirPath)));
  ipcMain.handle('workspace:search', (_event, workspacePath: string, query: string) =>
    ipcResult(() => searchWorkspaceFiles(workspacePath, query))
  );
  ipcMain.handle('workspace:create-file', (_event, workspacePath: string, filePath: string) =>
    ipcResult(() => createFile(workspacePath, filePath))
  );
  ipcMain.handle('workspace:create-dir', (_event, workspacePath: string, dirPath: string) =>
    ipcResult(() => createDirectory(workspacePath, dirPath))
  );
  ipcMain.handle('workspace:delete-path', (_event, workspacePath: string, targetPath: string) =>
    ipcResult(() => deletePath(workspacePath, targetPath))
  );
  ipcMain.handle('workspace:rename-path', (_event, workspacePath: string, oldPath: string, newPath: string) =>
    ipcResult(() => renamePath(workspacePath, oldPath, newPath))
  );
  ipcMain.handle('workspace:read-file', (_event, workspacePath: string, filePath: string) =>
    ipcResult(() => readWorkspaceFile(workspacePath, filePath))
  );
  ipcMain.handle('workspace:write-file', (_event, workspacePath: string, filePath: string, content: string) =>
    ipcResult(() => writeWorkspaceFile(workspacePath, filePath, content))
  );
  ipcMain.handle('database:test-connection', (_event, config: DbConnectionConfig, password?: string, connectionString?: string, username?: string) =>
    ipcResult(() => testDbConnection(config, password, connectionString, username))
  );
  ipcMain.handle('database:get-schema', (_event, config: DbConnectionConfig) =>
    ipcResult(() => getDbSchema(config))
  );
  ipcMain.handle('database:run-query', (_event, config: DbConnectionConfig, sql: string, caller: 'agent' | 'user') =>
    ipcResult(async () => {
      if (config.type === 'mongodb') {
        // Enforce basic JSON parsing validation for Mongo queries
        try {
          JSON.parse(sql);
        } catch (err: any) {
          throw new Error(`Malformed MongoDB query JSON: ${err.message}`);
        }
        
        const review = {
          sql,
          normalizedSql: sql,
          safe: true,
          riskScore: 0,
          severity: 'info' as const,
          message: 'MongoDB query is safe (natively read-only FIND).',
          suggestedSql: sql
        };

        try {
          const result = await runDbQuery(config, sql);
          await logDbAudit(config.id, config.id, caller, sql, 'success');
          return { ...result, safetyReview: review };
        } catch (err: any) {
          await logDbAudit(config.id, config.id, caller, sql, 'failed', err.message);
          throw err;
        }
      }

      const review = validateSqlQuery(sql, config.environment, config.permissionMode);
      if (review.severity === 'block') {
        await logDbAudit(config.id, config.id, caller, sql, 'failed', review.message);
        throw new Error(review.message);
      }
      
      const sqlToExecute = review.suggestedSql || sql;
      
      try {
        const result = await runDbQuery(config, sqlToExecute);
        await logDbAudit(config.id, config.id, caller, sqlToExecute, 'success');
        return { ...result, safetyReview: review };
      } catch (err: any) {
        await logDbAudit(config.id, config.id, caller, sqlToExecute, 'failed', err.message);
        throw err;
      }
    })
  );
  ipcMain.handle('database:save-secrets', (_event, connectionId: string, password?: string, connectionString?: string, username?: string) =>
    ipcResult(async () => {
      const passwordEncryptedRef = password ? encrypt(password) : undefined;
      const connectionStringEncryptedRef = connectionString ? encrypt(connectionString) : undefined;
      const usernameEncryptedRef = username ? encrypt(username) : undefined;
      await setDbSecrets(connectionId, { passwordEncryptedRef, connectionStringEncryptedRef, usernameEncryptedRef });
      return { ok: true };
    })
  );
  ipcMain.handle('database:delete-secrets', (_event, connectionId: string) =>
    ipcResult(async () => {
      await deleteDbSecrets(connectionId);
      return { ok: true };
    })
  );
  ipcMain.handle('database:encrypt-password', (_event, password: string) =>
    ipcResult(() => encrypt(password))
  );
  ipcMain.handle('mcp:list-clients', () => ipcResult(() => getActiveMcpClients()));
  ipcMain.handle('mcp-client:test-connection', (_event, sseUrl: string, headersJson: string) =>
    ipcResult(async () => {
      let headers: Record<string, string> = {};
      if (headersJson && headersJson.trim()) {
        try {
          headers = JSON.parse(headersJson);
        } catch (err) {
          throw new Error('Invalid headers JSON format');
        }
      }
      return testMcpConnection(sseUrl, headers);
    })
  );
  ipcMain.handle('mcp-client:list-tools', (_event, sseUrl: string, headersJson: string) =>
    ipcResult(async () => {
      let headers: Record<string, string> = {};
      if (headersJson && headersJson.trim()) {
        try {
          headers = JSON.parse(headersJson);
        } catch (err) {
          throw new Error('Invalid headers JSON format');
        }
      }
      return listMcpTools(sseUrl, headers);
    })
  );
  ipcMain.handle('mcp-client:get-figma-context', (_event, sseUrl: string, headersJson: string, figmaUrl: string) =>
    ipcResult(async () => {
      let headers: Record<string, string> = {};
      if (headersJson && headersJson.trim()) {
        try {
          headers = JSON.parse(headersJson);
        } catch (err) {
          throw new Error('Invalid headers JSON format');
        }
      }
      return getFigmaContextFromMcp(sseUrl, headers, figmaUrl);
    })
  );
  ipcMain.handle('clipboard:write-text', (_event, text: string) =>
    ipcResult(() => {
      clipboard.writeText(text);
      return true;
    })
  );
  ipcMain.handle('clipboard:write-image', (_event, dataUrl: string) =>
    ipcResult(() => {
      clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
      return true;
    })
  );
  ipcMain.handle('preview:detect-servers', () => ipcResult(() => detectDevServers()));
  ipcMain.handle('mobile:getAdbStatus', () => ipcResult(() => detectAdb()));
  ipcMain.handle('mobile:listAndroidDevices', () => ipcResult(() => listAndroidDevices()));
  ipcMain.handle('mobile:reversePort', (_event, deviceId: string, port: number) =>
    ipcResult(() => reversePort(deviceId, port))
  );
  ipcMain.handle('mobile:removeReversePort', (_event, deviceId: string, port: number) =>
    ipcResult(() => removeReversePort(deviceId, port))
  );
  ipcMain.handle('mobile:listReversePorts', (_event, deviceId: string) =>
    ipcResult(() => listReversePorts(deviceId))
  );
  ipcMain.handle('mobile:installAdb', () => ipcResult(() => installAdb()));
  ipcMain.handle('mobile:captureScreenshot', (_event, deviceId: string) =>
    ipcResult(() => captureScreenshot(deviceId))
  );
  ipcMain.handle('mobile:detectScrcpy', () => ipcResult(() => detectScrcpy()));
  ipcMain.handle('mobile:installScrcpy', () => ipcResult(() => installScrcpy()));
  ipcMain.handle('mobile:launchScrcpy', (_event, deviceId: string) =>
    ipcResult(() => launchScrcpy(deviceId))
  );
  ipcMain.handle('mobile:getDeviceScreenSize', (_event, deviceId: string) =>
    ipcResult(() => getDeviceScreenSize(deviceId))
  );
  ipcMain.handle('mobile:sendAdbInput', (_event, deviceId: string, type: 'tap' | 'swipe', params: any) =>
    ipcResult(() => sendAdbInput(deviceId, type, params))
  );
  ipcMain.handle('mobile:detectMobileStack', (_event, workspacePath: string) =>
    ipcResult(() => detectMobileStack(workspacePath))
  );
  ipcMain.handle('design:extract-website', (_event, url: string, options: any) =>
    ipcResult(() => extractWebsiteDesign(url, options))
  );
  ipcMain.handle('design:extract-multi-source', (_event, urls: any, viewports: any, userScreenshots: any) =>
    ipcResult(() => extractWebsiteDesignMultiSource(urls, viewports, userScreenshots))
  );
  ipcMain.handle('project:run', (_event, workspaceId: string, config: RunConfig) =>
    ipcResult(() => runProject(workspaceId, config, getMainWindow))
  );
  ipcMain.handle('project:stop', (_event, workspaceId: string) =>
    ipcResult(() => stopProject(workspaceId, getMainWindow))
  );
  ipcMain.handle('project:read-logs', (_event, workspaceId: string) =>
    ipcResult(() => readProjectLogs(workspaceId))
  );
  ipcMain.handle('project:status', (_event, workspaceId: string) =>
    ipcResult(() => getProjectStatus(workspaceId))
  );
  ipcMain.handle('preview:open-external', (_event, url: string) =>
    ipcResult(() => shell.openExternal(url))
  );
  ipcMain.handle(
    'preview:popout',
    (_event, url: string, width?: number, height?: number, zoomFactor?: number) =>
      ipcResult(() => {
        const popWindow = new BrowserWindow({
          width: width ?? 1280,
          height: height ?? 800,
          autoHideMenuBar: true,
          title: `AgentDeck Preview: ${url}`,
          webPreferences: {
            sandbox: true
          }
        });
        if (zoomFactor && zoomFactor !== 1) {
          popWindow.webContents.on('did-finish-load', () => {
            try {
              popWindow.webContents.setZoomFactor(zoomFactor);
            } catch (err) {
              console.error('Failed to set zoom factor:', err);
            }
          });
        }
        void popWindow.loadURL(url);
      })
  );

  ipcMain.handle(
    'attachment:save',
    (
      _event,
      payload: {
        workspaceId: string;
        paneId: string;
        taskId: string | null;
        originalName: string;
        mimeType: string;
        dataBase64: string;
      }
    ) =>
      ipcResult(async () => {
        const buffer = Buffer.from(payload.dataBase64, 'base64');
        const metadata = await saveAttachment({
          workspaceId: payload.workspaceId,
          paneId: payload.paneId,
          taskId: payload.taskId,
          originalName: payload.originalName,
          mimeType: payload.mimeType,
          buffer
        });
        const state = await readState();
        state.attachments = [...(state.attachments || []), metadata];
        await writeState(state);
        return metadata;
      })
  );

  ipcMain.handle('attachment:delete', (_event, id: string) =>
    ipcResult(async () => {
      const state = await readState();
      const current = state.attachments || [];
      const target = current.find((att) => att.id === id);
      if (target) {
        await deleteAttachmentFile(target.localPath);
        state.attachments = current.filter((att) => att.id !== id);
        await writeState(state);
      }
      return { success: true };
    })
  );

  ipcMain.handle('attachment:submit', (_event, ids: string[]) =>
    ipcResult(async () => {
      const state = await readState();
      state.attachments = (state.attachments || []).map((att) => {
        if (ids.includes(att.id)) {
          return { ...att, status: 'submitted' as const };
        }
        return att;
      });
      await writeState(state);
      return { success: true };
    })
  );

  ipcMain.handle('attachment:cleanup-workspace', (_event, workspaceId: string) =>
    ipcResult(async () => {
      const state = await readState();
      const remaining = await deleteWorkspaceAttachments(workspaceId, state);
      state.attachments = remaining;
      await writeState(state);
      return { success: true };
    })
  );

  ipcMain.handle('agent:submit-input', (_event, payload: AgentInputPayload) =>
    ipcResult(async () => {
      const textLength = payload.text ? payload.text.length : 0;
      const attachmentCount = payload.attachments ? payload.attachments.length : 0;
      const attachmentIds = payload.attachments ? payload.attachments.map((att) => att.id) : [];

      console.log(
        `[AGENT WORKSPACE PROCESSOR] Structured payload submitted. PaneId: ${payload.paneId}, AgentType: ${payload.agentType}, TextLength: ${textLength}, AttachmentCount: ${attachmentCount}, AttachmentIds: ${JSON.stringify(attachmentIds)}`
      );

      const result = processAgentInput(payload);

      let taskId: string | null = null;
      try {
        const state = await readState();
        const activeTask = state.tasks?.find((t) => t.paneId === payload.paneId && t.status === 'running');
        if (activeTask) {
          taskId = activeTask.id;
        }
      } catch (err) {
        console.error('[AGENT WORKSPACE PROCESSOR] Failed to check active task for log:', err);
      }

      await appendPaneLogEntry(payload.paneId, 'input', payload.text, {
        agentType: payload.agentType,
        textLength,
        attachmentCount,
        attachmentIds,
        success: result.success,
        error: result.success ? undefined : result.warning || 'Submission failed',
        taskId
      });

      const textNormalized = result.commandText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const textCleaned = textNormalized.replace(/^\n+|\n+$/g, '');
      const hasNewline = textCleaned.includes('\n');
      const commandToSend = hasNewline
        ? `\x1b[200~${textCleaned}\x1b[201~\r`
        : textCleaned + '\r';

      const writeSuccess = writeTerminal(payload.paneId, commandToSend);
      if (!writeSuccess) {
        throw new Error('Command execution failed. No active terminal process found for this session.');
      }

      return {
        success: result.success,
        warning: result.warning,
        commandText: result.commandText,
        adapterUsed: result.adapterUsed
      };
    })
  );


  ipcMain.on('terminal:write', (_event, payload: { paneId: string; data: string }) => {
    writeTerminal(payload.paneId, payload.data);
  });
  ipcMain.handle('terminal:write-checked', (_event, payload: { paneId: string; data: string }) =>
    writeTerminal(payload.paneId, payload.data)
  );

  ipcMain.on('terminal:resize', (_event, payload: { paneId: string; cols: number; rows: number }) => {
    resizeTerminal(payload.paneId, payload.cols, payload.rows);
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  void ensureStorage().then(async () => {
    try {
      const state = await readState();
      await cleanupOrphanedAttachments(state);
    } catch (err) {
      console.error('[SYSTEM] Failed to cleanup orphaned attachments on startup:', err);
    }
  });
  
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      const pathsToTry = [
        path.join(process.cwd(), 'agentdeck'),
        path.join(app.getAppPath(), 'agentdeck')
      ];
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          fs.chmodSync(p, 0o755);
          console.log(`[SYSTEM] Shell launcher script chmod +x set at: ${p}`);
        }
      }
    } catch (err) {
      console.error('[ERROR] Failed to set execute permissions on launcher script:', err);
    }
  }

  createWindow();
  startMcpServer(8765, () => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send('state:external-reload');
    }
  });

  // Mobile Companion (LAN) — only listens if companion.enabled in settings
  void syncCompanionFromSettings(getMainWindow).catch((err) =>
    console.error('[COMPANION] startup failed:', err)
  );

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  killAllTerminals();
  killAllProjects();
  void stopCompanionServer();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});
