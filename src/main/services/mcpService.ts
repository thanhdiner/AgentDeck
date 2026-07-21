import http from 'node:http';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import { readState, writeState, readPaneLog } from './storageService.js';
import type { DeckTask, AssistantMessage, McpClientInfo } from '../../shared/types.js';
import {
  dedupeAssistantReply,
  generateAssistantResponse,
  trimAssistantHistory
} from '../../shared/assistantEngine.js';
import type { StoreContext } from '../../shared/assistantEngine.js';
import { getDbSchema, runDbQuery, logDbAudit } from './databaseService.js';
import { validateSqlQuery } from '../../shared/dbSafety.js';

export const activeClients = new Map<http.ServerResponse, McpClientInfo>();
let serverInstance: http.Server | null = null;
let latestPluginSelection: any = null;

export function getLatestPluginSelection() {
  return latestPluginSelection;
}

export function setLatestPluginSelection(payload: any) {
  latestPluginSelection = payload;
}

export function getActiveMcpClients(): McpClientInfo[] {
  return Array.from(activeClients.values());
}

function notifyClientsChanged() {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.send('mcp:clients-changed', getActiveMcpClients());
    }
  } catch (err) {
    console.error('Failed to notify MCP clients change:', err);
  }
}

interface TerminalLogEntry {
  paneId: string;
  direction: 'input' | 'output';
  text: string;
  timestamp: number;
}

function parseLogEntries(logContent: string, paneId: string): TerminalLogEntry[] {
  return logContent
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return {
          paneId,
          direction: parsed.direction || 'output',
          text: parsed.text || '',
          timestamp: parsed.timestamp || Date.now()
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is TerminalLogEntry => e !== null);
}

function getRecentErrors(entries: TerminalLogEntry[], limit = 8): string[] {
  return entries
    .filter(
      (entry) =>
        entry.direction !== 'input' &&
        /\b(error|failed|exception|traceback|crashed|denied|fatal)\b/i.test(entry.text)
    )
    .slice(-limit)
    .map((e) => e.text);
}

function formatMarkdownContext(activeWorkspaceName: string, context: any): string {
  if (!context) {
    return `# Project Context: ${activeWorkspaceName}\n\nNo project context is generated yet. Run Auto-Scan in AgentDeck.`;
  }
  return [
    `# Project Context: ${activeWorkspaceName}`,
    `*Last Updated: ${new Date(context.updatedAt).toLocaleString()}*`,
    '',
    '## Technology Stack',
    '```',
    context.techStack || 'Not detected',
    '```',
    '',
    '## Directory Structure',
    '```',
    context.folderStructure || 'Not scanned',
    '```',
    '',
    '## Coding Rules & Guidelines',
    context.codingRules || 'No rules detected',
    '',
    '## Project Memory',
    context.projectMemory || 'No memory candidates found'
  ].join('\n');
}

function formatMarkdownTasks(tasks: DeckTask[]): string {
  const todo = tasks.filter(t => t.status === 'todo');
  const running = tasks.filter(t => t.status === 'running');
  const review = tasks.filter(t => t.status === 'review');
  const done = tasks.filter(t => t.status === 'done');

  const renderList = (list: DeckTask[]) => {
    if (list.length === 0) return '_None_';
    return list.map(t => `- [${t.priority || 'medium'}] **${t.title}**: ${t.body.replace(/\n/g, ' ')}`).join('\n');
  };

  return [
    '# Active Workspace Tasks',
    '',
    '### Todo',
    renderList(todo),
    '',
    '### Running',
    renderList(running),
    '',
    '### Review',
    renderList(review),
    '',
    '### Done',
    renderList(done)
  ].join('\n');
}

