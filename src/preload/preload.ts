// Đã đọc AGENTS.md
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  AppSetting,
  AppStateSnapshot,
  AppStorageInfo,
  DevServerInfo,
  GitWorkspaceStatus,
  IpcResult,
  McpClientInfo,
  ProjectContext,
  ReviewReport,
  SettingUpdate,
  TerminalExitEvent,
  TerminalLifecycleEvent,
  TerminalOutputEvent,
  TerminalStartOptions,
  Workspace,
  AttachedImageMetadata,
  AgentInputPayload,
  WebsiteExtractResult,
  WebsiteAnalysisSourceUrl,
  UserProvidedDesignScreenshot,
  WebsiteAnalysisRun,
  DbConnectionConfig,
  DbSchemaMetadata,
  AndroidDevice,
  AndroidDeviceStatus,
  MobileStackDetection
} from '../shared/types.js';

const terminalOutputListeners = new Set<(event: TerminalOutputEvent) => void>();
const terminalLifecycleListeners = new Set<(event: TerminalLifecycleEvent) => void>();

const filePathsCache = new Map<string, string>();

(globalThis as any).addEventListener('drop', (e: any) => {
  const files = e.dataTransfer?.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const path = webUtils.getPathForFile(file);
        if (path) {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          filePathsCache.set(key, path);
        }
      } catch (err) {
        console.error('[PRELOAD] Error caching path in drop:', err);
      }
    }
  }
}, { capture: true, passive: true });

(globalThis as any).addEventListener('change', (e: any) => {
  const target = e.target as any;
  if (target && target.type === 'file' && target.files) {
    const files = target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const path = webUtils.getPathForFile(file);
        if (path) {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          filePathsCache.set(key, path);
        }
      } catch (err) {
        console.error('[PRELOAD] Error caching path in change:', err);
      }
    }
  }
}, { capture: true, passive: true });
const terminalExitListeners = new Set<(event: TerminalExitEvent) => void>();

function isTerminalExitEvent(event: TerminalLifecycleEvent): event is TerminalExitEvent {
  return event.kind === 'exited' || event.kind === 'crashed' || event.kind === 'killed';
}

ipcRenderer.on('terminal:data', (_event, payload: TerminalOutputEvent) => {
  terminalOutputListeners.forEach((listener) => listener(payload));
});

ipcRenderer.on('terminal:lifecycle', (_event, payload: TerminalLifecycleEvent) => {
  terminalLifecycleListeners.forEach((listener) => listener(payload));

  if (isTerminalExitEvent(payload)) {
    terminalExitListeners.forEach((listener) => listener(payload));
  }
});

ipcRenderer.on('terminal:exit', (_event, payload: TerminalExitEvent) => {
  terminalExitListeners.forEach((listener) => listener(payload));
});

