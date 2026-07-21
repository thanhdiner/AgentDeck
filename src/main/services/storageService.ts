import { app } from 'electron';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type {
  AgentRun,
  AppStateMetadata,
  AppStateSnapshot,
  AppStorageInfo,
  TerminalLogDirection,
  TerminalLogEntry,
  Workspace
} from '../../shared/types.js';

export const SCHEMA_VERSION = 2;

export const defaultPermissionPolicy = {
  mode: 'allow-safe' as const,
  allowedCommands: [
    'dir',
    'ls',
    'pwd',
    'git status',
    'git diff',
    'npm test',
    'npm run build',
    'npm run lint',
    'npm run typecheck'
  ],
  blockedPatterns: ['rm -rf', 'del /s', 'rmdir /s', 'format ', 'diskpart', 'git reset --hard', 'git clean -fd'],
  reviewPatterns: ['git push', 'npm install', 'pnpm install', 'yarn install', 'curl ', 'wget ', 'docker compose down'],
  trustedWorkspaceIds: []
};

const require = createRequire(import.meta.url);
const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const timestamp = () => Date.now();
const maxLogBytes = 1024 * 1024;
let sqlJsPromise: Promise<SqlJsStatic> | null = null;
const lastRotateCheck = new Map<string, number>();
let storageEnsured = false;
const writeQueues = new Map<
  string,
  {
    promise: Promise<void>;
    items: string[];
    timer: NodeJS.Timeout | null;
  }
>();

const defaultMetadata = (): AppStateMetadata => {
  const now = timestamp();
  return {
    schemaVersion: SCHEMA_VERSION,
    storageEngine: 'sqlite',
    createdAt: now,
    updatedAt: now,
    migratedAt: null
  };
};

export const defaultState = (): AppStateSnapshot => ({
  metadata: defaultMetadata(),
  workspaces: [],
  projects: [],
  activeWorkspaceId: null,
  activePaneId: null,
  tasks: [],
  skills: [],
  agentProfiles: [],
  agentRuns: [],
  permissionPolicy: defaultPermissionPolicy,
  permissionRules: [],
  permissionDecisions: [],
  workspaceTemplates: [],
  projectNotes: [],
  reviewReports: [],
  appSettings: [],
  rightTab: 'tasks',
  assistantMessages: [],
  workflows: [],
  attachments: [],
  autoImportFigma: false,
  autoAttachFigma: false,
  autoImportMode: 'get_design_context',
  latestReceivedSelection: null,
  figmaBuildPlans: [],
  activeFigmaBuildPlanId: null
});

export function appDataPath(...segments: string[]) {
  return path.join(app.getPath('userData'), ...segments);
}

export function statePath() {
  return appDataPath('agentdeck.sqlite');
}

function legacyStatePath() {
  return appDataPath('state.json');
}

export function logsDir() {
  return appDataPath('logs');
}

export function reportsDir() {
  return appDataPath('reports');
}

export function logPath(paneId: string) {
  return path.join(logsDir(), `${paneId}.jsonl`);
}

function legacyLogPath(paneId: string) {
  return path.join(logsDir(), `${paneId}.log`);
}