export function startMcpServer(port: number, triggerReload: () => void) {
  if (serverInstance) {
    return;
  }

  serverInstance = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url || '', `http://localhost:${port}`);

    // Endpoint 1: Quick check GET /context
    if (url.pathname === '/context' && req.method === 'GET') {
      try {
        const state = await readState();
        const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
        if (!activeWorkspace) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No active workspace found' }));
          return;
        }

        const tasks = state.tasks.filter(t => {
          if (!t.paneId) return true;
          return activeWorkspace.panes[t.paneId] !== undefined;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          workspaceName: activeWorkspace.name,
          rootPath: activeWorkspace.rootPath,
          context: activeWorkspace.context || null,
          tasks
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // Endpoint 2: SSE GET /sse
    if (url.pathname === '/sse' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const userAgent = req.headers['user-agent'] || '';
      let name = 'Generic MCP Client';
      if (userAgent.includes('Cursor')) {
        name = 'Cursor';
      } else if (userAgent.includes('Claude')) {
        name = 'Claude Desktop';
      } else if (userAgent.includes('vscode')) {
        name = 'VS Code';
      }

      const clientInfo: McpClientInfo = {
        id: crypto.randomUUID(),
        name,
        connectedAt: Date.now(),
        userAgent
      };

      activeClients.set(res, clientInfo);
      notifyClientsChanged();

      req.on('close', () => {
        activeClients.delete(res);
        notifyClientsChanged();
      });

      // Send endpoint configuration redirect event
      res.write('event: endpoint\n');
      res.write(`data: http://localhost:${port}/message\n\n`);
      return;
    }

    // Endpoint 3: POST /message (JSON-RPC MCP messages)
    if (url.pathname === '/message' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          if (payload.jsonrpc !== '2.0') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON-RPC protocol version' }));
            return;
          }

          const response = await handleMcpRequest(payload, triggerReload);
          
          // Send back HTTP response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));

          // Also publish over SSE to all connected clients
          for (const [clientRes] of activeClients.entries()) {
            if (!clientRes.writableEnded) {
              clientRes.write(`data: ${JSON.stringify(response)}\n\n`);
            }
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to process request payload' }));
        }
      });
      return;
    }

    // Endpoint 4: POST /figma/selection (Figma plugin node selection receiver)
    if (url.pathname === '/figma/selection' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          if (!body.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request body is empty' }));
            return;
          }

          const payload = JSON.parse(body);
          
          // Validate payload structure
          if (payload.source !== 'figma-plugin') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid source. Expected "figma-plugin".' }));
            return;
          }

          if (!payload.nodeId || typeof payload.nodeId !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing or invalid nodeId' }));
            return;
          }

          if (!payload.selectionUrl || typeof payload.selectionUrl !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing or invalid selectionUrl' }));
            return;
          }

          console.log(`[FIGMA PLUGIN RECEIVER] Received figma plugin selection node ID: ${payload.nodeId}, url: ${payload.selectionUrl}`);

          // Cache the latest plugin selection locally to support high fidelity mock context resolution
          setLatestPluginSelection(payload);

          // Forward selection payload to Electron renderer process
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            // Only restore, show, and focus window if it's NOT an auto-send trigger (prevent focus-stealing)
            if (payload.trigger !== 'auto') {
              if (win.isMinimized()) {
                win.restore();
              }
              win.show();
              win.focus();
            }
            win.webContents.send('figma:plugin-selection', payload);
            console.log(`[FIGMA PLUGIN RECEIVER] Successfully forwarded ${payload.trigger || 'manual'} payload to renderer.`);
          } else {
            console.warn('[FIGMA PLUGIN RECEIVER] Warning: No active BrowserWindow found to receive figma selection.');
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: 'Selection successfully received by AgentDeck.' }));
        } catch (err: any) {
          console.error('[FIGMA PLUGIN RECEIVER] Failed to process plugin selection:', err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Malformed JSON payload: ${err.message || err}` }));
        }
      });
      return;
    }

    // Default: 404
    res.writeHead(404);
    res.end();
  });

  serverInstance.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MCP SERVER] Port ${port} is already in use. Skipping MCP server start.`);
      serverInstance = null;
    } else {
      console.error('[MCP SERVER] Server error:', err);
    }
  });

  serverInstance.listen(port, 'localhost', () => {
    console.log(`[MCP SERVER] Listening on http://localhost:${port}`);
  });
}