const agentDeck = {
  getVersion: () => ipcRenderer.invoke('app:getVersion') as Promise<IpcResult<string>>,
  listWorkspaces: () => ipcRenderer.invoke('workspace:list') as Promise<IpcResult<Workspace[]>>,
  createWorkspaceFolder: () => ipcRenderer.invoke('workspace:create') as Promise<IpcResult<string | null>>,
  openWorkspaceFolder: () => ipcRenderer.invoke('workspace:open') as Promise<IpcResult<string | null>>,
  validateWorkspacePath: (folderPath: string) =>
    ipcRenderer.invoke('workspace:validate-path', folderPath) as Promise<IpcResult<string>>,
  terminalCreate: (options: TerminalStartOptions) =>
    ipcRenderer.invoke('terminal:create', options) as Promise<IpcResult<void>>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<IpcResult<AppSetting[]>>,
  setSetting: (update: SettingUpdate) => ipcRenderer.invoke('settings:set', update) as Promise<IpcResult<AppSetting>>,
  selectWorkspaceFolder: () => ipcRenderer.invoke('workspace:select-folder') as Promise<string | null>,
  loadState: () => ipcRenderer.invoke('state:load') as Promise<AppStateSnapshot>,
  saveState: (state: AppStateSnapshot) => ipcRenderer.invoke('state:save', state) as Promise<void>,
  getStorageInfo: () => ipcRenderer.invoke('storage:info') as Promise<AppStorageInfo>,
  readLog: (paneId: string) => ipcRenderer.invoke('logs:read', paneId) as Promise<string>,
  terminalStart: (options: TerminalStartOptions) => ipcRenderer.invoke('terminal:start', options) as Promise<void>,
  terminalWrite: (paneId: string, data: string) => ipcRenderer.send('terminal:write', { paneId, data }),
  /** Returns false when no live PTY (killed / not started). Prefer this for agent CLI launch. */
  terminalWriteChecked: (paneId: string, data: string) =>
    ipcRenderer.invoke('terminal:write-checked', { paneId, data }) as Promise<boolean>,
  terminalResize: (paneId: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { paneId, cols, rows }),
  terminalRestart: (options: TerminalStartOptions) => ipcRenderer.invoke('terminal:restart', options) as Promise<void>,
  terminalKill: (paneId: string) => ipcRenderer.invoke('terminal:kill', paneId) as Promise<void>,
  terminalClearLog: (paneId: string) => ipcRenderer.invoke('terminal:clear-log', paneId) as Promise<void>,
  terminalPause: (paneId: string) => ipcRenderer.invoke('terminal:pause', paneId) as Promise<void>,
  terminalResume: (paneId: string) => ipcRenderer.invoke('terminal:resume', paneId) as Promise<void>,
  exportReviewReport: (report: ReviewReport) => ipcRenderer.invoke('review:export-report', report) as Promise<string>,
  getGitWorkspaceStatus: (workspacePath: string) =>
    ipcRenderer.invoke('git:status', workspacePath) as Promise<GitWorkspaceStatus>,
  getGitFileDiff: (workspacePath: string, filePath: string, contextLines?: number) =>
    ipcRenderer.invoke('git:file-diff', workspacePath, filePath, contextLines) as Promise<IpcResult<string>>,
  listArtifacts: () =>
    ipcRenderer.invoke('workspace:list-artifacts') as Promise<Array<{ name: string; relPath: string; type: string; size: number; mtime: number }>>,
  readArtifactBase64: (relPath: string) =>
    ipcRenderer.invoke('workspace:read-artifact-base64', relPath) as Promise<string>,
  readArtifactText: (relPath: string) =>
    ipcRenderer.invoke('workspace:read-artifact-text', relPath) as Promise<string>,
  deleteArtifact: (relPath: string) =>
    ipcRenderer.invoke('workspace:delete-artifact', relPath) as Promise<void>,
  createGitCheckpoint: (workspacePath: string) =>
    ipcRenderer.invoke('git:checkpoint', workspacePath) as Promise<string>,
  discardGitFileChanges: (workspacePath: string, filePath: string) =>
    ipcRenderer.invoke('git:discard-file-changes', workspacePath, filePath) as Promise<IpcResult<void>>,
  discardAllGitChanges: (workspacePath: string) =>
    ipcRenderer.invoke('git:discard-all-changes', workspacePath) as Promise<IpcResult<void>>,
  commitGitChanges: (workspacePath: string, filePaths: string[], message: string) =>
    ipcRenderer.invoke('git:commit-changes', workspacePath, filePaths, message) as Promise<IpcResult<void>>,
  revertGitHunk: (workspacePath: string, filePath: string, hunkHeader: string, hunkLines: string[]) =>
    ipcRenderer.invoke('git:revert-hunk', workspacePath, filePath, hunkHeader, hunkLines) as Promise<IpcResult<void>>,
  generateCommitMessage: (workspacePath: string, filePaths: string[], settings: any) =>
    ipcRenderer.invoke('git:generate-commit-message', workspacePath, filePaths, settings) as Promise<IpcResult<string>>,
  gitFetch: (workspacePath: string) =>
    ipcRenderer.invoke('git:fetch', workspacePath) as Promise<IpcResult<string>>,
  gitPull: (workspacePath: string) =>
    ipcRenderer.invoke('git:pull', workspacePath) as Promise<IpcResult<string>>,
  gitPush: (workspacePath: string) =>
    ipcRenderer.invoke('git:push', workspacePath) as Promise<IpcResult<string>>,
  generateProjectContext: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:generate-context', workspacePath) as Promise<ProjectContext>,
  readDir: (dirPath: string) =>
    ipcRenderer.invoke('workspace:read-dir', dirPath) as Promise<IpcResult<{ name: string; path: string; isDirectory: boolean; size: number; ext: string }[]>>,
  searchWorkspace: (workspacePath: string, query: string) =>
    ipcRenderer.invoke('workspace:search', workspacePath, query) as Promise<IpcResult<{ path: string; relPath: string; line: number; text: string }[]>>,
  readWorkspaceFile: (workspacePath: string, filePath: string) =>
    ipcRenderer.invoke('workspace:read-file', workspacePath, filePath) as Promise<IpcResult<string>>,
  writeWorkspaceFile: (workspacePath: string, filePath: string, content: string) =>
    ipcRenderer.invoke('workspace:write-file', workspacePath, filePath, content) as Promise<IpcResult<void>>,
  createFile: (workspacePath: string, filePath: string) =>
    ipcRenderer.invoke('workspace:create-file', workspacePath, filePath) as Promise<IpcResult<void>>,
  createDir: (workspacePath: string, dirPath: string) =>
    ipcRenderer.invoke('workspace:create-dir', workspacePath, dirPath) as Promise<IpcResult<void>>,
  deletePath: (workspacePath: string, targetPath: string) =>
    ipcRenderer.invoke('workspace:delete-path', workspacePath, targetPath) as Promise<IpcResult<void>>,
  renamePath: (workspacePath: string, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('workspace:rename-path', workspacePath, oldPath, newPath) as Promise<IpcResult<void>>,
  getMcpClients: () => ipcRenderer.invoke('mcp:list-clients') as Promise<IpcResult<McpClientInfo[]>>,
  mcpClientTestConnection: (sseUrl: string, headersJson: string) =>
    ipcRenderer.invoke('mcp-client:test-connection', sseUrl, headersJson) as Promise<
      IpcResult<{ ok: boolean; message: string; toolsCount?: number }>
    >,
  mcpClientListTools: (sseUrl: string, headersJson: string) =>
    ipcRenderer.invoke('mcp-client:list-tools', sseUrl, headersJson) as Promise<IpcResult<any[]>>,
  mcpClientGetFigmaContext: (sseUrl: string, headersJson: string, figmaUrl: string) =>
    ipcRenderer.invoke('mcp-client:get-figma-context', sseUrl, headersJson, figmaUrl) as Promise<IpcResult<string>>,
  clipboardWriteText: (text: string) =>
    ipcRenderer.invoke('clipboard:write-text', text) as Promise<IpcResult<boolean>>,
  clipboardWriteImage: (dataUrl: string) =>
    ipcRenderer.invoke('clipboard:write-image', dataUrl) as Promise<IpcResult<boolean>>,
  detectDevServers: () => ipcRenderer.invoke('preview:detect-servers') as Promise<IpcResult<DevServerInfo[]>>,
  mobileDevices: {
    getAdbStatus: () => ipcRenderer.invoke('mobile:getAdbStatus') as Promise<IpcResult<{ adbPath?: string; version?: string; missing: boolean }>>,
    listAndroidDevices: () => ipcRenderer.invoke('mobile:listAndroidDevices') as Promise<IpcResult<AndroidDevice[]>>,
    reversePort: (deviceId: string, port: number) => ipcRenderer.invoke('mobile:reversePort', deviceId, port) as Promise<IpcResult<void>>,
    removeReversePort: (deviceId: string, port: number) => ipcRenderer.invoke('mobile:removeReversePort', deviceId, port) as Promise<IpcResult<void>>,
    listReversePorts: (deviceId: string) => ipcRenderer.invoke('mobile:listReversePorts', deviceId) as Promise<IpcResult<number[]>>,
    installAdb: () => ipcRenderer.invoke('mobile:installAdb') as Promise<IpcResult<{ ok: boolean; error?: string }>>,
    captureScreenshot: (deviceId: string) => ipcRenderer.invoke('mobile:captureScreenshot', deviceId) as Promise<IpcResult<string>>,
    detectScrcpy: () => ipcRenderer.invoke('mobile:detectScrcpy') as Promise<IpcResult<{ missing: boolean; scrcpyPath?: string }>>,
    installScrcpy: () => ipcRenderer.invoke('mobile:installScrcpy') as Promise<IpcResult<{ ok: boolean; error?: string }>>,
    launchScrcpy: (deviceId: string) => ipcRenderer.invoke('mobile:launchScrcpy', deviceId) as Promise<IpcResult<void>>,
    getDeviceScreenSize: (deviceId: string) => ipcRenderer.invoke('mobile:getDeviceScreenSize', deviceId) as Promise<IpcResult<{ width: number; height: number }>>,
    sendAdbInput: (deviceId: string, type: 'tap' | 'swipe' | 'keyevent', params: any) => ipcRenderer.invoke('mobile:sendAdbInput', deviceId, type, params) as Promise<IpcResult<void>>,
    detectMobileStack: (workspacePath: string) => ipcRenderer.invoke('mobile:detectMobileStack', workspacePath) as Promise<IpcResult<MobileStackDetection>>
  },
  openExternalUrl: (url: string) => ipcRenderer.invoke('preview:open-external', url) as Promise<IpcResult<void>>,
  extractWebsiteDesign: (url: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('design:extract-website', url, options) as Promise<IpcResult<WebsiteExtractResult>>,
  extractWebsiteDesignMultiSource: (
    urls: WebsiteAnalysisSourceUrl[],
    viewports: string[],
    userScreenshots: UserProvidedDesignScreenshot[]
  ) =>
    ipcRenderer.invoke('design:extract-multi-source', urls, viewports, userScreenshots) as Promise<
      IpcResult<WebsiteAnalysisRun>
    >,
  popoutPreview: (url: string, width?: number, height?: number, zoomFactor?: number) =>
    ipcRenderer.invoke('preview:popout', url, width, height, zoomFactor) as Promise<IpcResult<void>>,
  
  applyWorkspaceInitAssets: (workspacePath: string, config: any) =>
    ipcRenderer.invoke('workspace:apply-init-assets', workspacePath, config) as Promise<IpcResult<{ cssPath: string; memoryGenerated: boolean }>>,
  loadWorkspaceInitAssets: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:load-init-assets', workspacePath) as Promise<IpcResult<any>>,
  generateDesignLLM: (vision: string, settings: any) =>
    ipcRenderer.invoke('workspace:generate-design-llm', vision, settings) as Promise<IpcResult<any>>,
  workspaceAnalyzeFigmaDesign: (importedContext: string, selectionUrl: string, settings: any, workspaceContext?: any) =>
    ipcRenderer.invoke('workspace:analyze-figma-design', importedContext, selectionUrl, settings, workspaceContext) as Promise<IpcResult<any>>,
  generateDesignStream: (vision: string, mode: string, settings: any) =>
    ipcRenderer.invoke('workspace:generate-design-stream', vision, mode, settings) as Promise<IpcResult<any>>,
  testLLMConnection: (settings: any) =>
    ipcRenderer.invoke('workspace:test-llm-connection', settings) as Promise<IpcResult<any>>,
  /** Assist panel chat via Settings → AI Models (LLM) config (supports vision images) */
  assistantChatLLM: (payload: {
    settings: {
      provider: string;
      apiKey: string;
      model: string;
      baseUrl?: string;
    };
    systemPrompt: string;
    messages: {
      role: 'user' | 'assistant';
      content: string;
      images?: { mimeType: string; data: string }[];
    }[];
    requestId?: string;
  }) =>
    ipcRenderer.invoke('assistant:chat-llm', payload) as Promise<
      IpcResult<{ content: string }>
    >,
  cancelAssistantChat: (requestId: string) =>
    ipcRenderer.invoke('assistant:cancel-chat', requestId) as Promise<
      IpcResult<{ cancelled: boolean }>
    >,
  
  // Project Runner APIs
  projectRun: (workspaceId: string, config: any) =>
    ipcRenderer.invoke('project:run', workspaceId, config) as Promise<IpcResult<void>>,
  projectStop: (workspaceId: string) =>
    ipcRenderer.invoke('project:stop', workspaceId) as Promise<IpcResult<void>>,
  projectReadLogs: (workspaceId: string) =>
    ipcRenderer.invoke('project:read-logs', workspaceId) as Promise<IpcResult<string>>,
  projectStatus: (workspaceId: string) =>
    ipcRenderer.invoke('project:status', workspaceId) as Promise<IpcResult<{ status: string; activeConfigId: string | null; errors: string[] }>>,

  attachmentSave: (payload: { workspaceId: string; paneId: string; taskId: string | null; originalName: string; mimeType: string; dataBase64: string }) =>
    ipcRenderer.invoke('attachment:save', payload) as Promise<IpcResult<AttachedImageMetadata>>,
  attachmentDelete: (id: string) =>
    ipcRenderer.invoke('attachment:delete', id) as Promise<IpcResult<{ success: boolean }>>,
  attachmentSubmit: (ids: string[]) =>
    ipcRenderer.invoke('attachment:submit', ids) as Promise<IpcResult<{ success: boolean }>>,
  attachmentCleanupWorkspace: (workspaceId: string) =>
    ipcRenderer.invoke('attachment:cleanup-workspace', workspaceId) as Promise<IpcResult<{ success: boolean }>>,
  agentSubmitInput: (payload: AgentInputPayload) =>
    ipcRenderer.invoke('agent:submit-input', payload) as Promise<
      IpcResult<{
        success: boolean;
        warning?: string;
        commandText: string;
        adapterUsed: string;
      }>
    >,
  databaseTestConnection: (config: DbConnectionConfig, password?: string, connectionString?: string, username?: string) =>
    ipcRenderer.invoke('database:test-connection', config, password, connectionString, username) as Promise<IpcResult<{ ok: boolean; message: string }>>,
  databaseGetSchema: (config: DbConnectionConfig) =>
    ipcRenderer.invoke('database:get-schema', config) as Promise<IpcResult<DbSchemaMetadata>>,
  databaseRunQuery: (config: DbConnectionConfig, sql: string, caller: 'agent' | 'user') =>
    ipcRenderer.invoke('database:run-query', config, sql, caller) as Promise<
      IpcResult<{ columns: string[]; rows: any[]; safetyReview: any }>
    >,
  databaseSaveSecrets: (connectionId: string, password?: string, connectionString?: string, username?: string) =>
    ipcRenderer.invoke('database:save-secrets', connectionId, password, connectionString, username) as Promise<IpcResult<{ ok: boolean }>>,
  databaseDeleteSecrets: (connectionId: string) =>
    ipcRenderer.invoke('database:delete-secrets', connectionId) as Promise<IpcResult<{ ok: boolean }>>,
  databaseEncryptPassword: (password: string) =>
    ipcRenderer.invoke('database:encrypt-password', password) as Promise<IpcResult<string>>,



  onProjectLifecycle: (listener: (event: { workspaceId: string; status: string; activeConfigId: string | null; errors: string[] }) => void) => {
    const handler = (_event: any, payload: any) => listener(payload);
    ipcRenderer.on('project:lifecycle', handler);
    return () => {
      ipcRenderer.off('project:lifecycle', handler);
    };
  },
  onProjectData: (listener: (event: { workspaceId: string; data: string; label: string }) => void) => {
    const handler = (_event: any, payload: any) => listener(payload);
    ipcRenderer.on('project:data', handler);
    return () => {
      ipcRenderer.off('project:data', handler);
    };
  },

  onMcpClientsChanged: (listener: (clients: McpClientInfo[]) => void) => {
    const handler = (_event: any, clients: McpClientInfo[]) => listener(clients);
    ipcRenderer.on('mcp:clients-changed', handler);
    return () => {
      ipcRenderer.off('mcp:clients-changed', handler);
    };
  },
  onTerminalData: (listener: (event: TerminalOutputEvent) => void) => {
    terminalOutputListeners.add(listener);
    return () => terminalOutputListeners.delete(listener);
  },
  onTerminalLifecycle: (listener: (event: TerminalLifecycleEvent) => void) => {
    terminalLifecycleListeners.add(listener);
    return () => terminalLifecycleListeners.delete(listener);
  },
  onTerminalExit: (listener: (event: TerminalExitEvent) => void) => {
    terminalExitListeners.add(listener);
    return () => terminalExitListeners.delete(listener);
  },
  onStateReload: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('state:external-reload', handler);
    return () => {
      ipcRenderer.off('state:external-reload', handler);
    };
  },
  /** Mobile Companion LAN control */
  companionGetStatus: () =>
    ipcRenderer.invoke('companion:get-status') as Promise<
      IpcResult<{
        enabled: boolean;
        running: boolean;
        port: number;
        token: string;
        urls: string[];
        error: string | null;
      }>
    >,
  companionSetEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('companion:set-enabled', enabled) as Promise<
      IpcResult<{
        enabled: boolean;
        running: boolean;
        port: number;
        token: string;
        urls: string[];
        error: string | null;
      }>
    >,
  companionRegenerateToken: () =>
    ipcRenderer.invoke('companion:regenerate-token') as Promise<
      IpcResult<{
        enabled: boolean;
        running: boolean;
        port: number;
        token: string;
        urls: string[];
        error: string | null;
      }>
    >,
  onCompanionAction: (
    listener: (action: {
      type: string;
      taskId?: string;
      paneId?: string;
      agentId?: string;
      workspaceId?: string;
      configId?: string;
      title?: string;
      text?: string;
    }) => void
  ) => {
    const handler = (
      _event: unknown,
      action: {
        type: string;
        taskId?: string;
        paneId?: string;
        agentId?: string;
        workspaceId?: string;
        configId?: string;
        title?: string;
        text?: string;
      }
    ) => listener(action);
    ipcRenderer.on('companion:action', handler);
    return () => {
      ipcRenderer.off('companion:action', handler);
    };
  },
  onFigmaPluginSelection: (listener: (payload: any) => void) => {
    const handler = (_event: any, payload: any) => listener(payload);
    ipcRenderer.on('figma:plugin-selection', handler);
    return () => {
      ipcRenderer.off('figma:plugin-selection', handler);
    };
  },
  getPathForFile: (file: any) => {
    try {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      const path = filePathsCache.get(key);
      if (path) return path;
      // Fallback
      return webUtils.getPathForFile(file);
    } catch (err) {
      console.error('Failed to get path for file:', err);
      return '';
    }
  }
};

contextBridge.exposeInMainWorld('agentDeck', agentDeck);

export type AgentDeckApi = typeof agentDeck;