async function rotatePaneLogIfNeeded(paneId: string) {
  const nowTime = timestamp();
  const lastCheck = lastRotateCheck.get(paneId) || 0;
  if (nowTime - lastCheck < 15000) {
    return;
  }
  lastRotateCheck.set(paneId, nowTime);

  const filePath = logPath(paneId);

  try {
    const stat = await fs.stat(filePath);
    if (stat.size < maxLogBytes) {
      return;
    }

    const rotatedPath = path.join(logsDir(), `${paneId}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
    await fs.rename(filePath, rotatedPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function ensureStorage() {
  if (storageEnsured) return;
  await fs.mkdir(logsDir(), { recursive: true });
  await fs.mkdir(reportsDir(), { recursive: true });
  storageEnsured = true;
}

function loadSqlJs() {
  sqlJsPromise ??= initSqlJs({ locateFile: (file) => (file === 'sql-wasm.wasm' ? sqlWasmPath : file) });
  return sqlJsPromise;
}

function normalizeState(raw: Partial<AppStateSnapshot>): AppStateSnapshot {
  const fallback = defaultState();
  const metadata = raw.metadata ?? fallback.metadata;
  const migrated = metadata.schemaVersion !== SCHEMA_VERSION || metadata.storageEngine !== 'sqlite';

  return {
    ...fallback,
    ...raw,
    metadata: {
      ...fallback.metadata,
      ...metadata,
      schemaVersion: SCHEMA_VERSION,
      storageEngine: 'sqlite',
      migratedAt: migrated ? timestamp() : (metadata.migratedAt ?? null)
    },
    workspaces: Array.isArray(raw.workspaces) ? raw.workspaces : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    agentProfiles: Array.isArray(raw.agentProfiles) ? raw.agentProfiles : [],
    agentRuns: Array.isArray(raw.agentRuns) ? raw.agentRuns : [],
    permissionPolicy: { ...fallback.permissionPolicy, ...(raw.permissionPolicy ?? {}) },
    permissionRules: Array.isArray(raw.permissionRules) ? raw.permissionRules : [],
    permissionDecisions: Array.isArray(raw.permissionDecisions) ? raw.permissionDecisions : [],
    workspaceTemplates: Array.isArray(raw.workspaceTemplates) ? raw.workspaceTemplates : [],
    projectNotes: Array.isArray(raw.projectNotes) ? raw.projectNotes : [],
    reviewReports: Array.isArray(raw.reviewReports) ? raw.reviewReports : [],
    appSettings: Array.isArray(raw.appSettings) ? raw.appSettings : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    autoImportFigma: raw.autoImportFigma ?? fallback.autoImportFigma,
    autoAttachFigma: raw.autoAttachFigma ?? fallback.autoAttachFigma,
    autoImportMode: raw.autoImportMode ?? fallback.autoImportMode,
    latestReceivedSelection: raw.latestReceivedSelection !== undefined ? raw.latestReceivedSelection : fallback.latestReceivedSelection,
    figmaBuildPlans: Array.isArray(raw.figmaBuildPlans) ? raw.figmaBuildPlans : [],
    activeFigmaBuildPlanId: raw.activeFigmaBuildPlanId !== undefined ? raw.activeFigmaBuildPlanId : fallback.activeFigmaBuildPlanId
  };
}

function initializeDatabase(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_opened_at INTEGER,
      layout_json TEXT NOT NULL,
      settings_json TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      task_id TEXT,
      agent_profile_id TEXT NOT NULL,
      terminal_session_id TEXT NOT NULL,
      command TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      log_path TEXT NOT NULL,
      summary TEXT NOT NULL
    )
  `);
  db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

async function openDatabase() {
  const SQL = await loadSqlJs();

  try {
    const data = await fs.readFile(statePath());
    const db = new SQL.Database(new Uint8Array(data));
    initializeDatabase(db);
    return db;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }

    const db = new SQL.Database();
    initializeDatabase(db);
    return db;
  }
}

async function saveDatabase(db: Database) {
  await fs.writeFile(statePath(), Buffer.from(db.export()));
}

async function readLegacyState() {
  try {
    return normalizeState(JSON.parse(await fs.readFile(legacyStatePath(), 'utf8')) as Partial<AppStateSnapshot>);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function readSnapshotFromDatabase(db: Database) {
  const result = db.exec('SELECT data_json FROM app_state WHERE id = 1 LIMIT 1');
  const value = result[0]?.values[0]?.[0];
  return typeof value === 'string' ? normalizeState(JSON.parse(value) as Partial<AppStateSnapshot>) : null;
}

function writeWorkspaceMetadata(db: Database, workspaces: Workspace[]) {
  db.run('DELETE FROM workspaces');

  for (const workspace of workspaces) {
    if (!workspace.id) {
      continue;
    }

    const rootPath = workspace.rootPath || workspace.path || '';
    const createdAt = workspace.createdAt ?? timestamp();
    const updatedAt = workspace.updatedAt ?? createdAt;

    db.run(
      `
        INSERT INTO workspaces (
          id,
          name,
          root_path,
          created_at,
          updated_at,
          last_opened_at,
          layout_json,
          settings_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        workspace.id,
        workspace.name || rootPath || workspace.id,
        rootPath,
        createdAt,
        updatedAt,
        workspace.lastOpenedAt ?? null,
        workspace.layoutJson || JSON.stringify(workspace.layout ?? null),
        workspace.settingsJson || '{}'
      ]
    );
  }
}

function writeAgentRunMetadata(db: Database, agentRuns: AgentRun[]) {
  db.run('DELETE FROM agent_runs');

  for (const run of agentRuns) {
    if (!run.id || !run.workspaceId || !run.agentProfileId || !run.terminalSessionId) {
      continue;
    }

    db.run(
      `
        INSERT INTO agent_runs (
          id,
          workspace_id,
          task_id,
          agent_profile_id,
          terminal_session_id,
          command,
          status,
          started_at,
          finished_at,
          log_path,
          summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        run.id,
        run.workspaceId,
        run.taskId ?? null,
        run.agentProfileId,
        run.terminalSessionId,
        run.command,
        run.status,
        run.startedAt,
        run.finishedAt ?? null,
        run.logPath,
        run.summary
      ]
    );
  }
}

async function persistState(db: Database, state: AppStateSnapshot) {
  const nextState = normalizeState({ ...state, metadata: { ...state.metadata, updatedAt: timestamp() } });

  db.run('BEGIN');
  try {
    db.run('INSERT OR REPLACE INTO app_state (id, data_json, updated_at) VALUES (1, ?, ?)', [
      JSON.stringify(nextState),
      nextState.metadata.updatedAt
    ]);
    writeWorkspaceMetadata(db, nextState.workspaces);
    writeAgentRunMetadata(db, nextState.agentRuns);
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  await saveDatabase(db);
  return nextState;
}

export async function readState(): Promise<AppStateSnapshot> {
  await ensureStorage();
  const db = await openDatabase();

  try {
    const existing = readSnapshotFromDatabase(db);
    if (existing) {
      return existing;
    }

    const initialState = (await readLegacyState()) ?? defaultState();
    return persistState(db, initialState);
  } finally {
    db.close();
  }
}

export async function writeState(state: AppStateSnapshot) {
  await ensureStorage();
  const db = await openDatabase();

  try {
    await persistState(db, state);
  } finally {
    db.close();
  }
}

function getOrCreateQueue(paneId: string) {
  let queue = writeQueues.get(paneId);
  if (!queue) {
    queue = {
      promise: Promise.resolve(),
      items: [],
      timer: null
    };
    writeQueues.set(paneId, queue);
  }
  return queue;
}

function scheduleFlush(
  paneId: string,
  queue: { promise: Promise<void>; items: string[]; timer: NodeJS.Timeout | null }
) {
  if (queue.timer) return;
  queue.timer = setTimeout(() => {
    const q = writeQueues.get(paneId);
    if (q) {
      q.timer = null;
      void doFlush(paneId);
    }
  }, 150);
}

async function doFlush(paneId: string) {
  const queue = writeQueues.get(paneId);
  if (!queue || queue.items.length === 0) return;

  const toWrite = queue.items.join('');
  queue.items = [];

  queue.promise = queue.promise.then(async () => {
    try {
      await ensureStorage();
      await rotatePaneLogIfNeeded(paneId);
      await fs.appendFile(logPath(paneId), toWrite, 'utf8');
    } catch (error) {
      console.error(`Failed to write logs for pane ${paneId}:`, error);
    }
  });
  await queue.promise;
}

export async function flushPaneLogQueue(paneId: string) {
  const queue = writeQueues.get(paneId);
  if (queue) {
    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }
    await doFlush(paneId);
    writeQueues.delete(paneId);
  }
}

/**
 * Synchronous hot-path log entry — zero promises, zero async, zero await.
 * Just serializes and pushes into the in-memory buffer.
 * Actual I/O is deferred entirely to the flush timer.
 */
export function queuePaneLogEntry(
  paneId: string,
  direction: TerminalLogDirection,
  text: string,
  extra?: Partial<Omit<TerminalLogEntry, 'timestamp' | 'sessionId' | 'direction' | 'text'>>
) {
  const entry: TerminalLogEntry = {
    timestamp: timestamp(),
    sessionId: paneId,
    direction,
    text,
    ...extra
  };
  const line = `${JSON.stringify(entry)}\n`;
  const queue = getOrCreateQueue(paneId);
  queue.items.push(line);
  scheduleFlush(paneId, queue);
}

export async function appendPaneLogEntry(
  paneId: string,
  direction: TerminalLogDirection,
  text: string,
  extra?: Partial<Omit<TerminalLogEntry, 'timestamp' | 'sessionId' | 'direction' | 'text'>>
) {
  queuePaneLogEntry(paneId, direction, text, extra);
}

export async function appendPaneLog(paneId: string, data: string) {
  await appendPaneLogEntry(paneId, 'output', data);
}

export async function readPaneLog(paneId: string) {
  try {
    return await fs.readFile(logPath(paneId), 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      try {
        return await fs.readFile(legacyLogPath(paneId), 'utf8');
      } catch (legacyError) {
        const legacyCode = (legacyError as NodeJS.ErrnoException).code;
        if (legacyCode === 'ENOENT') {
          return '';
        }

        throw legacyError;
      }
    }

    throw error;
  }
}

export async function clearPaneLog(paneId: string) {
  await ensureStorage();
  await fs.writeFile(logPath(paneId), '', 'utf8');
}

export async function writeReportFile(title: string, body: string) {
  await ensureStorage();
  const safeName =
    title
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'review-report';
  const filePath = path.join(reportsDir(), `${safeName}.md`);
  await fs.writeFile(filePath, body, 'utf8');
  return filePath;
}

export function getStorageInfo(): AppStorageInfo {
  return {
    schemaVersion: SCHEMA_VERSION,
    storageEngine: 'sqlite',
    userDataPath: app.getPath('userData'),
    statePath: statePath(),
    logsDir: logsDir(),
    reportsDir: reportsDir(),
    logFilePattern: 'logs/{paneId}.jsonl'
  };
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const isWindows = process.platform === 'win32';
  let pParent = path.resolve(parentPath);
  let pChild = path.resolve(childPath);
  if (isWindows) {
    pParent = pParent.toLowerCase();
    pChild = pChild.toLowerCase();
  }
  const relative = path.relative(pParent, pChild);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function listArtifacts(): Promise<Array<{ name: string; relPath: string; type: string; size: number; mtime: number }>> {
  let conversationId: string | null = null;
  const sourceMetadata = process.env.ANTIGRAVITY_SOURCE_METADATA;
  if (sourceMetadata) {
    try {
      const parsed = JSON.parse(sourceMetadata);
      conversationId = parsed.tool?.conversationId || null;
    } catch {
      // ignore
    }
  }

  const homedir = os.homedir();
  const brainBaseDir = path.join(homedir, '.gemini', 'antigravity', 'brain');
  
  let targetBrainDir = '';
  
  if (conversationId) {
    targetBrainDir = path.join(brainBaseDir, conversationId);
  } else {
    try {
      const entries = await fs.readdir(brainBaseDir, { withFileTypes: true });
      let newestTime = 0;
      let newestDir = '';
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'tempmediaStorage') {
          const fullPath = path.join(brainBaseDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
            newestDir = entry.name;
          }
        }
      }
      if (newestDir) {
        targetBrainDir = path.join(brainBaseDir, newestDir);
      }
    } catch (err) {
      console.error('Failed to read brain directory:', err);
    }
  }

  if (!targetBrainDir) {
    return [];
  }

  const results: Array<{ name: string; relPath: string; type: string; size: number; mtime: number }> = [];

  async function scan(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(targetBrainDir, fullPath).replace(/\\/g, '/');
      
      if (entry.isDirectory()) {
        if (entry.name === '.agents') continue;
        if (entry.name === '.system_generated') continue;
        if (entry.name === '.tempmediaStorage') continue;
        try {
          await scan(fullPath);
        } catch {
          // ignore
        }
      } else {
        if (entry.name.endsWith('.metadata.json')) {
          continue;
        }
        
        try {
          const stat = await fs.stat(fullPath);
          const ext = path.extname(entry.name).toLowerCase();
          
          let type = 'Other';
          if (entry.name === 'task.md') {
            type = 'Task';
          } else if (entry.name === 'walkthrough.md') {
            type = 'Walkthrough';
          } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
            type = 'Media';
          } else if (
            relPath.startsWith('scratch/') || 
            entry.name.toLowerCase().includes('test') || 
            entry.name.toLowerCase().includes('search')
          ) {
            type = 'Test Search';
          } else if (ext === '.md') {
            type = 'Document';
          }

          results.push({
            name: entry.name,
            relPath,
            type,
            size: stat.size,
            mtime: stat.mtimeMs
          });
        } catch {
          // ignore
        }
      }
    }
  }

  try {
    await scan(targetBrainDir);
  } catch (err) {
    console.error('Error scanning artifacts folder:', err);
  }

  return results;
}

