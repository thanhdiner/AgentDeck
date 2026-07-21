/**
 * Mobile Companion — lightweight LAN HTTP API + mobile web UI.
 * Enable only on trusted networks (LAN / Tailscale). Token required.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import type { BrowserWindow } from 'electron';
import type { DeckTask, AgentRun, TaskStatus, TaskPriority } from '../../shared/types.js';
import { readState, writeState, readPaneLog } from './storageService.js';
import { writeTerminal } from './terminalService.js';
import { getGitWorkspaceStatus } from './gitService.js';
import { getProjectStatus } from './projectRunnerService.js';
import { getCompanionHtml } from './companionHtml.js';

export type CompanionStatus = {
  enabled: boolean;
  running: boolean;
  port: number;
  token: string;
  urls: string[];
  error: string | null;
};

const DEFAULT_PORT = 8787;
const SETTING_ENABLED = 'companion.enabled';
const SETTING_TOKEN = 'companion.token';
const SETTING_PORT = 'companion.port';

let server: http.Server | null = null;
let currentPort = DEFAULT_PORT;
let currentToken = '';
let lastError: string | null = null;
let getMainWindow: (() => BrowserWindow | null) | null = null;

function now() {
  return Date.now();
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function generateCompanionToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function listLanUrls(port: number): string[] {
  const urls: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const ent of entries) {
      if (ent.family !== 'IPv4' || ent.internal) continue;
      // skip link-local noise unless nothing else
      if (ent.address.startsWith('169.254.')) continue;
      urls.push(`http://${ent.address}:${port}`);
    }
  }
  if (urls.length === 0) {
    urls.push(`http://127.0.0.1:${port}`);
  }
  return urls;
}

async function getCompanionConfig(): Promise<{ enabled: boolean; token: string; port: number }> {
  const state = await readState();
  const enabled =
    state.appSettings.find((s) => s.key === SETTING_ENABLED)?.value === true ||
    state.appSettings.find((s) => s.key === SETTING_ENABLED)?.value === 'true';
  let token = String(state.appSettings.find((s) => s.key === SETTING_TOKEN)?.value || '');
  if (!token) {
    token = generateCompanionToken();
    await writeState({
      ...state,
      appSettings: [
        { key: SETTING_TOKEN, value: token, updatedAt: now() },
        ...state.appSettings.filter((s) => s.key !== SETTING_TOKEN)
      ]
    });
  }
  const portRaw = state.appSettings.find((s) => s.key === SETTING_PORT)?.value;
  const port = typeof portRaw === 'number' && portRaw > 0 ? portRaw : Number(portRaw) || DEFAULT_PORT;
  return { enabled: Boolean(enabled), token, port };
}

function extractToken(req: http.IncomingMessage, url: URL): string | null {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const header = req.headers['x-agentdeck-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const q = url.searchParams.get('token');
  return q?.trim() || null;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      if (Buffer.concat(chunks).length > 256 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function notifyRenderer(channel: string, payload: unknown) {
  const win = getMainWindow?.();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function triggerReload() {
  notifyRenderer('state:external-reload', null);
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  token: string
): Promise<void> {
  const provided = extractToken(req, url);
  if (!provided || provided !== token) {
    sendJson(res, 401, { error: 'Unauthorized — set token in Settings or ?token=' });
    return;
  }

  const pathName = url.pathname.replace(/\/+$/, '') || '/';

  // GET /api/status — dashboard snapshot
  if (pathName === '/api/status' && req.method === 'GET') {
    const state = await readState();
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId) ?? null;
    const running = state.agentRuns.filter((r) => r.status === 'running').length;
    const byStatus = {
      todo: state.tasks.filter((t) => t.status === 'todo').length,
      running: state.tasks.filter((t) => t.status === 'running').length,
      review: state.tasks.filter((t) => t.status === 'review').length,
      done: state.tasks.filter((t) => t.status === 'done').length
    };
    const panes = ws
      ? Object.values(ws.panes || {}).map((p) => ({
          id: p.id,
          title: p.title,
          shell: p.shell ?? null,
          processStatus: p.processStatus ?? null,
          active: p.id === state.activePaneId
        }))
      : [];
    const projectRun = ws ? getProjectStatus(ws.id) : { status: 'stopped', activeConfigId: null, errors: [] as string[] };
    const runConfigs = (ws?.runConfigs || []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      command: (c.command || '').slice(0, 120),
      previewUrl: c.previewUrl || null
    }));
    const activeRunConfig =
      runConfigs.find((c) => c.id === projectRun.activeConfigId) ||
      runConfigs.find((c) => c.id === ws?.defaultConfigId) ||
      runConfigs[0] ||
      null;
    sendJson(res, 200, {
      ok: true,
      workspace: ws
        ? {
            id: ws.id,
            name: ws.name,
            rootPath: ws.rootPath,
            color: ws.color || '#38bdf8',
            paneCount: Object.keys(ws.panes || {}).length,
            defaultConfigId: ws.defaultConfigId || null,
            runConfigs
          }
        : null,
      workspaces: state.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        rootPath: w.rootPath,
        color: w.color || null,
        paneCount: Object.keys(w.panes || {}).length,
        active: w.id === state.activeWorkspaceId
      })),
      activePaneId: state.activePaneId,
      panes,
      taskCount: state.tasks.length,
      openTasks: state.tasks.filter((t) => t.status !== 'done').length,
      tasksByStatus: byStatus,
      runningAgents: running,
      agentCount: (state.agentProfiles || []).length,
      permissionMode: state.permissionPolicy?.mode ?? null,
      projectRun: {
        status: projectRun.status,
        activeConfigId: projectRun.activeConfigId,
        errors: projectRun.errors || [],
        activeConfig: activeRunConfig
      }
    });
    return;
  }

  // GET /api/workspaces
  if (pathName === '/api/workspaces' && req.method === 'GET') {
    const state = await readState();
    sendJson(res, 200, {
      activeWorkspaceId: state.activeWorkspaceId,
      workspaces: state.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        rootPath: w.rootPath,
        paneCount: Object.keys(w.panes || {}).length,
        active: w.id === state.activeWorkspaceId
      }))
    });
    return;
  }

  // POST /api/workspaces/active  { workspaceId }
  if (pathName === '/api/workspaces/active' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { workspaceId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const workspaceId = String(body.workspaceId || '').trim();
    const state = await readState();
    const ws = state.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      sendJson(res, 404, { error: 'Workspace not found' });
      return;
    }
    const firstPane = Object.keys(ws.panes || {})[0] ?? null;
    await writeState({
      ...state,
      activeWorkspaceId: workspaceId,
      activePaneId: firstPane
    });
    triggerReload();
    notifyRenderer('companion:action', { type: 'select-workspace', workspaceId });
    sendJson(res, 200, { ok: true, workspaceId, activePaneId: firstPane });
    return;
  }

  // GET /api/panes
  if (pathName === '/api/panes' && req.method === 'GET') {
    const state = await readState();
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!ws) {
      sendJson(res, 200, { panes: [], activePaneId: null });
      return;
    }
    const panes = Object.values(ws.panes || {}).map((p) => ({
      id: p.id,
      title: p.title,
      shell: p.shell ?? null,
      cwd: p.cwd ?? null,
      processStatus: p.processStatus ?? null,
      active: p.id === state.activePaneId
    }));
    sendJson(res, 200, { panes, activePaneId: state.activePaneId });
    return;
  }

  // POST /api/panes/active  { paneId }
  if (pathName === '/api/panes/active' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { paneId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const paneId = String(body.paneId || '').trim();
    const state = await readState();
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!ws?.panes?.[paneId]) {
      sendJson(res, 404, { error: 'Pane not found in active workspace' });
      return;
    }
    await writeState({ ...state, activePaneId: paneId });
    triggerReload();
    notifyRenderer('companion:action', { type: 'select-pane', paneId });
    sendJson(res, 200, { ok: true, paneId });
    return;
  }

  // POST /api/panes  { title? } — create pane on desktop
  if (pathName === '/api/panes' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { title?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const state = await readState();
    if (!state.activeWorkspaceId) {
      sendJson(res, 400, { error: 'No active workspace' });
      return;
    }
    const title = String(body.title || '').trim() || undefined;
    notifyRenderer('companion:action', { type: 'create-pane', title });
    sendJson(res, 200, { ok: true, message: 'Pane create requested on desktop' });
    return;
  }

  // POST /api/project/run  { configId? }
  if (pathName === '/api/project/run' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { configId?: string; workspaceId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const state = await readState();
    const workspaceId = String(body.workspaceId || state.activeWorkspaceId || '').trim();
    const ws = state.workspaces.find((w) => w.id === workspaceId);
    if (!ws) {
      sendJson(res, 404, { error: 'Workspace not found' });
      return;
    }
    const configs = ws.runConfigs || [];
    if (!configs.length) {
      sendJson(res, 400, { error: 'No run configs — configure Run on desktop first' });
      return;
    }
    const configId =
      String(body.configId || '').trim() ||
      ws.defaultConfigId ||
      configs[0]?.id ||
      '';
    if (!configs.some((c) => c.id === configId)) {
      sendJson(res, 404, { error: 'Run config not found' });
      return;
    }
    notifyRenderer('companion:action', { type: 'run-project', workspaceId, configId });
    sendJson(res, 200, { ok: true, workspaceId, configId, message: 'Project run requested' });
    return;
  }

  // POST /api/project/stop  { workspaceId? }
  if (pathName === '/api/project/stop' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { workspaceId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const state = await readState();
    const workspaceId = String(body.workspaceId || state.activeWorkspaceId || '').trim();
    if (!workspaceId) {
      sendJson(res, 400, { error: 'No workspace' });
      return;
    }
    notifyRenderer('companion:action', { type: 'stop-project', workspaceId });
    sendJson(res, 200, { ok: true, workspaceId, message: 'Project stop requested' });
    return;
  }

  // GET /api/agents
  if (pathName === '/api/agents' && req.method === 'GET') {
    const state = await readState();
    const agents = (state.agentProfiles || []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || '',
      providerType: a.providerType,
      commandTemplate: (a.commandTemplate || '').slice(0, 160)
    }));
    sendJson(res, 200, { agents });
    return;
  }

  // POST /api/agents/:id/run  { paneId? }
  const agentRunMatch = pathName.match(/^\/api\/agents\/([^/]+)\/run$/);
  if (agentRunMatch && req.method === 'POST') {
    const agentId = decodeURIComponent(agentRunMatch[1]);
    const raw = await readBody(req);
    let body: { paneId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const state = await readState();
    const agent = (state.agentProfiles || []).find((a) => a.id === agentId);
    if (!agent) {
      sendJson(res, 404, { error: 'Agent not found' });
      return;
    }
    const paneId = body.paneId || state.activePaneId;
    if (!paneId) {
      sendJson(res, 400, { error: 'No pane selected' });
      return;
    }
    notifyRenderer('companion:action', { type: 'run-agent', agentId, paneId });
    sendJson(res, 200, { ok: true, agentId, paneId, message: 'Agent run requested on desktop' });
    return;
  }

  // GET /api/tasks
  if (pathName === '/api/tasks' && req.method === 'GET') {
    const state = await readState();
    const statusFilter = url.searchParams.get('status');
    let tasks = [...state.tasks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (statusFilter && statusFilter !== 'all') {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }
    sendJson(res, 200, {
      tasks: tasks.slice(0, 100).map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        status: t.status,
        priority: t.priority ?? 'medium',
        paneId: t.paneId,
        agentId: t.agentId,
        skillId: t.skillId ?? null,
        updatedAt: t.updatedAt,
        createdAt: t.createdAt
      }))
    });
    return;
  }

  // POST /api/tasks  { title, body?, run?, priority?, agentId? }
  if (pathName === '/api/tasks' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: {
      title?: string;
      body?: string;
      run?: boolean;
      priority?: string;
      agentId?: string | null;
    } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const title = String(body.title || '').trim();
    if (!title) {
      sendJson(res, 400, { error: 'title is required' });
      return;
    }
    const state = await readState();
    const priority = (['low', 'medium', 'high'].includes(String(body.priority))
      ? body.priority
      : 'medium') as TaskPriority;
    const task: DeckTask = {
      id: newId('task'),
      title,
      body: String(body.body || '').trim(),
      status: 'todo',
      paneId: state.activePaneId,
      agentId: body.agentId || null,
      priority,
      createdAt: now(),
      updatedAt: now()
    };
    await writeState({
      ...state,
      tasks: [task, ...state.tasks]
    });
    triggerReload();
    if (body.run) {
      setTimeout(() => {
        notifyRenderer('companion:action', { type: 'run-task', taskId: task.id });
      }, 400);
    }
    sendJson(res, 201, { task, runQueued: Boolean(body.run) });
    return;
  }

  // PATCH /api/tasks/:id
  const taskPatchMatch = pathName.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskPatchMatch && req.method === 'PATCH') {
    const taskId = decodeURIComponent(taskPatchMatch[1]);
    const raw = await readBody(req);
    let body: {
      status?: string;
      title?: string;
      body?: string;
      priority?: string;
      agentId?: string | null;
    } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const state = await readState();
    const idx = state.tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    const prev = state.tasks[idx];
    const nextStatus = body.status as TaskStatus | undefined;
    const validStatus =
      nextStatus && ['todo', 'running', 'review', 'done'].includes(nextStatus)
        ? nextStatus
        : prev.status;
    const next: DeckTask = {
      ...prev,
      title: body.title != null ? String(body.title).trim() || prev.title : prev.title,
      body: body.body != null ? String(body.body) : prev.body,
      status: validStatus,
      priority:
        body.priority && ['low', 'medium', 'high'].includes(body.priority)
          ? (body.priority as TaskPriority)
          : prev.priority,
      agentId: body.agentId !== undefined ? body.agentId : prev.agentId,
      updatedAt: now()
    };
    const tasks = [...state.tasks];
    tasks[idx] = next;
    await writeState({ ...state, tasks });
    triggerReload();
    sendJson(res, 200, { task: next });
    return;
  }

  // DELETE /api/tasks/:id
  if (taskPatchMatch && req.method === 'DELETE') {
    const taskId = decodeURIComponent(taskPatchMatch[1]);
    const state = await readState();
    if (!state.tasks.some((t) => t.id === taskId)) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    await writeState({
      ...state,
      tasks: state.tasks.filter((t) => t.id !== taskId)
    });
    triggerReload();
    sendJson(res, 200, { ok: true, deleted: taskId });
    return;
  }

  // POST /api/tasks/:id/run
  const runMatch = pathName.match(/^\/api\/tasks\/([^/]+)\/run$/);
  if (runMatch && req.method === 'POST') {
    const taskId = decodeURIComponent(runMatch[1]);
    const state = await readState();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      sendJson(res, 404, { error: 'Task not found' });
      return;
    }
    notifyRenderer('companion:action', { type: 'run-task', taskId });
    sendJson(res, 200, { ok: true, taskId, message: 'Run requested on desktop' });
    return;
  }

  // GET /api/runs
  if (pathName === '/api/runs' && req.method === 'GET') {
    const state = await readState();
    const wsId = state.activeWorkspaceId;
    const statusFilter = url.searchParams.get('status');
    let runs = (state.agentRuns as AgentRun[])
      .filter((r) => !wsId || r.workspaceId === wsId)
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    if (statusFilter && statusFilter !== 'all') {
      runs = runs.filter((r) => r.status === statusFilter);
    }
    sendJson(res, 200, {
      runs: runs.slice(0, 50).map((r) => ({
        id: r.id,
        agentProfileId: r.agentProfileId,
        status: r.status,
        command: (r.command || '').slice(0, 400),
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        summary: r.summary || '',
        taskTitle: r.taskTitle || null,
        terminalSessionId: r.terminalSessionId
      }))
    });
    return;
  }

  // GET /api/git
  if (pathName === '/api/git' && req.method === 'GET') {
    const state = await readState();
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!ws?.rootPath) {
      sendJson(res, 200, { ok: false, error: 'No active workspace' });
      return;
    }
    try {
      const git = await getGitWorkspaceStatus(ws.rootPath);
      sendJson(res, 200, {
        ok: true,
        branch: git?.branch ?? null,
        changedFiles: (git?.changedFiles || []).slice(0, 40),
        changedCount: (git?.changedFiles || []).length,
        isRepo: Boolean(git)
      });
    } catch (err) {
      sendJson(res, 200, {
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
    return;
  }

  // POST /api/prompt  { text, submit?, paneId? }
  if (pathName === '/api/prompt' && req.method === 'POST') {
    const raw = await readBody(req);
    let body: { text?: string; submit?: boolean; paneId?: string } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    const text = String(body.text || '');
    if (!text.trim()) {
      sendJson(res, 400, { error: 'text is required' });
      return;
    }
    const state = await readState();
    const paneId = body.paneId || state.activePaneId;
    if (!paneId) {
      sendJson(res, 400, { error: 'No active terminal pane on desktop' });
      return;
    }
    const payload = body.submit === false ? text : `${text}\r`;
    const ok = writeTerminal(paneId, payload);
    if (!ok) {
      notifyRenderer('companion:action', {
        type: 'write-prompt',
        paneId,
        text: payload
      });
    }
    sendJson(res, 200, { ok: true, paneId, wrote: ok });
    return;
  }

  // GET /api/logs/tail?paneId=&lines=
  if (pathName === '/api/logs/tail' && req.method === 'GET') {
    const state = await readState();
    const paneId = url.searchParams.get('paneId') || state.activePaneId;
    if (!paneId) {
      sendJson(res, 400, { error: 'No paneId' });
      return;
    }
    const lines = Math.min(300, Math.max(20, Number(url.searchParams.get('lines')) || 100));
    const raw = await readPaneLog(paneId);
    const all = (raw || '').split(/\r?\n/);
    const tail = all.slice(-lines).join('\n');
    sendJson(res, 200, { paneId, lines: tail, totalLines: all.length });
    return;
  }

  // GET /api/skills — list skill names for reference
  if (pathName === '/api/skills' && req.method === 'GET') {
    const state = await readState();
    const skills = (state.skills || []).slice(0, 60).map((s) => ({
      id: s.id,
      name: s.name,
      description: (s.description || '').slice(0, 120)
    }));
    sendJson(res, 200, { skills });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

export function getCompanionStatus(): CompanionStatus {
  return {
    enabled: Boolean(server),
    running: Boolean(server?.listening),
    port: currentPort,
    token: currentToken,
    urls: server ? listLanUrls(currentPort) : [],
    error: lastError
  };
}

export async function stopCompanionServer(): Promise<void> {
  await new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    const s = server;
    server = null;
    s.close(() => resolve());
  });
  lastError = null;
}

export async function startCompanionServer(
  getWin: () => BrowserWindow | null
): Promise<CompanionStatus> {
  getMainWindow = getWin;
  const cfg = await getCompanionConfig();
  currentToken = cfg.token;
  currentPort = cfg.port;
  lastError = null;

  if (!cfg.enabled) {
    await stopCompanionServer();
    return getCompanionStatus();
  }

  if (server?.listening) {
    return getCompanionStatus();
  }

  await stopCompanionServer();

  server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || `127.0.0.1:${currentPort}`;
      const url = new URL(req.url || '/', `http://${host}`);

      // CORS for phone browsers (same origin for UI; allow fetch from other origins if needed)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-AgentDeck-Token'
      );
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Static UI
      if ((url.pathname === '/' || url.pathname === '/index.html') && req.method === 'GET') {
        const html = getCompanionHtml();
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache'
        });
        res.end(html);
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url, currentToken);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (err) {
      console.error('[COMPANION]', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server!.once('error', (err: NodeJS.ErrnoException) => {
      lastError = err.message;
      server = null;
      reject(err);
    });
    server!.listen(currentPort, '0.0.0.0', () => {
      console.log(`[COMPANION] Listening on 0.0.0.0:${currentPort}`);
      resolve();
    });
  });

  return getCompanionStatus();
}

export async function syncCompanionFromSettings(
  getWin: () => BrowserWindow | null
): Promise<CompanionStatus> {
  try {
    const cfg = await getCompanionConfig();
    if (cfg.enabled) {
      return await startCompanionServer(getWin);
    }
    await stopCompanionServer();
    currentToken = cfg.token;
    currentPort = cfg.port;
    return getCompanionStatus();
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error('[COMPANION] sync failed:', lastError);
    return getCompanionStatus();
  }
}

export async function ensureCompanionTokenInState(): Promise<string> {
  const cfg = await getCompanionConfig();
  currentToken = cfg.token;
  currentPort = cfg.port;
  return cfg.token;
}