async function handleMcpRequest(request: any, triggerReload: () => void): Promise<any> {
  const { method, id, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            resources: {},
            tools: {}
          },
          serverInfo: {
            name: 'agentdeck-mcp-server',
            version: '1.0.0'
          }
        }
      };

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'agentdeck://active-workspace/context',
              name: 'Active Workspace Context',
              description: 'Shared codebase architecture, folder structure, tech stack, rules, and notes',
              mimeType: 'text/markdown'
            },
            {
              uri: 'agentdeck://active-workspace/tasks',
              name: 'Active Workspace Task Board',
              description: 'List of all tasks on the current workspace Kanban board',
              mimeType: 'text/markdown'
            }
          ]
        }
      };

    case 'resources/read': {
      const uri = params?.uri;
      const state = await readState();
      const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);

      if (!activeWorkspace) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'No active workspace open' }
        };
      }

      if (uri === 'agentdeck://active-workspace/context') {
        const text = formatMarkdownContext(activeWorkspace.name, activeWorkspace.context);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [{ uri, mimeType: 'text/markdown', text }]
          }
        };
      }

      if (uri === 'agentdeck://active-workspace/tasks') {
        const workspacePaneIds = new Set(Object.keys(activeWorkspace.panes));
        const tasks = state.tasks.filter(t => t.paneId === null || workspacePaneIds.has(t.paneId));
        const text = formatMarkdownTasks(tasks);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [{ uri, mimeType: 'text/markdown', text }]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Resource uri '${uri}' not recognized` }
      };
    }

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_project_context',
              description: 'Retrieve the active workspace tech stack, directory tree, rules, and memory.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'get_task_board',
              description: 'Retrieve all Kanban tasks registered in the active workspace.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'add_task',
              description: 'Add a new developer task to the active workspace task board in AgentDeck.',
              inputSchema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Brief summary of the developer task' },
                  body: { type: 'string', description: 'Detailed instruction, goals, or prompt for the task' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' }
                },
                required: ['title']
              }
            },
            {
              name: 'send_assistant_message',
              description: 'Send a message or request to the Central Agent Assistant in AgentDeck.',
              inputSchema: {
                type: 'object',
                properties: {
                  message: { type: 'string', description: 'The query, command, or message text' }
                },
                required: ['message']
              }
            },
            {
              name: 'inspect_database_schema',
              description: 'Retrieve the database tables, columns, and types to understand the project data model.',
              inputSchema: {
                type: 'object',
                properties: {
                  connectionId: { type: 'string', description: 'Optional specific database connection ID' }
                }
              }
            },
            {
              name: 'run_database_query',
              description: 'Execute a read-only SELECT SQL query or authorized database statement.',
              inputSchema: {
                type: 'object',
                properties: {
                  sql: { type: 'string', description: 'The SQL statement to execute' },
                  connectionId: { type: 'string', description: 'Optional specific database connection ID' }
                },
                required: ['sql']
              }
            }
          ]
        }
      };

    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments || {};
      const state = await readState();
      const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);

      if (!activeWorkspace) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: 'No active workspace open' }
        };
      }

      if (name === 'inspect_database_schema') {
        const connId = args.connectionId;
        const dbConnections = activeWorkspace.dbConnections || [];
        const connection = connId ? dbConnections.find(c => c.id === connId) : dbConnections[0];

        if (!connection) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'No active database connection found in workspace.' }
          };
        }

        try {
          const schema = await getDbSchema(connection);
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }] }
          };
        } catch (err: any) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: `Failed to inspect schema: ${err.message}` }
          };
        }
      }

      if (name === 'run_database_query') {
        const sql = args.sql || '';
        const connId = args.connectionId;
        const dbConnections = activeWorkspace.dbConnections || [];
        const connection = connId ? dbConnections.find(c => c.id === connId) : dbConnections[0];

        if (!connection) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'No active database connection found in workspace.' }
          };
        }

        const review = validateSqlQuery(sql, connection.environment, connection.permissionMode);
        if (review.severity === 'block' || review.severity === 'danger' || review.severity === 'review') {
          await logDbAudit(activeWorkspace.id, connection.id, 'agent', sql, 'failed', review.message);
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: `Query execution blocked: ${review.message}` }
          };
        }

        const sqlToExecute = review.suggestedSql || sql;

        try {
          const res = await runDbQuery(connection, sqlToExecute);
          await logDbAudit(activeWorkspace.id, connection.id, 'agent', sqlToExecute, 'success');
          return {
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(res.rows, null, 2) }] }
          };
        } catch (err: any) {
          await logDbAudit(activeWorkspace.id, connection.id, 'agent', sqlToExecute, 'failed', err.message);
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: `Database execution error: ${err.message}` }
          };
        }
      }

      if (name === 'get_project_context') {
        const text = formatMarkdownContext(activeWorkspace.name, activeWorkspace.context);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] }
        };
      }

      if (name === 'get_task_board') {
        const workspacePaneIds = new Set(Object.keys(activeWorkspace.panes));
        const tasks = state.tasks.filter(t => t.paneId === null || workspacePaneIds.has(t.paneId));
        const text = formatMarkdownTasks(tasks);
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text }] }
        };
      }

      if (name === 'add_task') {
        const title = (args.title || '').trim();
        const body = (args.body || '').trim();
        const priority = args.priority || 'medium';

        if (!title) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Task title is required' }
          };
        }

        const newTask: DeckTask = {
          id: `task-${crypto.randomUUID()}`,
          title,
          body,
          status: 'todo',
          paneId: state.activePaneId || null,
          agentId: null,
          priority,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await writeState({
          ...state,
          tasks: [newTask, ...state.tasks]
        });

        triggerReload();

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Task '${title}' created successfully and added to the todo column.` }]
          }
        };
      }

      if (name === 'send_assistant_message') {
        const message = (args.message || '').trim();

        if (!message) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: 'Message content is required' }
          };
        }

        let recentErrors: string[] = [];
        try {
          const paneIds = Object.keys(activeWorkspace.panes || {});
          const allEntries: TerminalLogEntry[] = [];
          for (const paneId of paneIds) {
            const rawLog = await readPaneLog(paneId);
            if (rawLog) {
              allEntries.push(...parseLogEntries(rawLog, paneId));
            }
          }
          allEntries.sort((a, b) => a.timestamp - b.timestamp);
          recentErrors = getRecentErrors(allEntries);
        } catch (err) {
          console.error('Failed to read workspace logs in MCP:', err);
        }

        const activePane = state.activePaneId ? activeWorkspace.panes[state.activePaneId] : null;
        const runningAgentsCount = state.agentRuns.filter((r) => r.status === 'running').length;

        const storeContext: StoreContext = {
          activeWorkspaceName: activeWorkspace.name,
          activeWorkspacePath: activeWorkspace.rootPath,
          activePaneId: state.activePaneId,
          activePaneTitle: activePane ? activePane.title : null,
          tasks: state.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            body: t.body || '',
            status: t.status,
            priority: t.priority || 'medium'
          })),
          agentProfiles: state.agentProfiles.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description || ''
          })),
          runningAgentsCount,
          recentErrors
        };

        const userMsg: AssistantMessage = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          role: 'user',
          content: message,
          timestamp: Date.now()
        };

        const currentMessages = Array.isArray(state.assistantMessages) ? state.assistantMessages : [];
        const assistantMsg = dedupeAssistantReply(
          generateAssistantResponse(message, storeContext),
          currentMessages
        );
        const messages = trimAssistantHistory([...currentMessages, userMsg, assistantMsg]);

        await writeState({
          ...state,
          assistantMessages: messages
        });

        triggerReload();

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: assistantMsg.content
              }
            ]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Tool '${name}' not found` }
      };
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method '${method}' not found` }
      };
  }
}