export async function readArtifactBase64(relPath: string): Promise<string> {
  let conversationId: string | null = null;
  const sourceMetadata = process.env.ANTIGRAVITY_SOURCE_METADATA;
  if (sourceMetadata) {
    try {
      const parsed = JSON.parse(sourceMetadata);
      conversationId = parsed.tool?.conversationId || null;
    } catch {
      // ignore
    }
  }

  const homedir = os.homedir();
  const brainBaseDir = path.join(homedir, '.gemini', 'antigravity', 'brain');
  
  let targetBrainDir = '';
  
  if (conversationId) {
    targetBrainDir = path.join(brainBaseDir, conversationId);
  } else {
    try {
      const entries = await fs.readdir(brainBaseDir, { withFileTypes: true });
      let newestTime = 0;
      let newestDir = '';
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'tempmediaStorage') {
          const fullPath = path.join(brainBaseDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
            newestDir = entry.name;
          }
        }
      }
      if (newestDir) {
        targetBrainDir = path.join(brainBaseDir, newestDir);
      }
    } catch (err) {
      console.error('Failed to read brain directory:', err);
    }
  }

  if (!targetBrainDir) {
    throw new Error('Brain directory not found');
  }

  const absolutePath = path.resolve(targetBrainDir, relPath);
  if (!isPathInside(absolutePath, targetBrainDir) && absolutePath !== path.resolve(targetBrainDir)) {
    throw new Error('Access denied: file is outside the brain directory');
  }

  const buffer = await fs.readFile(absolutePath);
  return buffer.toString('base64');
}

export async function readArtifactText(relPath: string): Promise<string> {
  let conversationId: string | null = null;
  const sourceMetadata = process.env.ANTIGRAVITY_SOURCE_METADATA;
  if (sourceMetadata) {
    try {
      const parsed = JSON.parse(sourceMetadata);
      conversationId = parsed.tool?.conversationId || null;
    } catch {
      // ignore
    }
  }

  const homedir = os.homedir();
  const brainBaseDir = path.join(homedir, '.gemini', 'antigravity', 'brain');
  
  let targetBrainDir = '';
  
  if (conversationId) {
    targetBrainDir = path.join(brainBaseDir, conversationId);
  } else {
    try {
      const entries = await fs.readdir(brainBaseDir, { withFileTypes: true });
      let newestTime = 0;
      let newestDir = '';
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'tempmediaStorage') {
          const fullPath = path.join(brainBaseDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
            newestDir = entry.name;
          }
        }
      }
      if (newestDir) {
        targetBrainDir = path.join(brainBaseDir, newestDir);
      }
    } catch (err) {
      console.error('Failed to read brain directory:', err);
    }
  }

  if (!targetBrainDir) {
    throw new Error('Brain directory not found');
  }

  const absolutePath = path.resolve(targetBrainDir, relPath);
  if (!isPathInside(absolutePath, targetBrainDir) && absolutePath !== path.resolve(targetBrainDir)) {
    throw new Error('Access denied: file is outside the brain directory');
  }

  return fs.readFile(absolutePath, 'utf8');
}

export async function deleteArtifact(relPath: string): Promise<void> {
  let conversationId: string | null = null;
  const sourceMetadata = process.env.ANTIGRAVITY_SOURCE_METADATA;
  if (sourceMetadata) {
    try {
      const parsed = JSON.parse(sourceMetadata);
      conversationId = parsed.tool?.conversationId || null;
    } catch {
      // ignore
    }
  }

  const homedir = os.homedir();
  const brainBaseDir = path.join(homedir, '.gemini', 'antigravity', 'brain');
  
  let targetBrainDir = '';
  
  if (conversationId) {
    targetBrainDir = path.join(brainBaseDir, conversationId);
  } else {
    try {
      const entries = await fs.readdir(brainBaseDir, { withFileTypes: true });
      let newestTime = 0;
      let newestDir = '';
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'tempmediaStorage') {
          const fullPath = path.join(brainBaseDir, entry.name);
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > newestTime) {
            newestTime = stat.mtimeMs;
            newestDir = entry.name;
          }
        }
      }
      if (newestDir) {
        targetBrainDir = path.join(brainBaseDir, newestDir);
      }
    } catch (err) {
      console.error('Failed to read brain directory:', err);
    }
  }

  if (!targetBrainDir) {
    throw new Error('Brain directory not found');
  }

  const absolutePath = path.resolve(targetBrainDir, relPath);
  if (!isPathInside(absolutePath, targetBrainDir) && absolutePath !== path.resolve(targetBrainDir)) {
    throw new Error('Access denied: file is outside the brain directory');
  }

  await fs.unlink(absolutePath);
}

